'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DATA_STATES, deriveState, describeState, worstOf, transition, isRecoverable, STALE_AFTER_MS
} = require('../src/index.js');

const NOW = 1_700_000_000_000;

const ok = (at = NOW) => ({ ok: true, at, code: null, message: null });
const bad = (at = NOW, code = 'NETWORK') => ({ ok: false, at, code, message: 'nope' });
const idle = () => ({ ok: false, at: null, code: null, message: null });

/** A dashboard that has everything going for it, as the baseline to spoil. */
const healthy = (overrides = {}) => ({
  online: true,
  realtime: 'connected',
  fetching: false,
  hasData: true,
  attempted: true,
  sources: { properties: ok(), storms: ok(), assessments: ok(), alerts: ok() },
  fetchedAt: NOW - 1000,
  now: NOW,
  ...overrides
});

/* ------------------------------------------------------------- the states -- */

test('everything answering, fresh, and connected is LIVE', () => {
  assert.equal(deriveState(healthy()), DATA_STATES.LIVE);
});

test('a store with no inputs at all is SYNCING, not OFFLINE', () => {
  // First paint, before anything has been asked. Calling that OFFLINE would
  // show a scary badge on every cold load.
  assert.equal(deriveState({}), DATA_STATES.SYNCING);
  assert.equal(deriveState({ fetching: true, sources: { properties: idle() } }), DATA_STATES.SYNCING);
});

test('a read in flight over existing data is SYNCING', () => {
  assert.equal(deriveState(healthy({ fetching: true })), DATA_STATES.SYNCING);
});

test('data past the freshness window is STALE', () => {
  assert.equal(
    deriveState(healthy({ fetchedAt: NOW - STALE_AFTER_MS - 1 })),
    DATA_STATES.STALE
  );
});

test('fresh data with no push channel is still STALE', () => {
  // Nothing is wrong, but nothing is arriving either: between polls the screen
  // cannot be vouched for, and saying LIVE would be a claim we cannot back.
  assert.equal(deriveState(healthy({ realtime: 'disconnected' })), DATA_STATES.STALE);
  assert.equal(deriveState(healthy({ realtime: 'connecting' })), DATA_STATES.STALE);
});

test('one failed lane out of four is DEGRADED', () => {
  const state = deriveState(healthy({
    sources: { properties: ok(), storms: ok(), assessments: ok(), alerts: bad(NOW, 'ALERTS_UNAVAILABLE') }
  }));
  assert.equal(state, DATA_STATES.DEGRADED);
});

test('every reporting lane having failed is OFFLINE even with a live network', () => {
  // A dead API behind working wifi looks the same to the operator as no wifi.
  const state = deriveState(healthy({
    sources: { properties: bad(), storms: bad(), assessments: bad(), alerts: bad() }
  }));
  assert.equal(state, DATA_STATES.OFFLINE);
});

test('OFFLINE means no lane has succeeded, not that four lanes failed', () => {
  // Only one lane has ever reported and it failed, so nothing on the screen
  // came from the network. DEGRADED would imply part of the view is current;
  // none of it is. Lanes still sitting idle are unknowns, not evidence either
  // way - and because `refresh()` reads every configured lane together, this
  // shape only occurs before the first full read has landed.
  const state = deriveState(healthy({
    sources: { properties: bad(), storms: idle(), assessments: idle(), alerts: idle() }
  }));
  assert.equal(state, DATA_STATES.OFFLINE);
});

test('one lane failing after a full read is DEGRADED, not OFFLINE', () => {
  // The realistic version of the case above: a targeted re-read of the alert
  // lane fails while the other three still hold data from the last full pass.
  const state = deriveState(healthy({
    sources: { properties: ok(), storms: ok(), assessments: ok(), alerts: bad(NOW, 'ALERTS_UNAVAILABLE') }
  }));
  assert.equal(state, DATA_STATES.DEGRADED);
});

test('the browser reporting no network wins over everything', () => {
  assert.equal(deriveState(healthy({ online: false })), DATA_STATES.OFFLINE);
  assert.equal(deriveState(healthy({ online: false, fetching: true })), DATA_STATES.OFFLINE);
});

/* ----------------------------------------------------------- the ordering -- */

test('a failure outranks a refresh that is already in flight', () => {
  // The retry does not make the half-truth on screen any truer, so the badge
  // stays DEGRADED and `fetching` is surfaced separately for the spinner.
  const state = deriveState(healthy({
    fetching: true,
    sources: { properties: ok(), storms: ok(), assessments: ok(), alerts: bad() }
  }));
  assert.equal(state, DATA_STATES.DEGRADED);
});

