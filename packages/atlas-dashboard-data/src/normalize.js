'use strict';

const {
  ACTIVITY_TYPES, SEVERITIES, RISK_BANDS,
  HIGH_RISK_THRESHOLD, MEDIUM_RISK_THRESHOLD
} = require('./types');

/**
 * Raw API payloads in, the domain model out.
 *
 * This is the only module that knows a storm row calls its region
 * `region_name` and an assessment calls its score `overall_score`. Keeping
 * that knowledge in one pure file is what lets the views be rewritten - and
 * the endpoints be replaced by a single aggregate endpoint later - without
 * either one learning the other's vocabulary.
 *
 * Every function here is defensive to the point of tedium. A field that the
 * seed data happens to always set is still optional in the schema, and a
 * dashboard that throws because one row has a null `region_name` is a worse
 * outcome than a row that reads "Unknown region".
 */

/** ms since epoch from a number, Date or ISO string; null when unusable. */
function toEpoch(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * A coordinate, or null.
 *
 * Separate from `toNumber` because the fallback must not be 0 here: a property
 * with no latitude is not a property at latitude zero.
 */
function coordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A finite number, or the fallback. Guards `NaN`, `null` and `"42"` alike. */
function toNumber(value, fallback = 0) {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

/**
 * How many rows exist in total, not how many this page returned.
 *
 * Reading `data.length` was the original sin of the mock dashboard: a tile
 * labelled "Total Properties" would have shown 25, the page size, and nobody
 * would have noticed for months. `meta.total` is what the list endpoints
 * answer with; `meta.count` is what the GeoJSON alert endpoint answers with.
 */
function countOf(payload) {
  if (!payload || typeof payload !== 'object') return 0;
  const meta = payload.meta;
  if (meta && typeof meta === 'object') {
    if (Number.isFinite(meta.total)) return meta.total;
    if (Number.isFinite(meta.count)) return meta.count;
  }
  if (Array.isArray(payload.data)) return payload.data.length;
  if (Array.isArray(payload.features)) return payload.features.length;
  if (Array.isArray(payload)) return payload.length;
  return 0;
}

const rowsOf = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.features)) return payload.features;
  return [];
};

/** @returns {import('./types').RiskBand} */
function riskBandFor(score) {
  const n = toNumber(score, 0);
  if (n >= HIGH_RISK_THRESHOLD) return RISK_BANDS.HIGH;
  if (n >= MEDIUM_RISK_THRESHOLD) return RISK_BANDS.MEDIUM;
  return RISK_BANDS.LOW;
}

