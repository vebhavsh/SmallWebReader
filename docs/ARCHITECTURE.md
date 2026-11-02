# SmallWebReader — Architecture

> **Status:** Current workspace implementation. Core URL reading, PostgreSQL-backed discovery, and explicit demo fixtures are implemented.

## 1. System topology

```text
Browser Client (Separate Workspace / Laptop)
  |-- Local storage: subscriptions, reading history, read/unread status, cached articles
  |-- RSS/Atom XML feed parsing & HTML sanitization
  |
  |-- POST /api/read  (Implemented: safe reading proxy)
  |-- GET  /api/fetch (Implemented: safe feed fetching proxy)
  |-- POST /api/discovery/query  (Implemented: PostgreSQL-backed recommendations)
  |-- POST /api/discovery/submit (Implemented: opted-in aggregate contribution)
  |-- GET  /api/discovery/popular (Implemented: genuine aggregate popularity)
  v
Backend API Service (Node.js + Express + TypeScript)
  |-- URL security: IP validation (IPv4/IPv6 private/link-local/multicast blocks), DNS rebinding guard
  |-- Safe fetch: strict timeouts (10s), bounded size (5MB), redirect hop limit (5)
  |-- Extractor: Mozilla Readability + cleaned publisher-container fallback; sanitized semantic HTML
  v
Database (PostgreSQL / Supabase)
  |-- Canonical feed directory
  |-- Aggregate pair co-occurrence counters
  |-- Aggregate feed popularity counters
  |-- Ephemeral HMAC-derived rate-limit entries (<= 24h retention)
```

## 2. Technology choices

| Component | Status | Technology Choice |
|---|---|---|
| Backend Runtime & Framework | **Confirmed & Implemented** | Node.js LTS + Express + TypeScript |
| Testing & Verification | **Confirmed & Implemented** | Jest + Supertest + Local Smoke Runner |
| Content Extraction | **Implemented** | `@mozilla/readability` + JSDOM, sanitized semantic HTML |
| Database Engine | **Implemented** | PostgreSQL (Supabase compatible) |
| Recommendation Model | **Implemented** | Transparent co-occurrence (`k = 3`) with labeled directory fallback |
| Frontend | **In progress on separate laptop** | Vanilla JS / modern client-side framework |

## 3. Data model & privacy architecture (Planned)

### Database Entities
1. `canonical_feeds`:
   - Unique canonical feed URL.
   - Public metadata: feed title and separately stored publisher homepage URL (never a substitute for the canonical feed URL).
2. `feed_pairs`:
   - Unordered pair identifiers: `(feed_a_id, feed_b_id)` with `feed_a_id < feed_b_id`.
   - `co_occurrence_count`: aggregate integer incremented during consented contributions.
3. `feed_popularity`:
   - `feed_id`: references `canonical_feeds`.
   - `contribution_count`: aggregate integer count of how many contribution events contained this feed.
4. `rate_limits`:
   - `key_hash`: HMAC-SHA256 of client IP + daily rotating server secret.
   - `counter`: request count in current window.
   - `expires_at`: timestamp <= 24 hours. Expired rows purged automatically.

### Privacy Guarantees
- No user accounts, sessions, or client UUIDs.
- No storage of reading habits, article opens, or bookmarks on the server.
- No persistence of query feeds submitted to `/api/discovery/query`.
- No persistence of raw feed lists submitted to `/api/discovery/submit` (only pair counters are updated in a transaction).

## 4. URL canonicalization engine

The backend applies conservative URL normalization via `canonicalizeUrl` before persisting URLs in `canonical_feeds` or pairing them in `feed_pairs`:
- **Allowed Schemes:** `http:` and `https:` only.
- **Credential Stripping:** Embedded user credentials (`user:pass@host`) are strictly rejected (`400 INVALID_URL`).
- **Host Normalization:** Hostnames and protocols are normalized to lowercase.
- **Port Handling:** Default ports (`:80` for HTTP, `:443` for HTTPS) are removed; non-standard ports are preserved in the host identifier.
- **Fragment Removal:** URL fragments (`#...`) are stripped since fragments are client-only and irrelevant to feeds.
- **Path and Query Preservation:** Path casing, trailing slashes, and query parameters are preserved by default to prevent breaking valid feeds that depend on specific query parameters (e.g. `?format=atom` or `?feed=rss2`).
- **Distinct Paths:** Different feed paths on the same host (e.g. `/feed.xml` vs `/rss`) are treated as distinct canonical feeds.
- **Security Validation:** Every canonicalized URL is validated through the SSRF IP blocklist before any fetch operation.

## 5. Unresolved architectural decisions

1. **Deterministic Recommendation Formula:** The exact scoring combination between pair affinity and global popularity, and tie-breaking criteria.
2. **Proxy Fetch Response Format:** Determining whether `GET /api/fetch` returns raw XML with original content-type or a JSON wrapper.