test('a failure outranks staleness', () => {
  const state = deriveState(healthy({
    fetchedAt: NOW - STALE_AFTER_MS * 10,
    sources: { properties: ok(), storms: ok(), assessments: ok(), alerts: bad() }
  }));
  assert.equal(state, DATA_STATES.DEGRADED);
});

test('a refresh in flight outranks staleness', () => {
  const state = deriveState(healthy({ fetching: true, fetchedAt: NOW - STALE_AFTER_MS * 10 }));
  assert.equal(state, DATA_STATES.SYNCING);
});

test('data from cache while offline still reads OFFLINE', () => {
  // The cache supplies data, never freshness.
  const state = deriveState(healthy({ online: false, fetchedAt: NOW - 1000 }));
  assert.equal(state, DATA_STATES.OFFLINE);
});

test('deriveState is total: every combination of signals returns a known state', () => {
  const known = new Set(Object.values(DATA_STATES));
  const flags = [true, false];
  const realtimes = ['connected', 'connecting', 'disconnected'];
  const reports = [
    { properties: ok(), alerts: ok() },
    { properties: ok(), alerts: bad() },
    { properties: bad(), alerts: bad() },
    { properties: idle(), alerts: idle() },
    undefined
  ];

  let combinations = 0;
  for (const online of flags) {
    for (const realtime of realtimes) {
      for (const fetching of flags) {
        for (const hasData of flags) {
          for (const attempted of flags) {
            for (const sources of reports) {
              for (const fetchedAt of [null, NOW - 1000, NOW - STALE_AFTER_MS * 5]) {
                const state = deriveState({
                  online, realtime, fetching, hasData, attempted, sources, fetchedAt, now: NOW
                });
                assert.ok(known.has(state), `unknown state ${state}`);
                combinations += 1;
              }
            }
          }
        }
      }
    }
  }
  assert.equal(combinations, 2 * 3 * 2 * 2 * 2 * 5 * 3);
});

/* ---------------------------------------------------------- presentation -- */

test('every state has copy and a tone, and only LIVE is trusted', () => {
  for (const state of Object.values(DATA_STATES)) {
    const described = describeState(state);
    assert.equal(described.state, state);
    assert.ok(described.label.length > 0, `${state} needs a label`);
    assert.ok(described.hint.length > 0, `${state} needs a hint`);
    assert.ok(['positive', 'info', 'neutral', 'warning', 'critical'].includes(described.tone));
    assert.equal(described.trusted, state === DATA_STATES.LIVE);
  }
});

test('an unknown state describes itself as unknown rather than throwing', () => {
  const described = describeState('BANANA');
  assert.equal(described.label, 'UNKNOWN');
  assert.equal(described.state, DATA_STATES.OFFLINE);
});

test('worstOf agrees with the lifecycle ordering', () => {
  assert.equal(worstOf(DATA_STATES.LIVE, DATA_STATES.SYNCING), DATA_STATES.SYNCING);
  assert.equal(worstOf(DATA_STATES.SYNCING, DATA_STATES.STALE), DATA_STATES.STALE);
  assert.equal(worstOf(DATA_STATES.DEGRADED, DATA_STATES.STALE), DATA_STATES.DEGRADED);
  assert.equal(worstOf(DATA_STATES.OFFLINE, DATA_STATES.LIVE), DATA_STATES.OFFLINE);
  assert.equal(worstOf(), DATA_STATES.LIVE, 'nothing to report is not a problem');
  assert.equal(worstOf('BANANA'), DATA_STATES.LIVE, 'junk is ignored, not ranked');
});

/* ----------------------------------------------------------- transitions -- */

test('a transition records where it came from, and a no-op records nothing', () => {
  const moved = transition(DATA_STATES.LIVE, DATA_STATES.DEGRADED, { at: NOW, reason: 'alerts 503' });
  assert.deepEqual({ ...moved }, {
    from: DATA_STATES.LIVE, to: DATA_STATES.DEGRADED, at: NOW, reason: 'alerts 503'
  });
  assert.equal(transition(DATA_STATES.LIVE, DATA_STATES.LIVE), null);
});

test('a recorded transition is frozen, so history cannot be rewritten', () => {
  const moved = transition(DATA_STATES.LIVE, DATA_STATES.OFFLINE, { at: NOW });
  assert.throws(() => { 'use strict'; moved.to = DATA_STATES.LIVE; }, TypeError);
});

test('retry is offered exactly where retrying could help', () => {
  assert.equal(isRecoverable(DATA_STATES.DEGRADED), true);
  assert.equal(isRecoverable(DATA_STATES.OFFLINE), true);
  assert.equal(isRecoverable(DATA_STATES.STALE), true);
  assert.equal(isRecoverable(DATA_STATES.LIVE), false);
  assert.equal(isRecoverable(DATA_STATES.SYNCING), false, 'a read is already in flight');
});
