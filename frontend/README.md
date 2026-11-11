# Atlas & Helios — frontend

React 18 (Create React App), Tailwind, Framer Motion, ECharts, MapLibre,
Socket.IO.

```bash
npm install            # from the repo root: this is an npm workspace
npm start              # dev server on :3000, proxying /api to :5000
npm test               # jest + React Testing Library
npm run build          # production bundle
```

`npm start` proxies `/api` to `http://localhost:5000` (the `proxy` field in
`package.json`), so run the backend alongside it — or `npm run dev` from the
root, which starts both.

### Environment

| Variable | Default | Notes |
|---|---|---|
| `REACT_APP_API_URL` | `/api` | Same-origin by default, which is what the reverse proxy expects. |
| `REACT_APP_WS_URL` | the page's own origin | Only set this for a split deployment where the socket lives elsewhere. |

---

## The dashboard data layer

> Full contract: [`DESIGN/dashboard-data-layer.md`](../DESIGN/dashboard-data-layer.md)

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

The config (`.storybook/`) and the stories (`src/**/*.stories.jsx`) are
committed; Storybook itself is **not** in `package.json`. Several hundred
megabytes of unpinned devDependencies on a workspace whose Docker build runs
`npm ci` is a change that deserves its own review, and the thing this work
needed — a way to render every data state without a network — is the mock
provider, which already works in plain component tests.

One install, from the repo root:

```bash
npm i -D --workspace=atlas-helios-frontend \
  storybook @storybook/react @storybook/react-webpack5 \
  @storybook/addon-essentials @storybook/addon-a11y

npm run storybook --workspace=atlas-helios-frontend     # :6006
```

Committed stories:

| Story | Shows |
|---|---|
| `Data layer/DataStateBadge` | All five states side by side, compact variants, panel notes |
| `Data layer/DashboardDataProvider` | A component reading the hook with the live machinery switched off |
| `Dashboard/QuickStats` | The tiles in every state, including one failed lane among four healthy |
| `Dashboard/ActivityFeed` | Skeletons, rows, degraded, and empty-vs-offline |
| `Dashboard/PriorityQueue` | Every state, plus a property nobody has assessed |

There is deliberately **no full-page `Dashboard` story**: `StormMap` and
`PredictionChart` still own their own data, so the page would not render
meaningfully without a network. Those two are on the list in
[`DESIGN/dashboard-data-layer.md`](../DESIGN/dashboard-data-layer.md#still-mock-elsewhere).
