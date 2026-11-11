'use strict';

const { DATA_STATES, STATE_SEVERITY } = require('./types');

/**
 * The data-state lifecycle: LIVE -> SYNCING -> STALE -> DEGRADED -> OFFLINE.
 *
 * The old dashboard had exactly one state - "whatever is in `useState`" - and
 * a mock dataset that could never be anything but current. Once the numbers
 * come from four independent reads and a socket, "current" stops being a safe
 * assumption: the alert feed can 503 while properties answer fine, the socket
 * can drop while the tab stays open, and a backgrounded laptop can wake up
 * showing figures from an hour ago. An operator dispatching crews off those
 * figures needs to be told which of those is happening.
 *
 * So the state is *derived*, never assigned. Every input that could make the
 * screen untrustworthy is a field on one object, the rules below are a total
 * order over them, and the answer is a pure function of the inputs. That is
 * what makes the lifecycle testable rather than aspirational.
 */

/** Freshness window. Past this, data is labelled STALE even if nothing failed. */
const STALE_AFTER_MS = 90_000;

/** @typedef {'connected'|'connecting'|'disconnected'} RealtimeStatus */

/**
 * @typedef {object} StateInput
 * @property {boolean} [online]            Browser connectivity. Default true.
 * @property {RealtimeStatus} [realtime]   WebSocket status. Default 'disconnected'.
 * @property {boolean} [fetching]          A read is in flight.
 * @property {boolean} [hasData]           A snapshot exists, from network or cache.
 * @property {boolean} [attempted]         At least one read has completed or failed.
 * @property {import('./types').SourceReport} [sources]
 * @property {number|null} [fetchedAt]     Epoch ms of the newest data on screen.
 * @property {number} [now]                Injected clock, for tests.
 * @property {number} [staleAfterMs]
 */

const statuses = (sources) => Object.values(sources || {});

/**
 * Collapse every signal into one state.
 *
 * The ordering is the design, so it is written as a flat sequence of guards
 * rather than nested conditions - each line is one rule, and the rule that
 * fires first wins:
 *
 * 1. The browser says there is no network. Nothing else can be true.
 * 2. No lane has succeeded and at least one has failed: nothing on screen came
 *    from the network, so OFFLINE even though the browser thinks it has a
 *    connection. (A dead API behind live wifi looks identical to the operator.)
 * 3. Some lanes failed and some did not: DEGRADED. This sits above SYNCING on
 *    purpose - a retry already in flight does not make the half-truth on
 *    screen any more true, and `fetching` is exposed separately so the badge
 *    can still spin.
 * 4. Nothing to show yet, or a read in flight: SYNCING.
 * 5. Data exists but has aged out, or there is no push channel to keep it
 *    current between polls: STALE.
 * 6. Otherwise LIVE.
 *
 * @param {StateInput} input
 * @returns {import('./types').DataState}
 */
function deriveState(input = {}) {
  const {
    online = true,
    realtime = 'disconnected',
    fetching = false,
    hasData = false,
    attempted = false,
    sources,
    fetchedAt = null,
    now = Date.now(),
    staleAfterMs = STALE_AFTER_MS
  } = input;

  if (!online) return DATA_STATES.OFFLINE;

  const reported = statuses(sources).filter((s) => s && s.at !== null && s.at !== undefined);
  const failed = reported.filter((s) => !s.ok);

  if (attempted && reported.length > 0 && failed.length === reported.length) {
    return DATA_STATES.OFFLINE;
  }
  if (failed.length > 0) return DATA_STATES.DEGRADED;
  if (fetching || !hasData) return DATA_STATES.SYNCING;

  const age = fetchedAt === null ? Infinity : now - fetchedAt;
  if (age > staleAfterMs || realtime !== 'connected') return DATA_STATES.STALE;

  return DATA_STATES.LIVE;
}

/**
 * Copy and presentation intent for one state, in one place.
 *
 * Five components needed to render the same five states; left to themselves
 * they would have invented five vocabularies ("Live" / "Connected" / "Online")
 * and five palettes. `tone` is a semantic name rather than a Tailwind class so
 * this stays usable from a non-React consumer - the mobile app, a status
 * endpoint - and so a theme change is one edit in the view layer.
 *
 * @param {import('./types').DataState} state
 */
function describeState(state) {
  switch (state) {
    case DATA_STATES.LIVE:
      return {
        state, label: 'LIVE', tone: 'positive', pulse: true, trusted: true,
        hint: 'Streaming live updates.'
      };
    case DATA_STATES.SYNCING:
      return {
        state, label: 'SYNCING', tone: 'info', pulse: true, trusted: false,
        hint: 'Fetching the latest figures.'
      };
    case DATA_STATES.STALE:
      return {
        state, label: 'STALE', tone: 'neutral', pulse: false, trusted: false,
        hint: 'Not receiving live updates. Figures may have moved.'
      };
    case DATA_STATES.DEGRADED:
      return {
        state, label: 'DEGRADED', tone: 'warning', pulse: false, trusted: false,
        hint: 'Some feeds are unavailable. Parts of this view are last-known.'
      };
    case DATA_STATES.OFFLINE:
      return {
        state, label: 'OFFLINE', tone: 'critical', pulse: false, trusted: false,
        hint: 'No connection. Showing the last data cached on this device.'
      };
    default:
      // An unknown state is a bug, but a dashboard that throws is worse than
      // one that admits it does not know.
      return {
        state: DATA_STATES.OFFLINE, label: 'UNKNOWN', tone: 'critical',
        pulse: false, trusted: false, hint: 'Data state could not be determined.'
      };
  }
}

/** Worst of several lanes, for a screen that shows one badge over many panels. */
function worstOf(...states) {
  return states
    .filter((s) => STATE_SEVERITY.includes(s))
    .reduce(
      (worst, s) =>
        STATE_SEVERITY.indexOf(s) > STATE_SEVERITY.indexOf(worst) ? s : worst,
      DATA_STATES.LIVE
    );
}

/**
 * Record a move between states, or `null` when nothing moved.
 *
 * Returning null for a no-op is what keeps the history readable: a 30-second
 * poll that stays LIVE should leave no trace, so what remains is the sequence
 * of events worth explaining to whoever asks why the badge went amber.
 *
 * @returns {import('./types').StateTransition|null}
 */
function transition(from, to, { at = Date.now(), reason = '' } = {}) {
  if (from === to) return null;
  return Object.freeze({ from, to, at, reason });
}

/** True when a retry could plausibly fix it, i.e. worth offering a Retry button. */
const isRecoverable = (state) =>
  state === DATA_STATES.DEGRADED ||
  state === DATA_STATES.OFFLINE ||
  state === DATA_STATES.STALE;

module.exports = {
  STALE_AFTER_MS,
  deriveState,
  describeState,
  worstOf,
  transition,
  isRecoverable
};
