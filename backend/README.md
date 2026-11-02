# SmallWebReader — Backend

Node.js + TypeScript backend for SmallWebReader, providing safe web content reading, bounded proxying, and privacy-preserving feed discovery.

## Prerequisites
- Node.js 20 LTS or later
- npm

## Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env if you need a different port or CORS origin
```

## Run (development — hot-reload)

```bash
npm run dev
```

Server starts on `http://localhost:3001` by default.

## Build (production)

```bash
npm run build
npm start
```

## Run tests

### Unit tests

Runs all mocked unit tests (requires no external services or live database):

```bash
npm test
```

### Smoke tests (quick verification)

Run the fast, local API smoke tests:

```bash
npm run test:smoke
```

By default, smoke tests run entirely locally in-process without requiring external internet access.

To optionally verify fetching a live public URL end-to-end, set `SMOKE_TEST_URL`:

```bash
# Optional live verification:
$env:SMOKE_TEST_URL="https://example.com"
npm run test:smoke
```

### Live PostgreSQL integration tests

To test database transactions, pair counters, rate limiting, and migrations against a **real PostgreSQL instance**:

1. Create a dedicated test database (never use production).
2. Set `TEST_DATABASE_URL`:
   ```bash
   $env:TEST_DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/smallwebreader_test"
   ```
3. Run the integration test suite:
   ```bash
   npm run test:integration
   ```

*Note: If `TEST_DATABASE_URL` is omitted, the integration test suite is safely skipped.*

## Environment variables

See `.env.example` for all supported variables and their defaults.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Port the backend listens on |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `DATABASE_URL` | None | PostgreSQL connection string (Supabase compatible) |
| `DATABASE_MAX_POOL_SIZE` | `10` | Maximum connections in the pool |
| `DATABASE_SSL` | `false` | Enable SSL for remote/hosted databases |
| `RATE_LIMIT_HMAC_SECRET` | None | Secret key used to hash client IPs with HMAC-SHA256 |

## Database migrations

Database migrations reside in `backend/migrations/` and define the privacy-preserving discovery tables.

To run migrations against the database specified in `.env`:

```bash
npm run migrate
```

## Implemented API Endpoints

### 1. `GET /health`
Liveness check confirming that the server is active.

- **Request Body:** None
- **Response `200 OK`:**
  ```json
  {
    "status": "ok"
  }
  ```

### 2. `POST /api/read`
Safely fetches a publicly accessible webpage, guards against SSRF, redirects, oversized payloads, and timeouts, and returns sanitized semantic article HTML using Mozilla Readability with a cleaned publisher-container fallback.

- **Request Headers:** `Content-Type: application/json`
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
    "contentType": "html",
    "content": "<h2>Article section</h2><p>Extracted article content...</p>"
  }
  ```

### 3. `GET /api/fetch`
Safely fetches public RSS, Atom, XML feeds, or HTML homepages for client-side feed autodiscovery and parsing. Returns an inert JSON structure with `X-Content-Type-Options: nosniff` and CSP headers to prevent XSS.

- **Query Parameters:** `url` (e.g. `/api/fetch?url=https://example.com/feed.xml`)
- **Response `200 OK`:**
  ```json
  {
    "url": "https://example.com/feed.xml",
    "contentType": "application/rss+xml; charset=utf-8",
    "content": "<?xml version=\"1.0\"?>..."
  }
  ```
- **Error Response Format:**
  ```json
  {
    "error": {
      "code": "INVALID_URL",
      "message": "Enter a valid public webpage URL."
    }
  }
  ```
  Possible Error Codes:
  - `400 INVALID_URL`: Malformed URL or non-HTTP/HTTPS protocol.
  - `422 VALIDATION_ERROR`: Missing or invalid `url` parameter.
  - `403 URL_NOT_ALLOWED`: Target resolves to localhost, private/link-local/internal IP, or cloud metadata service.
  - `502 PAGE_FETCH_FAILED`: Host not found, upstream non-2xx status, unsupported content type, or excessive redirects.
  - `504 FETCH_TIMEOUT`: Request to target URL timed out.
  - `500 INTERNAL_ERROR`: Unexpected internal failure (never leaks stack traces).

## Discovery Endpoints

The discovery endpoints use PostgreSQL by default. Demo discovery is enabled only with `USE_DEMO_DISCOVERY=true`; database errors return an error response and never fall back to fixtures. Popularity excludes synthetic seed-directory rows and remains empty until genuine aggregate contributions exist.
- `POST /api/discovery/query` — Deterministic feed recommendations with a minimum support threshold.
- `POST /api/discovery/submit` — Explicitly consented aggregate feed contributions; disabled in demo mode.
- `GET /api/discovery/popular` — Genuine aggregate popularity.
