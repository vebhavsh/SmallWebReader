# SmallWebReader — Project Specification

> **Status:** Working draft aligned with hackathon product direction. Unresolved implementation details are explicitly labeled for confirmation.

## 1. Project purpose

SmallWebReader is a privacy-conscious reader for independent blogs. It helps users:
- Add a blog or feed URL.
- Find and read RSS/Atom feeds.
- View a unified article timeline.
- Track read/unread states locally.
- Safely read article content stripped of clutter.
- Keep subscriptions, reading state, and cached content exclusively in local browser storage.
- Discover independent blogs via transparent, aggregate recommendations.
- Browse a Popular feed directory that functions without requiring users to contribute data.

> **Note:** The exact organizer-provided problem statement text is not present in the workspace and has not been verified.

## 2. Target users

People seeking a simple, privacy-respecting way to discover, follow, and read independent blogs and web feeds without centralized user tracking, behavioral profiling, or cloud-synced personal reading history.

## 3. Product architecture & storage boundaries

- **Frontend (Browser):**
  - Handles feed parsing (RSS/Atom), timeline rendering, and article presentation.
  - Manages subscriptions, read/unread states, and content caches exclusively in local browser storage (e.g. IndexedDB / localStorage).
  - Explicit user opt-in required before submitting any contribution batch to discovery.
- **Backend (API Service):**
  - Stateless article reading and safe URL proxying (`GET /health`, `POST /api/read`, `GET /api/fetch`).
  - Privacy-preserving discovery service (`POST /api/discovery/query`, `POST /api/discovery/submit`, `GET /api/discovery/popular`).
  - No server-side reader identities, reading histories, or raw query logs.

## 4. Current confirmed MVP vs. Planned roadmap

### Confirmed & Implemented (Backend)
- `GET /health` — liveness check.
- `POST /api/read` — safe fetching and sanitized semantic article extraction with SSRF protections, timeout, and response-size bounds.
- 40 automated tests and local in-process smoke tests.

### Implemented Discovery & Fetch Endpoints
- `GET /api/fetch?url=...` — bounded proxy to fetch public feed/page XML/HTML for client-side parsing.
- `POST /api/discovery/query` — PostgreSQL-backed feed recommendations with minimum support `k = 3` and labeled directory fallback.
- `POST /api/discovery/submit` — optional user-consented batch contribution updating aggregate counts; disabled in explicit demo mode.
- `GET /api/discovery/popular` — genuine opt-in aggregate rankings; empty until eligible contributions exist.

## 5. Explicitly out of scope

Do not implement or plan work around:
- AI-generated summaries, chat/QA, or LLM APIs.
- Vector databases, embeddings, or semantic search.
- Personal Knowledge Vault, notes, or highlights.
- Audio, podcast, or social networking features.
- Cross-feed visual graph visualizers.
- Automatic browsing-history scanning.
- Browser extensions.
- Persistent user accounts, logins, session tokens, or device fingerprinting.
- Complex message queues or distributed infrastructure (e.g. Kafka, Redis).

## 6. Privacy and data rules

- **No Reader Tracking:** No accounts, user IDs, or server-side reading profiles.
- **No Raw Logs:** Never persist raw recommendation query lists or raw contribution batches.
- **Separate Operations:** Recommendation queries (`/query`) and contribution submissions (`/submit`) must be strictly decoupled.
- **Explicit Consent:** Contribution is strictly opt-in and disabled by default.
- **Zero-Contribution Access:** The Popular directory and standard reading features must work completely without contributing feeds.
- **Rate Limiting Privacy:** Never store raw client IP addresses. Any database-backed rate limiting must use HMAC-derived keys with <= 24-hour retention and automated cleanup of expired keys.
- **Operational Reality:** Do not claim "perfect anonymity"; cloud hosting providers maintain standard operational/network logs.

## 7. Planned discovery & database direction

- **Ranking Engine:** Transparent, deterministic ranking based on aggregate co-occurrence counters, not black-box ML.
- **Database Engine:** PostgreSQL (with Supabase as a hosting option), configured through the backend environment.
- **Logical Data Model (4 Tables):**
  1. `canonical_feeds`: Canonical feed URL and limited public feed metadata (title, site URL).
  2. `feed_pairs`: Aggregate co-subscription counts between unordered feed pairs `(feed_a, feed_b)`.
  3. `feed_popularity`: Aggregate contribution-event counts per feed.
  4. `rate_limits`: HMAC-derived rate-limit keys and short-lived counters (<= 24h retention).
- **Recommendation Evidence Rules:**
  - Exclude feeds already in the user's query list.
  - Require minimum support threshold `k = 3` before surfacing pair-based recommendation reasons.
  - Return generic directory reasons when support is below `k = 3`.

## 8. Requirements still needing confirmation

1. The workspace API contract is documented in `docs/API_CONTRACT.md`; future contract changes still require team confirmation.
2. Canonical URL normalization rules (handling query strings, tracking tags, trailing slashes, scheme variations).
3. Exact ranking score formula and normalization math when merging popularity and pair counts.
4. Database column types, constraints, index definitions, and migration strategies.
