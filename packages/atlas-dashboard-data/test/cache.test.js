'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createCache, memoryStore, safeStore, CACHE_VERSION } = require('../src/index.js');

const NOW = 1_700_000_000_000;
const snapshotAt = (fetchedAt) => ({
  summary: { totalProperties: 1284, activeStorms: 2, highRiskProperties: 47, recentAssessments: 18, weatherAlerts: 3 },
  activity: [{ id: 'storm:s1', type: 'storm', message: 'Hail active in Tarrant County, TX', timestamp: fetchedAt, severity: 'warning' }],
  priorityProperties: [{ id: 'p1', address: '1247 Oak Ridge Dr', score: 94, risk: 'high', timestamp: fetchedAt }],
  fetchedAt
});

test('a round trip returns the snapshot and its age', () => {
  const store = memoryStore();
  let now = NOW;
  const cache = createCache({ store, ttlMs: 60_000, now: () => now });

  assert.equal(cache.read(), null, 'nothing cached yet');
  assert.equal(cache.write(snapshotAt(NOW)), true);

  now = NOW + 30_000;
  const read = cache.read();
  assert.equal(read.fetchedAt, NOW);
  assert.equal(read.age, 30_000);
  assert.equal(read.expired, false);
  assert.deepEqual(read.snapshot.summary, snapshotAt(NOW).summary);
});

test('timestamps survive the JSON round trip as numbers', () => {
  // The bug this guards: a `Date` in the model becomes a string in storage,
  // and the first component to call `.toLocaleTimeString()` on it throws.
  const cache = createCache({ store: memoryStore(), now: () => NOW });
  cache.write(snapshotAt(NOW));
  const { snapshot } = cache.read();
  assert.equal(typeof snapshot.activity[0].timestamp, 'number');
  assert.equal(typeof snapshot.priorityProperties[0].timestamp, 'number');
  assert.equal(snapshot.activity[0].timestamp, NOW);
});

test('an expired snapshot is still returned, flagged rather than dropped', () => {
  // Old data under an OFFLINE badge beats a blank screen in a truck with no
  // signal, so expiry is a label for the caller, not a delete.
  let now = NOW;
  const cache = createCache({ store: memoryStore(), ttlMs: 1000, now: () => now });
  cache.write(snapshotAt(NOW));

  now = NOW + 5000;
  const read = cache.read();
  assert.equal(read.expired, true);
  assert.equal(read.snapshot.summary.totalProperties, 1284);
});

test('a snapshot that never came from the network is not cached', () => {
  const cache = createCache({ store: memoryStore(), now: () => NOW });
  assert.equal(cache.write({ summary: {}, fetchedAt: null }), false);
  assert.equal(cache.write(null), false);
  assert.equal(cache.read(), null);
});

test('half-written JSON is discarded, not re-parsed forever', () => {
  const store = memoryStore({ 'atlas.dashboard.snapshot': '{"version":1,"snapsh' });
  const cache = createCache({ store, now: () => NOW });
  assert.equal(cache.read(), null);
  assert.equal(store.getItem('atlas.dashboard.snapshot'), null, 'and the bad bytes are gone');
});

test('a snapshot from an older envelope version is discarded', () => {
  const store = memoryStore({
    'atlas.dashboard.snapshot': JSON.stringify({ version: CACHE_VERSION - 1, fetchedAt: NOW, snapshot: snapshotAt(NOW) })
  });
  const cache = createCache({ store, now: () => NOW });
  assert.equal(cache.read(), null, 'a model change must not resurrect an incompatible shape');
});

test('an envelope with no snapshot is discarded', () => {
  const store = memoryStore({ 'atlas.dashboard.snapshot': JSON.stringify({ version: CACHE_VERSION, fetchedAt: NOW }) });
  assert.equal(createCache({ store, now: () => NOW }).read(), null);
});

test('a storage that throws degrades to no cache instead of taking the page down', () => {
  // Safari in private mode throws on setItem; a browser with site data blocked
  // throws on the read. Both are ordinary user configurations.
  const hostile = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); },
    removeItem() { throw new Error('SecurityError'); }
  };
  const cache = createCache({ store: hostile, now: () => NOW });
  assert.doesNotThrow(() => cache.write(snapshotAt(NOW)));
  assert.equal(cache.read(), null);
  assert.doesNotThrow(() => cache.clear());
});

test('no storage at all is a working no-op cache', () => {
  const cache = createCache({ store: null, now: () => NOW });
  assert.equal(cache.write(snapshotAt(NOW)), true);
  assert.equal(cache.read().fetchedAt, NOW, 'backed by memory, so it still works in tests and SSR');
});

test('clear removes the entry', () => {
  const store = memoryStore();
  const cache = createCache({ store, now: () => NOW });
  cache.write(snapshotAt(NOW));
  cache.clear();
  assert.equal(cache.read(), null);
});

test('two caches with different keys do not see each other', () => {
  const store = memoryStore();
  const a = createCache({ store, key: 'a', now: () => NOW });
  const b = createCache({ store, key: 'b', now: () => NOW });
  a.write(snapshotAt(NOW));
  assert.equal(b.read(), null);
  assert.equal(a.read().fetchedAt, NOW);
});

test('safeStore wraps a partial storage object without throwing', () => {
  const wrapped = safeStore({ getItem: () => 'x' });
  assert.equal(wrapped.getItem('k'), 'x');
  assert.doesNotThrow(() => wrapped.setItem('k', 'v'), 'a missing setItem must not be a crash');
});
