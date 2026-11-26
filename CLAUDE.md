# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Atlas & Helios: a storm-intelligence and property-assessment platform for restoration
crews. **Atlas** is the storm side (NOAA feeds, radar, risk scoring, leads); **Helios** is
the assessment and estimating side.

**Trust the docs selectively.** The root `README.md` describes an aspirational system and
is wrong in places that matter — it lists Redis (not used anywhere in code), Leaflet (a
declared dependency with zero imports; MapLibre GL is the real renderer) and TensorFlow
(an *optional* require that is not installed, so damage analysis runs simulated). The
accurate documents are `frontend/README.md`, `packages/README.md` and `DESIGN/`. Verify
against code before repeating a capability claim from the root README.

## Commands

npm workspaces at the root cover `frontend`, `backend` and `packages/*`. (`mobile` is
listed in `workspaces` but the directory does not exist. `apps/propertyinsight-studio` is
a separate Vite app and is **not** a workspace — install and run it on its own.)

```bash
npm run dev              # backend :5000 + frontend :3000 together
npm run test:all         # packages + frontend + backend
npm run test:e2e         # real backend + built frontend in Chromium, feeds stubbed
```

`test:e2e` needs `frontend` built first and Playwright installed — deliberately not a repo
dependency (`npm i -D playwright && npx playwright install chromium`, or point
`CHROMIUM_PATH` at an existing binary).

Running the stack without Postgres — the backend defaults to Postgres, `DB_CLIENT=sqlite3`
puts it on a file instead (same engine the tests use, so the migration is known to work):

```bash
cd backend
DB_CLIENT=sqlite3 npm run migrate   # schema
DB_CLIENT=sqlite3 npm run seed      # 1 company, 12 properties, 2 storms, 6 assessments
DB_CLIENT=sqlite3 npm run dev
cd ../frontend && npm start         # sign in as dev@atlashelios.test / atlas-dev-password
```

Tests, including single files:

```bash
cd backend && npx jest tests/auth.test.js          # jest; NODE_ENV=test → in-memory
npx jest -t "usable token pair"                    # SQLite, no DB_CLIENT needed
cd packages/atlas-dashboard-data && node --test test/normalize.test.js   # node:test, not jest
cd frontend && CI=true npm test -- --watchAll=false --testPathPattern useDashboardData
```

Frontend gates worth running before you push:

```bash
cd frontend
npm run build:check    # production build, failing only on warnings from OUR code
npm run brand:check    # forbidden brand strings, unqualified "verified"
npm run brand:colour   # CIEDE2000 + WCAG, dependency-free
```

`build:check` exists because `CI=true npm run build` promotes third-party warnings to
errors (maplibre-gl emits one), which made the strict build unusable and so unused.

## Architecture

### Backend (`backend/`) — Express + Knex

`server.js` mounts one router per resource. Routers are thin: validation, scoping, query,
response. The shared machinery is in `src/routes/_helpers.js`, and two pieces of it are
load-bearing:

- **`scopeToCompany(query, user)`** is the multi-tenant boundary. Without it a user of one
  restoration company reads another's properties, leads and estimates. It lives in the
  helper so no router can forget it; only a `platform_admin` opts out. Any new resource
  query goes through it.
- **`newId()`** (`node:crypto` `randomUUID`) is how ids are made. **Do not `require('uuid')`** —
  the installed version is ESM-only with no `require` export, so it works on Node 22 and
  breaks everywhere else. That shipped as a latent 500 once already.

`config/secrets.js` resolves JWT secrets **once, at boot**: production refuses to start
without `JWT_SECRET`; development and test generate an ephemeral one and warn. This is the
fix for a bug where the secret was read inside `jwt.sign`, so the server booted healthy and
then 500'd on every sign-in. Keep configuration resolution at boot for the same reason.

`config/db-config.js` has no side effects, so `knexfile.js` and the running server share
one source of truth. Pagination caps `limit` at **100** — a request for more is a 400, not
a clamp.

### Frontend (`frontend/src/`) — CRA + Tailwind

