# SmallWebReader — Test Plan

> Automated coverage for the current implemented endpoints.

## 1. Verified & Automated Test Suites (Current Status)

### A. Health Check (`GET /health`)
- [x] Returns HTTP 200 with `{ "status": "ok" }`.

### B. Safe Read (`POST /api/read`)
- [x] Input validation:
  - [x] Missing `url` rejected with 422 `VALIDATION_ERROR`.
  - [x] Non-string `url` rejected with 422 `VALIDATION_ERROR`.
  - [x] Empty string or whitespace `url` rejected with 422 `VALIDATION_ERROR`.
  - [x] Malformed URLs rejected with 400 `INVALID_URL`.
  - [x] Non-HTTP/HTTPS protocols (`ftp://`, `file://`, `javascript:`, `data:`) rejected with 400 `INVALID_URL`.
- [x] SSRF & Network Security:
  - [x] IPv4 loopback (`127.0.0.1`, `0.0.0.0`) blocked with 403 `URL_NOT_ALLOWED`.
  - [x] Private IPv4 ranges (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) blocked.
  - [x] Link-local / cloud metadata (`169.254.169.254`) blocked.
  - [x] IPv6 loopback (`::1`), link-local (`fe80::/10`), unique-local (`fc00::/7`, `fd00::/8`), and multicast (`ff00::/8`) blocked.
  - [x] IPv4-mapped IPv6 addresses (both dotted and normalized hex) blocked.
  - [x] Domain names resolving to blocked IPs blocked prior to connection.
  - [x] Redirects to private/internal IPs or unsupported schemes blocked.
  - [x] Redirect loop / hop limit (max 5) enforced with 502 `PAGE_FETCH_FAILED`.
- [x] Resource & Content Bounding:
  - [x] Request timeout (10s) enforced with 504 `FETCH_TIMEOUT`.
  - [x] Response size limit (5MB) enforced with 502 `PAGE_FETCH_FAILED`.
  - [x] Non-HTML content types (e.g. `image/png`, `application/json`) rejected with 502 `PAGE_FETCH_FAILED`.
  - [x] Stream errors and remote 5xx handled cleanly with 502.
  - [x] Malformed/unclosed HTML tags stripped without crashing or leaking script contents.
  - [x] Readability extraction preserves article structure, metadata, relative links, and images.
  - [x] Publisher-container and Project Gutenberg fallback extraction preserve long-form text.
  - [x] Scripts, event handlers, and unsafe URL schemes are removed.
  - [x] Empty and navigation-only pages return `EXTRACTION_FAILED`.

### C. Safe Fetch (`GET /api/fetch?url=...`)
- [x] Validates URL query parameter and uses the same SSRF and redirect protections as `/api/read`.
- [x] Permits RSS/Atom XML content types and enforces response-size and timeout bounds.

### D. Discovery
- [x] Development mode uses PostgreSQL when `USE_DEMO_DISCOVERY=false`; demo fixtures require the explicit `true` flag.
- [x] Popular includes only genuine aggregate contributions and returns an honest empty state without data.
- [x] Related excludes followed feeds, applies the `k = 3` co-occurrence threshold, and labels curated directory fallbacks.
- [x] Database failures return useful errors; no fixture fallback is used in live mode.
- [x] Contributions require explicit consent and are disabled in demo mode.

### E. Frontend discovery and reader
- [x] Follow/unfollow refreshes Related/Popular results and persists to the Library.
- [x] Related feed cards validate RSS/Atom content through the safe fetch proxy before enabling Follow.
- [x] RSS channel links and Atom HTML alternate links resolve publisher homepages; candidate homepages are verified as HTML through the safe fetch proxy.
- [x] Related “Open website” links use only verified HTTP(S) publisher homepages, never raw RSS/Atom URLs.
- [x] Missing or unsafe homepage metadata shows a disabled “Website unavailable” action and a useful reason; raw XML is not a primary reader action.
- [x] Verified homepage metadata remains separate from subscription feed URLs; feed metadata checks are cached for the page session.
- [x] Broken/unverified feeds cannot be followed; a verified publisher homepage may still be opened independently.
- [x] Legacy Marginalian and Increment recommendations use publisher-advertised replacement feeds without deleting legacy database rows or subscriptions.
- [x] Feed URLs remain unchanged for subscription, refresh, and follow/unfollow.
- [x] Curated feed cards do not send `.example` sample article URLs to extraction.
- [x] DOMPurify remains enabled and unsafe link/image sources are removed.
- [x] Article structure, lists, quotes, code, images, and tables have reader styling.

### F. Smoke Testing
- [x] In-process local smoke test script (`npm run test:smoke`) verifies core behaviors without internet access.
- [x] Optional live URL testing via `SMOKE_TEST_URL` environment variable.
