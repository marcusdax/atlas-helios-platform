'use strict';

/**
 * Basemap providers.
 *
 * Open-source mapping separates three concerns that proprietary SDKs bundle
 * together: the data, who hosts the tiles, and what renders them. Keeping them
 * apart is the reason this file exists, because only the middle one is a real
 * decision for this product.
 *
 *   Data      OpenStreetMap (ODbL). Every vector option below is OSM under the
 *             hood, so switching host does not change the map's content.
 *   Hosting   OpenFreeMap's public instance, or a self-hosted PMTiles archive.
 *   Renderer  MapLibre GL (BSD-3), already the renderer here.
 *
 * Two hosting choices, and the trade is infrastructure against control:
 *
 *   hosted   OpenFreeMap. No API key, no registration, no view or rate limit,
 *            commercial use permitted. Nothing to run. The default, because a
 *            storm-response tool should not have an outage because someone
 *            forgot to renew a tile plan.
 *
 *   pmtiles  Protomaps. The whole region is one static `.pmtiles` archive on
 *            object storage; the browser fetches byte ranges over HTTP, so
 *            there is no tile server and no PostGIS behind it. This is the
 *            option for air-gapped trucks, for traffic that would be rude to
 *            point at a free public instance, and for a basemap that keeps
 *            working when the network does not.
 *
 * Deliberately absent: `tile.openstreetmap.org`. Those raster tiles are served
 * by donated volunteer infrastructure under a usage policy that forbids heavy
 * or commercial traffic, and OSMF blocks clients that ignore it. Pointing a
 * commercial product at them is not a shortcut, it is taking someone else's
 * donated bandwidth — `assertUsableTileUrl` below refuses the host outright so
 * it cannot arrive later by configuration.
 */

/** Hosts that must never be used as a tile source, and why. */
const REFUSED_TILE_HOSTS = [
  {
    match: /(^|\.)tile\.openstreetmap\.org$/i,
    why: 'OSMF volunteer tile servers forbid heavy and commercial use, and block clients that ignore it. '
      + 'Use the hosted OpenFreeMap instance or a self-hosted PMTiles archive.'
  },
  {
    match: /(^|\.)tile\.osm\.org$/i,
    why: 'Alias of tile.openstreetmap.org, under the same usage policy.'
  }
];

/**
 * Throw on a tile URL that must not ship, rather than discovering it in
 * production when the host starts returning 418s.
 *
 * @param {string} url
 * @returns {string} the url, unchanged, so this can wrap a value inline
 */
