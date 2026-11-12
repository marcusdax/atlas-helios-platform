# Dashboard data layer — the contract

Status: implemented. Supersedes the "Critical engineering issue" section of
[`atlas-helios-ui-v2-proposal.md`](./atlas-helios-ui-v2-proposal.md), which
called for this work.

---

## What was wrong

`Dashboard.js` built its own dataset inside `fetchDashboardData()`:

```js
const mockData = {
  totalProperties: 1247,      // a literal
  activeStorms: activeStorms.length,
  highRiskProperties: 47,     // a literal
  recentAssessments: recentAssessments.length,
  weatherAlerts: 3            // a literal
};
```

…plus three hand-written activity rows, a hardcoded priority-property list in
the JSX, and two invented trend figures (`+2.5%`, `-12%`) on the stat tiles.

The literals were a symptom, not the disease. The page owned its own `useState`,
its own socket subscription and its own idea of what the numbers were, so there
was no seam between *where data comes from* and *what the screen shows*. With no
seam, typing the numbers in was the cheapest way to make the screen render — and
there was nowhere to put the answer to "how current is this?", because the mock
was always, by construction, current.

An operator dispatching crews off those tiles has to know the difference between
a figure that arrived a second ago and the last figure anyone saw before the
feed producing it went down. That is what this layer is for.

---

## Shape

```text
         Components  (QuickStats, ActivityFeed, PriorityQueue, DataStateBadge)
              │        render a view; own no data
              ▼
      useDashboardData()                       frontend/src/data/useDashboardData.js
              │        React wiring only: socket, online/offline, poll, ticker
              ▼
        DashboardStore                         @atlas/dashboard-data
              │        reconciles three lanes into one snapshot, derives the state
      ┌───────┼───────────────┐
      ▼       ▼               ▼
    REST   WebSocket     local cache
      │       │               │
      ▼       ▼               ▼
  dashboardGateway.js   socket.io events   localStorage
      │
      ▼
  /api/properties · /api/storms · /api/assessments/history · /api/radar/alerts
```

Everything below the hook is framework-free and lives in
`packages/atlas-dashboard-data`. That is not architectural decoration: it is why
the whole lifecycle can be tested without a renderer (93 tests, no DOM), and why
the mobile field tool can consume the same model later without importing React.

---

## The domain model

Two conventions hold everywhere, and both kill a specific class of bug.

**Every instant is epoch milliseconds.** Not a `Date`, not an ISO string. A
snapshot round-trips through `JSON.stringify` into the local cache, which turns
a `Date` into a string — and the first component to call
`.toLocaleTimeString()` on it throws. Formatting belongs in the view.

**Nothing is optional by accident.** A count is `0`, never `undefined`. A list
is `[]`, never `null`. A view never has to guard a lane that has not loaded.

```ts
DashboardSnapshot {
  summary: {
    totalProperties, activeStorms, highRiskProperties,
    recentAssessments, weatherAlerts            // all numbers
  }
  activity: ActivityEvent[]                     // newest first
  priorityProperties: PriorityProperty[]        // worst first
  fetchedAt: number | null                      // epoch ms
}

ActivityEvent    { id, type, message, timestamp, severity }
PriorityProperty { id, address, score, risk, timestamp, city?, state? }
```

`ActivityEvent.id` is **content-derived** (`assessment:<id>`, `storm:<id>`,
`alert:<id>`). A `property_assessment_complete` push lands a row immediately and
the refresh it triggers brings the same assessment back from
`/api/assessments/history` seconds later; keyed this way, the second copy
replaces the first instead of stacking under it.

Types are JSDoc, in `packages/atlas-dashboard-data/src/types.js`. The frontend
is a plain Create React App bundle, and adding a compiler to type four screens
would cost more than it returns — JSDoc gives the same editor completion and the
same single source of truth, and `checkJs` can turn the typedefs into real
errors later without touching a line of runtime code.

---

## The data-state lifecycle

**LIVE → SYNCING → STALE → DEGRADED → OFFLINE**

