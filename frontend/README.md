# Atlas & Helios — frontend

React 18 (Create React App), Tailwind, Framer Motion, ECharts, MapLibre,
Socket.IO.

```bash
npm install            # from the repo root: this is an npm workspace
npm start              # dev server on :3000, proxying /api to :5000
npm test               # jest + React Testing Library
npm run build          # production bundle
npm run build:check    # production build, failing only on OUR warnings
npm run storybook      # component gallery on :6006
```

`build:check` exists because `CI=true npm run build` promotes every webpack
warning to an error, including ones emitted from inside a dependency — today,
`maplibre-gl` v6's own bundle contains a dynamic require that webpack flags.
That one third-party warning made the strict build unusable, so nobody ran it,
so real lint errors in our code reached reviewers instead. `build:check` runs
the same build and fails only on warnings from `src/` or our workspace
packages, lint findings included.

`npm start` proxies `/api` to `http://localhost:5000` (the `proxy` field in
`package.json`), so run the backend alongside it — or `npm run dev` from the
root, which starts both.

### Running the whole stack without Postgres

The backend defaults to Postgres, which is what production runs. For a local
look at the product, `DB_CLIENT=sqlite3` puts it on a file instead — the same
engine the test suite already uses, so the migration is known to work on it:

```bash
cd backend
DB_CLIENT=sqlite3 npm run migrate     # create the schema
DB_CLIENT=sqlite3 npm run seed        # a company, 12 properties, 2 storms, 6 assessments
DB_CLIENT=sqlite3 npm run dev         # :5000

cd ../frontend && npm start           # :3000
```

Sign in with **dev@atlashelios.test / atlas-dev-password**.

The seed is a development dataset, not mock data: they are rows in a real
database, read through the real API. Delete them and the dashboard honestly
shows an empty tenant; stop the backend and it honestly shows OFFLINE.

With no outbound access to `api.weather.gov` the alert and forecast lanes
answer 503 and the dashboard shows DEGRADED with those two feeds named — which
is the intended behaviour, and a good way to see it. `WEATHER_ALLOW_MOCK=true`
on the backend makes the forecast render from the demo generator instead,
labelled *"Demo forecast — the NOAA feed is not connected."*

### Environment

| Variable | Default | Notes |
|---|---|---|
| `REACT_APP_API_URL` | `/api` | Same-origin by default, which is what the reverse proxy expects. |
| `REACT_APP_WS_URL` | the page's own origin | Only set this for a split deployment where the socket lives elsewhere. |
| `REACT_APP_DEFAULT_LAT` / `_LNG` | — | Fallback forecast point. Normally unnecessary: the dashboard forecasts the first active monitoring region. |
| `REACT_APP_BASEMAP_PROVIDER` | `hosted` | `hosted` uses OpenFreeMap's public instance — no key, no rate limit, commercial use allowed. `pmtiles` uses a self-hosted Protomaps archive instead. |
| `REACT_APP_PMTILES_URL` | — | The `.pmtiles` archive, e.g. `https://tiles.example.com/dfw.pmtiles`. Required by the `pmtiles` provider; without it the map falls back to hosted and says so in its footer. |
| `REACT_APP_PMTILES_STYLE_URL` | built-in | Only for an archive built with the Protomaps schema rather than OpenMapTiles. The built-in style keeps a self-hosted archive working offline. |

Both tile hosts serve OpenStreetMap data through the OpenMapTiles schema and
render through MapLibre GL, so switching provider changes who serves the tiles
and nothing else. `DESIGN/mapping-stack.md` covers the choice, why
`tile.openstreetmap.org` is refused in code, and why GLG-CE was evaluated and
rejected on licence grounds.

The backend has one worth knowing about too: **`WEATHER_ALLOW_MOCK=true`** lets
a failed NOAA call answer with the demo generator instead of a 503. It is off by
default, and even when on the payload is stamped `source: 'mock'` so the chart
labels itself. Weather *alerts* never fabricate either way.

---

## The dashboard data layer

> Full contract: [`DESIGN/dashboard-data-layer.md`](../DESIGN/dashboard-data-layer.md)

`App.js` mounts one `DashboardDataProvider`, which owns a single live store.
Every consumer below it — the dashboard panels, the sidebar — reads that one
store through `useDashboardData()`, so one set of requests serves the screen and
two panels cannot disagree by a poll interval.

The dashboard reads **one hook**. It owns no data, fetches nothing itself, and
holds no state about what the numbers are:

```js
import { useDashboardData } from '../data/useDashboardData';

const { state, summary, activity, priorityProperties,
        fetchedAt, failedSources, fetching, refresh } = useDashboardData();
```

