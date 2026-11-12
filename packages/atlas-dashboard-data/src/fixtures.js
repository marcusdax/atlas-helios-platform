'use strict';

const { DATA_STATES, SOURCES, ACTIVITY_TYPES, SEVERITIES, RISK_BANDS } = require('./types');

/**
 * Fixture views, one per data state.
 *
 * These exist so that Storybook and the component tests can render all five
 * states without a network, a socket or a clock. They are NOT a fallback for
 * the app: nothing in `frontend/src` imports this module outside `*.stories.*`
 * and tests, which is the rule that keeps the mock dataset from creeping back
 * into the dashboard the way it did before.
 *
 * Every fixture carries the inputs its state was derived from, and
 * `test/fixtures.test.js` feeds those inputs back through `deriveState` and
 * asserts the answer matches. A story labelled DEGRADED therefore cannot
 * quietly drift into showing something the real state machine would call
 * something else - which is the usual way a mock gallery stops being evidence.
 *
 * This module is deliberately absent from `index.js`: a consumer has to reach
 * for `@atlas/dashboard-data/src/fixtures` on purpose, so it can never be
 * pulled into a production bundle by a stray barrel import.
 */

/** A fixed instant, so stories and snapshots do not change by the minute. */
const REFERENCE_NOW = Date.parse('2026-03-14T18:42:00.000Z');

const minutes = (n) => n * 60_000;

const ok = (at) => ({ ok: true, at, code: null, message: null });
const failed = (at, code, message) => ({ ok: false, at, code, message });
const idle = () => ({ ok: false, at: null, code: null, message: null });

/** Twenty-four hours that look like a Texas spring afternoon, not a sine wave. */
const forecast = (now) =>
  Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now + i * 3600_000).getUTCHours();
    const storming = i >= 2 && i <= 6;
    return {
      time: now + i * 3600_000,
      temperature: Math.round(62 + Math.max(0, Math.sin(((hour - 6) / 24) * Math.PI * 2)) * 22),
      precipitationProbability: storming ? 60 + (i % 3) * 10 : Math.max(0, 20 - i),
      windSpeed: storming ? 25 + (i % 4) * 5 : 10 + (i % 3),
      humidity: storming ? 80 : 55 + (i % 5),
      shortForecast: storming ? 'Showers And Thunderstorms Likely' : 'Partly Cloudy'
    };
  });

const allOk = (at) => ({
  [SOURCES.PROPERTIES]: ok(at),
  [SOURCES.STORMS]: ok(at),
  [SOURCES.ASSESSMENTS]: ok(at),
  [SOURCES.ALERTS]: ok(at),
  [SOURCES.FORECAST]: ok(at)
});

const summary = () => ({
  totalProperties: 1284,
  activeStorms: 2,
  highRiskProperties: 47,
  recentAssessments: 18,
  weatherAlerts: 3
});

const activity = (now) => [
  {
    id: `${ACTIVITY_TYPES.ALERT}:nws-1`,
    type: ACTIVITY_TYPES.ALERT,
    message: 'Severe Thunderstorm Warning issued for Dallas County, TX until 8:15 PM CDT',
    timestamp: now - minutes(4),
    severity: SEVERITIES.ERROR
  },
  {
    id: `${ACTIVITY_TYPES.ASSESSMENT}:a-9f21`,
    type: ACTIVITY_TYPES.ASSESSMENT,
    message: 'Assessment completed at 1247 Oak Ridge Dr — 94% damage probability',
    timestamp: now - minutes(15),
    severity: SEVERITIES.WARNING
  },
  {
    id: `${ACTIVITY_TYPES.STORM}:storm-001`,
    type: ACTIVITY_TYPES.STORM,
    message: 'Severe thunderstorm active in Dallas County, TX — 47 properties exposed',
    timestamp: now - minutes(32),
    severity: SEVERITIES.ERROR
  },
  {
    id: `${ACTIVITY_TYPES.LEAD}:lead-7731`,
    type: ACTIVITY_TYPES.LEAD,
    message: '6 new leads generated',
    timestamp: now - minutes(48),
    severity: SEVERITIES.INFO
  },
  {
    id: `${ACTIVITY_TYPES.ASSESSMENT}:a-9f14`,
    type: ACTIVITY_TYPES.ASSESSMENT,
    message: 'Assessment completed at 3856 Maple Ave — 87% damage probability',
    timestamp: now - minutes(63),
    severity: SEVERITIES.WARNING
  }
];

const priorityProperties = (now) => [
  { id: 'p-1', address: '1247 Oak Ridge Dr', city: 'Dallas', state: 'TX', score: 94, risk: RISK_BANDS.HIGH, timestamp: now - minutes(15) },
  { id: 'p-2', address: '3856 Maple Ave', city: 'Dallas', state: 'TX', score: 87, risk: RISK_BANDS.HIGH, timestamp: now - minutes(63) },
  { id: 'p-3', address: '2109 Pine Street', city: 'Irving', state: 'TX', score: 71, risk: RISK_BANDS.HIGH, timestamp: now - minutes(126) },
  { id: 'p-4', address: '884 Cedar Hollow Ct', city: 'Plano', state: 'TX', score: 58, risk: RISK_BANDS.MEDIUM, timestamp: now - minutes(190) }
];

/**
 * @param {object} [options]
 * @param {number} [options.now] Reference instant the fixtures are relative to.
 * @returns {Record<string, import('./types').DashboardView & {description: string}>}
 */
