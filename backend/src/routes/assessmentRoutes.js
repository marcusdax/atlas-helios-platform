'use strict';

const express = require('express');
const multer = require('multer');
const { authMiddleware, authorize } = require('../middleware/auth');
const { asyncHandler, ErrorResponse } = require('../middleware/errorHandler');
const db = require('../../config/database');
const logger = require('../utils/logger');
const PropertyService = require('../services/PropertyService');
const ComputerVisionService = require('../services/ComputerVisionService');
const { Joi, validate, paginate, meta, scopeToCompany, notFoundIf, paginationSchema } = require('./_helpers');

const router = express.Router();
router.use(authMiddleware);

/**
 * Inspection photos arrive from a phone in the field, so they are held in
 * memory and handed straight to the vision pipeline rather than written to
 * disk: there is nothing to clean up if the request dies, and nothing on the
 * filesystem to leak between tenants.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number.parseInt(process.env.MAX_UPLOAD_BYTES, 10) || 15 * 1024 * 1024,
    files: 12
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    cb(allowed.includes(file.mimetype) ? null : new ErrorResponse(
      `Unsupported image type ${file.mimetype}`, 400, { code: 'VALIDATION_ERROR' }
    ), allowed.includes(file.mimetype));
  }
});

/**
 * @route GET /api/assessments/history
 * @desc  Assessment history for the company. Declared before /:id.
 */
router.get('/history', validate(paginationSchema.keys({
  property_id: Joi.string().max(64),
  status: Joi.string().valid('pending', 'processing', 'completed', 'failed'),
  since: Joi.date().iso()
}), 'query'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);

  const base = () => {
    // Assessments carry no company column; they inherit scope from the
    // property, so the join is the tenancy boundary rather than a convenience.
    let query = db('property_assessments as a')
      .join('properties as p', 'p.id', 'a.property_id')
      .modify((qb) => scopeToCompany(qb, req.user, 'p.company_id'));

    if (req.query.property_id) query = query.where('a.property_id', req.query.property_id);
    if (req.query.status) query = query.where('a.status', req.query.status);
    if (req.query.since) query = query.where('a.created_at', '>=', req.query.since);
    return query;
  };

  const [{ count }] = await base().count({ count: 'a.id' });
  const data = await base()
    .select('a.*', 'p.address', 'p.city', 'p.state', 'p.zip_code')
    .orderBy('a.created_at', req.query.order)
    .limit(limit).offset(offset);

  res.json({ data, meta: meta(Number(count), { page, limit }) });
}));

/**
 * @route POST /api/assessments
 * @desc  Start an AI assessment for a property, with optional inspection photos.
 *
 * Returns 202: a vision pass takes tens of seconds, which is longer than a
 * field tablet on LTE will hold a socket. The client polls GET /:id, and the
 * WebSocket `property_assessment_complete` event pushes the result when done.
 */
router.post('/', authorize('admin', 'manager', 'agent', 'inspector'),
  upload.array('images', 12),
  asyncHandler(async (req, res) => {
    const { error, value } = Joi.object({
      property_id: Joi.string().max(64).required(),
      inspection_type: Joi.string().valid('exterior', 'roof', 'full', 'storm_damage').default('exterior'),
      notes: Joi.string().max(2000).allow(''),
      storm_event_id: Joi.string().max(64)
    }).validate(req.body, { stripUnknown: true, convert: true });

    if (error) {
      throw new ErrorResponse('Validation failed', 400, {
        code: 'VALIDATION_ERROR',
        fields: error.details.map((d) => ({ field: d.path.join('.'), message: d.message }))
      });
    }

    const property = notFoundIf(
      await scopeToCompany(db('properties'), req.user).where('id', value.property_id).first(),
      'Property'
    );

    const assessment = await PropertyService.performPropertyAssessment(property.id, {
      ...value,
      requested_by: req.user.id,
      image_count: req.files?.length || 0
    });

    // Photos are analysed out of band so the request returns immediately.
    if (req.files?.length) {
      Promise.all(req.files.map((file) =>
        ComputerVisionService.analyzePropertyDamage(file.buffer, property)
      ))
        .then((analyses) => PropertyService.completeAssessment(assessment.id, { analyses }))
        .catch((err) => {
          logger.error(`Assessment ${assessment.id} vision pass failed:`, err);
          return PropertyService.updateAssessmentStatus(assessment.id, 'failed', err.message);
        });
    }

    logger.info(`Assessment ${assessment.id} started for property ${property.id}`);
    res.status(202)
      .location(`${req.baseUrl}/${assessment.id}`)
      .json({ data: assessment, meta: { images_queued: req.files?.length || 0 } });
  }));

/**
 * @route GET /api/assessments/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const assessment = notFoundIf(
    await db('property_assessments as a')
      .join('properties as p', 'p.id', 'a.property_id')
      .modify((qb) => scopeToCompany(qb, req.user, 'p.company_id'))
      .where('a.id', req.params.id)
      .select('a.*', 'p.address', 'p.city', 'p.state', 'p.zip_code', 'p.latitude', 'p.longitude')
      .first(),
    'Assessment'
  );

  res.json({ data: assessment });
}));

/**
 * @route PUT /api/assessments/:id
 * @desc  Human review of an AI result. An inspector overriding the model is a
 *        first-class outcome, not an error path — it is also the label the
 *        model is retrained on, so the original scores are preserved alongside.
 */
router.put('/:id', authorize('admin', 'manager', 'inspector'), validate(Joi.object({
  status: Joi.string().valid('completed', 'failed', 'needs_review'),
  reviewed_severity: Joi.string().valid('none', 'minor', 'moderate', 'severe', 'total_loss'),
  reviewer_notes: Joi.string().max(4000).allow(''),
  confirmed: Joi.boolean()
}).min(1)), asyncHandler(async (req, res) => {
  const assessment = notFoundIf(
    await db('property_assessments as a')
      .join('properties as p', 'p.id', 'a.property_id')
      .modify((qb) => scopeToCompany(qb, req.user, 'p.company_id'))
      .where('a.id', req.params.id)
      .select('a.*')
      .first(),
    'Assessment'
  );

  const [updated] = await db('property_assessments')
    .where('id', assessment.id)
    .update({
      ...req.body,
      reviewed_by: req.user.id,
      reviewed_at: db.fn.now(),
      updated_at: db.fn.now()
    })
    .returning('*');

  logger.info(`Assessment ${assessment.id} reviewed by user ${req.user.id}`);
  res.json({ data: updated });
}));

module.exports = router;
