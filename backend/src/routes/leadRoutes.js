'use strict';

const express = require('express');
const axios = require('axios');
const { authMiddleware, authorize } = require('../middleware/auth');
const { asyncHandler, ErrorResponse } = require('../middleware/errorHandler');
const db = require('../../config/database');
const logger = require('../utils/logger');
const {
  newId, Joi, validate, paginate, meta, scopeToCompany, notFoundIf, paginationSchema } = require('./_helpers');

const router = express.Router();
router.use(authMiddleware);

const STATUSES = ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost', 'closed'];

/**
 * Lead score, computed here rather than stored, so a change to the weighting
 * re-scores the whole pipeline instead of only leads created after the change.
 *
 * The weights encode what actually predicts a signed job in restoration: fresh
 * storm damage first, because that is when the homeowner is motivated and the
 * insurer is paying; property value second; and recency third, because a lead
 * worked on day one converts several times better than the same lead worked on
 * day ten.
 */
function scoreLead(lead) {
  const damage = Math.min(100, lead.damage_probability || 0);
  const value = Math.min(100, ((lead.estimated_value || 0) / 750000) * 100);
  const ageDays = lead.created_at
    ? (Date.now() - new Date(lead.created_at).getTime()) / 86400000
    : 0;
  const freshness = Math.max(0, 100 - ageDays * 8);

  const score = damage * 0.5 + value * 0.2 + freshness * 0.3;
  return Math.round(Math.max(0, Math.min(100, score)));
}

const leadBody = Joi.object({
  property_id: Joi.string().max(64).required(),
  storm_event_id: Joi.string().max(64),
  contact_name: Joi.string().max(160),
  contact_phone: Joi.string().max(40),
  contact_email: Joi.string().email().max(160),
  source: Joi.string().valid('storm_alert', 'canvass', 'referral', 'inbound', 'campaign').default('storm_alert'),
  status: Joi.string().valid(...STATUSES).default('new'),
  assigned_to: Joi.string().max(64),
  notes: Joi.string().max(4000).allow('')
});

/**
 * @route GET /api/leads
 */
router.get('/', validate(paginationSchema.keys({
  status: Joi.string().valid(...STATUSES),
  assigned_to: Joi.string().max(64),
  source: Joi.string().max(40),
  min_score: Joi.number().min(0).max(100)
}), 'query'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);

  const base = () => {
    let query = scopeToCompany(db('leads as l'), req.user, 'l.company_id')
      .join('properties as p', 'p.id', 'l.property_id');
    if (req.query.status) query = query.where('l.status', req.query.status);
    if (req.query.assigned_to) query = query.where('l.assigned_to', req.query.assigned_to);
    if (req.query.source) query = query.where('l.source', req.query.source);
    return query;
  };

  const [{ count }] = await base().count({ count: 'l.id' });
  const rows = await base()
    .select('l.*', 'p.address', 'p.city', 'p.state', 'p.zip_code',
      'p.estimated_value', 'p.damage_probability', 'p.latitude', 'p.longitude')
    .orderBy('l.created_at', req.query.order)
    .limit(limit).offset(offset);

  const data = rows
    .map((lead) => ({ ...lead, score: scoreLead(lead) }))
    .filter((lead) => req.query.min_score === undefined || lead.score >= req.query.min_score)
    .sort((a, b) => b.score - a.score);

  res.json({ data, meta: meta(Number(count), { page, limit }) });
}));

/**
 * @route POST /api/leads
 */
router.post('/', authorize('admin', 'manager', 'agent'), validate(leadBody), asyncHandler(async (req, res) => {
  const property = notFoundIf(
    await scopeToCompany(db('properties'), req.user).where('id', req.body.property_id).first(),
    'Property'
  );

  // One open lead per property: a second one splits the call history and two
  // reps end up knocking on the same door.
  const open = await scopeToCompany(db('leads'), req.user)
    .where('property_id', property.id)
    .whereNotIn('status', ['won', 'lost', 'closed'])
    .first();

  if (open) return res.status(200).json({ data: open, meta: { created: false, reason: 'open_lead_exists' } });

  const [lead] = await db('leads').insert({
    id: newId(),
    ...req.body,
    company_id: req.user.company_id,
    created_by: req.user.id
  }).returning('*');

  logger.info(`Lead ${lead.id} created for property ${property.id}`);
  return res.status(201).json({ data: { ...lead, score: scoreLead({ ...lead, ...property }) }, meta: { created: true } });
}));