function assertUsableTileUrl(url) {
  if (typeof url !== 'string' || url === '') return url;
  let host;
  try {
    host = new URL(url.replace(/^pmtiles:\/\//, 'https://')).hostname;
  } catch {
    return url; // a relative path or a template fragment; nothing to check
  }
  const refused = REFUSED_TILE_HOSTS.find((r) => r.match.test(host));
  if (refused) throw new Error(`Refusing tile host ${host}: ${refused.why}`);
  return url;
}

/* ------------------------------------------------------------------------ */
/* OpenMapTiles schema style                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Palette per theme, in the engine colours so the basemap sits under the
 * product rather than competing with it. The map is a backdrop for damage
 * overlays: it has to recede.
 */
const THEMES = {
  dark: {
    background: '#0A0D11',
    water: '#121C26',
    landuse: '#11161C',
    park: '#101A16',
    building: '#182028',
    roadMinor: '#222A33',
    roadMajor: '#2E3942',
    motorway: '#3A464F',
    boundary: '#34404D',
    label: '#9AA4AE',
    labelHalo: '#0A0D11'
  },
  light: {
    background: '#F6F1E7',
    water: '#CBD9E3',
    landuse: '#EDE7DA',
    park: '#DCE5D4',
    building: '#E2DACB',
    roadMinor: '#FFFFFF',
    roadMajor: '#FFFFFF',
    motorway: '#F2D9A8',
    boundary: '#B4AE9F',
    label: '#4A5765',
    labelHalo: '#F6F1E7'
  }
};

/**
 * A compact style for the OpenMapTiles schema.
 *
 * Why this is written out rather than fetched: a self-hosted archive exists so
 * the map works without the public internet, and a style fetched from a CDN at
 * boot would put the dependency straight back. This covers the layers that
 * matter when someone is looking for a roof — water, land, buildings, the road
 * hierarchy, boundaries and place labels — and nothing else.
 *
 * It is the OpenMapTiles schema specifically, which is what both OpenFreeMap
 * and a planetiler-built archive emit, so one style serves both hosts. An
 * archive built with the Protomaps basemap schema uses different layer names
 * and needs its own style; pass `styleUrl` for that case.
 *
 * @param {object} options
 * @param {object} options.source   MapLibre source spec for the vector tiles
 * @param {'dark'|'light'} [options.theme]
 * @param {string} [options.attribution]
 */
function openMapTilesStyle({ source, theme = 'dark', attribution }) {
  const c = THEMES[theme] || THEMES.dark;
  const vector = attribution ? { ...source, attribution } : source;

  const road = (id, filterClasses, color, widthStops) => ({
    id,
    type: 'line',
    source: 'omt',
    'source-layer': 'transportation',
    filter: ['match', ['get', 'class'], filterClasses, true, false],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': { base: 1.4, stops: widthStops } }
  });

  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { omt: vector },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': c.background } },
      {
        id: 'landuse',
        type: 'fill',
        source: 'omt',
        'source-layer': 'landuse',
        paint: { 'fill-color': c.landuse }
      },
      {
        id: 'park',
        type: 'fill',
        source: 'omt',
        'source-layer': 'park',
        paint: { 'fill-color': c.park }
      },
      {
        id: 'water',
        type: 'fill',
        source: 'omt',
        'source-layer': 'water',
        paint: { 'fill-color': c.water }
      },
      {
        // Buildings appear late. Below z14 they are noise; at z16 they are the
        // thing being assessed.
        id: 'building',
        type: 'fill',
        source: 'omt',
        'source-layer': 'building',
        minzoom: 14,
        paint: { 'fill-color': c.building, 'fill-opacity': { base: 1, stops: [[14, 0], [16, 0.85]] } }
      },
      road('road-minor', ['minor', 'service', 'track', 'path'], c.roadMinor, [[12, 0.4], [16, 3], [20, 12]]),
      road('road-major', ['secondary', 'tertiary'], c.roadMajor, [[8, 0.5], [14, 2.5], [20, 18]]),
      road('road-trunk', ['primary', 'trunk'], c.motorway, [[6, 0.6], [14, 3.5], [20, 24]]),
      road('road-motorway', ['motorway'], c.motorway, [[5, 0.8], [14, 4.5], [20, 30]]),
      {
        id: 'boundary',
        type: 'line',
        source: 'omt',
        'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 4],
        paint: { 'line-color': c.boundary, 'line-width': 1, 'line-dasharray': [3, 2] }
      },
      {
        id: 'place-label',
        type: 'symbol',
        source: 'omt',
        'source-layer': 'place',
        filter: ['match', ['get', 'class'], ['city', 'town', 'village', 'suburb'], true, false],
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': { base: 1.2, stops: [[6, 11], [12, 15]] }
        },
        paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.2 }
      },
      {
        // Street names only once a street is what you are looking at.
        id: 'street-label',
        type: 'symbol',
        source: 'omt',
        'source-layer': 'transportation_name',
        minzoom: 14,
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'symbol-placement': 'line'
        },
        paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.2 }
      }
    ]
  };
}

/* ------------------------------------------------------------------------ */
/* Provider resolution                                                        */
/* ------------------------------------------------------------------------ */

const OPENFREEMAP_ATTRIBUTION = '© OpenFreeMap · © OpenStreetMap contributors';
const PROTOMAPS_ATTRIBUTION = '© OpenStreetMap contributors';
const USGS_ATTRIBUTION = 'USGS The National Map';

