'use strict';

const { ALERT_SEVERITY, severityOf, isActionable } = require('./sources');
const { coordinate } = require('./properties');

/**
 * NWS alert polygons, and the property exposure they imply.
 *
 * The map layer is only half of it. The reason Atlas draws warning polygons is
 * to answer one question — which of my customers' roofs are inside one — so
 * this module also does the point-in-polygon test that turns a weather feed
 * into a dispatch list.
 */

/**
 * Normalise a GeoJSON alert FeatureCollection into a layer-ready collection.
 *
 * Alerts without geometry are dropped rather than rendered at [0,0]. The NWS
 * feed emits plenty of them: an alert scoped to a zone or county carries only
 * an affected-zone URL, and a "null island" polygon in the Gulf of Guinea is
 * worse than no polygon at all.
 */
function toAlertFeatures(payload, { actionableOnly = false } = {}) {
  const features = payload?.features || [];

  return features
    .filter((f) => f?.geometry && (!actionableOnly || isActionable(f)))
    .map((f) => {
      const severity = severityOf(f);
      const p = f.properties || {};
      return {
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: p.id || f.id,
          event: p.event || 'Alert',
          severity: p.severity || 'Unknown',
          severity_rank: severity.rank,
          color: severity.color,
          urgency: p.urgency,
          certainty: p.certainty,
          headline: p.headline,
          area: p.areaDesc,
          onset: p.onset,
          expires: p.expires,
          actionable: isActionable(f)
        }
      };
    })
    // Draw least severe first so a tornado warning is never buried under a
    // frost advisory that happens to come later in the feed.
    .sort((a, b) => a.properties.severity_rank - b.properties.severity_rank);
}

/** Ray casting against one linear ring. */
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = (yi > lat) !== (yj > lat);
    if (straddles && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Point in polygon, honouring holes. */
function pointInPolygon(lng, lat, coordinates) {
  if (!coordinates?.length) return false;
  if (!pointInRing(lng, lat, coordinates[0])) return false;
  // Any interior ring the point falls inside is a hole, so it is outside.
  for (let i = 1; i < coordinates.length; i++) {
    if (pointInRing(lng, lat, coordinates[i])) return false;
  }
  return true;
}

/** Point in a Polygon or MultiPolygon geometry. */
function pointInGeometry(lng, lat, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return pointInPolygon(lng, lat, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly) => pointInPolygon(lng, lat, poly));
  }
  return false;
}

/**
 * Which properties fall inside which alerts.
 *
 * Each property is returned with its worst covering alert, because that is
 * what a dispatcher sorts on. A bounding-box pre-filter keeps this near-linear:
 * without it, a national alert sweep against a large book of business is a
 * polygon test per property per alert.
 */
function propertiesInAlerts(properties, alertFeatures) {
  const withBounds = alertFeatures.map((feature) => ({ feature, bbox: geometryBounds(feature.geometry) }));

  return properties
    .map((property) => {
      // Strict parse: an ungeocoded row must not be tested as a point at 0,0.
      const lng = coordinate(property.longitude);
      const lat = coordinate(property.latitude);
      if (lng === null || lat === null) return null;

      const hits = withBounds
        .filter(({ bbox }) => bbox
          && lng >= bbox.west && lng <= bbox.east
          && lat >= bbox.south && lat <= bbox.north)
        .filter(({ feature }) => pointInGeometry(lng, lat, feature.geometry))
        .map(({ feature }) => feature.properties);

      if (hits.length === 0) return null;

      const worst = hits.reduce((a, b) => (b.severity_rank > a.severity_rank ? b : a));
      return { ...property, alerts: hits, worst_alert: worst, alert_count: hits.length };
    })
    .filter(Boolean)
    .sort((a, b) => b.worst_alert.severity_rank - a.worst_alert.severity_rank);
}

/** Bounding box of a Polygon/MultiPolygon, for the pre-filter above. */
function geometryBounds(geometry) {
  if (!geometry) return null;
  const rings = geometry.type === 'Polygon'
    ? geometry.coordinates
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates.flat()
      : null;
  if (!rings) return null;

  let north = -Infinity; let south = Infinity;
  let east = -Infinity; let west = Infinity;

  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lat > north) north = lat;
      if (lat < south) south = lat;
      if (lng > east) east = lng;
      if (lng < west) west = lng;
    }
  }
  return Number.isFinite(north) ? { north, south, east, west } : null;
}

/**
 * MapLibre layer definitions for the alert collection.
 *
 * A fill plus a line, because a translucent fill alone loses its edge against
 * radar returns underneath — and the edge is the part that answers "is my
 * customer in it or not".
 */
function alertLayers({ sourceId = 'atlas-alerts', beforeId } = {}) {
  return [
    {
      id: `${sourceId}-fill`,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': ['get', 'color'],
        // Severe alerts read through the radar; minor ones stay out of the way.
        'fill-opacity': ['interpolate', ['linear'], ['get', 'severity_rank'], 0, 0.08, 4, 0.28]
      },
      beforeId
    },
    {
      id: `${sourceId}-outline`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['get', 'severity_rank'], 0, 1, 4, 2.5],
        'line-opacity': 0.9
      },
      beforeId
    }
  ];
}

module.exports = {
  toAlertFeatures,
  propertiesInAlerts,
  pointInGeometry,
  pointInPolygon,
  geometryBounds,
  alertLayers,
  ALERT_SEVERITY
};
