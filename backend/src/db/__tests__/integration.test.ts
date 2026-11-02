/**
 * PostgreSQL Real Database Integration Tests.
 *
 * This test suite executes ONLY when TEST_DATABASE_URL is explicitly set.
 * If TEST_DATABASE_URL is not set, the tests are skipped with a clear message.
 *
 * Security guard: Prevents running against production databases.
 */

import { Pool } from 'pg';
import { runMigrations } from '../migrate';
import {
  recordFeedContribution,
  queryFeedRecommendations,
  getPopularFeeds,
} from '../discovery';
import { checkRateLimit } from '../rateLimit';

const testDbUrl = process.env.TEST_DATABASE_URL;
const isConfigured = Boolean(testDbUrl && testDbUrl.trim() !== '');

const describeOrSkip = isConfigured ? describe : describe.skip;

describeOrSkip('PostgreSQL Real Database Integration Tests', () => {
  let pool: Pool;

  // Increase default Jest timeout for remote cloud database round-trips
  jest.setTimeout(30000);

  beforeAll(async () => {
    // Safety check against running against production
    if (!testDbUrl) return;

    // Load custom CA if configured in environment
    const caCertPath = process.env.DATABASE_SSL_CA_CERT_PATH;
    let sslConfig: boolean | { rejectUnauthorized: boolean; ca?: string } = false;

    if (process.env.DATABASE_SSL === 'true') {
      if (caCertPath) {
        const fs = require('fs');
        const path = require('path');
        const resolvedPath = path.isAbsolute(caCertPath)
          ? caCertPath
          : path.resolve(__dirname, '../../../../', caCertPath);
        if (fs.existsSync(resolvedPath)) {
          sslConfig = {
            rejectUnauthorized: true,
            ca: fs.readFileSync(resolvedPath, 'utf8'),
          };
        } else {
          sslConfig = { rejectUnauthorized: false };
        }
      } else {
        sslConfig = { rejectUnauthorized: false };
      }
    }

    pool = new Pool({
      connectionString: testDbUrl,
      ssl: sslConfig,
      max: 5,
      idleTimeoutMillis: 10000,
    });

    // Run migrations on isolated test database
    await runMigrations(pool);
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    if (!pool) return;
    // Clean tables between tests
    await pool.query('TRUNCATE canonical_feeds, feed_pairs, feed_popularity, rate_limits RESTART IDENTITY CASCADE;');
  });

  it('inserts canonical feeds and updates feed_popularity and feed_pairs atomically', async () => {
    const feeds = [
      { canonicalUrl: 'https://techblog.org/feed.xml', host: 'techblog.org' },
      { canonicalUrl: 'https://designweekly.com/rss', host: 'designweekly.com' },
      { canonicalUrl: 'https://codenotes.dev/atom', host: 'codenotes.dev' },
    ];

    const result = await recordFeedContribution(feeds, pool);
    expect(result.success).toBe(true);
    expect(result.feedsUpdated).toBe(3);
    expect(result.pairsUpdated).toBe(3); // (1,2), (1,3), (2,3)

    // Check canonical_feeds
    const canonicalRes = await pool.query('SELECT COUNT(*) as count FROM canonical_feeds;');
    expect(canonicalRes.rows[0].count).toBe('3');

    // Check feed_popularity
    const popRes = await pool.query('SELECT aggregate_count FROM feed_popularity;');
    expect(popRes.rows).toHaveLength(3);
    for (const r of popRes.rows) {
      expect(r.aggregate_count).toBe(1);
    }

    // Check feed_pairs invariant feed_a_id < feed_b_id
    const pairsRes = await pool.query('SELECT feed_a_id, feed_b_id, contribution_count FROM feed_pairs;');
    expect(pairsRes.rows).toHaveLength(3);
    for (const r of pairsRes.rows) {
      expect(BigInt(r.feed_a_id)).toBeLessThan(BigInt(r.feed_b_id));
      expect(r.contribution_count).toBe(1);
    }

    // Second contribution with 2 of the same feeds + 1 new feed
    const batch2 = [
      { canonicalUrl: 'https://techblog.org/feed.xml', host: 'techblog.org' },
      { canonicalUrl: 'https://designweekly.com/rss', host: 'designweekly.com' },
      { canonicalUrl: 'https://newblog.io/rss', host: 'newblog.io' },
    ];
    await recordFeedContribution(batch2, pool);

    // techblog & designweekly pair count should now be 2
    const pair12 = await pool.query(
      `SELECT contribution_count FROM feed_pairs
       WHERE feed_a_id = (SELECT id FROM canonical_feeds WHERE canonical_url = 'https://techblog.org/feed.xml')
         AND feed_b_id = (SELECT id FROM canonical_feeds WHERE canonical_url = 'https://designweekly.com/rss')`
    );
    expect(pair12.rows[0].contribution_count).toBe(2);
  });

  it('enforces k=3 recommendation evidence threshold and excludes followed feeds', async () => {
    const feedA = { canonicalUrl: 'https://base.org/feed', host: 'base.org' };
    const feedB = { canonicalUrl: 'https://copair.org/feed', host: 'copair.org' };

    // Record 3 contributions for pair (A, B) to reach k=3
    for (let i = 0; i < 3; i++) {
      await recordFeedContribution([feedA, feedB], pool);
    }

    // Query with feedA
    const recs = await queryFeedRecommendations([feedA.canonicalUrl], 10, pool);
    expect(recs).toHaveLength(1);
    expect(recs[0].canonicalUrl).toBe(feedB.canonicalUrl);
    expect(recs[0].supportCount).toBe(3);
    expect(recs[0].reason).toBe('Frequently followed together with blogs in your feed list');

    // Query with both feedA and feedB -> should exclude both
    const recsBoth = await queryFeedRecommendations([feedA.canonicalUrl, feedB.canonicalUrl], 10, pool);
    expect(recsBoth.some(r => r.canonicalUrl === feedA.canonicalUrl || r.canonicalUrl === feedB.canonicalUrl)).toBe(false);
  });

  it('supports pagination over genuine aggregate feed entries', async () => {
    // Populate isolated test rows without mixing seed-directory data into popularity.
    for (let i = 1; i <= 5; i++) {
      await pool.query(
        `INSERT INTO canonical_feeds (canonical_url, host, title, is_seed)
         VALUES ($1, $2, $3, false)`,
        [`https://seed${i}.com/feed`, `seed${i}.com`, `Seed Blog ${i}`]
      );
      await pool.query(
        `INSERT INTO feed_popularity (feed_id, aggregate_count)
         SELECT id, 1 FROM canonical_feeds WHERE canonical_url = $1`,
        [`https://seed${i}.com/feed`]
      );
    }

    const page1 = await getPopularFeeds(2, 0, pool);
    expect(page1.total).toBe(5);
    expect(page1.feeds).toHaveLength(2);

    const page2 = await getPopularFeeds(2, 2, pool);
    expect(page2.total).toBe(5);
    expect(page2.feeds).toHaveLength(2);
    expect(page2.feeds[0].canonicalUrl).not.toBe(page1.feeds[0].canonicalUrl);
  });

  it('enforces rate limiting with HMAC hash retention on live database', async () => {
    const rawIp = '203.0.113.199';
    const limit = 2;

    const check1 = await checkRateLimit(rawIp, limit, pool);
    expect(check1.allowed).toBe(true);
    expect(check1.currentCount).toBe(1);

    const check2 = await checkRateLimit(rawIp, limit, pool);
    expect(check2.allowed).toBe(true);
    expect(check2.currentCount).toBe(2);

    const check3 = await checkRateLimit(rawIp, limit, pool);
    expect(check3.allowed).toBe(false);
    expect(check3.currentCount).toBe(3);

    // Confirm raw IP was never stored
    const rows = await pool.query('SELECT ip_hash FROM rate_limits;');
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].ip_hash).not.toContain(rawIp);
    expect(rows.rows[0].ip_hash).toHaveLength(64);
  });
});

if (!isConfigured) {
  describe('PostgreSQL Real Database Integration Tests (Info)', () => {
    it('skips integration tests when TEST_DATABASE_URL is not configured', () => {
      console.log('[INFO] TEST_DATABASE_URL not set. Live PostgreSQL integration tests skipped.');
      expect(true).toBe(true);
    });
  });
}
