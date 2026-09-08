'use strict';

const express = require('express');
const axios = require('axios');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { asyncHandler, ErrorResponse } = require('../middleware/errorHandler');
const db = require('../../config/database');
const logger = require('../utils/logger');
const {
  RADAR_PROVIDERS, BASEMAPS, ALERTS_ENDPOINT,
  framesFromRainViewer, toAlertFeatures, propertiesInAlerts
} = require('@atlas/radar-map');
const { Joi, validate, scopeToCompany, boundsSchema } = require('./_helpers');

const router = express.Router();

/**
 * Radar and alert routes.
 *
 * These proxy NOAA and RainViewer rather than letting the browser call them
 * directly, for three reasons that all matter in the field:
 *
 *  - CORS. api.weather.gov does not send permissive CORS headers for every
 *    query shape, and a truck full of reps is not the place to discover that.
 *  - Politeness. One cached fetch per interval serves every open dashboard,
 *    instead of every dashboard hammering a free public endpoint during the
 *    exact storm everyone else is also watching.
 *  - The join. Alert polygons only become useful when crossed with this
 *    company's properties, and that crossing has to happen where the property
 *    rows are.
 */

/**
 * A tiny TTL cache, in process.
 *
 * Deliberately not Redis: this is a handful of kilobytes with a sub-minute
 * lifetime, and a cache miss costs one upstream request. Redis would add an
 * operational dependency to save nothing. Behind several instances each keeps
 * its own copy, which is correct — they are all reading the same public feed.
 */
const cache = new Map();

async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  // A single in-flight promise per key, so a burst of dashboards refreshing
  // together produces one upstream request rather than one each.
  if (hit?.pending) return hit.pending;

  const pending = loader()
    .then((value) => {
      cache.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, { pending, expires: 0 });
  return pending;
}

const UPSTREAM = {
  timeout: 15000,
  headers: {
    // api.weather.gov requires a User-Agent identifying the caller.
    'User-Agent': process.env.NWS_USER_AGENT || '(atlas-helios-platform, support@propertyinsight.ai)',
    Accept: 'application/geo+json'
  }
};

/**
 * @route GET /api/radar/config
 * @desc  What the client needs to build the map: providers, basemaps, defaults.
 *        Served from the server so a provider can be switched without shipping
 *        a new frontend bundle.
 */
router.get('/config', (req, res) => {
  res.json({
    data: {
      providers: Object.values(RADAR_PROVIDERS).map(({ frameTemplate, ...rest }) => rest),
      basemaps: BASEMAPS,
      defaults: {
        provider: process.env.RADAR_PROVIDER || 'rainviewer',
        basemap: process.env.RADAR_BASEMAP || 'dark',
        opacity: Number(process.env.RADAR_OPACITY) || 0.7,
        center: {
          lat: Number(process.env.RADAR_CENTER_LAT) || 32.7767,
          lng: Number(process.env.RADAR_CENTER_LNG) || -96.797
        },
        zoom: Number(process.env.RADAR_ZOOM) || 7
      }
    }
  });
});

/**
 * @route GET /api/radar/frames
 * @desc  The animation timeline: two hours of past scans plus nowcast frames,
 *        with the fully-resolved tile URL template for each.
 */
router.get('/frames', validate(Joi.object({
  forecast: Joi.boolean().default(true)
}), 'query'), asyncHandler(async (req, res) => {
  // 60s: RainViewer publishes a new frame roughly every ten minutes, so a
  // minute of staleness is invisible and cuts upstream traffic by orders.
  const payload = await cached('rainviewer-index', 60000, async () => {
    const response = await axios.get(RADAR_PROVIDERS.rainviewer.indexUrl, UPSTREAM);
    return response.data;
  }).catch((error) => {
    logger.warn(`Radar frame index unavailable: ${error.message}`);
    return null;
  });

  if (!payload) {
    throw new ErrorResponse('Radar frame index is unavailable', 503, { code: 'RADAR_UNAVAILABLE' });
  }

  const provider = RADAR_PROVIDERS.rainviewer;
  const frames = framesFromRainViewer(payload, { includeForecast: req.query.forecast })
    .map((frame) => ({
      time: frame.time,
      kind: frame.kind,
      tileUrl: provider.frameTemplate(frame.host, frame.path)
    }));

  res.json({
    data: {
      provider: provider.id,
      tileSize: provider.tileSize,
      maxZoom: provider.maxZoom,
      attribution: provider.attribution,
      frames
    },
    meta: { count: frames.length, generated_at: new Date().toISOString() }
  });
}));

