'use strict';

/**
 * Property risk markers.
 *
 * A circle layer rather than DOM markers: a storm footprint over a metro area
 * routinely covers thousands of properties, and thousands of absolutely
 * positioned DOM nodes make the map unpannable. Circles are drawn on the GPU
 * with the rest of the style, and the data-driven paint means the risk ramp is
 * evaluated per feature without a re-render.
 */

/**
 * Parse a coordinate strictly.
 *
 * `Number(null)` is 0 and `Number.isFinite(0)` is true, so a naive finite check
 * treats an ungeocoded row as a valid point at 0,0 - the Gulf of Guinea, half a
 * world from any customer. Null, undefined and empty string are rejected before
 * the numeric conversion, not after it.
 */
function coordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Risk bands, matching the API's damage_probability scale. */
const RISK_BANDS = [
  { min: 80, color: '#d40000', label: 'Severe' },
  { min: 60, color: '#ff6b00', label: 'High' },
  { min: 40, color: '#ffb703', label: 'Moderate' },
  { min: 0, color: '#4cc9f0', label: 'Low' }
];

const bandFor = (score) =>
  RISK_BANDS.find((band) => (score || 0) >= band.min) || RISK_BANDS[RISK_BANDS.length - 1];

/** Property rows -> GeoJSON, dropping anything ungeocoded rather than placing it at 0,0. */
function toPropertyFeatures(properties) {
  return {
    type: 'FeatureCollection',
    features: (properties || [])
      .map((p) => ({ row: p, lng: coordinate(p.longitude), lat: coordinate(p.latitude) }))
      .filter(({ lng, lat }) => lng !== null && lat !== null)
      .map(({ row: p, lng, lat }) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          id: p.id,
          address: p.address,
          city: p.city,
          state: p.state,
          risk: Number(p.damage_probability) || 0,
          value: Number(p.estimated_value) || 0,
          band: bandFor(Number(p.damage_probability) || 0).label
        }
      }))
  };
}

/**
 * Layers for the property source.
 *
 * Radius grows with risk as well as zoom, so the properties worth dispatching
 * to are the ones that stand out at metro zoom — the view a dispatcher
 * actually works from.
 */
function propertyLayers({ sourceId = 'atlas-properties', beforeId } = {}) {
  return [
    {
      id: `${sourceId}-circles`,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-color': [
          'step', ['get', 'risk'],
          '#4cc9f0', 40, '#ffb703', 60, '#ff6b00', 80, '#d40000'
        ],
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          6, ['interpolate', ['linear'], ['get', 'risk'], 0, 2, 100, 5],
          12, ['interpolate', ['linear'], ['get', 'risk'], 0, 4, 100, 11]
        ],
        'circle-stroke-width': 1,
        'circle-stroke-color': 'rgba(8,12,16,.65)',
        'circle-opacity': 0.9
      },
      beforeId
    }
  ];
}

module.exports = { toPropertyFeatures, propertyLayers, RISK_BANDS, bandFor, coordinate };
