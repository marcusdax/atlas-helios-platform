'use strict';

const express = require('express');
const { authMiddleware, authorize } = require('../middleware/auth');
const { asyncHandler, ErrorResponse } = require('../middleware/errorHandler');
const db = require('../../config/database');
const logger = require('../utils/logger');
const PropertyService = require('../services/PropertyService');
const {
  newId, Joi, validate, paginate, meta, scopeToCompany, notFoundIf,
  paginationSchema, coordinateSchema, radiusBox, distanceMiles
} = require('./_helpers');

const router = express.Router();

// Everything about a property is company data. There is no anonymous read.
router.use(authMiddleware);

const propertyBody = Joi.object({
  address: Joi.string().max(255).required(),
  city: Joi.string().max(100).required(),
  state: Joi.string().max(50).required(),
  zip_code: Joi.string().max(20).required(),
  ...coordinateSchema,
  property_type: Joi.string().valid('residential', 'commercial', 'industrial', 'multi_family').default('residential'),
  year_built: Joi.number().integer().min(1600).max(new Date().getFullYear() + 1),
  square_footage: Joi.number().integer().min(0),
  roof_type: Joi.string().max(80),
  roof_age: Joi.number().integer().min(0).max(200),
  stories: Joi.number().integer().min(0).max(200),
  estimated_value: Joi.number().min(0),
  owner_name: Joi.string().max(160),
  owner_phone: Joi.string().max(40),
  owner_email: Joi.string().email().max(160),
  metadata: Joi.object().unknown(true)
});

const listQuery = paginationSchema.keys({
  q: Joi.string().max(160),
  state: Joi.string().max(50),
  city: Joi.string().max(100),
  zip_code: Joi.string().max(20),
  property_type: Joi.string().valid('residential', 'commercial', 'industrial', 'multi_family'),
  min_risk: Joi.number().min(0).max(100),
  // A radius search needs all three or none of them.
  latitude: coordinateSchema.latitude,
  longitude: coordinateSchema.longitude,
  radius: Joi.number().min(0.1).max(200)
}).with('radius', ['latitude', 'longitude']);

const SORTABLE = new Set(['created_at', 'updated_at', 'estimated_value', 'year_built', 'damage_probability']);

/**
 * @route GET /api/properties
 * @desc  List properties for the caller's company, filtered and paged.
 */
router.get('/', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  const { q, state, city, zip_code: zip, property_type: type, min_risk: minRisk } = req.query;
  const { latitude, longitude, radius } = req.query;

  const base = () => {
    let query = scopeToCompany(db('properties'), req.user);
    if (state) query = query.where('state', state);
    if (city) query = query.whereRaw('LOWER(city) = ?', [city.toLowerCase()]);
    if (zip) query = query.where('zip_code', zip);
    if (type) query = query.where('property_type', type);
    if (minRisk !== undefined) query = query.where('damage_probability', '>=', minRisk);
    if (q) {
      query = query.where((b) => b
        .whereILike('address', `%${q}%`)
        .orWhereILike('owner_name', `%${q}%`)
        .orWhereILike('city', `%${q}%`));
    }
    // Narrow by bounding box first: it uses the lat/lng index, where an exact
    // haversine in SQL would force a full scan.
    if (radius) {
      const box = radiusBox(latitude, longitude, radius);
      query = query
        .whereBetween('latitude', [box.south, box.north])
        .whereBetween('longitude', [box.west, box.east]);
    }
    return query;
  };

  const sort = SORTABLE.has(req.query.sort) ? req.query.sort : 'created_at';
  const [{ count }] = await base().count({ count: '*' });
  const rows = await base().orderBy(sort, req.query.order).limit(limit).offset(offset);

  // Exact distance is applied after the index has done its work.
  const data = radius
    ? rows
        .map((r) => ({ ...r, distance_miles: Number(distanceMiles(latitude, longitude, r.latitude, r.longitude).toFixed(2)) }))
        .filter((r) => r.distance_miles <= radius)
        .sort((a, b) => a.distance_miles - b.distance_miles)
    : rows;

  res.json({ data, meta: meta(Number(count), { page, limit }) });
}));

/**
 * @route GET /api/properties/search
 * @desc  Resolve a property by address, enriching from external providers when
 *        it is not already on file. Declared before /:id so "search" is not
 *        read as an id.
 */
router.get('/search', validate(Joi.object({
  address: Joi.string().max(255).required(),
  city: Joi.string().max(100).required(),
  state: Joi.string().max(50).required(),
  zip_code: Joi.string().max(20).required()
}), 'query'), asyncHandler(async (req, res) => {
  const { address, city, state, zip_code: zip } = req.query;
  const property = await PropertyService.getPropertyByAddress(address, city, state, zip);
  notFoundIf(property, 'Property');
  res.json({ data: property });
}));

/**
 * @route POST /api/properties
 * @desc  Create a property under the caller's company.
 */
router.post('/', authorize('admin', 'manager', 'agent'), validate(propertyBody), asyncHandler(async (req, res) => {
  const payload = { id: newId(), ...req.body, company_id: req.user.company_id, created_by: req.user.id };

  // Address is the natural key. Returning the existing row rather than a
  // duplicate keeps a double-submit from splitting one property's history.
  const existing = await scopeToCompany(db('properties'), req.user)
    .where({ address: payload.address, zip_code: payload.zip_code })
    .first();

  if (existing) return res.status(200).json({ data: existing, meta: { created: false } });

  const [property] = await db('properties').insert(payload).returning('*');
  logger.info(`Property created: ${property.id} by user ${req.user.id}`);
  return res.status(201).json({ data: property, meta: { created: true } });
}));

/**
 * @route GET /api/properties/:id
 * @desc  One property with its latest assessment and open leads.
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const property = notFoundIf(
    await scopeToCompany(db('properties'), req.user).where('id', req.params.id).first(),
    'Property'
  );

  const [assessments, leads] = await Promise.all([
    db('property_assessments').where('property_id', property.id).orderBy('created_at', 'desc').limit(5),
    db('leads').where('property_id', property.id).whereNot('status', 'closed').orderBy('created_at', 'desc')
  ]);

  res.json({ data: { ...property, assessments, leads } });
}));

/**
 * @route PUT /api/properties/:id
 */
router.put('/:id', authorize('admin', 'manager', 'agent'),
  validate(propertyBody.fork(Object.keys(propertyBody.describe().keys), (s) => s.optional())),
  asyncHandler(async (req, res) => {
    const property = notFoundIf(
      await scopeToCompany(db('properties'), req.user).where('id', req.params.id).first(),
      'Property'
    );

    if (Object.keys(req.body).length === 0) {
      throw new ErrorResponse('No updatable fields supplied', 400, { code: 'VALIDATION_ERROR' });
    }

    const [updated] = await db('properties')
      .where('id', property.id)
      .update({ ...req.body, updated_at: db.fn.now() })
      .returning('*');

    res.json({ data: updated });
  }));

/**
 * @route GET /api/properties/:id/assessments
 */
router.get('/:id/assessments', asyncHandler(async (req, res) => {
  notFoundIf(await scopeToCompany(db('properties'), req.user).where('id', req.params.id).first(), 'Property');
  res.json({ data: await PropertyService.getPropertyAssessmentHistory(req.params.id, 25) });
}));

module.exports = router;
