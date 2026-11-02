/**
 * Tests for Discovery API Endpoints:
 * - POST /api/discovery/query
 * - POST /api/discovery/submit
 * - GET  /api/discovery/popular
 */

import request from 'supertest';
import app from '../app';
import * as poolModule from '../db/pool';

// Mock getDatabasePool
jest.mock('../db/pool', () => {
  const original = jest.requireActual('../db/pool');
  return {
    ...original,
    getDatabasePool: jest.fn(),
  };
});

describe('Discovery API Layer', () => {
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USE_DEMO_DISCOVERY = 'false';

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue(mockClient),
    };

    (poolModule.getDatabasePool as jest.Mock).mockReturnValue(mockPool);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. POST /api/discovery/submit
  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/discovery/submit', () => {
    it('rejects submission when consent is missing or false', async () => {
      const res = await request(app)
        .post('/api/discovery/submit')
        .send({ feeds: ['https://example.com/feed'] });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CONSENT_REQUIRED');
    });

    it('does not claim to record contributions in explicit demo mode', async () => {
      const originalDemoFlag = process.env.USE_DEMO_DISCOVERY;
      process.env.USE_DEMO_DISCOVERY = 'true';
      try {
        const res = await request(app)
          .post('/api/discovery/submit')
          .send({ consent: true, feeds: ['https://one.example/feed', 'https://two.example/feed'] });

        expect(res.status).toBe(503);
        expect(res.body.error.code).toBe('DEMO_MODE');
        expect(res.body.error.message).toContain('no data was recorded');
        expect(mockPool.connect).not.toHaveBeenCalled();
      } finally {
        process.env.USE_DEMO_DISCOVERY = originalDemoFlag || 'false';
      }
    });

    it('rejects submission when feeds array is missing or empty', async () => {
      const res = await request(app)
        .post('/api/discovery/submit')
        .send({ consent: true, feeds: [] });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects submission when batch exceeds 50 feeds', async () => {
      const manyFeeds = Array.from({ length: 51 }, (_, i) => `https://example.com/feed${i}`);
      const res = await request(app)
        .post('/api/discovery/submit')
        .send({ consent: true, feeds: manyFeeds });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('handles rate limiting (429)', async () => {
      // Mock rate limit count returning > 10
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 11 }] });

      const res = await request(app)
        .post('/api/discovery/submit')
        .send({ consent: true, feeds: ['https://example.com/feed1', 'https://example.com/feed2'] });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('successfully processes consented contribution and updates pairs', async () => {
      // 1. Rate limit query
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });

      // 2. Transaction queries on client
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: '1', canonical_url: 'https://blog1.com/feed' }] }) // insert feed 1
        .mockResolvedValueOnce({ rows: [{ id: '2', canonical_url: 'https://blog2.com/feed' }] }) // insert feed 2
        .mockResolvedValueOnce({}) // popularity feed 1
        .mockResolvedValueOnce({}) // popularity feed 2
        .mockResolvedValueOnce({}) // pair (1, 2)
        .mockResolvedValueOnce({}); // COMMIT

      const res = await request(app)
        .post('/api/discovery/submit')
        .send({
          consent: true,
          feeds: ['https://blog1.com/feed', 'https://blog2.com/feed'],
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('accepted');
      expect(res.body.feedsProcessed).toBe(2);
      expect(res.body.pairsUpdated).toBe(1);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('rolls back transaction on database error', async () => {
      // Rate limit query
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });

      // BEGIN succeeds, next query fails
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('DB failure'));

      const res = await request(app)
        .post('/api/discovery/submit')
        .send({
          consent: true,
          feeds: ['https://blog1.com/feed', 'https://blog2.com/feed'],
        });

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. POST /api/discovery/query
  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/discovery/query', () => {
    it('uses PostgreSQL-backed related data in development when demo mode is false', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      process.env.USE_DEMO_DISCOVERY = 'false';
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: 1 }] }) // persistent rate limit
        .mockResolvedValueOnce({ rows: [{ id: '10', canonical_url: 'https://inputblog.net/feed' }] })
        .mockResolvedValueOnce({
          rows: [{
            canonical_url: 'https://relatedblog.net/feed',
            host: 'relatedblog.net',
            title: 'Related Feed',
            website_url: 'https://relatedblog.net/',
            total_support: '3',
            max_single_support: '3',
          }],
        });

      try {
        const res = await request(app)
          .post('/api/discovery/query')
          .send({ feeds: ['https://inputblog.net/feed'], limit: 1 });
        expect(res.status).toBe(200);
        expect(res.body.recommendations[0].canonicalUrl).toBe('https://relatedblog.net/feed');
        expect(res.body.recommendations[0].websiteUrl).toBe('https://relatedblog.net/');
        expect(res.body.recommendations[0].supportCount).toBe(3);
        expect(mockPool.query.mock.calls[2][0]).toContain("c.canonical_url NOT IN ('https://www.themarginalian.org/feed/', 'https://increment.com/feed/')");
        expect(mockPool.query).toHaveBeenCalledTimes(3);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('rejects when feeds field is not an array', async () => {
      const res = await request(app)
        .post('/api/discovery/query')
        .send({ feeds: 'not-an-array' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns labeled curated directory fallback when no input feeds match database', async () => {
      // 1. Rate limit check
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });

      // 2. Feed lookup returns empty
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // 3. Fallback popular seeds query
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            canonical_url: 'https://seedblog.com/feed',
            host: 'seedblog.com',
            title: 'Seed Blog',
            website_url: 'https://seedblog.com/',
          },
        ],
      });

      const res = await request(app)
        .post('/api/discovery/query')
        .send({ feeds: ['https://unknownblog.com/feed'] });

      expect(res.status).toBe(200);
      expect(res.body.recommendations).toHaveLength(1);
      expect(res.body.recommendations[0].canonicalUrl).toBe('https://seedblog.com/feed');
      expect(res.body.recommendations[0].reason).toContain('seed directory');
      expect(res.body.recommendations[0].websiteUrl).toBe('https://seedblog.com/');
    });

    it('enforces k=3 threshold for specific pair-evidence recommendations', async () => {
      // 1. Rate limit check
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });

      // 2. Feed lookup finds feed 10
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: '10', canonical_url: 'https://inputblog.com/feed' }],
      });

      // 3. Co-occurrence query returns 2 candidates (one with support=5, one with support=2)
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            canonical_url: 'https://highsupport.com/feed',
            host: 'highsupport.com',
            title: 'High Support',
            total_support: '5',
            max_single_support: '5',
          },
          {
            canonical_url: 'https://lowsupport.com/feed',
            host: 'lowsupport.com',
            title: 'Low Support',
            total_support: '2',
            max_single_support: '2',
          },
          {
            canonical_url: 'https://example.com/feed.xml',
            host: 'example.com',
            title: 'Reserved Example Feed',
            total_support: '4',
            max_single_support: '4',
          },
        ],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          canonical_url: 'https://directory.example/feed',
          host: 'directory.net',
          title: 'Directory Feed',
        }],
      });

      const res = await request(app)
        .post('/api/discovery/query')
        .send({ feeds: ['https://inputblog.com/feed'], limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.recommendations).toHaveLength(2);

      // Support >= 3 has specific pair-evidence reason
      expect(res.body.recommendations[0].reason).toBe('Frequently followed together with blogs in your feed list');
      expect(res.body.recommendations[1].reason).toContain('seed directory');
      expect(res.body.recommendations[1].supportCount).toBe(0);
      expect(res.body.recommendations.map((item: any) => item.canonicalUrl)).not.toContain('https://lowsupport.com/feed');
      expect(res.body.recommendations.map((item: any) => item.canonicalUrl)).not.toContain('https://example.com/feed.xml');
    });

    it('excludes feeds already in query list', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // feed lookup
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // popular

      const res = await request(app)
        .post('/api/discovery/query')
        .send({ feeds: ['https://myblog.com/feed'] });

      expect(res.status).toBe(200);
      const returnedUrls = res.body.recommendations.map((r: any) => r.canonicalUrl);
      expect(returnedUrls).not.toContain('https://myblog.com/feed');
    });

    it('returns a visible service error instead of demo data when discovery database access fails', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('database connection unavailable'));

      const res = await request(app)
        .post('/api/discovery/query')
        .send({ feeds: ['https://followed.example/feed'] });

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(res.body.error.message).toContain('Related recommendations are temporarily unavailable');
      expect(res.body).not.toHaveProperty('recommendations');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. GET /api/discovery/popular
  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/discovery/popular', () => {
    it('returns paginated popular feeds without requiring contribution', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] }) // COUNT query
        .mockResolvedValueOnce({
          rows: [
            {
              canonical_url: 'https://popularblog1.com/rss',
              host: 'popularblog1.com',
              title: 'Popular One',
              is_seed: false,
              agg_count: '42',
            },
            {
              canonical_url: 'https://popularblog2.com/atom',
              host: 'popularblog2.com',
              title: 'Popular Two',
              is_seed: false,
              agg_count: '18',
            },
          ],
        });

      const res = await request(app).get('/api/discovery/popular?limit=10&offset=0');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.limit).toBe(10);
      expect(res.body.offset).toBe(0);
      expect(res.body.feeds).toHaveLength(2);
      expect(res.body.feeds[0].canonicalUrl).toBe('https://popularblog1.com/rss');
      expect(res.body.feeds[0].aggregateCount).toBe(42);
      expect(res.body.feeds[0].isSeed).toBe(false);
    });

    it('uses the database in development when demo mode is false', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      process.env.USE_DEMO_DISCOVERY = 'false';
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({
          rows: [{
            canonical_url: 'https://genuine.net/feed',
            host: 'genuine.net',
            title: 'Genuine Feed',
            is_seed: false,
            agg_count: '3',
          }],
        });

      try {
        const res = await request(app).get('/api/discovery/popular');
        expect(res.status).toBe(200);
        expect(res.body.feeds[0].aggregateCount).toBe(3);
        expect(poolModule.getDatabasePool).toHaveBeenCalled();
        expect(mockPool.query).toHaveBeenCalledTimes(2);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('returns an honest empty Popular result when there are no genuine contributions', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/discovery/popular');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ feeds: [], total: 0 });
    });

    it('never returns reserved example/test hosts as genuine popularity', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              canonical_url: 'https://example.org/feed.xml',
              host: 'example.org',
              title: 'Reserved Example',
              is_seed: false,
              agg_count: '12',
            },
            {
              canonical_url: 'https://publisher.test/feed',
              host: 'publisher.test',
              title: 'Test Publisher',
              is_seed: false,
              agg_count: '8',
            },
            {
              canonical_url: 'https://publisher.example/feed',
              host: 'publisher.example',
              title: 'Test Domain',
              is_seed: false,
              agg_count: '7',
            },
            {
              canonical_url: 'https://realpublisher.org/feed',
              host: 'realpublisher.org',
              title: 'Real Publisher',
              is_seed: false,
              agg_count: '3',
            },
          ],
        });

      const res = await request(app).get('/api/discovery/popular');
      expect(res.status).toBe(200);
      expect(res.body.feeds.map((feed: any) => feed.host)).toEqual(['realpublisher.org']);
      expect(mockPool.query.mock.calls[0][0]).toContain('example');
      expect(mockPool.query.mock.calls[1][0]).toContain('example');
    });

    it('returns safe error when database query fails without leaking details', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Connection refused'));

      const res = await request(app).get('/api/discovery/popular');
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(res.body.error.message).toContain('discovery database could not be reached');
      expect(res.body).not.toHaveProperty('stack');
    });

    it('uses explicitly opted-in demo recommendations without fake support counts', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalDemoFlag = process.env.USE_DEMO_DISCOVERY;
      process.env.NODE_ENV = 'development';
      process.env.USE_DEMO_DISCOVERY = 'true';
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });

      try {
        const res = await request(app)
          .post('/api/discovery/query')
          .send({ feeds: ['https://my-feed.example/rss'] });
        expect(res.status).toBe(200);
        expect(res.body.recommendations[0].reason).toContain('Demo directory entry');
        expect(res.body.recommendations[0].supportCount).toBe(0);
        const popular = await request(app).get('/api/discovery/popular');
        expect(popular.status).toBe(200);
        expect(popular.body).toMatchObject({ feeds: [], total: 0 });
        expect(mockPool.query).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        process.env.USE_DEMO_DISCOVERY = originalDemoFlag || 'false';
      }
    });
  });
});