/**
 * @route GET /api/radar/alerts
 * @desc  Active NWS alerts as GeoJSON, optionally clipped to a viewport.
 */
router.get('/alerts', optionalAuth, validate(Joi.object({
  actionable: Joi.boolean().default(false),
  area: Joi.string().uppercase().length(2),
  north: boundsSchema.extract('north').optional(),
  south: boundsSchema.extract('south').optional(),
  east: boundsSchema.extract('east').optional(),
  west: boundsSchema.extract('west').optional()
}), 'query'), asyncHandler(async (req, res) => {
  const { area, actionable } = req.query;
  const key = `nws-alerts:${area || 'all'}`;

  const payload = await cached(key, 60000, async () => {
    const url = area ? `${ALERTS_ENDPOINT}?area=${area}` : ALERTS_ENDPOINT;
    const response = await axios.get(url, UPSTREAM);
    return response.data;
  }).catch((error) => {
    logger.warn(`NWS alerts unavailable: ${error.message}`);
    return null;
  });

  if (!payload) throw new ErrorResponse('Alert feed is unavailable', 503, { code: 'ALERTS_UNAVAILABLE' });

  let features = toAlertFeatures(payload, { actionableOnly: actionable });

  // Viewport clip is a cheap bbox reject, done here so a national feed does
  // not travel to a tablet that is looking at one county.
  const { north, south, east, west } = req.query;
  if ([north, south, east, west].every((v) => v !== undefined)) {
    const { geometryBounds } = require('@atlas/radar-map');
    features = features.filter((f) => {
      const b = geometryBounds(f.geometry);
      return b && b.south <= north && b.north >= south && b.west <= east && b.east >= west;
    });
  }

  res.json({
    type: 'FeatureCollection',
    features,
    meta: { count: features.length, source: 'NWS api.weather.gov' }
  });
}));

/**
 * @route GET /api/radar/exposure
 * @desc  This company's properties that sit inside an active alert polygon,
 *        worst alert first. The dispatch list Atlas exists to produce.
 */
router.get('/exposure', authMiddleware, validate(Joi.object({
  actionable: Joi.boolean().default(true),
  area: Joi.string().uppercase().length(2),
  limit: Joi.number().integer().min(1).max(2000).default(500)
}), 'query'), asyncHandler(async (req, res) => {
  const payload = await cached(`nws-alerts:${req.query.area || 'all'}`, 60000, async () => {
    const url = req.query.area ? `${ALERTS_ENDPOINT}?area=${req.query.area}` : ALERTS_ENDPOINT;
    const response = await axios.get(url, UPSTREAM);
    return response.data;
  }).catch(() => null);

  if (!payload) throw new ErrorResponse('Alert feed is unavailable', 503, { code: 'ALERTS_UNAVAILABLE' });

  const features = toAlertFeatures(payload, { actionableOnly: req.query.actionable });

  const properties = await scopeToCompany(db('properties'), req.user)
    .whereNotNull('latitude')
    .whereNotNull('longitude')
    .select('id', 'address', 'city', 'state', 'zip_code', 'latitude', 'longitude',
      'estimated_value', 'damage_probability', 'owner_name')
    .limit(req.query.limit);

  const exposed = propertiesInAlerts(properties, features);

  res.json({
    data: exposed,
    meta: {
      alerts: features.length,
      properties_checked: properties.length,
      properties_exposed: exposed.length
    }
  });
}));

module.exports = router;
module.exports._cache = cache;
