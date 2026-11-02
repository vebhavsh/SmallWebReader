# SmallWebReader — Full-Stack Application

SmallWebReader is a distraction-free reader and discovery engine for the independent web.

- **Backend:** Express + TypeScript + PostgreSQL (Supabase with strict TLS) on port `3001`
- **Frontend:** React 18 + Vite + TypeScript + Framer Motion on port `3000`

---

## Quick Start

### 1. Start Backend (Terminal 1)
```powershell
cd backend
npm run dev
```
Listens on `http://localhost:3001`.

### 2. Start Frontend (Terminal 2)
```powershell
cd frontend
npm run dev
```
Open `http://localhost:3000` in your browser.

### 3. Optional database-backed discovery setup
```powershell
cd backend
cp .env.example .env
# configure POSTGRES / DATABASE_URL if you want live discovery data
npm run migrate
npm run seed:demo
```

Demo discovery mode is enabled by default via `USE_DEMO_DISCOVERY=true` in the example environment file. It keeps the Discover UI populated without fake reader identities or reading-history storage.

---

## Offline-first notes

The frontend now includes a lightweight service worker and IndexedDB-backed article cache, so articles successfully opened are retrievable offline without breaking the app shell. The cache is local to the browser and is not sent to the backend.

---

## Testing & Quality Assurance

### Run All Backend Tests
```powershell
cd backend
npm run build
npm test
npm run test:smoke
```

### Run All Frontend Tests & Build
```powershell
cd frontend
npm run typecheck
npm run build
npm test
```

---

## Documentation
- `docs/API_CONTRACT.md` — Complete HTTP API contract specifications
- `docs/PROJECT_SPEC.md` — Product and architectural requirements
- `docs/HANDOFF.md` — Integration status and system verification notes
