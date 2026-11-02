import { Pool, PoolClient } from 'pg';
import { getDatabasePool } from './pool';
import { hashClientIp } from './config';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  remaining: number;
  resetAt: Date;
}

/**
 * Checks and increments an ephemeral hourly rate limit for a client IP.
 * - Raw IPs are never stored; only HMAC-SHA256 hashes are persisted.
 * - Records expire within 24 hours (cleanup deletes expired rows).
 *
 * @param rawIp Client IP address
 * @param limit Max requests permitted within 1 hour
 * @param customPool Optional test pool
 */
export async function checkRateLimit(
  rawIp: string,
  limit: number = 60,
  customPool?: Pool,
): Promise<RateLimitResult> {
  if (process.env.USE_DEMO_DISCOVERY === 'true') {
    return {
      allowed: true,
      currentCount: 0,
      remaining: limit,
      resetAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  const secret = process.env.RATE_LIMIT_HMAC_SECRET || 'dev_ephemeral_hmac_secret_2026';
  const ipHash = hashClientIp(rawIp, secret);

  // Hour-aligned window
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  const expiresAt = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000); // 24-hour retention
  const resetAt = new Date(windowStart.getTime() + 60 * 60 * 1000);

  const pool = customPool || getDatabasePool();

  const query = `
    INSERT INTO rate_limits (ip_hash, window_start, count, expires_at)
    VALUES ($1, $2, 1, $3)
    ON CONFLICT (ip_hash, window_start)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count;
  `;

  const res = await pool.query(query, [ipHash, windowStart, expiresAt]);
  const currentCount = res.rows[0]?.count ?? 1;

  return {
    allowed: currentCount <= limit,
    currentCount,
    remaining: Math.max(0, limit - currentCount),
    resetAt,
  };
}
