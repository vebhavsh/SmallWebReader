import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { Readable } from 'stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'zlib';
import { safeResolveHostname, isBlockedAddress } from './urlSecurity';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 10_000;          // 10 s connect + read
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_REDIRECTS = 5;

// Only fetch pages that are likely HTML or XML feeds — no binary blobs, executables, etc.
export const DEFAULT_ALLOWED_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
];

export const FEED_ALLOWED_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'application/rss+xml',
  'application/atom+xml',
  'application/xml',
  'text/xml',
];

// Cloud metadata endpoints — never fetch these.
const BLOCKED_HOSTS = new Set([
  '169.254.169.254',  // AWS / GCP / Azure IMDS
  'metadata.google.internal',
  'fd00:ec2::254',
]);

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface FetchSuccess {
  ok: true;
  finalUrl: string;
  body: string;
  contentType: string;
}

export type FetchErrorCode =
  | 'URL_NOT_ALLOWED'
  | 'PAGE_FETCH_FAILED'
  | 'FETCH_TIMEOUT'
  | 'INTERNAL_ERROR';

export interface FetchFailure {
  ok: false;
  code: FetchErrorCode;
  message: string;
}

export type FetchResult = FetchSuccess | FetchFailure;

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

export interface SafeFetchOptions {
  redirectsLeft?: number;
  allowedContentTypes?: string[];
  acceptHeader?: string;
}

