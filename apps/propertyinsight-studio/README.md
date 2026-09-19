# PropertyInsight Studio

A standalone app: render a property improvement onto the property's own photograph, then
build the campaign around it.

It follows the original PropertyInsight prototype feature-for-feature — render studio,
improvement suggestions, geospatial screening, campaign one-pagers, market framing — with
the rendering engine replaced by [`@alter/render-*`](../../packages/README.md) and every
model call moved behind its own API.

```bash
npm install
npm run dev          # api on :5175, client on :5173
```

No key needed to start: it boots on the mock render provider and a deterministic text
stub, so the whole app works offline. Set `ALTER_RENDER_API_KEY` for real output.

```bash
npm run build && npm start    # single server on :5175, serving the built client
```

---

## What replaced the engine

The prototype called the model vendor straight from the React component with the API key
in the query string. Everything below follows from undoing that.

| Prototype | Here |
|---|---|
| `apiKey` in the browser bundle, in a query string | Key exists only in the server process, sent as a header |
| `callGeminiApi` / `callImagenApi` inline in the component | `@alter/render-core` behind `POST /api/renders` |
| Two hand-rolled `fetch` calls, no retry | Retry with full-jitter backoff, circuit breaker, per-call timeouts |
| Every click bills a new generation | Content-derived idempotency keys; identical renders hit cache |
| No ceiling on concurrent generations | Concurrency gate plus a per-IP render quota |
| Prompt built inline, unconstrained | Exported prompt layer with per-trade geometry guardrails |
| Six industries as display strings | Seven trade presets from the server, each declaring what may and may not change |
| One `isLoading` shared across five features | One `useAsyncAction` instance per action |
| Model invents one-pager URLs | Server derives deterministic slugs; every link resolves |
| Copy failure fails the whole render | Degrades to template copy, flagged `meta.degraded` |

The client no longer contains the word "Gemini". Swapping providers is a server config
change; see the [packages guide](../../packages/README.md).

---

## Layout

```
server/
  app.js              createApp() — routes, quotas, CSP, error boundary
  index.js            boot + graceful drain
  routes/assist.js    suggestions, campaign, market, vision-params
  lib/textProvider.js text generation + offline stub
src/
  App.jsx             shell and section composition
  components/         RenderStudio, Suggestions, Targeting, Campaign, InfoModal, ui
  lib/                api client, image prep, useAsyncAction
```

`server/app.js` is a factory, not a singleton, so each test gets its own engine, cache and
quota counters instead of sharing hidden state.

## API

| Route | Purpose |
|---|---|
| `POST /api/renders` | Render. `?mode=async` returns `202` + a job id. Honours `Idempotency-Key`. |
| `GET /api/renders/:id` | Poll an async render. |
| `GET /api/renders/industries` | Trade presets. |
| `POST /api/assist/suggestions` | Improvement ideas for a described property. |
| `POST /api/assist/campaign` | Per-address one-pagers with server-derived links. |
| `POST /api/assist/market` | Market context for a trade and location. |
| `POST /api/assist/vision-params` | Sharpen imagery screening criteria. |
| `GET /api/health` | Status and active providers. |

Every error is `{ error: { code, message, details? } }` with a stable `code`
(`INVALID_INPUT`, `RATE_LIMITED`, `CIRCUIT_OPEN`, `TIMEOUT`, `NOT_FOUND`,
`PROVIDER_ERROR`). Branch on `code`, never on the message.

## Configuration

See [`.env.example`](.env.example). The ones that matter most:

| Variable | Default | Notes |
|---|---|---|
| `ALTER_RENDER_API_KEY` | — | Empty runs the whole app offline |
| `RENDER_RATE_LIMIT` | `40` | Per IP per window; separate from assist |
| `ASSIST_RATE_LIMIT` | `200` | So suggestion clicks cannot exhaust the render budget |
| `TRUST_PROXY_HOPS` | `0` | Raise **only** when actually behind a proxy — trusting `X-Forwarded-For` otherwise lets callers spoof past the quota |

## Tests

```bash
npm test                                     # 13 API tests, no network
npm run build && node test/e2e.mjs           # 26 end-to-end checks in Chromium
```

The end-to-end suite drives the real UI: upload, render, drag and keyboard the seam, and
each assist feature. Two of its checks read **painted pixels** rather than DOM state —
a defect got past an earlier DOM-only suite because an overlay reported `hidden === true`
while an author `display` rule kept it painted over both images. DOM state cannot tell a
visible image from one covered by an opaque div; only the rendered output can.

`test/e2e.mjs` needs Playwright, which is not a dependency:

```bash
npm i -D playwright && npx playwright install chromium
```

## Deploying

`npm run build` emits `dist/`; `npm start` serves it and the API from one process, with a
CSP that allows `data:` images (renders) and the OpenStreetMap embed frame.

Two defaults to revisit before real traffic: the render cache and job store are
per-process, so behind more than one instance put Redis or Postgres behind the same
interfaces (`{ get, set }` and `{ create, get, update, findByKey }`) — neither the engine
nor the router assumes either is local.

## Lifting it out of this repo

The app depends on the packages through `file:` links to `../../packages`. To run it
elsewhere, either publish those four packages and switch the `file:` specifiers to
versions, or copy `packages/` alongside the app and keep the relative paths. Two `file:`
link quirks are already handled and can be dropped once installing from a registry:

- `vite.config.js` adds the linked core to `build.commonjsOptions.include` — it is
  CommonJS and resolves outside the default `node_modules` include.
- `server/app.js` passes its own `express` into `createAlterRenderRouter` — the linked
  package's resolution chain does not reach this app's dependencies.
