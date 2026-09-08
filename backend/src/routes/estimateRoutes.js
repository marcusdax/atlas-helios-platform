'use strict';

const express = require('express');
const { authMiddleware, authorize } = require('../middleware/auth');
const { asyncHandler, ErrorResponse } = require('../middleware/errorHandler');
const db = require('../../config/database');
const logger = require('../utils/logger');
const {
  newId, Joi, validate, paginate, meta, scopeToCompany, notFoundIf, paginationSchema } = require('./_helpers');

const router = express.Router();
router.use(authMiddleware);

const STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'];

/**
 * Money is computed here, from the line items, on every read and write.
 *
 * Storing a total that the items no longer add up to is how a contractor sends
 * a homeowner a number they cannot defend. Totals are derived, rounded once at
 * the end, and in cents throughout — floating-point dollars drift by a penny
 * across a twenty-line roof estimate, and that penny is what an adjuster
 * queries.
 */
function priceEstimate(lineItems, { taxRate = 0, overheadRate = 0, profitRate = 0 } = {}) {
  const items = lineItems.map((item) => {
    const cents = Math.round(item.unit_price * 100) * item.quantity;
    return { ...item, line_total: cents / 100 };
  });

  const subtotalCents = items.reduce((sum, i) => sum + Math.round(i.line_total * 100), 0);
  const overheadCents = Math.round(subtotalCents * overheadRate);
  const profitCents = Math.round(subtotalCents * profitRate);
  const taxableCents = subtotalCents + overheadCents + profitCents;
  const taxCents = Math.round(taxableCents * taxRate);

  return {
    line_items: items,
    subtotal: subtotalCents / 100,
    overhead: overheadCents / 100,
    profit: profitCents / 100,
    tax: taxCents / 100,
    total: (taxableCents + taxCents) / 100
  };
}

const lineItemSchema = Joi.object({
  code: Joi.string().max(40),
  description: Joi.string().max(300).required(),
  category: Joi.string().valid('roofing', 'siding', 'gutters', 'windows', 'interior', 'labor', 'materials', 'other').default('other'),
  quantity: Joi.number().min(0).max(100000).required(),
  unit: Joi.string().max(20).default('EA'),
  unit_price: Joi.number().min(0).max(1000000).required()
});

const estimateBody = Joi.object({
  property_id: Joi.string().max(64).required(),
  lead_id: Joi.string().max(64),
  assessment_id: Joi.string().max(64),
  title: Joi.string().max(200).default('Property Restoration Estimate'),
  line_items: Joi.array().items(lineItemSchema).min(1).max(200).required(),
  tax_rate: Joi.number().min(0).max(0.3).default(0),
  overhead_rate: Joi.number().min(0).max(0.5).default(0.1),
  profit_rate: Joi.number().min(0).max(0.5).default(0.1),
  notes: Joi.string().max(4000).allow(''),
  valid_until: Joi.date().iso()
});

/**
 * @route GET /api/estimates
 */
router.get('/', validate(paginationSchema.keys({
  status: Joi.string().valid(...STATUSES),
  property_id: Joi.string().max(64)
}), 'query'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);

  const base = () => {
    let query = scopeToCompany(db('estimates as e'), req.user, 'e.company_id')
      .join('properties as p', 'p.id', 'e.property_id');
    if (req.query.status) query = query.where('e.status', req.query.status);
    if (req.query.property_id) query = query.where('e.property_id', req.query.property_id);
    return query;
  };

  const [{ count }] = await base().count({ count: 'e.id' });
  const data = await base()
    .select('e.*', 'p.address', 'p.city', 'p.state', 'p.zip_code')
    .orderBy('e.created_at', req.query.order)
    .limit(limit).offset(offset);

  res.json({ data, meta: meta(Number(count), { page, limit }) });
}));

/**
 * @route POST /api/estimates
 */
router.post('/', authorize('admin', 'manager', 'agent'), validate(estimateBody), asyncHandler(async (req, res) => {
  const property = notFoundIf(
    await scopeToCompany(db('properties'), req.user).where('id', req.body.property_id).first(),
    'Property'
  );

  const priced = priceEstimate(req.body.line_items, {
    taxRate: req.body.tax_rate,
    overheadRate: req.body.overhead_rate,
    profitRate: req.body.profit_rate
  });

  const [estimate] = await db('estimates').insert({
    id: newId(),
    property_id: property.id,
    lead_id: req.body.lead_id || null,
    assessment_id: req.body.assessment_id || null,
    company_id: req.user.company_id,
    created_by: req.user.id,
    title: req.body.title,
    status: 'draft',
    line_items: JSON.stringify(priced.line_items),
    subtotal: priced.subtotal,
    overhead: priced.overhead,
    profit: priced.profit,
    tax: priced.tax,
    total: priced.total,
    notes: req.body.notes || null,
    valid_until: req.body.valid_until || null
  }).returning('*');

  logger.info(`Estimate ${estimate.id} created for property ${property.id}, total ${priced.total}`);
  res.status(201).json({ data: estimate });
}));

