'use strict';

/**
 * Public weather data sources.
 *
 * Adapted from OpenRadar (MIT, https://github.com/marcusdax/OpenRadar), which
 * makes the point this catalogue exists to preserve: the underlying data is
 * public. NOAA publishes every MRMS grid, every radar mosaic and every warning
 * polygon free to anyone who asks, so a storm-intelligence product has no
 * reason to rent its own weather picture from a reseller.
 *
 * What is NOT carried over is OpenRadar's Rust decoding of NEXRAD Level II and
 * GRIB2 volumes. That is a desktop app with a native sidecar; this is a browser
 * in a field truck. So the browser consumes already-rendered tiles, and the
 * server proxies the JSON documents — same data, one decode boundary earlier.
 */

/**
 * Radar mosaic providers, in preference order.
 *
 * Two are listed because a single-provider radar layer is a single point of
 * failure over exactly the weather it exists to show: NOAA's public endpoints
 * are busiest during the severe events a restoration company is dispatched on.
 */
const RADAR_PROVIDERS = {
  /**
   * NOAA nowCOAST — the authoritative national mosaic, no key, no quota.
   * WMS rather than a tile pyramid, so it is addressed through a bbox template.
   */
  nowcoast: {
    id: 'nowcoast',
    label: 'NOAA nowCOAST mosaic',
    kind: 'wms',
    tileSize: 256,
    maxZoom: 12,
    attribution: 'NOAA/NWS nowCOAST',
    // {bbox-epsg-3857} is substituted by MapLibre per tile.
    template:
      'https://nowcoast.noaa.gov/geoserver/observations/weather_radar/ows' +
      '?service=WMS&version=1.3.0&request=GetMap&layers=base_reflectivity_mosaic' +
      '&styles=&format=image/png&transparent=true&crs=EPSG:3857' +
      '&width=256&height=256&bbox={bbox-epsg-3857}',
    /** nowCOAST serves the latest scan only; history comes from RainViewer. */
    animated: false
  },

  /**
   * RainViewer — a tile pyramid with a published frame index, which is what
   * makes the two-hour scrub possible. Free tier, no key.
   */
  rainviewer: {
    id: 'rainviewer',
    label: 'RainViewer radar loop',
    kind: 'raster',
    tileSize: 256,
    maxZoom: 12,
    attribution: 'RainViewer · NOAA',
    indexUrl: 'https://api.rainviewer.com/public/weather-maps.json',
    /**
     * `path` comes from the frame index. `color=4` is the NEXRAD-like ramp and
     * `1_1` turns on smoothing and the snow layer — chosen so the picture a
     * homeowner is shown matches what they saw on the news.
     */
    frameTemplate: (host, path) => `${host}${path}/256/{z}/{x}/{y}/4/1_1.png`,
    animated: true
  }
};

/** NWS watches, warnings and advisories — polygons, updated continuously. */
const ALERTS_ENDPOINT = 'https://api.weather.gov/alerts/active';

/**
 * Severity ordering and colours.
 *
 * Ordered so a property covered by several alerts is drawn and sorted by its
 * worst one; a tornado warning must never be hidden under a frost advisory.
 */
const ALERT_SEVERITY = {
  Extreme: { rank: 4, color: '#d40000', label: 'Extreme' },
  Severe: { rank: 3, color: '#ff6b00', label: 'Severe' },
  Moderate: { rank: 2, color: '#ffb703', label: 'Moderate' },
  Minor: { rank: 1, color: '#4cc9f0', label: 'Minor' },
  Unknown: { rank: 0, color: '#8d99ae', label: 'Unknown' }
};

/** The event types that actually generate restoration work. */
const ACTIONABLE_EVENTS = [
  'Tornado Warning',
  'Severe Thunderstorm Warning',
  'Hurricane Warning',
  'High Wind Warning',
  'Flash Flood Warning',
  'Winter Storm Warning',
  'Ice Storm Warning'
];

const severityOf = (alert) =>
  ALERT_SEVERITY[alert?.properties?.severity] || ALERT_SEVERITY.Unknown;

/** True when an alert is the kind Atlas should raise a lead against. */
const isActionable = (alert) =>
  ACTIONABLE_EVENTS.includes(alert?.properties?.event) || severityOf(alert).rank >= 3;

// Basemaps moved to ./basemaps.js when the self-hosted PMTiles provider was
// added; re-exported here so existing importers keep working.
const { BASEMAPS } = require('./basemaps');

module.exports = {
  RADAR_PROVIDERS,
  BASEMAPS,
  ALERTS_ENDPOINT,
  ALERT_SEVERITY,
  ACTIONABLE_EVENTS,
  severityOf,
  isActionable
};