/**
 * @route PUT /api/leads/:id
 */
router.put('/:id', authorize('admin', 'manager', 'agent'), validate(Joi.object({
  status: Joi.string().valid(...STATUSES),
  assigned_to: Joi.string().max(64).allow(null),
  contact_name: Joi.string().max(160),
  contact_phone: Joi.string().max(40),
  contact_email: Joi.string().email().max(160),
  notes: Joi.string().max(4000).allow('')
}).min(1)), asyncHandler(async (req, res) => {
  const lead = notFoundIf(
    await scopeToCompany(db('leads'), req.user).where('id', req.params.id).first(),
    'Lead'
  );

  const [updated] = await db('leads')
    .where('id', lead.id)
    .update({ ...req.body, updated_at: db.fn.now() })
    .returning('*');

  // Status transitions are the audit trail a commission dispute is settled
  // from, so they are recorded rather than only overwritten.
  if (req.body.status && req.body.status !== lead.status) {
    await db('system_logs').insert({
      level: 'info',
      message: `Lead ${lead.id} ${lead.status} -> ${req.body.status}`,
      context: JSON.stringify({ lead_id: lead.id, user_id: req.user.id, from: lead.status, to: req.body.status })
    }).catch(() => {});
  }

  res.json({ data: updated });
}));

/**
 * @route POST /api/leads/export
 * @desc  Push selected leads to the configured CRM, or return CSV.
 */
router.post('/export', authorize('admin', 'manager'), validate(Joi.object({
  lead_ids: Joi.array().items(Joi.string().max(64)).min(1).max(500),
  status: Joi.string().valid(...STATUSES),
  format: Joi.string().valid('crm', 'csv').default('csv')
}).or('lead_ids', 'status')), asyncHandler(async (req, res) => {
  let query = scopeToCompany(db('leads as l'), req.user, 'l.company_id')
    .join('properties as p', 'p.id', 'l.property_id');

  if (req.body.lead_ids) query = query.whereIn('l.id', req.body.lead_ids);
  if (req.body.status) query = query.where('l.status', req.body.status);

  const leads = await query.select(
    'l.id', 'l.status', 'l.source', 'l.contact_name', 'l.contact_phone', 'l.contact_email',
    'l.created_at', 'p.address', 'p.city', 'p.state', 'p.zip_code', 'p.estimated_value', 'p.damage_probability'
  );

  if (leads.length === 0) throw new ErrorResponse('No leads matched the export criteria', 404, { code: 'NOT_FOUND' });

  if (req.body.format === 'csv') {
    const columns = Object.keys(leads[0]);
    // Quote every field and double embedded quotes: an address with a comma is
    // the normal case here, not an edge case.
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [columns.join(','), ...leads.map((r) => columns.map((c) => escape(r[c])).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`);
    return res.send(csv);
  }

  if (process.env.CRM_INTEGRATION_ENABLED !== 'true' || !process.env.CRM_API_KEY) {
    throw new ErrorResponse('CRM integration is not configured', 503, { code: 'CRM_NOT_CONFIGURED' });
  }

  try {
    const response = await axios.post(
      `${process.env.CRM_API_BASE_URL}/leads/bulk`,
      { leads },
      { headers: { Authorization: `Bearer ${process.env.CRM_API_KEY}` }, timeout: 20000 }
    );
    logger.info(`Exported ${leads.length} leads to CRM for company ${req.user.company_id}`);
    return res.json({ data: { exported: leads.length, crm_reference: response.data?.batch_id || null } });
  } catch (err) {
    // Never surface the upstream body: it echoes the payload and can carry the
    // bearer token back in an error envelope.
    logger.error('CRM export failed:', err.message);
    throw new ErrorResponse('CRM export failed', 502, { code: 'CRM_EXPORT_FAILED' });
  }
}));

/**
 * @route GET /api/leads/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const lead = notFoundIf(
    await scopeToCompany(db('leads as l'), req.user, 'l.company_id')
      .join('properties as p', 'p.id', 'l.property_id')
      .where('l.id', req.params.id)
      .select('l.*', 'p.address', 'p.city', 'p.state', 'p.zip_code', 'p.estimated_value', 'p.damage_probability')
      .first(),
    'Lead'
  );

  const estimates = await db('estimates').where('lead_id', lead.id).orderBy('created_at', 'desc');
  res.json({ data: { ...lead, score: scoreLead(lead), estimates } });
}));

module.exports = router;
module.exports.scoreLead = scoreLead;
