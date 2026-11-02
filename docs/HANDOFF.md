# HANDOFF — SmallWebReader Final Workspace State

## Personal Library publisher links — 2026-11-02

- Followed-feed storage now keeps `feedUrl` (subscription/refresh/unfollow) separate from nullable `homepageUrl` (publisher navigation). Existing local records using the old `url` field are read compatibly and normalized without losing subscriptions.
- Personal Library never links the feed URL. It verifies homepage candidates through the existing safe `/api/fetch` proxy, displays only verified HTML as “Open website”, and shows “Publisher website unavailable” otherwise.
- BBC News feed metadata advertises `https://www.bbc.co.uk/news`; for the explicitly confirmed feed `https://feeds.bbci.co.uk/news/rss.xml`, the app also verifies and prefers the supplied canonical homepage `https://www.bbc.com/news`. Aeon’s `https://aeon.co/feed.rss` feed resolves to verified `https://aeon.co/`.
- Publisher titles and “View articles” expand locally fetched articles in the Library. Selecting an article opens it in the existing in-app reader. Feed refresh and follow/unfollow continue using the original RSS/Atom URL.
- Discover curated, popular, and followed-feed cards no longer expose raw RSS/Atom URLs as website links. Publisher links are shown only after verification.
- Browser verification on `http://localhost:3002/` followed BBC News (33 articles) and Aeon (20 articles), opened Personal Library, and confirmed that the feed URLs were displayed as plain text, separate website actions were offered, and the BBC article opened in the clean in-app reader. Browser safe-proxy checks returned RSS for both feed URLs and HTML for `https://www.bbc.com/news`, `https://www.bbc.co.uk/news`, and `https://aeon.co/`.
- Frontend tests: 12 files and 91 tests passed. Frontend TypeScript/Vite production build passed. Automated regression tests cover homepage destinations, unavailable metadata, local article browsing, legacy storage normalization, and refresh via `feedUrl`.

## Current Related feed website and validation fix — 2026-11-02

- Related cards verify their RSS/Atom subscription URL through the existing `/api/fetch` proxy. Follow is disabled until a valid feed document is confirmed; an invalid feed can never be followed.
- The feed URL remains the subscription and parsing URL. RSS channel links, Atom HTML alternate links, separately stored publisher homepage metadata, and a conservative same-origin fallback are considered in priority order. Candidate homepages must return HTML through the same safe proxy before they are exposed as “Open website”.
- The discovery response now includes nullable `websiteUrl` metadata alongside `canonicalUrl`; this additive API-contract field is documented in `docs/API_CONTRACT.md` and must be kept in sync by frontend/backend owners.
- If a homepage is not verified, the card shows a disabled “Website unavailable” action and an explanation. The raw RSS/Atom URL is never linked from a Related card. A valid feed with no homepage can still be followed.
- The per-page metadata cache avoids refetching the same feed/homepage validation. Homepage metadata is stored separately from canonical feed URLs in `canonical_feeds.website_url`.
- Migration `003_feed_homepage_metadata.sql` is additive: it adds homepage metadata, records official replacements for The Marginalian (`https://feeds.feedburner.com/brainpickings/rss`) and Increment (`https://increment.com/feed.xml`), and leaves legacy feed rows and subscriptions in place. The card normalizer maps those two known stale directory entries to their publisher-advertised replacement URLs.
- The Related database query excludes the two superseded seed URLs while preserving their database rows, so the 10-card directory page has no duplicate Marginalian or Increment cards.
- Safe-fetch/browser verification:
  - The Marginalian: replaced `https://www.themarginalian.org/feed/` with publisher-advertised `https://feeds.feedburner.com/brainpickings/rss` (valid RSS, 20 entries); homepage `https://www.themarginalian.org/` opened as a normal webpage.
  - Daring Fireball: `https://daringfireball.net/feeds/main` (valid Atom, 48 entries); homepage `https://daringfireball.net/` opened normally.
  - Simon Willison: `https://simonwillison.net/atom/everything/` (valid Atom, 30 entries); homepage `https://simonwillison.net/` opened normally.
  - Julia Evans: `https://jvns.ca/atom.xml` (valid Atom, 20 entries); homepage `https://jvns.ca/` opened normally.
  - Increment: replaced `https://increment.com/feed/` (403) with the publisher-advertised `https://increment.com/feed.xml` (valid RSS, 20 entries); homepage `https://increment.com/` rendered its normal webpage in the browser, though initial navigation exceeded the browser tool's wait limit.
  - CSS-Tricks: `https://css-tricks.com/feed/` (valid RSS, 15 entries); homepage `https://css-tricks.com/` opened normally.
  - Wil Wheaton: `https://www.wilwheaton.net/feed/` (valid RSS, 10 entries); homepage redirects to and opens as `https://wilwheaton.net/`.
  - Dan Luu: `https://danluu.com/atom.xml` exceeds the safe-fetch 5 MiB response limit, so Follow is disabled; `https://danluu.com/` remains separately verified and opens as a normal webpage.
  - Old European Culture: `https://www.oldeuropeanculture.com/feed/` and its homepage fail DNS resolution; Website unavailable and Follow disabled.
  - Aaron Swartz Archive: `https://www.aaronsw.com/2002/feeds/atom.xml` times out and its homepage could not be verified; Website unavailable and Follow disabled.
