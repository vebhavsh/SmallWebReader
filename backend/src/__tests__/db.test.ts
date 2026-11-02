import fs from 'fs';
import path from 'path';
import { validateDatabaseConfig, hashClientIp } from '../db/config';

describe('Database Configuration & Utilities', () => {
  describe('validateDatabaseConfig', () => {
    it('returns configured: false when no env variables are present', () => {
      const res = validateDatabaseConfig({});
      expect(res.configured).toBe(false);
      expect(res.config).toBeUndefined();
    });

    it('returns configured: true when DATABASE_URL is provided', () => {
      const res = validateDatabaseConfig({
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/smallwebreader',
      });
      expect(res.configured).toBe(true);
      expect(res.config?.connectionString).toBe('postgresql://postgres:password@localhost:5432/smallwebreader');
      expect(res.config?.maxPoolSize).toBe(10);
      expect(res.config?.ssl).toBe(false);
    });

    it('supports custom DATABASE_MAX_POOL_SIZE and SSL', () => {
      const res = validateDatabaseConfig({
        DATABASE_URL: 'postgresql://user:pass@ep-test.supabase.co:5432/postgres',
        DATABASE_MAX_POOL_SIZE: '25',
        DATABASE_SSL: 'true',
        DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
      });
      expect(res.configured).toBe(true);
      expect(res.config?.maxPoolSize).toBe(25);
      expect(res.config?.ssl).toEqual({ rejectUnauthorized: false });
    });

    it('returns error when specified CA certificate file is missing', () => {
      const res = validateDatabaseConfig({
        DATABASE_URL: 'postgresql://user:pass@ep-test.supabase.co:5432/postgres',
        DATABASE_SSL: 'true',
        DATABASE_SSL_CA_CERT_PATH: 'nonexistent/path/ca.crt',
      });
      expect(res.configured).toBe(false);
      expect(res.error).toContain('Specified SSL CA certificate file not found');
    });

    it('returns error when DATABASE_MAX_POOL_SIZE is invalid', () => {
      const res = validateDatabaseConfig({
        DATABASE_URL: 'postgresql://localhost/db',
        DATABASE_MAX_POOL_SIZE: '-5',
      });
      expect(res.configured).toBe(false);
      expect(res.error).toContain('DATABASE_MAX_POOL_SIZE');
    });

    it('supports individual PG variables', () => {
      const res = validateDatabaseConfig({
        PGHOST: 'localhost',
        PGDATABASE: 'testdb',
        PGUSER: 'testuser',
        PGPASSWORD: 'secretpassword',
        PGPORT: '5433',
      });
      expect(res.configured).toBe(true);
      expect(res.config?.host).toBe('localhost');
      expect(res.config?.database).toBe('testdb');
      expect(res.config?.user).toBe('testuser');
      expect(res.config?.port).toBe(5433);
    });
  });

  describe('Privacy Utilities: hashClientIp', () => {
    it('generates consistent 64-character SHA-256 hex string', () => {
      const secret = 'test-secret-salt-12345';
      const ip = '198.51.100.42';
      const hash1 = hashClientIp(ip, secret);
      const hash2 = hashClientIp(ip, secret);

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toContain(ip);
    });

    it('produces distinct hashes for distinct IPs', () => {
      const secret = 'test-secret-salt-12345';
      const hashA = hashClientIp('198.51.100.1', secret);
      const hashB = hashClientIp('198.51.100.2', secret);
      expect(hashA).not.toBe(hashB);
    });

    it('throws if HMAC secret is empty', () => {
      expect(() => hashClientIp('127.0.0.1', '')).toThrow('HMAC secret is required');
    });
  });

  describe('Migration Script Syntax & Integrity', () => {
    it('verifies migration 001 exists and contains all required tables and constraints', () => {
      const migrationFile = path.resolve(__dirname, '../../migrations/001_initial_discovery_schema.sql');
      expect(fs.existsSync(migrationFile)).toBe(true);

      const sql = fs.readFileSync(migrationFile, 'utf8');

      // Table existence
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS canonical_feeds');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS feed_pairs');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS feed_popularity');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS rate_limits');

      // Required column presence
      expect(sql).toContain('canonical_url TEXT NOT NULL UNIQUE');
      expect(sql).toContain('is_seed BOOLEAN NOT NULL DEFAULT FALSE');
      expect(sql).toContain('eligible_at TIMESTAMPTZ');
      expect(sql).toContain('feed_a_id BIGINT NOT NULL');
      expect(sql).toContain('feed_b_id BIGINT NOT NULL');
      expect(sql).toContain('aggregate_count INTEGER NOT NULL DEFAULT 1');
      expect(sql).toContain('ip_hash CHAR(64) NOT NULL');
      expect(sql).toContain('expires_at TIMESTAMPTZ NOT NULL');

      // Constraint checks: feed_a_id < feed_b_id preventing duplicate/reversed pairs
      expect(sql).toContain('CONSTRAINT chk_feed_order CHECK (feed_a_id < feed_b_id)');
      expect(sql).toContain('CONSTRAINT chk_contribution_count_nonnegative CHECK (contribution_count >= 0)');
      expect(sql).toContain('CONSTRAINT chk_aggregate_count_nonnegative CHECK (aggregate_count >= 0)');
    });

    it('adds separate publisher homepage metadata and preserves legacy feed records', () => {
      const migrationFile = path.resolve(__dirname, '../../migrations/003_feed_homepage_metadata.sql');
      expect(fs.existsSync(migrationFile)).toBe(true);

      const sql = fs.readFileSync(migrationFile, 'utf8');
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS website_url TEXT');
      expect(sql).toContain('https://feeds.feedburner.com/brainpickings/rss');
      expect(sql).toContain('https://increment.com/feed.xml');
      expect(sql).toContain('ON CONFLICT (canonical_url) DO UPDATE');
      expect(sql).not.toMatch(/\bDELETE\s+FROM\s+canonical_feeds/i);
      expect(sql).not.toMatch(/SET\s+canonical_url\s*=/i);
    });

    it('does not overwrite existing homepage metadata with an unverified null seed value', () => {
      const seedFile = path.resolve(__dirname, '../../scripts/seedDatabase.ts');
      const seedScript = fs.readFileSync(seedFile, 'utf8');

      expect(seedScript).toContain(
        'website_url = COALESCE(EXCLUDED.website_url, canonical_feeds.website_url)'
      );
    });
  });
});
