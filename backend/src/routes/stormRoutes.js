'use strict';

const express = require('express');
const { authMiddleware, authorize, optionalAuth } = require('../middleware/auth');
const { asyncHandler, ErrorResponse } = require('../middleware/errorHandler');
const db = require('../../config/database');
const logger = require('../utils/logger');
const StormService = require('../services/StormService');
const {
  Joi, validate, paginate, meta, scopeToCompany, notFoundIf, paginationSchema,
  coordinateSchema, radiusBox
} = require('./_helpers');

const router = express.Router();

const listQuery = paginationSchema.keys({
  status: Joi.string().valid('active', 'dissipated', 'forecast').default('active'),
  severity: Joi.string().valid('low', 'moderate', 'high', 'extreme'),
  type: Joi.string().max(40),
  since: Joi.date().iso(),
  // A viewport query: only storms the map can actually show.
  latitude: coordinateSchema.latitude,
  longitude: coordinateSchema.longitude,
  radius: Joi.number().min(1).max(1000)
}).with('radius', ['latitude', 'longitude']);

/**
 * @route GET /api/storms
 * @desc  Active storm events, optionally within a viewport.
 * @access Optional auth — the storm picture itself is not company data, and the
 *         public map on the marketing site renders from this same endpoint.
 */
router.get('/', optionalAuth, validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  const { status, severity, type, since, latitude, longitude, radius } = req.query;

  const base = () => {
    let query = db('storm_events').where('status', status);
    if (severity) query = query.where('severity', severity);
    if (type) query = query.where('event_type', type);
    if (since) query = query.where('created_at', '>=', since);
    if (radius) {
      const box = radiusBox(latitude, longitude, radius);
      query = query
        .whereBetween('latitude', [box.south, box.north])
        .whereBetween('longitude', [box.west, box.east]);
    }
    return query;
  };

  const [{ count }] = await base().count({ count: '*' });
  const data = await base().orderBy('created_at', req.query.order).limit(limit).offset(offset);

  res.json({ data, meta: meta(Number(count), { page, limit }) });
}));

/**
 * @route GET /api/storms/regions
 * @desc  The monitoring regions Atlas polls. Declared before /:id.
 */
router.get('/regions', optionalAuth, asyncHandler(async (req, res) => {
  res.json({ data: await db('monitoring_regions').where('active', true).orderBy('name') });
}));

/**
 * @route GET /api/storms/alerts/user
 * @desc  Storm alerts raised for the caller's company. Declared before /:id.
 *
 * This seeds the alert list the dashboard then keeps live over the `storm_alert`
 * WebSocket event, so it returns the same storm_alerts rows that event emits.
 * It is deliberately not /api/radar/alerts: that endpoint proxies the public NWS
 * GeoJSON feed - national weather data in a different shape - rather than the
 * alerts Atlas raised against a company's own monitoring regions.
 *
 * storm_alerts carries no company column, so it inherits scope from the region
 * its storm was detected in, which POST /api/storms/track registers per company.
 * The join is therefore the tenancy boundary, the same way an assessment
 * inherits its scope from the property. An alert whose storm belongs to no
 * region is attributable to no company, and the inner join drops it rather than
 * showing it to every tenant.
 */
router.get('/alerts/user', authMiddleware, validate(paginationSchema.keys({
  acknowledged: Joi.boolean(),
  since: Joi.date().iso()
}), 'query'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);

  const base = () => {
    let query = db('storm_alerts as a')
      .join('storm_events as e', 'e.id', 'a.storm_event_id')
      .join('monitoring_regions as r', 'r.id', 'e.region_id')
      .modify((qb) => scopeToCompany(qb, req.user, 'r.company_id'));

    if (req.query.acknowledged !== undefined) {
      query = query.where('a.acknowledged', req.query.acknowledged);
    }
    if (req.query.since) query = query.where('a.created_at', '>=', req.query.since);
    return query;
  };

  const [{ count }] = await base().count({ count: 'a.id' });
  const data = await base()
    .select(
      'a.*',
      'e.event_type as storm_event_type',
      'e.severity as storm_severity',
      'e.region_name as storm_region_name',
      'e.status as storm_status'
    )
    .orderBy('a.created_at', req.query.order)
    .limit(limit).offset(offset);

  res.json({ data, meta: meta(Number(count), { page, limit }) });
}));

/**
 * @route GET /api/storms/:id
 * @desc  One storm with the properties it puts at risk.
 */
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const storm = notFoundIf(await db('storm_events').where('id', req.params.id).first(), 'Storm event');

  // Exposure is company data, so only an authenticated caller sees it.
  let exposure = null;
  if (req.user) {
    exposure = await StormService.getPropertyDamageScores(storm.latitude, storm.longitude, storm.radius_miles || 25);
  }

  const alerts = await db('storm_alerts').where('storm_event_id', storm.id).orderBy('created_at', 'desc').limit(50);
  res.json({ data: { ...storm, alerts, exposure } });
}));

/**
 * @route POST /api/storms/track
 * @desc  Register a monitoring region so Atlas begins polling it.
 */
router.post('/track', authMiddleware, authorize('admin', 'manager'), validate(Joi.object({
  name: Joi.string().max(120).required(),
  center: Joi.object({
    lat: coordinateSchema.latitude.required(),
    lng: coordinateSchema.longitude.required()
  }).required(),
  radius: Joi.number().min(1).max(500).default(50),
  notify: Joi.boolean().default(true)
})), asyncHandler(async (req, res) => {
  const { name, center, radius, notify } = req.body;

  const region = await StormService.saveMonitoringRegion({
    id: `region_${Date.now().toString(36)}`,
    name,
    center,
    radius,
    notify,
    company_id: req.user.company_id,
    bounds: radiusBox(center.lat, center.lng, radius)
  });

  logger.info(`Storm tracking region registered: ${name} by user ${req.user.id}`);
  res.status(201).json({ data: region });
}));

/**
 * @route GET /api/storms/report/:id
 * @desc  Impact report for a monitoring region over a time window.
 */
router.get('/report/:id', authMiddleware, validate(Joi.object({
  hours: Joi.number().integer().min(1).max(720).default(24)
}), 'query'), asyncHandler(async (req, res) => {
  const report = await StormService.generateStormReport(req.params.id, req.query.hours);
  if (!report) throw new ErrorResponse('No report available for that region', 404, { code: 'NOT_FOUND' });
  res.json({ data: report });
}));

/**
 * @route GET /api/storms/:id/properties
 * @desc  Properties inside a storm's footprint, scored by damage probability —
 *        the lead-generation surface Atlas exists to produce.
 */
router.get('/:id/properties', authMiddleware, validate(Joi.object({
  min_score: Joi.number().min(0).max(100).default(0),
  limit: Joi.number().integer().min(1).max(500).default(100)
}), 'query'), asyncHandler(async (req, res) => {
  const storm = notFoundIf(await db('storm_events').where('id', req.params.id).first(), 'Storm event');

  const scored = await StormService.getPropertyDamageScores(
    storm.latitude, storm.longitude, storm.radius_miles || 25
  );

  const data = (scored || [])
    .filter((p) => p.damage_score >= req.query.min_score)
    .sort((a, b) => b.damage_score - a.damage_score)
    .slice(0, req.query.limit);

  res.json({ data, meta: { storm_id: storm.id, evaluated: (scored || []).length } });
}));

module.exports = router;
