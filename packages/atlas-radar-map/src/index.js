'use strict';

const sources = require('./sources');
const basemaps = require('./basemaps');
const { RadarTimeline, framesFromRainViewer, clamp } = require('./timeline');
const { RadarLanes, syncLane, sourceKey } = require('./lanes');
const alerts = require('./alerts');
const properties = require('./properties');

module.exports = {
  // Data sources
  ...sources,

  // Basemaps: hosted OpenFreeMap, self-hosted Protomaps/PMTiles, USGS imagery
  ...basemaps,

  // Timeline
  RadarTimeline,
  framesFromRainViewer,
  clamp,

  // Radar rendering
  RadarLanes,
  syncLane,
  sourceKey,

  // Alerts
  toAlertFeatures: alerts.toAlertFeatures,
  propertiesInAlerts: alerts.propertiesInAlerts,
  pointInGeometry: alerts.pointInGeometry,
  geometryBounds: alerts.geometryBounds,
  alertLayers: alerts.alertLayers,

  // Property overlay
  toPropertyFeatures: properties.toPropertyFeatures,
  propertyLayers: properties.propertyLayers,
  RISK_BANDS: properties.RISK_BANDS,
  bandFor: properties.bandFor
};