`App.js` → `AuthProvider` → **`AuthGate`**, which chooses what *mounts*: a restoring
screen, `Login`, or `AuthenticatedApp`. This is a mount gate rather than a redirect on
purpose — rendering the shell and then redirecting fires every provider's mount fetch
against an unauthenticated API.

Inside the gate, **one** `DashboardDataProvider` owns a single live store; every panel
reads it through `useDashboardData()`, so one set of requests serves the screen and two
panels cannot disagree by a poll interval. The full contract is
`DESIGN/dashboard-data-layer.md`; `frontend/README.md` has the per-component rules and the
fixture/Storybook seam.

API errors arrive as `ApiError` with a `code` (`NETWORK`, `API_UNREACHABLE`, `ABORTED`, or
the server's own). Call sites distinguish them — an outage and a typo must not read alike.

`src/setupProxy.js`, not a `proxy` field in `package.json`, proxies `/api` to :5000. **Do
not reintroduce the `proxy` field**: it switches on the dev server's host check, which
crashes at boot in environments whose only non-loopback address is outside private ranges
(`allowedHosts[0] should be a non-empty string`). `frontend/README.md:23` still describes
the old mechanism and is stale.

### Packages (`packages/`)

- **`@atlas/dashboard-data`** — the framework-free model, store and state machine
  (`LIVE → SYNCING → STALE → DEGRADED → OFFLINE`). No React. The store's `dispose()` is
  reversible via `activate()` and guarded by a generation counter, because StrictMode
  double-invokes effects against the same memoised store.
- **`@atlas/radar-map`** — basemaps and layers. `basemapsFor(config)` resolves a provider;
  `assertUsableTileUrl` **throws** on `tile.openstreetmap.org` and `tile.osm.org`, so
  donated OSM infrastructure cannot be pointed at through configuration. Hosted
  (OpenFreeMap) is the default; `pmtiles` serves a self-hosted archive and falls back
  *visibly* when no URL is set. See `DESIGN/mapping-stack.md`.
- **`@alter/render-*`** — a portable before/after rendering engine, deliberately decoupled
  so it can leave this repo. `render-core` is framework-free, `render-server` is the only
  place a provider key exists. See `packages/README.md`.

`nexus-bridge/` is a separate Python service; when it is absent `/api/nexus/*` answers 503
`NEXUS_UNAVAILABLE` rather than failing the platform.

## Conventions this codebase actually enforces

These are the rules reviewers hold the line on here, and most bugs fixed recently were
violations of one of them.

**Never fabricate, and never let a failure read as a fact.**

- "Nothing happened" and "we cannot see" are different states and must render differently.
  A confident `0` is a claim; under `DEGRADED` the store keeps each lane's last known value
  and the panel labels it.
- A dependency that is down answers **503 with a named code** (`NEXUS_UNAVAILABLE`,
  `RADAR_UNAVAILABLE`, `ALERTS_UNAVAILABLE`), never a 500, and never an error string
  carrying an internal address.
- Demo and simulated output labels itself: the forecast mock is stamped `source: 'mock'`
  and the chart says so; weather **alerts** never fabricate either way; computer-vision
  output is simulated unless `@tensorflow/tfjs-node` is installed and must not be described
  as model inference.

**Brand.** The AUCTUM engine palette (ink/ivory/brass/proof/alert) is what tool surfaces
use; a market accent appears only on brand chrome (the sign-in screen is the one in-product
exception). `scripts/brand-check.mjs` fails the build on retired marks. The Helios accent
is deliberately **unshipped**: the proposed colour measured ΔE2000 2.94 against Atlas where
the brand's own rule demands ≥ 15, so shipping it would make the rule false on first use.

**Tests prove the failure, not just the fix.** `backend/tests/secrets.test.js` deletes
`JWT_SECRET` before loading anything — a file of its own, because resolution happens once
per module registry — and the other backend suites set `JWT_SECRET` themselves, which is
exactly why 64 tests passed while no real login worked. When adding a regression test, run
it against the unfixed code first.

**Commits** carry a subject in the imperative and a body explaining *why the old behaviour
was wrong*, not what changed. The diff shows what changed.