| State | Means | On screen |
|---|---|---|
| `LIVE` | Every lane answered, data is fresh, socket connected | Pulsing dot, figures at full strength |
| `SYNCING` | A read is in flight, or the first has not landed | Shimmering placeholders on first load; existing figures are **never** blanked by a refresh |
| `STALE` | Real data that can no longer be vouched for: aged past the window, or no push channel | Hollow dot, figures dimmed, "last read 6m ago" |
| `DEGRADED` | Some lanes answered, some failed | Amber hairline; **only the affected tiles** say "Last known — feed unavailable" |
| `OFFLINE` | Nothing reachable, or the browser reports no network | Barred dot, desaturated, "Cached on this device" |

The state is **derived, never assigned** — `deriveState(input)` in
`src/states.js` is a pure function of every signal that could make the screen
untrustworthy, and the guard order *is* the design:

1. The browser reports no network → `OFFLINE`.
2. No lane has succeeded and at least one has failed → `OFFLINE`. A dead API
   behind working wifi looks identical to the operator.
3. Some lanes failed → `DEGRADED`. This sits **above** `SYNCING` deliberately: a
   retry already in flight does not make the half-truth on screen any truer.
   `fetching` is exposed separately so the badge can still spin.
4. Nothing to show yet, or a read in flight → `SYNCING`.
5. Data aged past `STALE_AFTER_MS` (90s), **or** no connected socket → `STALE`.
   Without a push channel, freshness between polls cannot be claimed.
6. Otherwise → `LIVE`.

`describeState(state)` returns the label, hint, tone and `trusted` flag, so the
copy for a state exists once rather than once per component. Transitions are
recorded (`{from, to, at, reason}`, bounded to 20) and exposed on the view, which
is what makes "why did the badge go amber?" answerable.

---

## Partial failure is the normal case

`DashboardStore.refresh()` uses `Promise.allSettled`, not `Promise.all`. With
`all`, one 503 from the NWS alert proxy rejects the whole refresh and the
operator loses the property counts too — a total outage drawn from a partial one.

Each lane keeps its **last good contribution**. When the alert lane fails, the
count stays at its last known value and the card says so. It does **not** reset
to `0`, which an operator would read as "no weather today". That retention is
the entire point of `DEGRADED`, and
`composeSnapshot` treats an absent lane as *contributing nothing*, never as
contributing zero.

The alert lane is the one that actually fails in practice: it proxies
`api.weather.gov`, and it answers `503 ALERTS_UNAVAILABLE` often enough that
`DEGRADED` is a weekly state rather than a theoretical one.

---

## Realtime: pushes invalidate, they do not assert

A socket push adds an activity row immediately — that is what makes the feed feel
live — and then asks the store to re-read the counts. It never adjusts a count
itself.

A dashboard that increments its own tiles drifts away from the API within
minutes, usually invisibly, because nothing ever re-reads the number it
invented. So there is exactly one authority for every figure on screen.
`dashboard_update` is the single exception, because there the server is the one
stating the totals — and even then only the five known keys are accepted, each
required to be a finite non-negative number, so a malformed push can at worst
leave a count unchanged rather than render `NaN%` across an operator's screen.

Bursts are coalesced: a squall line crossing a metro emits storm alerts twenty
at a time, which without a 2s debounce is eighty HTTP requests inside a second.

---

## Why four REST reads, and how to replace them

There is no `/api/dashboard/summary` endpoint. Every figure already exists behind
an endpoint the rest of the app uses, so the dashboard composes them client-side
in `frontend/src/data/dashboardGateway.js`:

| Lane | Request | Yields |
|---|---|---|
| `properties` | `GET /api/properties?limit=1` | `meta.total` → **Total Properties** |
| | `GET /api/properties?min_risk=70&sort=damage_probability&order=desc&limit=5` | `meta.total` → **High-Risk**, rows → **priority queue** |
| `storms` | `GET /api/storms?status=active&limit=25` | `meta.total` → **Active Storms**, rows → activity |
| `assessments` | `GET /api/assessments/history?since=-24h&limit=10` | `meta.total` → **Assessments (24h)**, rows → activity |
| `alerts` | `GET /api/radar/alerts` | `meta.count` → **Weather Alerts**, features → activity |
| `forecast` | `GET /api/storms/regions`, then `GET /api/weather/forecast/hourly?lat&lng` | 24 hourly points → **the precipitation chart**, plus its `source` |

