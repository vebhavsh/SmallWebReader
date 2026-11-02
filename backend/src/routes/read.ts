import { Router, Request, Response } from 'express';
import { validateUrlInput } from '../urlSecurity';
import { safeFetch } from '../safeFetch';
import { extractContent } from '../extractor';

const router = Router();

/**
 * POST /api/read
 * API_CONTRACT.md §2
 *
 * Request body:  { "url": "https://example.com/article" }
 * Success 200:   article metadata and sanitized semantic HTML content
 * Errors:        { "error": { "code": string, "message": string } }
 */
router.post('/read', async (req: Request, res: Response): Promise<void> => {
  // ── 1. Validate input ────────────────────────────────────────────────────
  const validation = validateUrlInput(req.body?.url);

  if (!validation.valid) {
    const httpStatus = validation.code === 'VALIDATION_ERROR' ? 422
      : validation.code === 'URL_NOT_ALLOWED' ? 403
      : 400;
    res.status(httpStatus).json({ error: { code: validation.code, message: validation.message } });
    return;
  }

  // ── 2. Safe fetch (SSRF-protected, redirect-validating) ─────────────────
  const fetchResult = await safeFetch(validation.url);

  if (!fetchResult.ok) {
    const httpStatus =
      fetchResult.code === 'URL_NOT_ALLOWED' ? 403
      : fetchResult.code === 'FETCH_TIMEOUT' ? 504
      : fetchResult.code === 'PAGE_FETCH_FAILED' ? 502
      : 500;
    res.status(httpStatus).json({ error: { code: fetchResult.code, message: fetchResult.message } });
    return;
  }

  // ── 3. Extract readable content ─────────────────────────────────────────
  const extracted = extractContent(fetchResult.body, fetchResult.finalUrl);
  if (!extracted) {
    res.status(422).json({
      error: {
        code: 'EXTRACTION_FAILED',
        message: 'The publisher page did not contain a readable article. Open the original page or try another article URL.',
      },
    });
    return;
  }

  // ── 4. Return contract-defined shape ────────────────────────────────────
  res.status(200).json({
    url: fetchResult.finalUrl,
    ...extracted,
    contentType: 'html',
  });
});

export default router;
