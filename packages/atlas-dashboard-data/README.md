# @atlas/dashboard-data

The dashboard's data layer: one typed domain model fed by three lanes — REST,
WebSocket and a local cache — with an explicit lifecycle for how much of it can
be trusted right now.

**LIVE → SYNCING → STALE → DEGRADED → OFFLINE**

Framework-free. Pure functions and a plain observable store, so the model can be
driven by React, by the mobile field tool, or by a test with no renderer at all.

Full contract and rationale: [`DESIGN/dashboard-data-layer.md`](../../DESIGN/dashboard-data-layer.md).

```bash
npm test --workspace=@atlas/dashboard-data
```

## Use

```js
const { DashboardStore, createCache, describeState } = require('@atlas/dashboard-data');

const store = new DashboardStore({
  gateway: {
    // One loader per lane. Each fails independently.
    properties: (signal) => fetchProperties(signal),
    storms: (signal) => fetchStorms(signal),
    assessments: (signal) => fetchAssessments(signal),
    alerts: (signal) => fetchAlerts(signal)
  },
  cache: createCache({ store: window.localStorage })
});

store.subscribe((view) => render(view));

store.hydrate();          // paint the cached picture first
store.refresh();          // then read the network
store.setRealtime('connected');
store.handleRealtime('storm_alert', payload);
```

`getView()` returns a frozen view with a **stable identity** — it only changes
when something a component renders has changed, which is what
`useSyncExternalStore` needs and what keeps a 60-second poll on a quiet
dashboard from re-rendering a map twice a minute.

## Design notes

- **`deriveState` is pure and total.** The state is never assigned; it is derived
  from every signal that could make the screen untrustworthy. The guard order is
  the design, and one test walks 720 input combinations to prove no input falls
  through it.
- **`allSettled`, not `all`.** One 503 from an upstream weather feed must dim one
  card, not blank the dashboard. Each lane keeps its last good contribution, so
  a failed lane shows its last known value rather than a confident `0`.
- **Pushes invalidate, they do not assert.** A socket event adds an activity row
  and asks for a re-read; it never adjusts a count. A dashboard that increments
  its own tiles drifts away from the API within minutes, invisibly.
- **Every instant is epoch ms.** A `Date` does not survive the cache's JSON
  round trip, and the first `.toLocaleTimeString()` after it comes back throws.
- **Fixtures are not in the barrel.** `require('@atlas/dashboard-data/src/fixtures')`
  has to be deliberate, so the Storybook views cannot reach a production bundle.

## Modules

| File | What |
|---|---|
| `src/types.js` | JSDoc domain model, frozen enums, the risk thresholds |
| `src/states.js` | `deriveState`, `describeState`, `worstOf`, `transition` |
| `src/normalize.js` | Raw API payloads → the domain model; the only file that knows a storm row calls its region `region_name` |
| `src/cache.js` | TTL cache over an injected storage adapter; survives a storage that throws |
| `src/store.js` | `DashboardStore` — the source multiplexer |
| `src/fixtures.js` | One view per state, for stories and tests only |
