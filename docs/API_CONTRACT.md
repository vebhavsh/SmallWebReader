# SmallWebReader — API Contract

> **Status:** Current operational endpoints are verified and frozen. Planned endpoints are documented for architecture and contract finalization prior to implementation.

## Contract rules
- Frontend and backend must implement the identical HTTP method, path, field names, status codes, and error shape.
- JSON is used for all request and response bodies unless otherwise specified.
- No authentication or user identity tokens are required.

---

## 1. Health check (Implemented & Verified)

Confirms backend service health and liveness.

- **Method:** `GET`
- **Path:** `/health`
- **Request Body:** None
- **Response `200 OK`:**
  ```json
  {
    "status": "ok"
  }
  ```

---

## 2. Read webpage (Implemented & Verified)

Safely fetches a public webpage and returns sanitized semantic article HTML extracted with Mozilla Readability and a cleaned publisher-container fallback.

- **Method:** `POST`
- **Path:** `/api/read`
- **Content-Type:** `application/json`
- **Request Body:**
  ```json
  {
    "url": "https://example.com/article"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "url": "https://example.com/article",
    "title": "Example Article",
    "byline": "Example Author",
    "excerpt": "Publisher-provided summary",
    "publishedDate": "2025-03-04T10:30:00.000Z",
    "siteName": "Example Publisher",
    "leadImageUrl": "https://example.com/image.jpg",
    "contentType": "html",
    "content": "<h2>Article section</h2><p>Extracted article content...</p>"
  }
  ```

Metadata values may be `null` when the publisher does not provide them. Article HTML preserves semantic structure and is sanitized server-side; the frontend must continue sanitizing it with DOMPurify before rendering. Relative links and images are resolved against the fetched article URL, and only HTTP(S) targets are retained.

- **Extraction Error `422 Unprocessable Entity`:**
  ```json
  {
    "error": {
      "code": "EXTRACTION_FAILED",
      "message": "The publisher page did not contain a readable article. Open the original page or try another article URL."
    }
  }
  ```

---

## 3. Safe proxy fetch (Implemented & Verified)

Safely proxies public feed XML (RSS/Atom) or HTML for client-side feed autodiscovery and parsing. Returns an inert JSON structure to prevent same-origin executable code execution.

- **Method:** `GET`
- **Path:** `/api/fetch?url=...`
- **Query Parameters:**
  - `url` (string, required): The target public webpage or feed URL.
- **Allowed Upstream Content-Types:**
  - `application/rss+xml`, `application/atom+xml`, `application/xml`, `text/xml`, `text/html`, `application/xhtml+xml`
- **Security Headers Returned:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy: default-src 'none'`
- **Response `200 OK`:**
  ```json
  {
    "url": "https://example.com/feed.xml",
    "contentType": "application/rss+xml; charset=utf-8",
    "content": "<?xml version=\"1.0\"?>..."
  }
  ```

---

## 4. Discovery query (Implemented & Verified)

Returns feed recommendations based on aggregate co-occurrence in user contributions.
- Excludes feeds already in the user's query list.
- Enforces minimum support threshold `k = 3` for specific co-occurrence evidence reasons.
- Never persists raw query lists or reader identities.
- Returns the subscription feed URL separately from optional publisher homepage metadata.

- **Method:** `POST`
- **Path:** `/api/discovery/query`
- **Content-Type:** `application/json`
- **Request Body:**
  ```json
  {
    "feeds": [
      "https://example.com/feed.xml"
    ],
    "limit": 20
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "recommendations": [
      {
        "canonicalUrl": "https://otherblog.org/rss",
        "host": "otherblog.org",
        "title": "Other Blog",
        "websiteUrl": "https://otherblog.org/",
        "reason": "Frequently followed together with blogs in your feed list",
        "supportCount": 14
      }
    ],
    "count": 1
  }
  ```
- `websiteUrl` is nullable when no publisher homepage metadata is available. Clients must validate it as an HTTP(S) HTML destination before exposing it as a website link; `canonicalUrl` remains the RSS/Atom subscription URL.

---

## 5. Consented discovery submit (Implemented & Verified)

Accepts an explicitly consented batch of feeds to increment aggregate popularity and unordered pair counts.
- Contribution must be disabled by default; requires `"consent": true`.
- Never persists raw contribution batches or user identities.
- Bounded batch size (maximum 50 feeds).
- Rate limited via HMAC-SHA256 IP hashes.

- **Method:** `POST`
- **Path:** `/api/discovery/submit`
- **Content-Type:** `application/json`
- **Request Body:**
  ```json
  {
    "consent": true,
    "feeds": [
      "https://example.com/feed.xml",
      "https://otherblog.org/rss"
    ]
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "status": "accepted",
    "feedsProcessed": 2,
    "pairsUpdated": 1
  }
  ```
- **Consent Error `403 Forbidden`:**
  ```json
  {
    "error": {
      "code": "CONSENT_REQUIRED",
      "message": "Contribution requires explicit user consent (consent must be true)."
    }
  }
  ```

---

## 6. Popular feed directory (Implemented & Verified)

Returns eligible non-seed feeds with genuine opt-in aggregate contributions. Seed/directory entries are not used as popularity counts. When no eligible contribution aggregates exist, `feeds` is empty and `total` is `0`.

- **Method:** `GET`
- **Path:** `/api/discovery/popular?limit=20&offset=0`
- **Query Parameters:**
  - `limit` (optional integer, default 20, max 50)
  - `offset` (optional integer, default 0)
- **Response `200 OK`:**
  ```json
  {
    "feeds": [
      {
        "canonicalUrl": "https://popularblog.com/feed",
        "host": "popularblog.com",
        "title": "Popular Blog",
        "aggregateCount": 3,
        "isSeed": false
      }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0
  }
  ```

---

## 7. Standard error format (Implemented & Verified)

Consistent error payload returned by all endpoints:

```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "Enter a valid public webpage URL."
  }
}
```

Standard Status Codes:
- `400 INVALID_URL`: Malformed URL or unsupported protocol (non-HTTP/HTTPS).
- `403 CONSENT_REQUIRED`: Submission attempted without explicit user opt-in (`"consent": true`).
- `403 URL_NOT_ALLOWED`: Blocked private, localhost, link-local, multicast, or cloud metadata target.
- `422 VALIDATION_ERROR`: Required fields missing, empty, or incorrect type.
- `422 EXTRACTION_FAILED`: Page fetch succeeded, but no usable article was found.
- `429 RATE_LIMIT_EXCEEDED`: Request threshold exceeded for current hourly window.
- `502 PAGE_FETCH_FAILED`: Host not found, remote 4xx/5xx, unsupported content type, or excessive redirects.
- `504 FETCH_TIMEOUT`: Upstream connection or read exceeded timeout (10s).
- `500 INTERNAL_ERROR`: Internal server failure (never exposes stack traces).
- `422 EXTRACTION_FAILED`: Page fetch succeeded, but neither article extraction nor the safe fallback found usable content.
- `503 DEMO_MODE`: Discovery contribution was not recorded because explicit demo mode is enabled.