/**
 * @route GET /api/estimates/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const estimate = notFoundIf(
    await scopeToCompany(db('estimates as e'), req.user, 'e.company_id')
      .join('properties as p', 'p.id', 'e.property_id')
      .where('e.id', req.params.id)
      .select('e.*', 'p.address', 'p.city', 'p.state', 'p.zip_code', 'p.owner_name', 'p.owner_email')
      .first(),
    'Estimate'
  );

  res.json({ data: estimate });
}));

/**
 * @route PUT /api/estimates/:id
 * @desc  Edit a draft. A sent estimate is frozen: the homeowner and their
 *        adjuster are holding a copy of those numbers, so changing them under
 *        the same id would make the document unciteable. Revise by creating a
 *        new estimate instead.
 */
router.put('/:id', authorize('admin', 'manager', 'agent'), validate(Joi.object({
  title: Joi.string().max(200),
  line_items: Joi.array().items(lineItemSchema).min(1).max(200),
  tax_rate: Joi.number().min(0).max(0.3),
  overhead_rate: Joi.number().min(0).max(0.5),
  profit_rate: Joi.number().min(0).max(0.5),
  notes: Joi.string().max(4000).allow(''),
  valid_until: Joi.date().iso(),
  status: Joi.string().valid('accepted', 'declined')
}).min(1)), asyncHandler(async (req, res) => {
  const estimate = notFoundIf(
    await scopeToCompany(db('estimates'), req.user).where('id', req.params.id).first(),
    'Estimate'
  );

  const changesFigures = req.body.line_items || req.body.tax_rate !== undefined
    || req.body.overhead_rate !== undefined || req.body.profit_rate !== undefined;

  if (changesFigures && estimate.status !== 'draft') {
    throw new ErrorResponse(
      'A sent estimate cannot be repriced. Create a revision instead.',
      409,
      { code: 'ESTIMATE_LOCKED', status: estimate.status }
    );
  }

  const update = { ...req.body, updated_at: db.fn.now() };
  delete update.line_items;
  delete update.tax_rate;
  delete update.overhead_rate;
  delete update.profit_rate;

  if (changesFigures) {
    const items = req.body.line_items || JSON.parse(estimate.line_items || '[]');
    const priced = priceEstimate(items, {
      taxRate: req.body.tax_rate ?? Number(estimate.tax_rate ?? 0),
      overheadRate: req.body.overhead_rate ?? 0.1,
      profitRate: req.body.profit_rate ?? 0.1
    });
    Object.assign(update, {
      line_items: JSON.stringify(priced.line_items),
      subtotal: priced.subtotal,
      overhead: priced.overhead,
      profit: priced.profit,
      tax: priced.tax,
      total: priced.total
    });
  }

  const [updated] = await db('estimates').where('id', estimate.id).update(update).returning('*');
  res.json({ data: updated });
}));

/**
 * @route POST /api/estimates/:id/send
 * @desc  Mark an estimate sent and freeze its figures.
 */
router.post('/:id/send', authorize('admin', 'manager', 'agent'), validate(Joi.object({
  to: Joi.string().email().max(160),
  message: Joi.string().max(2000).allow('')
})), asyncHandler(async (req, res) => {
  const estimate = notFoundIf(
    await scopeToCompany(db('estimates as e'), req.user, 'e.company_id')
      .join('properties as p', 'p.id', 'e.property_id')
      .where('e.id', req.params.id)
      .select('e.*', 'p.owner_email', 'p.address')
      .first(),
    'Estimate'
  );

  if (estimate.status !== 'draft') {
    throw new ErrorResponse('Estimate has already been sent', 409, {
      code: 'ALREADY_SENT', status: estimate.status
    });
  }

  const recipient = req.body.to || estimate.owner_email;
  if (!recipient) {
    throw new ErrorResponse('No recipient address on file for this property', 400, {
      code: 'NO_RECIPIENT'
    });
  }

  const [updated] = await db('estimates')
    .where('id', estimate.id)
    .update({
      status: 'sent',
      sent_at: db.fn.now(),
      sent_to: recipient,
      sent_by: req.user.id,
      updated_at: db.fn.now()
    })
    .returning('*');

  // Delivery itself is a separate concern (SMTP is configured per deployment);
  // the state transition is what the rest of the product reads, so it commits
  // regardless of whether a mail transport is wired up yet.
  logger.info(`Estimate ${estimate.id} sent to ${recipient} by user ${req.user.id}`);

  res.json({
    data: updated,
    meta: { delivered: false, reason: process.env.SMTP_HOST ? 'queued' : 'no_mail_transport_configured' }
  });
}));

module.exports = router;
module.exports.priceEstimate = priceEstimate;
