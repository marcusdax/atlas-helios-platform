'use strict';

/**
 * The dashboard's domain model, declared once.
 *
 * Everything below is JSDoc rather than TypeScript because the frontend is a
 * plain Create React App bundle: adding a compiler to type four screens would
 * cost more than it returns. JSDoc typedefs give the same editor completion and
 * the same single source of truth, and `checkJs` can turn them into real
 * errors later without touching a line of runtime code.
 *
 * Two conventions hold everywhere in this package, and both exist to kill a
 * specific class of bug:
 *
 * 1. Every instant is epoch milliseconds, never a `Date` and never an ISO
 *    string. A snapshot round-trips through `JSON.stringify` on its way into
 *    the local cache, which silently turns a `Date` into a string - and the
 *    first component to call `.toLocaleTimeString()` on it then throws. Numbers
 *    survive the trip unchanged, so formatting belongs in the view and nowhere
 *    else.
 * 2. Nothing in the model is optional-by-accident. A count is a number (0, not
 *    undefined) and a list is an array (empty, not null), so a view never has
 *    to guard a lane that simply has not loaded yet.
 */

/**
 * How much of the truth is currently on screen.
 *
 * @typedef {'LIVE'|'SYNCING'|'STALE'|'DEGRADED'|'OFFLINE'} DataState
 *
 * - `LIVE`     every source answered, the data is fresh, and the realtime
 *              channel is connected: what you see is what is happening.
 * - `SYNCING`  a read is in flight, or the first read has not landed yet.
 * - `STALE`    real data, but it can no longer be vouched for: either it has
 *              aged past the freshness window, or the realtime channel is down
 *              so nothing is pushing changes between polls.
 * - `DEGRADED` some sources answered and some failed. The numbers on screen are
 *              partly last-known rather than current, and the report says which.
 * - `OFFLINE`  nothing is reachable - the browser reports no network, or every
 *              source failed. Anything on screen came out of the local cache.
 */
const DATA_STATES = Object.freeze({
  LIVE: 'LIVE',
  SYNCING: 'SYNCING',
  STALE: 'STALE',
  DEGRADED: 'DEGRADED',
  OFFLINE: 'OFFLINE'
});

/**
 * Worst-last ordering, used to pick a single badge when more than one state
 * could apply. `deriveState` is a total order on its own, but a composed screen
 * (several panels, each with its own lane) needs `worstOf` to agree with it.
 *
 * @type {ReadonlyArray<DataState>}
 */
const STATE_SEVERITY = Object.freeze([
  DATA_STATES.LIVE,
  DATA_STATES.SYNCING,
  DATA_STATES.STALE,
  DATA_STATES.DEGRADED,
  DATA_STATES.OFFLINE
]);

/**
 * The named read lanes. Each one fails independently, which is the whole point:
 * the NWS alert feed going down should dim one card, not blank the dashboard.
 *
 * @typedef {'properties'|'storms'|'assessments'|'alerts'|'forecast'} SourceName
 */
const SOURCES = Object.freeze({
  PROPERTIES: 'properties',
  STORMS: 'storms',
  ASSESSMENTS: 'assessments',
  ALERTS: 'alerts',
  FORECAST: 'forecast'
});

/** @typedef {'assessment'|'storm'|'alert'|'lead'|'system'} ActivityType */
const ACTIVITY_TYPES = Object.freeze({
  ASSESSMENT: 'assessment',
  STORM: 'storm',
  ALERT: 'alert',
  LEAD: 'lead',
  SYSTEM: 'system'
});

/** @typedef {'info'|'warning'|'error'} Severity */
const SEVERITIES = Object.freeze({ INFO: 'info', WARNING: 'warning', ERROR: 'error' });

/** @typedef {'low'|'medium'|'high'} RiskBand */
const RISK_BANDS = Object.freeze({ LOW: 'low', MEDIUM: 'medium', HIGH: 'high' });

/**
 * Where a risk score stops being worth a dispatch. 70 matches the backend's
 * `min_risk` default for the priority queue, so the count on the card and the
 * rows in the list can never disagree about what "high risk" means.
 */
const HIGH_RISK_THRESHOLD = 70;
const MEDIUM_RISK_THRESHOLD = 40;