- In the integrated Related view, all nine named publishers plus Simon Willison appeared without duplicate cards. It showed eight verified website links, two Website unavailable states, seven followable feeds and three disabled Follow buttons; there were no raw feed-source links. Following The Marginalian saved the replacement RSS URL to My Library and removed the card from Related.
- Automated coverage checks RSS and Atom homepage metadata, non-HTML destinations, absent/unsafe homepages, third-party feed-host behavior, broken feeds, official replacements, no raw XML primary action, and follow/unfollow persistence.

This update applied database migration `003_feed_homepage_metadata.sql` without deleting or rewriting any existing feed URL or subscription.

## Current discovery and extraction verification — 2026-11-02

- The verification browser used the frontend at `http://localhost:4173/` and the backend at `http://localhost:3003/`. The backend `.env` has `USE_DEMO_DISCOVERY=false`; no database credentials were changed or exposed.
- Discover → Popular queried the configured PostgreSQL backend and displayed the honest empty state. Seed/example rows were not presented as genuine popularity.
- Discover → Related displayed the PostgreSQL directory fallback with a “Curated directory fallback” label. After following Simon Willison’s feed, it appeared as one follow in My Library and was excluded from Related results. Unfollowing refreshed the feed card and recommendation state.
- The Curated cards use Simon Willison, Julia Evans, Quanta Magazine, and Aeon public feeds. Through the safe feed endpoint, each returned a feed (30, 20, 5, and 20 entries respectively); a current article from each feed also extracted successfully through `/api/read`.
- The Google DeepMind page `https://deepmind.google/blog/genie-4-a-new-generation-of-world-simulation/` extracted successfully after safe-fetch decompression was fixed. The browser reader showed the article title, byline, headings, paragraphs, lists, and publisher content without the reported navigation clutter. This was a verified public DeepMind article, not the exact URL from the user's video, which was not supplied in the workspace.
- Project Gutenberg’s `https://www.gutenberg.org/cache/epub/1342/pg1342-images.html` rendered *Pride and Prejudice* in the reader with its chapter headings and book text. The extraction contained 63 headings, 2,242 paragraphs, and 161 images.
- The reader displayed a visible “Extraction Failed” alert for a feed URL submitted as an article, rather than displaying the feed markup as article text.
- The DeepMind article was bookmarked and cached. The browser showed it in Bookmarks and Offline; with the browser context offline, opening the cached article still showed its title, body, and “Available offline” status.
- The backend and frontend automated suites passed; see “Current test and build results” below. Four live PostgreSQL integration tests were skipped because `TEST_DATABASE_URL` is unset.

## Current test and build results — 2026-11-02

Commands executed:

```powershell
cd C:\Users\Vaibhav\Desktop\SmallWebReader\backend
npm.cmd test -- --runInBand
npm.cmd run build

cd C:\Users\Vaibhav\Desktop\SmallWebReader\frontend
npm.cmd test -- --run
npm.cmd run build
```

Results:

- Backend: 8 suites passed; 108 tests passed and 4 skipped. The skips are live PostgreSQL integration checks because `TEST_DATABASE_URL` was not set.
- Backend TypeScript build passed.
- Frontend: 12 test files passed; 85 tests passed.
- Frontend TypeScript check and Vite production build passed.
- The current Related feed tests include the additive metadata migration and replacement query behavior. The backend migration command completed successfully; 4 live PostgreSQL integration tests remained skipped because `TEST_DATABASE_URL` is unset.
- Browser verification for the current feed-link task is detailed above. Follow-to-Library and Related exclusion were browser-verified; follow/unfollow persistence remains additionally covered by the frontend suite.

## Next concrete step

- When the exact DeepMind article URL from the user's video is available, run it through the browser reader and `/api/read`; when `TEST_DATABASE_URL` is configured, rerun the backend suite to execute the four live PostgreSQL integration tests.

## Earlier verified workspace state