/** Sentence-case a snake_case enum for display: `severe_thunderstorm` -> `Severe thunderstorm`. */
function humanize(value, fallback = '') {
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  const words = value.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ------------------------------------------------------------------ lanes -- */

/**
 * The properties lane: the two counts and the dispatch queue.
 *
 * `total` and `highRisk` are two reads of the same endpoint with different
 * filters. They are one lane because they share a failure mode - if
 * `/api/properties` is down, neither answers - and splitting them would only
 * produce a DEGRADED badge that cannot be acted on differently.
 */
function propertiesLane(payload, { priorityLimit = 5 } = {}) {
  // Destructuring with a `= {}` default would still throw on an explicit
  // null, and `api.js` returns exactly that for a 204.
  const { total, highRisk } = payload || {};
  const rows = rowsOf(highRisk);

  return {
    summary: {
      totalProperties: countOf(total),
      highRiskProperties: countOf(highRisk)
    },
    priorityProperties: rows
      .map((row) => ({
        id: String(row?.id ?? ''),
        address: row?.address || 'Unknown address',
        city: row?.city || undefined,
        state: row?.state || undefined,
        // `last_assessment_score` is the measured figure; `damage_probability`
        // is the modelled one. Prefer the measurement when a roof has actually
        // been looked at, so a human inspection outranks a prediction.
        score: Math.round(toNumber(row?.last_assessment_score, toNumber(row?.damage_probability, 0))),
        risk: row?.current_risk_level
          ? String(row.current_risk_level).toLowerCase()
          : riskBandFor(row?.damage_probability),
        timestamp: toEpoch(row?.last_assessment_date ?? row?.updated_at ?? row?.created_at),
        // Carried so the same rows can be pinned on the map without a second
        // read. Parsed strictly: `Number(null)` is 0 and 0,0 is the Gulf of
        // Guinea, half a world from any customer, so an ungeocoded row has to
        // come through as null and be dropped rather than drawn.
        latitude: coordinate(row?.latitude),
        longitude: coordinate(row?.longitude)
      }))
      .filter((p) => p.id !== '')
      .sort((a, b) => b.score - a.score)
      .slice(0, priorityLimit)
  };
}

/** The storms lane: the active count, and one activity row per storm. */
function stormsLane(payload, { activityLimit = 10 } = {}) {
  const rows = rowsOf(payload);

  return {
    summary: { activeStorms: countOf(payload) },
    activity: rows
      .map((row) => {
        const id = row?.id ?? row?.storm_id;
        if (id === undefined || id === null) return null;
        const kind = humanize(row?.event_type || row?.storm_type, 'Storm event');
        const region = row?.region_name || row?.region || 'an unmonitored region';
        const exposed = toNumber(row?.affected_properties, 0);
        return {
          id: `${ACTIVITY_TYPES.STORM}:${id}`,
          type: ACTIVITY_TYPES.STORM,
          message: exposed > 0
            ? `${kind} active in ${region} — ${exposed} propert${exposed === 1 ? 'y' : 'ies'} exposed`
            : `${kind} active in ${region}`,
          timestamp: toEpoch(row?.detected_at ?? row?.last_update ?? row?.created_at) ?? 0,
          severity: stormSeverity(row?.severity)
        };
      })
      .filter(Boolean)
      .slice(0, activityLimit)
  };
}

const stormSeverity = (severity) => {
  switch (String(severity || '').toLowerCase()) {
    case 'extreme':
    case 'high':
      return SEVERITIES.ERROR;
    case 'moderate':
      return SEVERITIES.WARNING;
    default:
      return SEVERITIES.INFO;
  }
};

/** The assessments lane: the recent count, and one activity row per assessment. */
function assessmentsLane(payload, { activityLimit = 10 } = {}) {
  const rows = rowsOf(payload);

  return {
    summary: { recentAssessments: countOf(payload) },
    activity: rows
      .map((row) => {
        const id = row?.id;
        if (id === undefined || id === null) return null;
        const address = row?.address || 'a property';
        const score = row?.overall_score ?? row?.damage_score;
        const scored = score === null || score === undefined
          ? ''
          : ` — ${Math.round(toNumber(score, 0))}% damage probability`;
        const failed = row?.status === 'failed';
        return {
          id: `${ACTIVITY_TYPES.ASSESSMENT}:${id}`,
          type: ACTIVITY_TYPES.ASSESSMENT,
          message: failed
            ? `Assessment failed at ${address}`
            : `Assessment ${row?.status === 'completed' ? 'completed' : String(row?.status || 'updated')} at ${address}${scored}`,
          timestamp: toEpoch(row?.completed_at ?? row?.created_at ?? row?.started_at) ?? 0,
          severity: failed
            ? SEVERITIES.ERROR
            : riskBandFor(score) === RISK_BANDS.HIGH ? SEVERITIES.WARNING : SEVERITIES.INFO
        };
      })
      .filter(Boolean)
      .slice(0, activityLimit)
  };
}

/** The alerts lane: the active NWS count, and one activity row per alert. */
function alertsLane(payload, { activityLimit = 10 } = {}) {
  const features = rowsOf(payload);

  return {
    summary: { weatherAlerts: countOf(payload) },
    activity: features
      .map((feature) => {
        const p = feature?.properties || feature || {};
        const id = p.id ?? feature?.id;
        if (id === undefined || id === null) return null;
        const area = p.area || p.areaDesc;
        return {
          id: `${ACTIVITY_TYPES.ALERT}:${id}`,
          type: ACTIVITY_TYPES.ALERT,
          // The NWS headline is already written for a human to read aloud, so
          // it beats anything composed from the parts.
          message: p.headline || `${p.event || 'Weather alert'}${area ? ` for ${area}` : ''}`,
          timestamp: toEpoch(p.onset ?? p.effective ?? p.sent) ?? 0,
          severity: p.actionable ? SEVERITIES.ERROR : SEVERITIES.WARNING
        };
      })
      .filter(Boolean)
      .slice(0, activityLimit)
  };
}

/** Which normaliser owns which lane name. */
const LANE_BUILDERS = Object.freeze({
  properties: propertiesLane,
  storms: stormsLane,
  assessments: assessmentsLane,
  alerts: alertsLane
});

/** Normalise one lane's raw payload into its contribution to the snapshot. */
function toLane(name, payload, options = {}) {
  const build = LANE_BUILDERS[name];
  if (!build) throw new Error(`Unknown dashboard source: ${name}`);
  return build(payload, options);
}

/* --------------------------------------------------------------- compose -- */

const EMPTY_SUMMARY = Object.freeze({
  totalProperties: 0,
  activeStorms: 0,
  highRiskProperties: 0,
  recentAssessments: 0,
  weatherAlerts: 0
});

/**
 * Newest first, one row per event.
 *
 * The dedupe is not theoretical: a `property_assessment_complete` push lands
 * an activity row immediately, and the refresh it triggers brings the same
 * assessment back from `/api/assessments/history` seconds later. Keyed on a
 * content-derived id, the second copy replaces the first instead of stacking
 * under it.
 */
function mergeActivity(lists, { limit = 12 } = {}) {
  const byId = new Map();
  for (const list of lists) {
    for (const event of list || []) {
      if (!event || typeof event.id !== 'string') continue;
      const existing = byId.get(event.id);
      // Later-arriving copies win, but a copy with no timestamp never
      // overwrites one that has a real instant.
      if (!existing || (event.timestamp || 0) >= (existing.timestamp || 0)) {
        byId.set(event.id, event);
      }
    }
  }
  return [...byId.values()]
    // The id tie-break is not cosmetic: a storm detected in the same second as
    // an assessment completing would otherwise be ordered by whichever lane
    // happened to land first, and a lane that fails and recovers changes that
    // order - so the feed would reshuffle itself between refreshes.
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/**
 * Assemble the snapshot from whatever lanes have contributed.
 *
 * A lane missing from `lanes` contributes nothing rather than zero. That
 * distinction is the whole value of the DEGRADED state: when the alert feed
 * 503s, the store keeps the last good alerts lane in place and the card shows
 * the last-known count with a warning, instead of flipping to a confident "0
 * weather alerts" that would read as good news.
 *
 * @returns {import('./types').DashboardSnapshot}
 */
function composeSnapshot(lanes = {}, { fetchedAt = null, activityLimit = 12, pushed = [] } = {}) {
  const present = Object.values(lanes).filter(Boolean);

  const summary = present.reduce(
    (acc, lane) => ({ ...acc, ...(lane.summary || {}) }),
    { ...EMPTY_SUMMARY }
  );

  return {
    summary,
    activity: mergeActivity([...present.map((l) => l.activity), pushed], { limit: activityLimit }),
    priorityProperties: lanes.properties?.priorityProperties || [],
    fetchedAt
  };
}

/* -------------------------------------------------------------- realtime -- */

/**
 * Turn a socket event into an activity row, or null if it carries nothing we
 * can state truthfully.
 *
 * Note what this deliberately does *not* do: it never adjusts a count. A push
 * says "something happened", not "the total is now 48", and a dashboard that
 * increments its own tiles drifts away from the API within minutes - usually
 * invisibly, because nothing ever re-reads the number it invented. The store
 * instead treats a push as an invalidation and re-reads the counts, so there
 * is exactly one authority for every figure on screen. `dashboard_update` is
 * the one exception, because there the server is the one stating the totals.
 *
 * @returns {import('./types').ActivityEvent|null}
 */
function eventToActivity(name, payload, { now = Date.now() } = {}) {
  const at = toEpoch(payload?.timestamp ?? payload?.detected_at ?? payload?.completed_at) ?? now;

  switch (name) {
    case 'storm_alert': {
      const id = payload?.id ?? payload?.storm_id;
      const kind = humanize(payload?.type || payload?.event_type, 'Storm alert');
      const region = payload?.region || payload?.region_name || 'an unmonitored region';
      return {
        id: `${ACTIVITY_TYPES.STORM}:${id ?? `push-${at}`}`,
        type: ACTIVITY_TYPES.STORM,
        message: payload?.message || `${kind} detected in ${region}`,
        timestamp: at,
        severity: stormSeverity(payload?.severity)
      };
    }
    case 'storm_dissipated': {
      const id = payload?.id ?? payload?.storm_id;
      if (id === undefined || id === null) return null;
      return {
        id: `${ACTIVITY_TYPES.STORM}:dissipated:${id}`,
        type: ACTIVITY_TYPES.STORM,
        message: `Storm ${payload?.region_name || id} has dissipated`,
        timestamp: at,
        severity: SEVERITIES.INFO
      };
    }
    case 'property_assessment_complete': {
      const id = payload?.id ?? payload?.assessment_id;
      const address = payload?.propertyAddress || payload?.address || 'a property';
      const score = payload?.overallScore ?? payload?.overall_score;
      const scored = score === null || score === undefined
        ? ''
        : ` — ${Math.round(toNumber(score, 0))}% damage probability`;
      return {
        id: `${ACTIVITY_TYPES.ASSESSMENT}:${id ?? `push-${at}`}`,
        type: ACTIVITY_TYPES.ASSESSMENT,
        message: `Assessment completed at ${address}${scored}`,
        timestamp: at,
        severity: riskBandFor(score) === RISK_BANDS.HIGH ? SEVERITIES.WARNING : SEVERITIES.INFO
      };
    }
    case 'new_leads_generated': {
      const count = toNumber(payload?.leadCount ?? payload?.count, 0);
      if (count <= 0) return null;
      return {
        id: `${ACTIVITY_TYPES.LEAD}:${at}`,
        type: ACTIVITY_TYPES.LEAD,
        message: `${count} new lead${count === 1 ? '' : 's'} generated`,
        timestamp: at,
        severity: SEVERITIES.INFO
      };
    }
    case 'system_notification': {
      if (!payload?.message) return null;
      return {
        id: `${ACTIVITY_TYPES.SYSTEM}:${at}`,
        type: ACTIVITY_TYPES.SYSTEM,
        message: String(payload.message),
        timestamp: at,
        severity: payload.type === 'error' ? SEVERITIES.ERROR : SEVERITIES.INFO
      };
    }
    default:
      return null;
  }
}

/**
 * Accept server-stated totals, and only the keys the model actually has.
 *
 * `dashboard_update` is a free-form socket payload: anything on the wire ends
 * up here. Whitelisting the five keys and requiring each to be a finite number
 * means a malformed or hostile push can at worst leave a count unchanged, not
 * render `NaN%` across the top of an operator's screen.
 */
function mergeSummaryPatch(summary, patch) {
  if (!patch || typeof patch !== 'object') return summary;
  const next = { ...summary };
  let changed = false;
  for (const key of Object.keys(EMPTY_SUMMARY)) {
    const value = patch[key];
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) {
      next[key] = n;
      changed = true;
    }
  }
  return changed ? next : summary;
}

module.exports = {
  toEpoch,
  toNumber,
  coordinate,
  countOf,
  rowsOf,
  riskBandFor,
  humanize,
  toLane,
  propertiesLane,
  stormsLane,
  assessmentsLane,
  alertsLane,
  mergeActivity,
  composeSnapshot,
  eventToActivity,
  mergeSummaryPatch,
  EMPTY_SUMMARY
};
