import { Router, Request, Response } from 'express';
import { canonicalizeUrl } from '../canonicalUrl';
import { checkRateLimit } from '../db/rateLimit';
import {
  queryFeedRecommendations,
  recordFeedContribution,
  getPopularFeeds,
} from '../db/discovery';

const router = Router();

// Helper to get client IP
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

/**
 * 1. POST /api/discovery/query
 *
 * Query recommendations based on an existing set of feeds.
 * Request body:
 *   { "feeds": string[], "limit"?: number }
 */
router.post('/query', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawFeeds = req.body?.feeds;
    if (!Array.isArray(rawFeeds)) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'feeds field must be an array of feed URLs.',
        },
      });
      return;
    }

    if (rawFeeds.length > 100) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A maximum of 100 feed URLs may be queried at once.',
        },
      });
      return;
    }

    // Rate limiting: 120 queries/hour per IP hash
    const ip = getClientIp(req);
    const rateCheck = await checkRateLimit(ip, 120);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
        },
      });
      return;
    }

    // Validate and canonicalize input feeds
    const canonicalUrls: string[] = [];
    for (const raw of rawFeeds) {
      const canonical = canonicalizeUrl(raw);
      if (canonical.valid) {
        canonicalUrls.push(canonical.canonicalUrl);
      }
    }

    const limit = Math.min(Math.max(1, parseInt(req.body?.limit || '20', 10)), 50);

    const recommendations = await queryFeedRecommendations(canonicalUrls, limit);

    res.status(200).json({
      recommendations,
      count: recommendations.length,
    });
  } catch (err) {
    // Database error or unexpected failure — never leak stack trace
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Related recommendations are temporarily unavailable because the discovery database could not be reached. Please try again.',
      },
    });
  }
});

/**
 * 2. POST /api/discovery/submit
 *
 * User-consented aggregate contribution batch.
 * Request body:
 *   { "consent": true, "feeds": string[] }
 */
router.post('/submit', async (req: Request, res: Response): Promise<void> => {
  try {
    const consent = req.body?.consent;
    if (consent !== true) {
      res.status(403).json({
        error: {
          code: 'CONSENT_REQUIRED',
          message: 'Contribution requires explicit user consent (consent must be true).',
        },
      });
      return;
    }

    if (process.env.USE_DEMO_DISCOVERY === 'true') {
      res.status(503).json({
        error: {
          code: 'DEMO_MODE',
          message: 'Contribution is disabled in demo mode and no data was recorded.',
        },
      });
      return;
    }

    const rawFeeds = req.body?.feeds;
    if (!Array.isArray(rawFeeds) || rawFeeds.length === 0) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'feeds field must be a non-empty array of feed URLs.',
        },
      });
      return;
    }

    if (rawFeeds.length > 50) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A contribution batch cannot exceed 50 feeds.',
        },
      });
      return;
    }

    // Rate limiting: max 10 contributions per hour per IP hash
    const ip = getClientIp(req);
    const rateCheck = await checkRateLimit(ip, 10);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Contribution rate limit exceeded. Please try again later.',
        },
      });
      return;
    }

    // Canonicalize feeds, deduplicating valid ones
    const feedMap = new Map<string, string>(); // canonicalUrl -> host
    for (const raw of rawFeeds) {
      const canonical = canonicalizeUrl(raw);
      if (canonical.valid) {
        feedMap.set(canonical.canonicalUrl, canonical.host);
      }
    }

    const validUrls = Array.from(feedMap.entries()).map(([canonicalUrl, host]) => ({
      canonicalUrl,
      host,
    }));

    if (validUrls.length === 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_URL',
          message: 'No valid HTTP/HTTPS public feed URLs provided.',
        },
      });
      return;
    }

    const result = await recordFeedContribution(validUrls);

    res.status(200).json({
      status: 'accepted',
      feedsProcessed: result.feedsUpdated,
      pairsUpdated: result.pairsUpdated,
      demoMode: process.env.USE_DEMO_DISCOVERY === 'true',
    });
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server-side failure during feed contribution.',
      },
    });
  }
});

/**
 * 3. GET /api/discovery/popular
 *
 * Browses top aggregate feeds and curated seeds without requiring user contribution.
 * Query params:
 *   limit?: number (default 20, max 50)
 *   offset?: number (default 0)
 */
router.get('/popular', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Math.max(1, parseInt((req.query.limit as string) || '20', 10)), 50);
    const offset = Math.max(0, parseInt((req.query.offset as string) || '0', 10));

    const { feeds, total } = await getPopularFeeds(limit, offset);

    res.status(200).json({
      feeds,
      total,
      limit,
      offset,
    });
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Popular feeds are temporarily unavailable because the discovery database could not be reached. Please try again.',
      },
    });
  }
});

export default router;
