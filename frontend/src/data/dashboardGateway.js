import { api } from '../lib/api';
import { HIGH_RISK_THRESHOLD } from '@atlas/dashboard-data';

/**
 * The REST lane: the only file that knows which endpoints feed the dashboard.
 *
 * It is one function returning four loaders rather than four exported
 * functions, so the whole supply side can be swapped in one argument - a test
 * passes stub loaders, a story passes none at all.
 *
 * ## Why four reads instead of one
 *
 * There is no `/api/dashboard/summary` endpoint, and adding one was not worth
 * the backend contract it would create today: every figure the dashboard shows
 * already exists behind an endpoint the rest of the app uses, and composing
 * them here keeps the change additive - nothing the mobile app or the public
 * map reads has to move. The counts come from `meta.total`, so a page size of
 * 25 can never masquerade as a total.
 *
 * When the fan-out does become the bottleneck, the migration is this file and
 * nothing else: replace the four loaders with one call to the aggregate
 * endpoint, keep returning the same shapes, and the store, the state machine,
 * the hook and every component stay exactly as they are. That seam is the
 * reason this layer exists.
 */

/** ISO instant `hours` ago, for the "recent" windows the API filters on. */
const hoursAgo = (hours, now = Date.now()) => new Date(now - hours * 3600_000).toISOString();

/**
 * Where to ask for the weather.
 *
 * The forecast endpoint wants a point, and the honest answer to "which point"
 * is already in the database: `monitoring_regions` is the list of metros Atlas
 * polls for severe weather, so the dashboard forecasts the first of them
 * rather than hardcoding a city. An explicit `location` wins, and
 * `REACT_APP_DEFAULT_LAT`/`LNG` is the last resort for a deployment with no
 * regions configured yet.
 *
 * The lookup is cached for the life of the gateway: the region list changes
 * when someone edits settings, not between polls.
 */
function createLocationResolver({ client, location }) {
  let resolved = location || null;
  let inflight = null;

  const fromEnv = () => {
    const lat = Number(process.env.REACT_APP_DEFAULT_LAT);
    const lng = Number(process.env.REACT_APP_DEFAULT_LNG);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  };

  return async (signal) => {
    if (resolved) return resolved;
    if (inflight) return inflight;

    inflight = (async () => {
      try {
        const payload = await client.storms.regions(signal);
        const regions = payload?.data || [];
        for (const region of regions) {
          // `center` is a JSON column, so some drivers hand it back as a string.
          const center = typeof region?.center === 'string'
            ? JSON.parse(region.center)
            : region?.center;
          const lat = Number(center?.lat);
          const lng = Number(center?.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, region: region.name };
        }
      } catch (error) {
        // A failed region lookup is not a failed forecast; fall through to the
        // configured default so one outage does not cascade into two.
        if (error?.code === 'ABORTED') throw error;
      }
      return fromEnv();
    })();

    try {
      resolved = await inflight;
      return resolved;
    } finally {
      inflight = null;
    }
  };
}

/**
 * @param {object} [options]
 * @param {typeof api} [options.client]        Injectable for tests.
 * @param {string} [options.area]              Two-letter state code to clip NWS alerts to.
 * @param {number} [options.priorityLimit]     Rows wanted in the dispatch queue.
 * @param {number} [options.activityWindowHours]
 * @param {{lat: number, lng: number}} [options.location] Forecast point; resolved from
 *        the monitoring regions when omitted.
 * @param {number} [options.mapLimit] Geocoded properties wanted for the map.
 * @param {() => number} [options.now]
 */
export function createDashboardGateway({
  client = api,
  area,
  priorityLimit = 5,
  mapLimit = 50,
  activityWindowHours = 24,
  location,
  now = Date.now
} = {}) {
  const resolveLocation = createLocationResolver({ client, location });

  return {
    /**
     * Both property counts and the dispatch queue.
     *
     * `limit: 1` for the total is deliberate: the tile needs `meta.total`, not
     * the rows, and asking for 25 properties to display one number is the kind
     * of waste that only shows up in production. The high-risk read is ordered
     * server-side so the queue is ranked by the same column the count filters
     * on, and the two can never disagree about who the worst roof is.
     */
    properties: async (signal) => {
      const [total, highRisk] = await Promise.all([
        client.properties.list({ limit: 1 }, signal),
        client.properties.list({
          min_risk: HIGH_RISK_THRESHOLD,
          sort: 'damage_probability',
          order: 'desc',
          // The map pins these same rows, so the page asks for enough of them
          // to be worth a map. The queue shows the worst few of the same list,
          // which is why the two can never disagree about who is worst.
          limit: Math.max(priorityLimit, mapLimit)
        }, signal)
      ]);
      return { total, highRisk };
    },

    storms: (signal) => client.storms.list({ status: 'active', limit: 25 }, signal),

    assessments: (signal) => client.assessments.history({
      since: hoursAgo(activityWindowHours, now()),
      limit: 10,
      order: 'desc'
    }, signal),

    /**
     * NWS alerts. This is the lane that actually fails in practice - the feed
     * is an upstream the backend proxies, and it answers 503 with
     * `ALERTS_UNAVAILABLE` often enough that DEGRADED is a weekly state rather
     * than a theoretical one.
     */
    alerts: (signal) => client.radar.alerts(area ? { area } : {}, signal),

    /**
     * The next 24 hours for the first monitored region.
     *
     * The panel this feeds used to be a literal array of twelve numbers under
     * the heading "24-Hour Weather Forecast". The backend now stamps every
     * weather payload with `source`, and answers 503 `WEATHER_UNAVAILABLE`
     * rather than substituting its demo generator, so this lane either carries
     * a real forecast or fails visibly.
     */
    forecast: async (signal) => {
      const point = await resolveLocation(signal);
      if (!point) {
        // Nothing to ask about is not a failure: no monitored region and no
        // configured default means the panel has nothing to show, and should
        // say so rather than forecast a city nobody chose.
        return { source: null, properties: { periods: [] } };
      }
      return client.weather.hourly({ lat: point.lat, lng: point.lng }, signal);
    }
  };
}

/**
 * The browser's localStorage, or null where there isn't one.
 *
 * Touching `window.localStorage` can throw outright when site data is blocked,
 * so even reaching for it is wrapped. `createCache` wraps every access too;
 * this guard is for the lookup itself.
 */
export function browserStore() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export default createDashboardGateway;