/**
 * @typedef {object} DashboardSummary
 * @property {number} totalProperties      Properties on file for the company.
 * @property {number} activeStorms         Storm events currently in `active`.
 * @property {number} highRiskProperties   Properties at or above the high-risk threshold.
 * @property {number} recentAssessments    Assessments in the recent window.
 * @property {number} weatherAlerts        Active NWS alerts for the area.
 */

/**
 * @typedef {object} ActivityEvent
 * @property {string} id            Content-derived, so the same event arriving by
 *                                  REST and by WebSocket collapses to one row.
 * @property {ActivityType} type
 * @property {string} message       Already human-readable; views do not compose copy.
 * @property {number} timestamp     Epoch ms.
 * @property {Severity} severity
 */

/**
 * @typedef {object} PriorityProperty
 * @property {string} id
 * @property {string} address
 * @property {number} score         0-100 damage probability.
 * @property {RiskBand} risk
 * @property {number|null} timestamp Epoch ms of the last assessment, if any.
 * @property {string} [city]
 * @property {string} [state]
 */

/**
 * One hour of the forecast.
 *
 * `windSpeed` is the top of the range the NWS quotes. "10 to 15 mph" becomes
 * 15, because what matters for a roof is the strongest wind it will see, not
 * the average.
 *
 * @typedef {object} ForecastPoint
 * @property {number} time                   Epoch ms, start of the hour.
 * @property {number|null} temperature       Fahrenheit.
 * @property {number} precipitationProbability 0-100.
 * @property {number|null} windSpeed         mph.
 * @property {number|null} humidity          0-100, when the feed carries it.
 * @property {string} shortForecast          The NWS's own phrase.
 */

/**
 * @typedef {object} DashboardSnapshot
 * @property {DashboardSummary} summary
 * @property {ActivityEvent[]} activity              Newest first.
 * @property {PriorityProperty[]} priorityProperties Worst first, the dispatch queue.
 * @property {PriorityProperty[]} mapProperties      The same read, more rows, all
 *                                                   geocoded - what the map pins.
 * @property {ForecastPoint[]} forecast              Next 24 hours, oldest first.
 * @property {'nws'|'mock'|null} forecastSource      Where the forecast came from.
 *                                                   `mock` means the backend's demo
 *                                                   flag is on and the view must say so.
 * @property {number|null} fetchedAt                 Epoch ms of the last read that
 *                                                   produced any of this.
 */

/**
 * One lane's last outcome. `failedAt`/`error` survive a later success on another
 * lane, which is what lets the UI say *which* number is last-known.
 *
 * @typedef {object} SourceStatus
 * @property {boolean} ok
 * @property {number|null} at        Epoch ms of the last attempt.
 * @property {string|null} code      Stable error code, e.g. `ALERTS_UNAVAILABLE`.
 * @property {string|null} message
 */

/**
 * @typedef {Record<SourceName, SourceStatus>} SourceReport
 */

/**
 * What a view actually consumes: the data, the single state badge, and enough
 * detail to explain the badge without guessing.
 *
 * @typedef {object} DashboardView
 * @property {DataState} state
 * @property {DashboardSummary} summary
 * @property {ActivityEvent[]} activity
 * @property {PriorityProperty[]} priorityProperties
 * @property {PriorityProperty[]} mapProperties
 * @property {ForecastPoint[]} forecast
 * @property {'nws'|'mock'|null} forecastSource
 * @property {number|null} fetchedAt
 * @property {number|null} age                  Ms since `fetchedAt`.
 * @property {boolean} fetching
 * @property {boolean} fromCache                True until a network read lands.
 * @property {SourceReport} sources
 * @property {SourceName[]} failedSources
 * @property {StateTransition[]} history        Bounded, newest last.
 */

/**
 * @typedef {object} StateTransition
 * @property {DataState} from
 * @property {DataState} to
 * @property {number} at
 * @property {string} reason
 */

module.exports = {
  DATA_STATES,
  STATE_SEVERITY,
  SOURCES,
  ACTIVITY_TYPES,
  SEVERITIES,
  RISK_BANDS,
  HIGH_RISK_THRESHOLD,
  MEDIUM_RISK_THRESHOLD
};