export async function safeFetch(
  initialUrl: URL,
  optionsOrRedirects: SafeFetchOptions | number = MAX_REDIRECTS,
): Promise<FetchResult> {
  const options: SafeFetchOptions =
    typeof optionsOrRedirects === 'number'
      ? { redirectsLeft: optionsOrRedirects }
      : optionsOrRedirects;

  const redirectsLeft = options.redirectsLeft ?? MAX_REDIRECTS;
  const allowedTypes = options.allowedContentTypes ?? DEFAULT_ALLOWED_CONTENT_TYPES;
  const acceptHeader = options.acceptHeader ?? 'text/html,application/xhtml+xml';
  // Block cloud metadata hosts by name before DNS
  if (BLOCKED_HOSTS.has(initialUrl.hostname)) {
    return { ok: false, code: 'URL_NOT_ALLOWED', message: 'That URL targets a private or reserved address.' };
  }

  // Resolve and validate the IP before connecting
  let resolvedIp: string;
  try {
    resolvedIp = await safeResolveHostname(initialUrl.hostname);
  } catch (err: unknown) {
    const e = err as { ssrf?: boolean; fetchFailed?: boolean };
    if (e.ssrf) return { ok: false, code: 'URL_NOT_ALLOWED', message: 'That URL targets a private or reserved address.' };
    return { ok: false, code: 'PAGE_FETCH_FAILED', message: 'Could not resolve the host.' };
  }

  return new Promise<FetchResult>((resolve) => {
    const lib = initialUrl.protocol === 'https:' ? https : http;

    // Build request options; supply the resolved IP as the host to avoid
    // a second DNS lookup (DNS rebinding protection), keeping the original
    // hostname in the Host header for SNI / virtual-hosting.
    const reqOptions: http.RequestOptions = {
      host: resolvedIp,
      port: initialUrl.port || (initialUrl.protocol === 'https:' ? 443 : 80),
      path: initialUrl.pathname + initialUrl.search,
      method: 'GET',
      headers: {
        Host: initialUrl.hostname,
        'User-Agent': 'SmallWebReader/0.1 (safe-fetch)',
        Accept: acceptHeader,
        'Accept-Encoding': 'gzip, deflate, br',
        // Deliberately omit: Cookie, Authorization, X-Forwarded-*, etc.
      },
      timeout: FETCH_TIMEOUT_MS,
      ...(initialUrl.protocol === 'https:' ? { servername: initialUrl.hostname } : {}),
      // Do not let Node follow redirects automatically
    };

    const req = lib.request(reqOptions, (res) => {
      const status = res.statusCode ?? 0;

      // ── Redirect handling ──────────────────────────────────────────────
      if (status >= 300 && status < 400) {
        if (redirectsLeft <= 0) {
          resolve({ ok: false, code: 'PAGE_FETCH_FAILED', message: 'Too many redirects.' });
          return;
        }
        const location = res.headers['location'];
        if (!location) {
          resolve({ ok: false, code: 'PAGE_FETCH_FAILED', message: 'Redirect with no Location header.' });
          return;
        }

        let nextUrl: URL;
        try {
          nextUrl = new URL(location, initialUrl.href);
        } catch {
          resolve({ ok: false, code: 'PAGE_FETCH_FAILED', message: 'Redirect to an invalid URL.' });
          return;
        }

        if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
          resolve({ ok: false, code: 'URL_NOT_ALLOWED', message: 'Redirect to an unsupported scheme.' });
          return;
        }

        // Validate redirect destination IP before following
        safeFetch(nextUrl, {
          redirectsLeft: redirectsLeft - 1,
          allowedContentTypes: allowedTypes,
          acceptHeader,
        })
          .then(resolve)
          .catch(() => {
            resolve({ ok: false, code: 'PAGE_FETCH_FAILED', message: 'Could not fetch redirect target.' });
          });

        res.resume(); // drain and discard the redirect body
        return;
      }

      // ── Non-2xx upstream error ─────────────────────────────────────────
      if (status < 200 || status >= 300) {
        res.resume();
        resolve({ ok: false, code: 'PAGE_FETCH_FAILED', message: `Upstream returned HTTP ${status}.` });
        return;
      }

      // ── Content-type check ────────────────────────────────────────────
      const rawCt = (res.headers['content-type'] ?? '').toLowerCase();
      const allowed = allowedTypes.some((prefix) => rawCt.startsWith(prefix));
      if (!allowed) {
        res.resume();
        resolve({ ok: false, code: 'PAGE_FETCH_FAILED', message: 'Unsupported content type.' });
        return;
      }

      // ── Body collection with size limit ───────────────────────────────
      const chunks: Buffer[] = [];
      let compressedBytes = 0;
      let decodedBytes = 0;
      let settled = false;
      const finish = (result: FetchResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const failForSize = () => {
        if (settled) return;
        req.destroy();
        finish({ ok: false, code: 'PAGE_FETCH_FAILED', message: 'Response exceeds maximum allowed size.' });
      };

      const encodings = (res.headers['content-encoding'] ?? 'identity')
        .split(',')
        .map((encoding) => encoding.trim().toLowerCase())
        .filter((encoding) => encoding && encoding !== 'identity')
        .reverse();

      let decodedStream: Readable = res;
      for (const encoding of encodings) {
        const decoder = encoding === 'gzip' || encoding === 'x-gzip' ? createGunzip()
          : encoding === 'deflate' ? createInflate()
          : encoding === 'br' ? createBrotliDecompress()
          : null;
        if (!decoder) {
          req.destroy();
          finish({ ok: false, code: 'PAGE_FETCH_FAILED', message: 'Unsupported response encoding.' });
          return;
        }
        decoder.on('error', () => {
          if (settled) return;
          req.destroy();
          finish({ ok: false, code: 'PAGE_FETCH_FAILED', message: 'Could not decode compressed response.' });
        });
        decodedStream = decodedStream.pipe(decoder);
      }

      res.on('data', (chunk: Buffer) => {
        compressedBytes += chunk.length;
        if (compressedBytes > MAX_RESPONSE_BYTES) failForSize();
      });

      decodedStream.on('data', (chunk: Buffer) => {
        if (settled) return;
        decodedBytes += chunk.length;
        if (decodedBytes > MAX_RESPONSE_BYTES) {
          failForSize();
          return;
        }
        chunks.push(chunk);
      });

      decodedStream.on('end', () => {
        if (settled) return;
        const body = Buffer.concat(chunks).toString('utf8');
        finish({
          ok: true,
          finalUrl: initialUrl.href,
          body,
          contentType: rawCt,
        });
      });

      res.on('error', () => {
        finish({ ok: false, code: 'PAGE_FETCH_FAILED', message: 'Error reading response.' });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, code: 'FETCH_TIMEOUT', message: 'The request timed out.' });
    });

    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNRESET' || err.message?.includes('socket hang up') || err.message?.includes('aborted')) {
        // Destroyed by us (size limit or timeout already resolved)
        return;
      }
      resolve({ ok: false, code: 'PAGE_FETCH_FAILED', message: 'Could not connect to the host.' });
    });

    req.end();
  });
}