- The live app ran as Guest Reader at `http://localhost:4173/`, with the backend API on port `3001`.
- Popular and Related Discover sections rendered backend results. The active directory contains 10 synthetic seed feeds; the UI labels these as demo data and does not present them as genuine popularity.
- Browser interaction completed: Related recommendation → Follow → feed visible in My Library → Unfollow. The recommendation disappeared after follow and returned after unfollow. Duplicate-follow behavior is also covered by the frontend test suite.
- A real public blog homepage (Simon Willison) was used to discover its Atom feed, subscribe, and load feed posts into the timeline during the earlier live-browser pass.
- Unfollowing The Marginalian left the existing two bookmarks and two cached articles intact.
- A public Julia Evans article was available in IndexedDB (`smallwebreader-offline`, `cached-articles`): 6,622 characters of extracted content, 1,272 words. After taking the browser offline and refreshing, the same full article opened with the “Available offline” indicator. Its bookmark and read state remained present. The browser returned online afterward.
- The service worker was activated for `http://localhost:4173/`; the `smallwebreader-shell-v2` cache was present.
- Responsive browser checks: at an effective 300px content viewport, the mobile bottom navigation remained usable and there was no horizontal page overflow. At an effective 1,012px content viewport, desktop navigation was shown with no horizontal overflow.
- A mobile header overflow and a soundtrack-dock overlap with the bottom navigation were found during browser checks and fixed.
- Related discovery now explicitly explains that followed or entered feed URLs are sent for recommendations. Reading history and bookmarks are not sent. Submitting aggregate discovery contributions remains a separate opt-in.

## Database and seed data

The configured development environment passed PostgreSQL connectivity and migrations in earlier verification. At that time the API returned 10 seeded directory entries. Current behavior is detailed above: Popular excludes seed rows, and Related labels seed rows as directory fallbacks. This task did not reset the database or rerun the seed command.

Set a valid `DATABASE_URL` in `backend/.env`, then run from the backend directory:

```powershell
cd C:\Users\Vaibhav\Desktop\SmallWebReader\backend
npm.cmd run migrate
npm.cmd run seed:demo
```

The seed command creates 10 synthetic demo feed records and is intended to be repeatable. These records and their popularity/relationship values are development fixtures, not real reader behavior. The official PECathon seed-list challenge remains **unverified** until its official file is available and audited.

## Prior test and build baseline (before current task)

Commands executed for this final verification:

```powershell
cd C:\Users\Vaibhav\Desktop\SmallWebReader\frontend
npm.cmd test
npm.cmd run build

cd C:\Users\Vaibhav\Desktop\SmallWebReader\backend
npm.cmd test -- --runInBand
npm.cmd run build
npm.cmd run test:smoke
```

Results:

- Frontend: 12 test files passed; 68 tests passed.
- Backend: 7 suites passed; 93 tests passed and 4 skipped.
- Backend integration tests reported `TEST_DATABASE_URL` was not set, so that test invocation skipped their live-PostgreSQL assertions.
- Backend TypeScript production build passed.
- Frontend TypeScript check and Vite production build passed. Route-level chunks were emitted; the main JavaScript chunk was 405.78 kB (118.58 kB gzip), with no Vite chunk-size warning.
- Backend smoke checks passed: health response, missing-URL validation, malformed-URL validation, and loopback SSRF rejection. The optional live-URL smoke case was skipped because `SMOKE_TEST_URL` was not set.

## Privacy and demo-data limits

- No account is needed for core reading. Preferences, follows, bookmarks, read state, history, and article cache are kept in the browser.
- Article/feed fetching and Related discovery send public URLs to the configured backend when requested. Reading history, bookmarks, and article contents are not sent.
- Aggregate discovery contribution is a separate opt-in action. No persistent reader ID is used.
- All 10 current popular-directory entries are synthetic development seed data. No genuine aggregate popularity claim is verified in this workspace.

## Prior limitations; current task status is documented above

- The official challenge seed-list file has not been supplied and audited.
- Live PostgreSQL integration tests still require `TEST_DATABASE_URL`; four were skipped in the current backend test run.
- No standalone Playwright end-to-end test runner is configured in the repository; the browser acceptance checks were performed manually in the integrated browser.

## Start the full application

Ensure `backend/.env` has a valid `DATABASE_URL` and `CORS_ORIGIN=http://localhost:4173`. Start the backend and frontend in separate PowerShell terminals:

```powershell
cd C:\Users\Vaibhav\Desktop\SmallWebReader\backend
npm.cmd run dev
```

```powershell
cd C:\Users\Vaibhav\Desktop\SmallWebReader\frontend
npm.cmd run dev -- --host 0.0.0.0 --port 4173
```

Open `http://localhost:4173/`. For a fresh database, run the migration and demo-seed commands above before starting the services. Do not treat demo seed recommendations as genuine popularity.
