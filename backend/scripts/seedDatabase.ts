import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const FEEDS = [
  { canonical_url: 'https://feeds.feedburner.com/brainpickings/rss', host: 'themarginalian.org', title: 'The Marginalian', website_url: 'https://www.themarginalian.org/', is_seed: true },
  { canonical_url: 'https://daringfireball.net/feeds/main', host: 'daringfireball.net', title: "Daring Fireball", website_url: 'https://daringfireball.net/', is_seed: true },
  { canonical_url: 'https://simonwillison.net/atom/everything/', host: 'simonwillison.net', title: "Simon Willison's Weblog", website_url: 'https://simonwillison.net/', is_seed: true },
  { canonical_url: 'https://jvns.ca/atom.xml', host: 'jvns.ca', title: "Julia Evans' Blog", website_url: 'https://jvns.ca/', is_seed: true },
  { canonical_url: 'https://danluu.com/atom.xml', host: 'danluu.com', title: "Dan Luu's Blog", website_url: 'https://danluu.com/', is_seed: true },
  { canonical_url: 'https://increment.com/feed.xml', host: 'increment.com', title: 'Increment', website_url: 'https://increment.com/', is_seed: true },
  { canonical_url: 'https://css-tricks.com/feed/', host: 'css-tricks.com', title: 'CSS-Tricks', website_url: 'https://css-tricks.com/', is_seed: true },
  { canonical_url: 'https://www.oldeuropeanculture.com/feed/', host: 'oldeuropeanculture.com', title: 'Old European Culture', website_url: null, is_seed: true },
  { canonical_url: 'https://www.wilwheaton.net/feed/', host: 'wilwheaton.net', title: 'Wil Wheaton', website_url: 'https://wilwheaton.net/', is_seed: true },
  { canonical_url: 'https://www.aaronsw.com/2002/feeds/atom.xml', host: 'aaronsw.com', title: 'Aaron Swartz Archive', website_url: null, is_seed: true },
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('[seed] DATABASE_URL is not configured; skipping database seed execution.');
    return;
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query('BEGIN');

    for (const feed of FEEDS) {
      await client.query(
        `INSERT INTO canonical_feeds (canonical_url, host, title, website_url, is_seed)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (canonical_url) DO UPDATE SET host = EXCLUDED.host, title = EXCLUDED.title, website_url = COALESCE(EXCLUDED.website_url, canonical_feeds.website_url), is_seed = EXCLUDED.is_seed;`,
        [feed.canonical_url, feed.host, feed.title, feed.website_url, feed.is_seed],
      );
    }

    await client.query('COMMIT');
    console.log(`[seed] Inserted ${FEEDS.length} development seed feeds into canonical_feeds.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed] Failed to insert demo data:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