/** Hosted OpenFreeMap: a style URL is all MapLibre needs. */
const hostedBasemaps = () => ({
  streets: {
    id: 'streets',
    label: 'Streets',
    provider: 'openfreemap',
    styleUrl: assertUsableTileUrl('https://tiles.openfreemap.org/styles/liberty'),
    attribution: OPENFREEMAP_ATTRIBUTION
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    provider: 'openfreemap',
    styleUrl: assertUsableTileUrl('https://tiles.openfreemap.org/styles/dark'),
    attribution: OPENFREEMAP_ATTRIBUTION
  }
});

/**
 * Self-hosted PMTiles.
 *
 * `pmtiles://` is resolved by a protocol handler the client registers once; it
 * turns each tile request into an HTTP range request against the single
 * archive, so the "server" is whatever can serve a byte range — R2, S3, a
 * static host, or a file on the truck's own machine.
 *
 * @param {object} options
 * @param {string} options.url            location of the .pmtiles archive
 * @param {string} [options.styleUrl]     a style to use instead of the built-in
 *                                        one — required if the archive uses the
 *                                        Protomaps schema rather than OpenMapTiles
 * @param {string} [options.attribution]
 */
function pmtilesBasemaps({ url, styleUrl, attribution = PROTOMAPS_ATTRIBUTION }) {
  assertUsableTileUrl(url);
  const source = { type: 'vector', url: `pmtiles://${url}` };

  const make = (id, label, theme) => ({
    id,
    label,
    provider: 'pmtiles',
    pmtilesUrl: url,
    // An explicit style wins; otherwise the built-in OpenMapTiles style keeps
    // the archive self-contained, which is the point of choosing PMTiles.
    ...(styleUrl ? { styleUrl } : { style: openMapTilesStyle({ source, theme, attribution }) }),
    attribution
  });

  return {
    streets: make('streets', 'Streets', 'light'),
    dark: make('dark', 'Dark', 'dark')
  };
}

/** USGS imagery. Raster, not OSM, and the only basemap that shows a roof. */
const imageryBasemap = () => ({
  id: 'imagery',
  label: 'Aerial imagery',
  provider: 'usgs',
  raster: {
    tiles: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256,
    maxzoom: 16
  },
  attribution: USGS_ATTRIBUTION
});

/**
 * The basemaps available for a given configuration.
 *
 * Falls back to the hosted provider when `pmtiles` is selected without a URL,
 * because a missing archive should degrade to a working map rather than to a
 * blank canvas — and says so through `fellBack`, so the caller can tell the
 * operator instead of silently serving something they did not choose.
 *
 * @param {object} [config]
 * @param {'hosted'|'pmtiles'} [config.provider]
 * @param {string} [config.pmtilesUrl]
 * @param {string} [config.pmtilesStyleUrl]
 * @param {string} [config.attribution]
 */
function basemapsFor(config = {}) {
  const wanted = config.provider || 'hosted';
  const usePmtiles = wanted === 'pmtiles' && Boolean(config.pmtilesUrl);

  const vector = usePmtiles
    ? pmtilesBasemaps({
      url: config.pmtilesUrl,
      styleUrl: config.pmtilesStyleUrl,
      attribution: config.attribution
    })
    : hostedBasemaps();

  return {
    ...vector,
    imagery: imageryBasemap(),
    meta: {
      provider: usePmtiles ? 'pmtiles' : 'hosted',
      requested: wanted,
      fellBack: wanted === 'pmtiles' && !usePmtiles,
      /** True when the map needs the pmtiles:// protocol handler registered. */
      needsPmtilesProtocol: usePmtiles
    }
  };
}

/** Back-compatible default: the hosted provider, as before. */
const BASEMAPS = { ...hostedBasemaps(), imagery: imageryBasemap() };

module.exports = {
  BASEMAPS,
  basemapsFor,
  hostedBasemaps,
  pmtilesBasemaps,
  imageryBasemap,
  openMapTilesStyle,
  assertUsableTileUrl,
  REFUSED_TILE_HOSTS,
  THEMES
};