This keeps the change **additive**: no existing endpoint moves, nothing the
mobile app or the public map reads changes, and no new backend contract has to be
maintained before it has earned its keep. That satisfies the migration
requirement without a deprecation window — there is nothing to deprecate.

Counts come from `meta.total`, never `data.length`. `limit: 1` for the total is
deliberate: the tile needs the number, not the rows. The original bug worth
remembering is that a tile labelled "Total Properties" would have shown `25` —
the default page size — and nobody would have noticed for months.

**When the fan-out becomes the bottleneck**, the migration is `dashboardGateway.js`
and nothing else: replace the four loaders with one call to the aggregate
endpoint, return the same shapes, and the store, the state machine, the hook and
every component stay exactly as they are. That seam is why this layer exists.

---

## Testing

| Suite | Command | Covers |
|---|---|---|
| Data layer (100 tests, no DOM) | `npm test --workspace=@atlas/dashboard-data` | state machine incl. an exhaustive 720-combination totality check, normalisers, cache, store integration, fixture/state agreement |
| React layer (51 tests) | `cd frontend && npm test` | hook ↔ store wiring, cache hydration across mounts, provider short-circuit, gateway request shapes, per-state component rendering |

Both run from the repo root via `npm run test:all`.

Two assertions are worth calling out because they encode requirements rather
than behaviour:

- **The five states render five different DOM trees.** `distinct visuals for each
  data state` is easy to claim and easy to lose — a refactor that collapses two
  treatments looks fine in review. So the tests render all five and assert the
  output differs, including with colour classes stripped, because colour alone
  fails a sunlit tablet.
- **One live provider serves many consumers from one set of reads.** The sidebar
  and the panels beside it share a store; the test counts the requests.
- **Fixtures derive the state they claim.** The Storybook gallery and the
  component tests share one set of fixtures, and
  `packages/atlas-dashboard-data/test/fixtures.test.js` feeds each fixture's own
  inputs back through `deriveState`. A story labelled `DEGRADED` therefore cannot
  drift into showing something the app would call something else — the usual way
  a mock gallery stops being evidence.

### The mock seam

`DashboardDataProvider` takes a view as a prop and supplies it to everything
below; `useDashboardData` returns it and the live machinery never starts — no
store, no socket, no fetch, asserted in the tests. The provider imports no
fixtures itself, which is what stops demo data from reaching a production
bundle through it. (Verified: a production build contains neither the fixture
module nor its strings.)

Storybook itself is **not installed**. The config and stories are committed and
the mock provider works in plain component tests, but adding several hundred
megabytes of unpinned devDependencies to a workspace whose Docker build runs
`npm ci` deserves its own review. One install command, in
[`frontend/README.md`](../frontend/README.md), is all that is left.

---

## One store for the whole screen

`DashboardDataProvider` has two modes. With a `value` it provides that view and
starts nothing — the mock seam. Without one it runs the live hook and shares the
result, and it is mounted near the root in `App.js`.

That is what makes a second consumer *ask for* the figures rather than fetch
them again. The sidebar's figures and activity feed read the same store as the
panels beside them, so one set of requests serves the screen — and, more
importantly, two panels cannot show counts that differ by a poll interval,
which is a bug nobody can reproduce.

---

## What the mock data turned out to be

The sweep after `fetchDashboardData()` found most of the rest of it was not
waiting to be wired up — it was dead, or already had a real replacement sitting
beside it unused:

| Was | Now |
|---|---|
| `contexts/StormContext.js` — two mock storms, two mock assessments, a `Math.random()` forecast, ~290 lines | **Deleted.** Nothing consumed `useStorm` once the dashboard stopped. Its cleanup also called `socket.off('storm_alert')` with no handler, which removes *every* listener for that event — including other modules'. |
| `contexts/PropertyContext.js` — mock properties and assessments, ~160 lines | **Deleted.** Nothing consumed `useProperty`. |
| `components/maps/StormMap.js` — a Leaflet map with ten hardcoded addresses pinned around downtown Dallas | **Deleted.** The dashboard now renders `RadarMap` — animated NOAA radar, NWS warning polygons, real property pins — which already existed and which the Storm Intelligence page was already using. |
| `components/layout/Sidebar.js` — twelve literal stats with invented trends (`'47'` / `'+12'`), three hardcoded activity sentences, and quick-action buttons whose handler was a `console.log` | **Rewritten** against the shared store, with per-lane "last known" marking. Links are router `Link`s to routes that exist; several of the old targets (`/property-assessment/new`, `/marketing`) never did. |
| `components/ui/StormAlert.js` — a `mockAlert` (*"Severe hail storm detected with high damage probability"*, 47 properties, 2.5 inch hail) shown by `Math.random() < 0.3` on a 30-second timer, as a red full-width banner on every page | **Rewritten** to show the worst storm actually being tracked, from the same store, using the sentence the data layer already composed. Shows nothing when there is nothing, and dismissal is per storm so silencing one cannot silence the next. |

The properties lane produces two lists from one read: `priorityProperties`, the
worst few for the dispatch queue, and `mapProperties`, more rows with the
ungeocoded ones dropped, for the map. One read means the pins and the queue can
never disagree about who the worst roof is, and a property with no coordinates
is dropped rather than drawn at 0,0 in the Gulf of Guinea. `toPropertyFeatures` in `@atlas/radar-map` accepts the domain model's
`score` as well as the raw column's `damage_probability`, so one map component
serves both callers without either reshaping for the other.

---

## The weather lane, and why the backend had to change first

`PredictionChart` was two stacked ECharts series named "Storm Probability" and
"Hail Risk", both literal arrays of twelve numbers, under a heading that read
"24-Hour Weather Forecast". They were also *stacked*, so the shape on screen was
the sum of two invented probabilities — a quantity with no meaning.

Pointing it at `/api/weather/forecast/hourly` was not enough on its own, because
**`NOAAWeatherService` silently substituted fabricated data on every failure
path**. A forecast, an hourly forecast, an area alert and a severe-weather check
all fell back to a mock generator and returned it through the same field as a
real response. The worst instance: `/api/weather/alerts` would serve an invented

> Severe Thunderstorm Warning … Take shelter immediately. Move to an interior
> room on the lowest floor.

that no meteorologist had issued. Wiring a chart to that would only have moved
the lie one layer up.

So the service reports failures as failures:

- Every successful payload is stamped `source: 'nws'`.
- A failure throws `WEATHER_UNAVAILABLE`, which the routes answer as **503 with
  that code** — so the dashboard marks one lane DEGRADED and keeps its last
  reading, instead of treating an upstream outage as a bug.
- `WEATHER_ALLOW_MOCK=true` brings the generator back for demos, and even then
  the payload is stamped `source: 'mock'` so the chart can label itself.
- **Alerts never fabricate, flag or no flag.** A warning that tells a person to
  take shelter is not a degraded experience if it is invented; it is a hazard.
- A severe-weather check never answers from a guess either: `isSevere: false`
  from a fabricated payload reads as an all-clear nobody checked.

### Where the forecast is for

The endpoint wants a point, and the honest answer to "which point" was already
in the database. `monitoring_regions` is the list of metros Atlas polls for
severe weather, so the gateway forecasts the first of them. An explicit
`location` option wins; `REACT_APP_DEFAULT_LAT`/`LNG` is the last resort. With
neither, the panel says *"No monitored region is configured, so there is nowhere
to forecast for"* rather than quietly forecasting a city nobody chose.

### One measure, one axis

The chart plots precipitation probability and nothing else. Wind is mph and
probability is a percentage; putting both on one plot needs two y-scales, and a
dual-axis chart invites the reader to infer a correlation from wherever the two
scalings happen to cross. Peak wind is a **number beside the title** instead,
which is the right form for a single value. Nothing is stacked, and only the
peak hour carries a label — a number on every point is noise.
