# SmallWebReader — Tasks & Roadmap

> Status labels: `DONE (TESTED)`, `TODO`, `BLOCKED`.

## Implementation roadmap (Ordered dependencies)

```text
Phase 1: Backend Foundation & Safe Reading (DONE)
   |
Phase 2: Discovery & Fetch Contract Finalization (Current Priority)
   |
Phase 3: Database Foundation & Migrations (PostgreSQL/Supabase)
   |
Phase 4: Safe Fetch Proxy Endpoint (GET /api/fetch)
   |
Phase 5: Popular Feed Directory (GET /api/discovery/popular)
   |
Phase 6: Consented Contribution Endpoint (POST /api/discovery/submit)
   |
Phase 7: Recommendation Engine (POST /api/discovery/query)
   |
Phase 8: Security Regression & Load Testing
   |
Phase 9: Integration with Frontend
```

---

## Task board

### 1. Backend Foundation (Phase 1 — Complete)
| Task | Owner | Status | Notes |
|---|---|---|---|
| Initialize Node.js + TypeScript skeleton | Backend owner | DONE (TESTED) | Express, Jest, strict TS |
| Health check endpoint `GET /health` | Backend owner | DONE (TESTED) | Liveness test passing |
| Safe URL reading endpoint `POST /api/read` | Backend owner | DONE (TESTED) | SSRF defense, 10s timeout, 5MB limit |
| Comprehensive test suite & local smoke tests | Backend owner | DONE (TESTED) | 40 unit/integration tests + smoke runner |

### 2. Contract & Architecture Finalization (Phase 2)
| Task | Owner | Status | Notes |
|---|---|---|---|
| Specify JSON schemas for `POST /api/discovery/query` | Whole team | BLOCKED | Define request/response fields & max query size |
| Specify JSON schemas for `POST /api/discovery/submit` | Whole team | BLOCKED | Define batch structure & consent contract |
| Specify schema for `GET /api/discovery/popular` | Whole team | BLOCKED | Define category/limit query parameters |
| Specify response format for `GET /api/fetch` | Whole team | BLOCKED | Decide raw XML stream vs JSON payload |
| Define URL canonicalization rules | Whole team | DONE (TESTED) | Conservative rules implemented in `canonicalUrl.ts` |

### 3. Database Layer (Phase 3)
| Task | Owner | Status | Notes |
|---|---|---|---|
| Choose PostgreSQL driver / migration tool | Backend owner | DONE (TESTED) | `pg` pool + repeatable `_migrations` runner |
| Implement `canonical_feeds` schema | Backend owner | DONE (TESTED) | Table, indexes, and unique URL constraint |
| Implement `feed_pairs` co-occurrence counters | Backend owner | DONE (TESTED) | Unordered pair constraint & atomic upsert |
| Implement `feed_popularity` counters | Backend owner | DONE (TESTED) | Counter table & update logic |
| Implement ephemeral `rate_limits` table | Backend owner | DONE (TESTED) | HMAC key hashing & 24h retention cleanup |
| Real PostgreSQL integration test suite | Backend owner | DONE (TESTED) | Executes safely when `TEST_DATABASE_URL` is set |

### 4. Discovery & Fetch Endpoints (Phases 4–7)
| Task | Owner | Status | Notes |
|---|---|---|---|
| Implement `GET /api/fetch` | Backend owner | DONE (TESTED) | Safe RSS/Atom/HTML proxy with inert JSON response |
| Implement `GET /api/discovery/popular` | Backend owner | DONE (TESTED) | Paginated seeds and aggregate popularity |
| Implement `POST /api/discovery/submit` | Backend owner | DONE (TESTED) | Consented contribution updating pair counters |
| Implement `POST /api/discovery/query` | Backend owner | DONE (TESTED) | Recommendations with k=3 support threshold |

### 5. Frontend & Integration (Phases 8–9)
| Task | Owner | Status | Notes |
|---|---|---|---|
| Frontend client development (separate laptop) | Frontend owner | IN PROGRESS | HTML, CSS, JS; local IndexedDB storage |
| Cross-laptop CORS & LAN network verification | Both | DONE (TESTED) | Verify connectivity over local network |
| End-to-end integration testing | Both | DONE (TESTED) | Core reading flow + discovery flows |