| Field | What it is |
|---|---|
| `state` | `LIVE` · `SYNCING` · `STALE` · `DEGRADED` · `OFFLINE` |
| `summary` | The five counts. Always numbers, never `undefined`. |
| `activity` | Newest-first events, messages already composed. |
| `priorityProperties` | Worst-first dispatch queue. |
| `mapProperties` | The same read, more rows, ungeocoded ones dropped — what the map pins. |
| `forecast` | Next 24 hours from the NWS hourly grid, oldest first. |
| `forecastSource` | `'nws'`, `'mock'` or `null`. A view showing `mock` must say so. |
| `fetchedAt` | Epoch ms of the newest data on screen, or `null`. |
| `failedSources` | Which read lanes are down, by name. |
| `fetching` | A read is in flight. Separate from `state` on purpose. |
| `refresh()` | Re-read on demand. |
| `description` | `{ label, hint, tone, trusted }` — the copy for `state`. |
| `recoverable` | Whether offering a Retry would make sense. |

### Where the pieces live

```
src/data/
  useDashboardData.js    the hook, the provider, freshness formatting
  dashboardGateway.js    the REST lane — the only file that names endpoints
src/components/ui/
  DataStateBadge.js      the badge, the tone palette, per-state treatments
  QuickStats.js          the five tiles
src/components/dashboard/
  ActivityFeed.js        the feed, in five states
  PriorityQueue.js       the dispatch queue, in five states

packages/atlas-dashboard-data/   the framework-free model, store and lifecycle
```

### Rules for a component that shows dashboard data

1. **Take `state` as a prop and render it.** Five ways, not one. A panel that
   renders the same regardless of state is quietly claiming its numbers are
   always current.
2. **Never blank existing data on a refresh.** Placeholders are for the *first*
   read only (`state === 'SYNCING' && fetchedAt === null`). The flicker is how a
   dashboard teaches its operator to distrust it.
3. **Distinguish "nothing happened" from "we cannot see".** An empty panel that
   does not say which is the most misleading thing on the screen.
4. **A confident `0` is a claim.** Under `DEGRADED` the store keeps each lane's
   last known value; render that and label it, rather than zero.
5. **Get copy and colour from the data layer.** `describeState(state)` for the
   words, `tonesFor(state)` / `treatmentFor(state)` for the classes. Five
   components inventing five vocabularies for one state is the failure mode.
6. **Instants are epoch ms.** Use `formatFreshness` / `useFreshnessLabel`; do not
   put a `Date` in the model.

### Adding a figure to the dashboard

1. Add the count to `DashboardSummary` and `EMPTY_SUMMARY`
   (`packages/atlas-dashboard-data/src/types.js`, `src/normalize.js`).
2. Return it from the lane that owns it in `src/normalize.js`, and add the read
   to `src/data/dashboardGateway.js` if no lane covers it.
3. Add a tile to `QuickStats`, naming its `source` so a failure of that lane
   dims that tile and no other.
4. Extend the lane's test in `packages/atlas-dashboard-data/test/normalize.test.js`.

---

## Testing

```bash
npm test                    # watch mode
CI=true npm test            # once, non-interactive
```

Component tests mount a panel with a view handed to it. For a component that
reads the hook instead of props, wrap it in the mock provider — no network, no
socket, no clock:

```jsx
import { DashboardDataProvider } from '../data/useDashboardData';
import { dashboardFixtures } from '@atlas/dashboard-data/src/fixtures';

render(
  <DashboardDataProvider value={dashboardFixtures().DEGRADED}>
    <PanelUnderTest />
  </DashboardDataProvider>
);
```

The fixtures carry one view per state, plus `EMPTY` for a tenant with nothing on
file. Each is checked against the real state machine by the data layer's own
suite, so a fixture cannot claim a state the app would disagree with.

They are deliberately absent from the `@atlas/dashboard-data` barrel — reaching
for `/src/fixtures` has to be on purpose, so demo data cannot be pulled into a
production bundle by a stray import.

---

## Storybook

```bash
npm run storybook          # :6006
npm run build-storybook    # static build into storybook-static/ (gitignored)
```

`@storybook/preset-create-react-app` is the load-bearing piece and has to stay
first in the `addons` list. Storybook notices `react-scripts` is installed and
switches its own babel handling off, so without that preset the webpack chain
carries no babel-loader at all and the build dies on the first line of JSX in
every story. Handing Storybook CRA's own config is the better outcome anyway: a
story then compiles exactly the way the component does, Tailwind and PostCSS
included.

Committed stories:

| Story | Shows |
|---|---|
| `Data layer/DataStateBadge` | All five states side by side, compact variants, panel notes |
| `Data layer/DashboardDataProvider` | A component reading the hook with the live machinery switched off |
| `Dashboard/QuickStats` | The tiles in every state, including one failed lane among four healthy |
| `Dashboard/ActivityFeed` | Skeletons, rows, degraded, and empty-vs-offline |
| `Dashboard/PriorityQueue` | Every state, plus a property nobody has assessed |
| `Dashboard/PredictionChart` | Every state, a labelled demo feed, a forecast-only outage, and no configured region |

There is deliberately **no full-page `Dashboard` story**: `RadarMap` fetches
radar tiles and alert polygons of its own, so the page would not render
meaningfully without a network.

### Adding a story

Give the component its view as props and take it from the shared fixtures, so
the gallery and the tests show the same thing:

```jsx
import { dashboardFixtures } from '@atlas/dashboard-data/src/fixtures';
const fixtures = dashboardFixtures();
// ...then render one panel per state, side by side.
```
