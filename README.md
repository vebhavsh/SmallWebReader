<div align="center">

# SmallWebReader

### A calmer way to follow the independent web.

**Discover independent blogs. Follow RSS/Atom feeds. Read without the noise. Keep your reading life on your device.**

<p>
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=111827" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase--compatible-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Offline--aware-IndexedDB%20%2B%20Service%20Worker-6B7280" alt="Offline aware" />
</p>

[Explore the repository](https://github.com/vebhavsh/SmallWebReader) · [API contract](docs/API_CONTRACT.md) · [Architecture notes](docs/ARCHITECTURE.md)

</div>

---

## The idea

The open web is full of thoughtful independent writing, but reading it often means fighting pop-ups, cluttered layouts, disconnected feeds, and recommendation systems that know more about a reader than they need to.

**SmallWebReader is a privacy-conscious reading workspace for the independent web.** It brings subscriptions, discovery, a clean article reader, and personal reading tools into one interface—while keeping subscriptions and personal reading activity in the browser instead of building a central profile of the reader.

It is designed around three principles:

- **Read, don't wrestle the page.** Extract the article and present its content in a focused, customizable canvas.
- **Your reading life belongs to you.** Bookmarks, followed feeds, reading history, preferences, and article copies are stored locally.
- **Discovery should be explainable.** Recommendations use transparent aggregate feed co-occurrence, with a clearly labelled directory fallback—not opaque personal profiling.

## At a glance

| Area | What it does |
|---|---|
| Reader | Extracts the readable part of a public webpage and presents a clean article view |
| Feed library | Follows RSS/Atom feeds and maintains a local article timeline |
| Discover | Offers related-feed recommendations and a popular-feed directory |
| Personal space | Stores bookmarks, read/unread state, history, goals, streaks, and reading statistics locally |
| Personalization | Provides onboarding, reading preferences, theme presets, animated backgrounds, and soundtrack controls |
| Offline access | Keeps successfully opened article copies in IndexedDB and caches the app shell / same-origin GET responses with a service worker |

---

## Product capabilities

### 1. A focused reading experience

- Submit a public article URL and extract its main content through the backend.
- Use Mozilla Readability, with a cleaned publisher-container fallback for pages Readability cannot confidently parse.
- Preserve useful article structure such as headings, paragraphs, lists, quotations, and supported semantic content.
- Render returned HTML through frontend sanitization with DOMPurify.
- Adjust the reading presentation using reader controls, typography settings, theme presets, and focus mode.
- See reading progress, estimated reading time, and article metadata when the source provides it.

### 2. Independent-web feed library

- Add and follow RSS and Atom feeds.
- Fetch feed documents through the backend's bounded proxy; parse feed XML in the browser.
- Keep the subscription URL separate from an optional publisher homepage URL.
- Refresh followed feeds and build a unified local article timeline.
- Track read and unread articles locally.
- Follow and unfollow feeds without rewriting the original feed URL.

### 3. Feed discovery

- **Related feeds:** recommendations derived from aggregate co-following signals.
- **Popular feeds:** a directory of feeds with genuine opt-in aggregate contribution counts.
- **Curated fallback:** independent-blog directory entries can fill recommendation gaps and are labelled as directory suggestions rather than popularity evidence.
- Exclude feeds already present in the reader's query list.
- Apply a minimum co-occurrence support threshold of **k = 3** before presenting pair-based recommendation evidence.

### 4. A personal reading space

- First-run welcome and onboarding flow, with guest exploration.
- Local reader profile and preferred reading genres / style.
- Dashboard, followed-feed library, bookmarks, reading history, and reading statistics.
- Daily reading goals, minutes / article counts, and reading streak tracking.
- Theme selection, animated theme backgrounds, reading controls, and ambient soundtrack controls.
- Responsive navigation, including a mobile navigation layout.

### 5. Offline-aware reading

SmallWebReader has two separate browser-side offline mechanisms:

1. **Article cache — IndexedDB:** after an article is successfully extracted, its readable content and metadata are saved locally. When a later network request fails, the reader attempts to open the cached copy.
2. **App-shell cache — Service Worker:** the service worker caches the application shell and successful same-origin GET responses, then can serve cached responses when the network is unavailable.

> Offline support is intentionally scoped. Previously cached articles and cached application resources may remain available offline; fresh webpage extraction, feed refresh, and server-backed discovery still require network access. Clearing browser storage can remove local subscriptions, history, bookmarks, preferences, and cached articles.

---

## System architecture

The application is split into a **browser-owned reading layer**, a **small API service**, and a **PostgreSQL aggregate-discovery store**.

```mermaid
flowchart TB
    subgraph Browser["BROWSER — React + TypeScript"]
        UI["Application shell<br/>Onboarding · Dashboard · Reader<br/>Library · Discover · Bookmarks · History · Stats · Settings"]
        Feed["Feed pipeline<br/>RSS / Atom parsing · timeline · read / unread"]
        Sanitize["Content presentation<br/>DOMPurify · reader controls · themes"]
        Local[("localStorage<br/>profile · preferences · followed feeds<br/>bookmarks · history · goals · stats · read state")]
        Cache[("IndexedDB<br/>successfully extracted article copies")]
        SW["Service Worker<br/>app shell + same-origin GET cache"]

        UI --> Feed
        UI --> Sanitize
        UI <--> Local
        UI <--> Cache
        SW -. offline response .-> UI
    end

    subgraph API["BACKEND — Node.js + Express + TypeScript"]
        Routes["HTTP API<br/>GET /health<br/>POST /api/read<br/>GET /api/fetch"]
        Discovery["Discovery routes<br/>POST /api/discovery/query<br/>POST /api/discovery/submit<br/>GET /api/discovery/popular"]
        Guard["Safe URL / fetch boundary<br/>HTTP(S) validation · DNS resolution<br/>private/reserved IP blocking · redirect checks<br/>10s timeout · 5MB response cap · 5 redirects"]
        Extract["Article extraction<br/>Mozilla Readability + JSDOM<br/>clean publisher-container fallback"]
        Routes --> Guard
        Guard --> Extract
    end

    subgraph Data["POSTGRESQL — Supabase compatible"]
        Feeds[("canonical_feeds<br/>canonical feed URL + public metadata")]
        Pairs[("feed_pairs<br/>aggregate co-occurrence counters")]
        Popular[("feed_popularity<br/>aggregate contribution counters")]
        Limits[("rate_limits<br/>HMAC-derived, expiring keys")]
    end

    Feed -->|"GET /api/fetch · feed XML / HTML"| Routes
    UI -->|"POST /api/read · article URL"| Routes
    Extract -->|"sanitized article payload"| Sanitize

    UI -->|"query existing feed URLs"| Discovery
    UI -->|"explicit opt-in contribution"| Discovery
    UI -->|"browse popular feeds"| Discovery
    Discovery --> Feeds
    Discovery --> Pairs
    Discovery --> Popular
    Discovery --> Limits
```

### Request flows

#### Reading an article

```mermaid
sequenceDiagram
    autonumber
    actor Reader
    participant UI as React Reader
    participant API as Express API
    participant Guard as Safe Fetch Boundary
    participant Extract as Readability / JSDOM
    participant IDB as Browser IndexedDB

    Reader->>UI: Submit article URL
    UI->>API: POST /api/read
    API->>Guard: Validate URL and resolve host
    Guard->>Guard: Block private targets and re-check redirects
    Guard->>Extract: Bounded HTML response
    Extract->>Extract: Extract and sanitize article markup
    Extract-->>API: Article content + metadata
    API-->>UI: Structured article response
    UI->>UI: Sanitize for rendering with DOMPurify
    UI->>IDB: Save successful article copy
    UI-->>Reader: Display focused reader view

    Note over UI,IDB: On a later fetch failure, the UI attempts to load the saved article copy.
```

#### Discovery and consent

```mermaid
flowchart LR
    A["Reader's locally held feed list"] --> B["POST /api/discovery/query"]
    B --> C["Canonicalize and match feed URLs"]
    C --> D["Aggregate pair evidence"]
    D --> E{"Support threshold met?<br/>k = 3"}
    E -->|Yes| F["Return related-feed evidence"]
    E -->|"No / remaining slots"| G["Return labelled curated directory entries"]

    H["Reader explicitly opts in"] --> I["POST /api/discovery/submit"]
    I --> J["Validate consent + rate limit"]
    J --> K["Update aggregate feed counters"]
    K --> L["Update unordered feed-pair counters"]
    L --> M[("PostgreSQL")]

    N["GET /api/discovery/popular"] --> O["Read genuine aggregate counts"]
    O --> M
```

### Key architectural boundaries

| Responsibility | Browser | Backend | Database |
|---|:---:|:---:|:---:|
| Followed feeds and feed timeline | ✓ |  |  |
| Bookmarks, history, read state, goals, profile preferences | ✓ |  |  |
| Saved article copies | ✓ IndexedDB |  |  |
| RSS / Atom parsing and reader UI | ✓ | Safe feed fetch proxy |  |
| Safe webpage fetching and article extraction |  | ✓ |  |
| Feed recommendation query | Sends current feed list | ✓ | Aggregate reads |
| Discovery contribution | Explicit consent action | Validates and processes | Aggregate counters only |
| Popular feed ranking | Displays result | ✓ | Aggregate reads |

**Important:** the backend does not need a reader account to serve the reading API. The personal reading stores are browser-side; the discovery database is for public feed metadata and aggregate counters, not a cloud-synced personal library.

---

## Privacy model

Privacy is a data-flow decision, not a badge.

| Data | Where it lives | Sent to backend? |
|---|---|---|
| Followed feeds and feed article list | Browser localStorage | Feed URLs may be sent when the reader requests recommendations or refreshes a feed |
| Bookmarks and reading history | Browser localStorage | No |
| Read / unread markers and reading stats | Browser localStorage | No |
| Local profile, preferences, goals, and theme settings | Browser localStorage | No |
| Successfully extracted article copies | Browser IndexedDB | No |
| Public feed directory metadata | PostgreSQL | Yes |
| Discovery co-occurrence / popularity counters | PostgreSQL | Only from explicitly consented contribution batches |
| Raw discovery query list | Request memory only | Not persisted as a raw query list by the discovery implementation |
| Rate-limit key | HMAC-derived, expiring database record | Raw IP is not stored as the rate-limit key |

### Discovery is opt-in

- Contribution is not the same operation as asking for recommendations.
- The discovery query endpoint reads the submitted feed list to calculate a response; the raw list is not written as a reader profile.
- The discovery submit endpoint requires consent to be explicitly set to true.
- The contribution handler updates feed and unordered-pair aggregate counters rather than keeping a raw contribution batch.
- Demo discovery mode disables contribution.
- Popular results in database mode represent genuine aggregate contributions; a seeded directory entry is not counted as a popularity event.

SmallWebReader does **not** claim perfect anonymity. Hosting providers and network infrastructure may retain their own standard operational logs. Review the deployment environment and its logging policies before making privacy promises to users.

---

## Security at the fetch boundary

Any URL supplied by a user is untrusted input. The backend applies defensive checks before it fetches a page or feed.

| Control | Current implementation |
|---|---|
| Scheme validation | Allows HTTP and HTTPS only |
| URL validation | Article-read URLs are checked for malformed input, unsupported schemes, and localhost targets; feed-fetch canonicalization also rejects embedded credentials |
| SSRF protection | Blocks private, loopback, link-local, multicast, and reserved IPv4 / IPv6 destinations |
| DNS checks | Resolves hostnames and validates resolved addresses before connecting |
| DNS rebinding mitigation | Connects to the validated resolved IP while retaining the hostname for the HTTP host / TLS server name |
| Redirect handling | Follows at most 5 redirects and validates each destination again |
| Request timeout | 10 seconds |
| Response-size bound | 5 MB |
| Content types | HTML for article extraction; HTML / RSS / Atom / XML for the feed proxy |
| HTML handling | Backend extraction sanitization plus frontend DOMPurify before rendering |
| Error handling | Structured errors; internal stack traces are not returned to the client |
| Rate limiting | HMAC-derived rate-limit keys with expiry cleanup |

These are implementation controls, not a guarantee that every remote publisher page will be extractable or that every deployment environment is risk-free.

---

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, TypeScript, Vite 6 |
| UI and motion | CSS, Framer Motion |
| Article safety | DOMPurify |
| Browser persistence | localStorage, IndexedDB |
| Offline app resources | Service Worker, Cache API |
| Backend | Node.js, Express 4, TypeScript |
| Extraction | Mozilla Readability, JSDOM |
| Database | PostgreSQL, compatible with Supabase hosting |
| Database access | `pg` connection pool and SQL migrations |
| Tests | Vitest, Testing Library, Jest, Supertest, local smoke tests |

---

## Repository layout

```text
SmallWebReader/
├── backend/
│   ├── migrations/             # PostgreSQL schema and seed migrations
│   ├── scripts/                # Migration, seed, and smoke-test scripts
│   ├── src/
│   │   ├── db/                 # Pool, migrations, discovery, rate limiting
│   │   ├── routes/             # Read, fetch, and discovery HTTP routes
│   │   ├── app.ts              # Express app and middleware
│   │   ├── safeFetch.ts        # Bounded outbound fetch implementation
│   │   ├── urlSecurity.ts      # URL, IP, and DNS security checks
│   │   ├── canonicalUrl.ts     # Feed URL canonicalization
│   │   └── extractor.ts        # Article extraction and cleanup
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── public/
│   │   └── sw.js               # Offline app-shell / request cache
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/         # Header, navigation, footer
│   │   │   ├── onboarding/     # Welcome and onboarding flow
│   │   │   ├── reader/         # Reader canvas and controls
│   │   │   ├── theme/          # Theme engine and soundtrack UI
│   │   │   ├── ui/             # Shared UI components
│   │   │   └── views/          # Dashboard, Library, Discover, etc.
│   │   ├── services/           # API clients and RSS / Atom feed service
│   │   ├── utils/              # Storage, IndexedDB, reading-time helpers
│   │   ├── theme/              # Theme configuration
│   │   ├── types/              # Shared frontend types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── .env.example
│
├── docs/
│   ├── API_CONTRACT.md         # HTTP routes, payloads, and error formats
│   ├── ARCHITECTURE.md         # Engineering architecture notes
│   ├── PROJECT_SPEC.md         # Product scope and privacy rules
│   ├── TASKS.md                # Implementation roadmap
│   └── TEST_PLAN.md            # Verification scenarios
│
├── AGENTS.md                  # Repository-level AI / contributor guardrails
└── README.md
```

---

## Getting started

### Prerequisites

- Node.js 20 LTS or later
- npm
- A modern browser with localStorage, IndexedDB, and Service Worker support
- PostgreSQL only when running database-backed discovery (the reader itself can be started in demo discovery mode)

### 1. Clone the repository

```bash
git clone https://github.com/vebhavsh/SmallWebReader.git
cd SmallWebReader
```

### 2. Configure and start the backend

Open **Terminal 1**:

```bash
cd backend
npm install
```

Create your local environment file:

**PowerShell**
```powershell
Copy-Item .env.example .env
```

**macOS / Linux**
```bash
cp .env.example .env
```

For a quick local run without PostgreSQL, edit `backend/.env` and set:

```env
PORT=3001
CORS_ORIGIN=http://localhost:3000
USE_DEMO_DISCOVERY=true
```

Then start the API:

```bash
npm run dev
```

The backend listens at `http://localhost:3001` by default. Check `http://localhost:3001/health`; a healthy response is:

```json
{ "status": "ok" }
```

### 3. Configure and start the frontend

Open **Terminal 2** from the repository root:

```bash
cd frontend
npm install
```

Create the frontend environment file:

**PowerShell**
```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux**
```bash
cp .env.example .env.local
```

Confirm these values in `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_USE_DEV_FIXTURES=false
```

Start the Vite development server:

```bash
npm run dev
```

Open **http://localhost:3000**.

> The frontend's live API client must point to the backend's reachable address. If the frontend and backend run on different devices, set `VITE_API_BASE_URL` to the backend device's LAN URL and set `CORS_ORIGIN` in the backend to the exact frontend origin.

---

## Discovery database setup

SmallWebReader supports two discovery configurations.

### Option A — Demo discovery (no database required)

Set this in `backend/.env`:

```env
USE_DEMO_DISCOVERY=true
```

The backend uses deterministic demo discovery fixtures. This is useful for local UI walkthroughs and does not record user contributions. The submit endpoint is disabled in this mode.

### Option B — PostgreSQL-backed discovery

1. Create a PostgreSQL database (local PostgreSQL or a compatible hosted PostgreSQL instance such as Supabase).
2. Set the connection details in `backend/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_SSL=true
USE_DEMO_DISCOVERY=false
RATE_LIMIT_HMAC_SECRET=replace-with-a-long-random-secret
```

3. Run the database migrations:

```bash
cd backend
npm run migrate
```

4. Optionally add the repository's demo directory / seed entries:

```bash
npm run seed:demo
```

5. Restart the backend.

In database mode, recommendations use stored aggregate evidence and directory fallbacks. The Popular list remains empty until eligible, genuine opt-in contributions have been recorded; seeded directory feeds are not displayed as contribution popularity.

> Use a dedicated test database for integration tests. Never point test commands at production data.

---

## Environment variables

### Backend — `backend/.env`

| Variable | Purpose |
|---|---|
| `PORT` | API port; defaults to `3001` |
| `CORS_ORIGIN` | Allowed frontend origin; set to `http://localhost:3000` for the default Vite setup |
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_MAX_POOL_SIZE` | Maximum database pool size |
| `DATABASE_SSL` | Enables TLS for a hosted database |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Controls certificate verification |
| `DATABASE_SSL_CA_CERT_PATH` | Optional path to a trusted CA certificate |
| `USE_DEMO_DISCOVERY` | `true` for fixture-backed discovery; `false` for PostgreSQL |
| `RATE_LIMIT_HMAC_SECRET` | Secret used to derive rate-limit keys; replace the example value |

### Frontend — `frontend/.env.local`

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API |
| `VITE_API_ENDPOINT` | Optional article extraction path; defaults to `/api/read` |
| `VITE_USE_DEV_FIXTURES` | `true` uses the frontend mock API; `false` uses the live backend client |

Never commit `.env`, `.env.local`, database credentials, or real secrets. The checked-in `.env.example` files are templates only.

---

## API reference

The canonical request / response definitions are maintained in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Backend liveness check |
| `POST` | `/api/read` | Safely fetch and extract a readable article |
| `GET` | `/api/fetch?url=...` | Safely fetch public HTML / RSS / Atom / XML for browser-side feed parsing |
| `POST` | `/api/discovery/query` | Recommend feeds related to a supplied feed list |
| `POST` | `/api/discovery/submit` | Record aggregate feed signals after explicit consent |
| `GET` | `/api/discovery/popular` | Return paginated genuine aggregate popularity |

### Standard error envelope

API errors use a predictable structure:

```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "Enter a valid public webpage URL."
  }
}
```

Common error codes include `VALIDATION_ERROR`, `INVALID_URL`, `URL_NOT_ALLOWED`, `CONSENT_REQUIRED`, `EXTRACTION_FAILED`, `RATE_LIMIT_EXCEEDED`, `PAGE_FETCH_FAILED`, `FETCH_TIMEOUT`, `DEMO_MODE`, and `INTERNAL_ERROR`.

---

## Tests and quality checks

Run checks from the relevant project directory.

### Backend

```bash
cd backend
npm run build
npm test
npm run test:smoke
```

Optional PostgreSQL integration tests (requires a dedicated test database):

**PowerShell**
```powershell
$env:TEST_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/smallwebreader_test"
npm run test:integration
```

**macOS / Linux**
```bash
TEST_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/smallwebreader_test" npm run test:integration
```

### Frontend

```bash
cd frontend
npm run typecheck
npm test
npm run build
```

Frontend `npm test` runs the Vitest suite. Backend `npm test` runs the Jest suite. Backend `npm run test:smoke` runs local API smoke checks; it does not require a live external website by default.

---

## Product decisions and scope

SmallWebReader deliberately favours a small, understandable system over unnecessary infrastructure.

- No AI-generated summaries, AI chat, embeddings, or vector database in the current product scope.
- No mandatory reader account or cloud-synced personal reading history.
- No Kafka, Redis, or distributed job system for the current MVP.
- Discovery is deterministic and aggregate-based; it is not an AI recommendation engine.
- Feed subscriptions and the personal library are local to the browser that created them. There is no cross-device sync in the current implementation.

These boundaries keep the reader lightweight and make the privacy model easier to explain and audit.

## Documentation

| Document | What it covers |
|---|---|
| [Project specification](docs/PROJECT_SPEC.md) | Product goals, scope, privacy and discovery rules |
| [Architecture notes](docs/ARCHITECTURE.md) | Backend, database, canonicalization, and system design |
| [API contract](docs/API_CONTRACT.md) | Endpoint methods, payloads, responses, and errors |
| [Task roadmap](docs/TASKS.md) | Implementation phases and task status |
| [Test plan](docs/TEST_PLAN.md) | Security, reader, discovery, and integration checks |
| [Backend guide](backend/README.md) | Backend-specific setup and commands |
| [Frontend guide](frontend/README.md) | Frontend package overview |

---

## Current limitations

- Article extraction depends on the structure and accessibility of the publisher's page. Some paywalled, heavily scripted, or unusual pages may not yield a complete article.
- Offline access is limited to already cached content and cached app resources.
- Discovery quality depends on available aggregate contribution data; an empty Popular view is a valid state when no eligible contributions exist.
- Browser-local data does not automatically transfer to another browser or device.
- The repository currently has no `LICENSE` file. Usage and redistribution terms have not yet been specified.

---

<div align="center">

**Built for readers who want more signal, less noise.**

[Back to the repository](https://github.com/vebhavsh/SmallWebReader)

</div>
