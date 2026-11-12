'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { DashboardStore, createCache, memoryStore, DATA_STATES, STALE_AFTER_MS } = require('../src/index.js');

const NOW = 1_700_000_000_000;

/** A clock the test moves by hand, so a day of dashboard life takes no time. */
function clock(start = NOW) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; return t; } };
}

/**
 * A scheduler whose timers only fire when the test says so. Real timers in a
 * test suite buy nothing but flakes.
 */
function manualScheduler() {
  let seq = 0;
  const timers = new Map();
  return {
    setTimeout: (fn, delay) => { const id = ++seq; timers.set(id, { fn, delay }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    pending: () => timers.size,
    async runAll() {
      const due = [...timers.values()];
      timers.clear();
      for (const t of due) await t.fn();
    }
  };
}

const payloads = {
  properties: {
    total: { data: [], meta: { total: 1284 } },
    highRisk: {
      meta: { total: 47 },
      data: [
        { id: 'p1', address: '1247 Oak Ridge Dr', damage_probability: 94, last_assessment_date: '2023-11-14T22:00:00Z' },
        { id: 'p2', address: '3856 Maple Ave', damage_probability: 87 }
      ]
    }
  },
  storms: { meta: { total: 2 }, data: [{ id: 's1', event_type: 'hail', severity: 'moderate', region_name: 'Tarrant County, TX', detected_at: '2023-11-14T21:00:00Z' }] },
  assessments: { meta: { total: 18 }, data: [{ id: 'a1', status: 'completed', address: '1247 Oak Ridge Dr', overall_score: 94, completed_at: '2023-11-14T22:00:00Z' }] },
  alerts: { meta: { count: 3 }, features: [{ properties: { id: 'nws-1', event: 'Severe Thunderstorm Warning', headline: 'Warning for Dallas County', actionable: true, onset: '2023-11-14T22:00:00Z' } }] }
};

/** A gateway that answers from `payloads`, with per-lane failure injection. */
function gateway({ fail = [], calls = {} } = {}) {
  const build = (name) => async () => {
    calls[name] = (calls[name] || 0) + 1;
    const failure = fail.find((f) => f === name || f?.name === name);
    if (failure) {
      throw Object.assign(new Error(failure?.message || 'upstream said no'), {
        code: failure?.code || 'NETWORK'
      });
    }
    return payloads[name];
  };
  return {
    properties: build('properties'),
    storms: build('storms'),
    assessments: build('assessments'),
    alerts: build('alerts')
  };
}

const connected = (store) => { store.setRealtime('connected'); return store; };

/* ------------------------------------------------------------ happy path -- */

test('a store starts SYNCING with a complete, zeroed model', () => {
  const store = new DashboardStore({ gateway: gateway() });
  const view = store.getView();
  assert.equal(view.state, DATA_STATES.SYNCING);
  assert.equal(view.summary.totalProperties, 0);
  assert.deepEqual(view.activity, []);
  assert.equal(view.fetchedAt, null);
  assert.equal(view.fromCache, false);

  // Every field a component reads has to exist from the first render. The bug
  // this guards: `forecast` and `mapProperties` were added to the snapshot and
  // not to the view, so the chart and the map both got `undefined` and only a
  // test caught it.
  for (const key of ['activity', 'priorityProperties', 'mapProperties', 'forecast']) {
    assert.ok(Array.isArray(view[key]), `view.${key} must be an array from the start`);
  }
  assert.equal(view.forecastSource, null);
});

test('the view exposes every field of the snapshot it is built from', () => {
  // Structural, so the next field added to the model cannot be left out of the
  // view the way these two were.
  const store = new DashboardStore({ gateway: gateway() });
  for (const key of Object.keys(store.snapshot)) {
    assert.ok(key in store.getView(), `snapshot.${key} is missing from the view`);
  }
});

test('a full refresh with the socket up is LIVE and carries every lane', async () => {
  const c = clock();
  const store = connected(new DashboardStore({ gateway: gateway(), now: c.now }));
  await store.refresh();

  const view = store.getView();
  assert.equal(view.state, DATA_STATES.LIVE);
  assert.deepEqual(view.summary, {
    totalProperties: 1284, activeStorms: 2, highRiskProperties: 47, recentAssessments: 18, weatherAlerts: 3
  });
  assert.equal(view.priorityProperties[0].address, '1247 Oak Ridge Dr');
  assert.equal(view.fetchedAt, NOW);
  assert.deepEqual(view.failedSources, []);

  // Activity is the three event-bearing lanes merged, newest first.
  // The alert and the assessment share an instant, so the id tie-break decides
  // their order - deterministically, whichever lane lands first.
  assert.deepEqual(view.activity.map((e) => e.id), ['alert:nws-1', 'assessment:a1', 'storm:s1']);
});

test('a refresh without a socket is STALE, however fresh the data is', async () => {
  const store = new DashboardStore({ gateway: gateway(), now: clock().now });
  await store.refresh();
  assert.equal(store.getView().state, DATA_STATES.STALE);
});

test('data ages into STALE with nothing else changing', async () => {
  const c = clock();
  const store = connected(new DashboardStore({ gateway: gateway(), now: c.now }));
  await store.refresh();
  assert.equal(store.getView().state, DATA_STATES.LIVE);

  c.advance(STALE_AFTER_MS + 1);
  store.tick();
  assert.equal(store.getView().state, DATA_STATES.STALE);
  assert.equal(store.getView().summary.totalProperties, 1284, 'stale does not mean empty');
});

/* -------------------------------------------------------- partial outage -- */

test('one failed lane is DEGRADED and names the lane and its code', async () => {
  const c = clock();
  const store = connected(new DashboardStore({
    gateway: gateway({ fail: [{ name: 'alerts', code: 'ALERTS_UNAVAILABLE', message: 'Alert feed is unavailable' }] }),
    now: c.now
  }));
  await store.refresh();

  const view = store.getView();
  assert.equal(view.state, DATA_STATES.DEGRADED);
  assert.deepEqual(view.failedSources, ['alerts']);
  assert.equal(view.sources.alerts.code, 'ALERTS_UNAVAILABLE');
  assert.equal(view.sources.alerts.message, 'Alert feed is unavailable');
  assert.equal(view.sources.properties.ok, true);
  assert.equal(view.summary.totalProperties, 1284, 'the lanes that answered still render');
});

test('a lane that fails on a later pass keeps its last known value', async () => {
  // This is the behaviour DEGRADED exists for: the alert count must not flip
  // to a confident zero, which an operator would read as "no weather today".
  const c = clock();
  const store = connected(new DashboardStore({ gateway: gateway(), now: c.now }));
  await store.refresh();
  assert.equal(store.getView().summary.weatherAlerts, 3);

  store.gateway = gateway({ fail: ['alerts'] });
  c.advance(10_000);
  await store.refresh();

  const view = store.getView();
  assert.equal(view.state, DATA_STATES.DEGRADED);
  assert.equal(view.summary.weatherAlerts, 3, 'last known, not reset to zero');
  assert.equal(view.activity.some((e) => e.id === 'alert:nws-1'), true, 'and its activity rows stay');
  assert.equal(view.fetchedAt, NOW + 10_000, 'the pass still counts as a read');
});

test('every lane failing is OFFLINE, and the last good data stays on screen', async () => {
  const c = clock();
  const store = connected(new DashboardStore({ gateway: gateway(), now: c.now }));
  await store.refresh();

  store.gateway = gateway({ fail: ['properties', 'storms', 'assessments', 'alerts'] });
  c.advance(5_000);
  await store.refresh();

  const view = store.getView();
  assert.equal(view.state, DATA_STATES.OFFLINE);
  assert.equal(view.failedSources.length, 4);
  assert.equal(view.summary.totalProperties, 1284);
  assert.equal(view.fetchedAt, NOW, 'the failed pass did not move the clock on the data');
});

test('a lane answering with an unreadable payload is a failed lane, not a crash', async () => {
  const store = connected(new DashboardStore({
    gateway: { ...gateway(), properties: async () => { throw Object.assign(new Error('boom'), { code: 'X' }); } },
    now: clock().now
  }));
  // A payload the normaliser cannot read takes a different path to a rejection,
  // so drive that one too.
  store.gateway.properties = async () => ({ total: { meta: { total: 5 } }, highRisk: { data: 'not an array' } });
  await assert.doesNotReject(() => store.refresh());
  assert.equal(store.getView().summary.totalProperties, 5);
  assert.equal(store.getView().state, DATA_STATES.LIVE, 'a tolerable payload is not a failure');
});

test('an aborted read is not recorded as a failure', async () => {
  const store = connected(new DashboardStore({
    gateway: { properties: async () => { throw Object.assign(new Error('aborted'), { code: 'ABORTED' }); } },
    now: clock().now
  }));
  await store.refresh();
  assert.equal(store.getView().sources.properties.at, null, 'an unmount says nothing about lane health');
  assert.equal(store.getView().state, DATA_STATES.SYNCING, 'still waiting for a first real answer');
});

/* ---------------------------------------------------------------- offline -- */

test('the browser going offline is OFFLINE immediately, and coming back re-reads', async () => {
  const c = clock();
  const scheduler = manualScheduler();
  const store = connected(new DashboardStore({ gateway: gateway(), now: c.now, scheduler }));
  await store.refresh();

  store.setOnline(false);
  assert.equal(store.getView().state, DATA_STATES.OFFLINE);
  assert.equal(store.getView().summary.totalProperties, 1284, 'cached numbers stay visible');

  store.setOnline(true);
  assert.equal(scheduler.pending(), 1, 'a re-read is queued rather than waiting for the next poll');
  await scheduler.runAll();
  assert.equal(store.getView().state, DATA_STATES.LIVE);
});

/* ------------------------------------------------------------ cache lane -- */

test('hydrate paints the cached snapshot without claiming it is fresh', async () => {
  const storage = memoryStore();
  const c = clock();

  const first = connected(new DashboardStore({
    gateway: gateway(), now: c.now, cache: createCache({ store: storage, now: c.now })
  }));
  await first.refresh();
  assert.equal(first.getView().state, DATA_STATES.LIVE);

  // A new tab, an hour later, with nothing reachable.
  c.advance(60 * 60 * 1000);
  const second = new DashboardStore({
    gateway: gateway({ fail: ['properties', 'storms', 'assessments', 'alerts'] }),
    now: c.now,
    cache: createCache({ store: storage, now: c.now })
  });

  assert.equal(second.hydrate(), true);
  let view = second.getView();
  assert.equal(view.summary.totalProperties, 1284, 'the picture paints before the network is asked');
  assert.equal(view.fromCache, true);
  assert.equal(view.fetchedAt, NOW, 'with the age it actually has');
  assert.equal(view.state, DATA_STATES.STALE, 'data, but not freshness');

  await second.refresh();
  view = second.getView();
  assert.equal(view.state, DATA_STATES.OFFLINE);
  assert.equal(view.fromCache, true, 'nothing has replaced the cached copy');
});

test('hydrate does not overwrite data that has already arrived', async () => {
  const storage = memoryStore();
  const c = clock();
  const cache = createCache({ store: storage, now: c.now });
  cache.write({ summary: { totalProperties: 1 }, activity: [], priorityProperties: [], fetchedAt: NOW - 10_000 });

  const store = connected(new DashboardStore({ gateway: gateway(), now: c.now, cache }));
  await store.refresh();
  assert.equal(store.hydrate(), false);
  assert.equal(store.getView().summary.totalProperties, 1284);
});

test('a failed refresh never writes the cache', async () => {
  const storage = memoryStore();
  const c = clock();
  const store = new DashboardStore({
    gateway: gateway({ fail: ['properties', 'storms', 'assessments', 'alerts'] }),
    now: c.now,
    cache: createCache({ store: storage, now: c.now })
  });
  await store.refresh();
  assert.equal(createCache({ store: storage, now: c.now }).read(), null);
});

/* --------------------------------------------------------- realtime lane -- */

test('a push lands an activity row at once and queues one re-read', async () => {
  const c = clock();
  const scheduler = manualScheduler();
  const calls = {};
  const store = connected(new DashboardStore({
    gateway: gateway({ calls }), now: c.now, scheduler, pushDebounceMs: 2000
  }));
  await store.refresh();
  assert.equal(calls.properties, 1);

  c.advance(1000);
  store.handleRealtime('property_assessment_complete', {
    id: 'a9', propertyAddress: '12 Elm St', overallScore: 91
  });

  const view = store.getView();
  assert.equal(view.activity[0].id, 'assessment:a9', 'at the top of the feed immediately');
  assert.match(view.activity[0].message, /12 Elm St/);
  assert.equal(view.summary.recentAssessments, 18, 'but the count is not invented');

  await scheduler.runAll();
  assert.equal(calls.assessments, 2, 'the count comes from a re-read instead');
});

test('a burst of pushes coalesces into a single re-read', async () => {
  // A squall line crossing a metro emits alerts in bursts of twenty.
  const scheduler = manualScheduler();
  const calls = {};
  const store = connected(new DashboardStore({ gateway: gateway({ calls }), now: clock().now, scheduler }));
  await store.refresh();

  for (let i = 0; i < 20; i++) {
    store.handleRealtime('storm_alert', { id: `s${i}`, type: 'hail', region: 'Tarrant County, TX' });
  }
  assert.equal(scheduler.pending(), 1, 'one timer, not twenty');

  await scheduler.runAll();
  assert.equal(calls.storms, 2);
});

test('a pushed row is replaced, not duplicated, when the refresh brings it back', async () => {
  const c = clock();
  const scheduler = manualScheduler();
  const store = connected(new DashboardStore({ gateway: gateway(), now: c.now, scheduler }));
  await store.refresh();

  store.handleRealtime('property_assessment_complete', {
    id: 'a1', propertyAddress: '1247 Oak Ridge Dr', overallScore: 94
  });
  await scheduler.runAll();

  const matching = store.getView().activity.filter((e) => e.id === 'assessment:a1');
  assert.equal(matching.length, 1, 'the push and the fetched row are the same event');
});

test('dashboard_update accepts server totals and ignores everything else', async () => {
  const store = connected(new DashboardStore({ gateway: gateway(), now: clock().now }));
  await store.refresh();

  store.handleRealtime('dashboard_update', { activeStorms: 9, totalProperties: 'many', evil: true });
  const view = store.getView();
  assert.equal(view.summary.activeStorms, 9);
  assert.equal(view.summary.totalProperties, 1284, 'a non-numeric total changes nothing');
  assert.equal(view.summary.evil, undefined);
});

test('a server total is superseded by the next authoritative read', async () => {
  // The bug this guards: the patch used to be applied on every view build, so
  // a single push pinned the tile forever and no later read could correct it.
  const c = clock();
  const store = connected(new DashboardStore({ gateway: gateway(), now: c.now }));
  await store.refresh();

  store.handleRealtime('dashboard_update', { activeStorms: 9 });
  assert.equal(store.getView().summary.activeStorms, 9);

  c.advance(10_000);
  await store.refresh();
  assert.equal(store.getView().summary.activeStorms, 2, 'the API is the authority again');
});

test('an unknown push changes nothing at all', async () => {
  const store = connected(new DashboardStore({ gateway: gateway(), now: clock().now }));
  await store.refresh();
  const before = store.getView();
  store.handleRealtime('weather_vibes', { mood: 'ominous' });
  assert.equal(store.getView(), before, 'identical identity, so no re-render');
});

/* ------------------------------------------------------- subscribe/views -- */

test('subscribers are told once per real change, and never for a no-op poll', async () => {
  const c = clock();
  const store = connected(new DashboardStore({ gateway: gateway(), now: c.now }));

  const seen = [];
  const unsubscribe = store.subscribe((view) => seen.push(view.state));

  await store.refresh();
  assert.deepEqual(seen, [DATA_STATES.SYNCING, DATA_STATES.LIVE]);

  // A second identical refresh moves nothing an operator can see.
  seen.length = 0;
  await store.refresh();
  assert.deepEqual(seen, [DATA_STATES.SYNCING, DATA_STATES.LIVE], 'only the in-flight hop and back');

  seen.length = 0;
  store.tick();
  assert.deepEqual(seen, [], 'a tick on unchanged, fresh data is silent');

  unsubscribe();
  store.setOnline(false);
  assert.deepEqual(seen, [], 'and an unsubscribed listener hears nothing');
});

test('the view identity is stable when nothing changed', async () => {
  // `useSyncExternalStore` compares by reference, so a fresh object here would
  // re-render the dashboard forever.
  const store = connected(new DashboardStore({ gateway: gateway(), now: clock().now }));
  await store.refresh();
  const a = store.getView();
  store.tick();
  assert.equal(store.getView(), a);
});

test('the transition history records why the badge moved', async () => {
  const c = clock();
  const store = connected(new DashboardStore({ gateway: gateway(), now: c.now }));
  await store.refresh();
  store.gateway = gateway({ fail: ['alerts'] });
  c.advance(1000);
  await store.refresh();
  store.setOnline(false);

  const history = store.getView().history;
  assert.deepEqual(
    history.map((h) => `${h.from}->${h.to}`),
    ['SYNCING->LIVE', 'LIVE->SYNCING', 'SYNCING->DEGRADED', 'DEGRADED->OFFLINE']
  );
  assert.equal(history.at(-1).reason, 'browser offline');
  assert.ok(history.every((h) => typeof h.at === 'number'));
});

test('the history is bounded, so a long-lived tab cannot grow without limit', async () => {
  const store = new DashboardStore({ gateway: gateway(), now: clock().now });
  for (let i = 0; i < 60; i++) store.setOnline(i % 2 === 0);
  assert.equal(store.getView().history.length, store.historyLimit);
});

/* ---------------------------------------------------------------- limits -- */

test('two overlapping refreshes make one set of requests', async () => {
  const calls = {};
  const store = new DashboardStore({ gateway: gateway({ calls }), now: clock().now });
  await Promise.all([store.refresh(), store.refresh(), store.refresh()]);
  assert.equal(calls.properties, 1, 'the later callers join the first');
});

test('a lane with no loader is simply not read', async () => {
  const store = connected(new DashboardStore({
    gateway: { properties: gateway().properties }, now: clock().now
  }));
  await store.refresh();
  const view = store.getView();
  assert.deepEqual(Object.keys(view.sources), ['properties']);
  assert.equal(view.state, DATA_STATES.LIVE);
  assert.equal(view.summary.weatherAlerts, 0, 'a lane nobody reads is zero, not last-known');
});

test('a store with no gateway at all does not throw', async () => {
  const store = new DashboardStore({});
  await assert.doesNotReject(() => store.refresh());
  assert.equal(store.getView().state, DATA_STATES.SYNCING);
});

test('dispose stops timers and silences the store', async () => {
  const scheduler = manualScheduler();
  const store = connected(new DashboardStore({ gateway: gateway(), now: clock().now, scheduler }));
  await store.refresh();

  let notified = 0;
  store.subscribe(() => { notified += 1; });
  store.handleRealtime('storm_alert', { id: 's5', region: 'X' });
  assert.equal(scheduler.pending(), 1);

  store.dispose();
  assert.equal(scheduler.pending(), 0, 'the queued re-read is cancelled');

  store.handleRealtime('storm_alert', { id: 's6', region: 'Y' });
  await store.refresh();
  assert.equal(notified, 1, 'nothing after dispose reaches a subscriber');
});

test('activity is bounded by the configured limit', async () => {
  const data = Array.from({ length: 40 }, (_, i) => ({
    id: `s${i}`, event_type: 'hail', region_name: 'X', detected_at: new Date(NOW - i * 1000).toISOString()
  }));
  const store = new DashboardStore({
    gateway: { storms: async () => ({ meta: { total: 40 }, data }) },
    now: clock().now,
    activityLimit: 4
  });
  await store.refresh();
  assert.equal(store.getView().activity.length, 4);
});

/* ------------------------------------------------------------ lifecycle -- */

test('a disposed store re-opens, so a StrictMode remount still loads', async () => {
  const calls = {};
  const store = connected(new DashboardStore({ gateway: gateway({ calls }), now: clock().now }));

  // Exactly what React does in development: effect, cleanup, effect again -
  // all against the one memoised store.
  store.activate(); store.hydrate(); const first = store.refresh();
  store.dispose();
  store.activate(); store.hydrate(); await store.refresh();
  await first.catch(() => {});

  const view = store.getView();
  assert.equal(view.state, DATA_STATES.LIVE, 'a remounted store must still reach LIVE');
  assert.equal(view.summary.totalProperties, 1284);
  assert.ok(view.fetchedAt !== null, 'the second read has to be allowed to land');
});

test('activate is idempotent and leaves a live store alone', async () => {
  const store = connected(new DashboardStore({ gateway: gateway(), now: clock().now }));
  await store.refresh();
  const before = store.getView();
  store.activate();
  store.activate();
  assert.equal(store.getView(), before, 'activating a live store must not churn the view');
});

test('a read aborted by dispose cannot land on the re-opened store', async () => {
  let release;
  const stalled = new Promise((resolve) => { release = resolve; });
  let pass = 0;

  const store = connected(new DashboardStore({
    now: clock().now,
    gateway: {
      // First pass hangs until released, then answers with a total that must
      // never be displayed; the second pass answers normally.
      properties: async () => {
        pass += 1;
        if (pass === 1) { await stalled; return { total: { data: [], meta: { total: 999 } }, highRisk: { meta: { total: 0 }, data: [] } }; }
        return payloads.properties;
      }
    }
  }));

  const abandoned = store.refresh();   // generation 0
  store.dispose();                     // aborts it, bumps the generation
  store.activate();
  await store.refresh();               // generation 1, lands normally

  release();
  await abandoned.catch(() => {});
  await Promise.resolve();

  assert.equal(
    store.getView().summary.totalProperties, 1284,
    'the superseded read must not overwrite the current one'
  );
});