function dashboardFixtures({ now = REFERENCE_NOW } = {}) {
  const base = {
    summary: summary(),
    activity: activity(now),
    priorityProperties: priorityProperties(now),
    mapProperties: priorityProperties(now),
    forecast: forecast(now),
    forecastSource: 'nws',
    history: []
  };

  /** @type {Record<string, any>} */
  const fixtures = {
    [DATA_STATES.LIVE]: {
      ...base,
      description: 'Every feed answering, socket connected, data seconds old.',
      state: DATA_STATES.LIVE,
      fetchedAt: now - 8_000,
      age: 8_000,
      fetching: false,
      fromCache: false,
      online: true,
      realtime: 'connected',
      sources: allOk(now - 8_000),
      failedSources: []
    },

    [DATA_STATES.SYNCING]: {
      ...base,
      // First paint: no numbers yet, so the tiles render as skeletons rather
      // than as a confident row of zeroes.
      summary: { totalProperties: 0, activeStorms: 0, highRiskProperties: 0, recentAssessments: 0, weatherAlerts: 0 },
      activity: [],
      priorityProperties: [],
      mapProperties: [],
      forecast: [],
      forecastSource: null,
      description: 'First read in flight. Nothing has landed yet.',
      state: DATA_STATES.SYNCING,
      fetchedAt: null,
      age: null,
      fetching: true,
      fromCache: false,
      online: true,
      realtime: 'connecting',
      sources: {
        [SOURCES.PROPERTIES]: idle(),
        [SOURCES.STORMS]: idle(),
        [SOURCES.ASSESSMENTS]: idle(),
        [SOURCES.ALERTS]: idle(),
        [SOURCES.FORECAST]: idle()
      },
      failedSources: []
    },

    [DATA_STATES.STALE]: {
      ...base,
      description: 'Real data, but the socket dropped and it has aged past the freshness window.',
      state: DATA_STATES.STALE,
      fetchedAt: now - minutes(6),
      age: minutes(6),
      fetching: false,
      fromCache: false,
      online: true,
      realtime: 'disconnected',
      sources: allOk(now - minutes(6)),
      failedSources: []
    },

    [DATA_STATES.DEGRADED]: {
      ...base,
      // The alert lane failed, so its count is the last one that was true.
      // The card says so rather than showing a confident zero.
      description: 'The NWS alert feed is down. Property and storm lanes are current.',
      state: DATA_STATES.DEGRADED,
      fetchedAt: now - 12_000,
      age: 12_000,
      fetching: false,
      fromCache: false,
      online: true,
      realtime: 'connected',
      sources: {
        ...allOk(now - 12_000),
        [SOURCES.ALERTS]: failed(now - 12_000, 'ALERTS_UNAVAILABLE', 'Alert feed is unavailable')
      },
      failedSources: [SOURCES.ALERTS]
    },

    [DATA_STATES.OFFLINE]: {
      ...base,
      description: 'No network. Painted from the snapshot cached on this device.',
      state: DATA_STATES.OFFLINE,
      fetchedAt: now - minutes(47),
      age: minutes(47),
      fetching: false,
      fromCache: true,
      online: false,
      realtime: 'disconnected',
      sources: {
        [SOURCES.PROPERTIES]: failed(now - minutes(2), 'NETWORK', 'Could not reach the server.'),
        [SOURCES.STORMS]: failed(now - minutes(2), 'NETWORK', 'Could not reach the server.'),
        [SOURCES.ASSESSMENTS]: failed(now - minutes(2), 'NETWORK', 'Could not reach the server.'),
        [SOURCES.ALERTS]: failed(now - minutes(2), 'NETWORK', 'Could not reach the server.'),
        [SOURCES.FORECAST]: failed(now - minutes(2), 'NETWORK', 'Could not reach the server.')
      },
      failedSources: [SOURCES.PROPERTIES, SOURCES.STORMS, SOURCES.ASSESSMENTS, SOURCES.ALERTS, SOURCES.FORECAST]
    },

    /**
     * Not a lifecycle state - an empty tenant. Worth a fixture of its own
     * because "nothing has happened yet" and "we cannot see what happened"
     * look identical if the empty case is never designed.
     */
    EMPTY: {
      description: 'A brand-new company: everything answered, there is just nothing on file.',
      state: DATA_STATES.LIVE,
      summary: { totalProperties: 0, activeStorms: 0, highRiskProperties: 0, recentAssessments: 0, weatherAlerts: 0 },
      activity: [],
      priorityProperties: [],
      mapProperties: [],
      // A new company has no properties, but the sky above them is still the sky.
      forecast: forecast(now),
      forecastSource: 'nws',
      history: [],
      fetchedAt: now - 5_000,
      age: 5_000,
      fetching: false,
      fromCache: false,
      online: true,
      realtime: 'connected',
      sources: allOk(now - 5_000),
      failedSources: []
    }
  };

  return fixtures;
}

/** The inputs `deriveState` needs, lifted back out of a fixture view. */
const stateInputsOf = (view, now = REFERENCE_NOW) => ({
  online: view.online,
  realtime: view.realtime,
  fetching: view.fetching,
  hasData: view.fetchedAt !== null,
  attempted: Object.values(view.sources).some((s) => s.at !== null),
  sources: view.sources,
  fetchedAt: view.fetchedAt,
  now
});

module.exports = { dashboardFixtures, stateInputsOf, REFERENCE_NOW };
