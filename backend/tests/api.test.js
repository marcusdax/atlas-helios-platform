'use strict';

/**
 * API tests for the resource routers documented in the README.
 *
 * These run against a real migrated database (SQLite in memory) through the
 * real auth middleware with real JWTs, so they exercise the actual SQL and the
 * actual authorisation path rather than a mock of either. That matters most for
 * the company scoping: a stubbed `db` would happily "prove" a tenancy boundary
 * that does not exist.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

const express = require('express');
const request = require('supertest');

const db = require('../config/database');
const { generateToken } = require('../src/middleware/auth');
const { errorHandler } = require('../src/middleware/errorHandler');
const { scoreLead } = require('../src/routes/leadRoutes');
const { priceEstimate } = require('../src/routes/estimateRoutes');

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/auth', require('../src/routes/authRoutes'));
  app.use('/api/properties', require('../src/routes/propertyRoutes'));
  app.use('/api/storms', require('../src/routes/stormRoutes'));
  app.use('/api/assessments', require('../src/routes/assessmentRoutes'));
  app.use('/api/leads', require('../src/routes/leadRoutes'));
  app.use('/api/estimates', require('../src/routes/estimateRoutes'));
  app.use(errorHandler);
  return app;
}

const app = buildApp();

// Two companies, so every scoping assertion has something to leak *to*.
const fixtures = {};

beforeAll(async () => {
  await db.migrate.latest();

  const insert = async (table, row) => {
    const [inserted] = await db(table).insert(row).returning('*');
    // SQLite's returning() support varies by driver version; read back if needed.
    return inserted && inserted.id ? inserted : db(table).where(row).first();
  };

  const uuid = () => require('crypto').randomUUID();

  fixtures.companyA = await insert('companies', { id: uuid(), name: 'Acme Restoration' });
  fixtures.companyB = await insert('companies', { id: uuid(), name: 'Rival Roofing' });

  fixtures.userA = await insert('users', {
    id: uuid(), name: 'Ada', email: 'ada@acme.test', password: 'x',
    role: 'manager', company_id: fixtures.companyA.id, status: 'active'
  });
  fixtures.userB = await insert('users', {
    id: uuid(), name: 'Bob', email: 'bob@rival.test', password: 'x',
    role: 'manager', company_id: fixtures.companyB.id, status: 'active'
  });
  fixtures.viewerA = await insert('users', {
    id: uuid(), name: 'Vic', email: 'vic@acme.test', password: 'x',
    role: 'user', company_id: fixtures.companyA.id, status: 'active'
  });

  // generateToken takes (userId, role), not a user object.
  const tokenFor = (user) => generateToken(user.id, user.role);
  fixtures.tokenA = tokenFor(fixtures.userA);
  fixtures.tokenB = tokenFor(fixtures.userB);
  fixtures.viewerToken = tokenFor(fixtures.viewerA);

  fixtures.propertyA = await insert('properties', {
    id: uuid(), company_id: fixtures.companyA.id, address: '123 Main St', city: 'Dallas',
    state: 'TX', zip_code: '75201', latitude: 32.7767, longitude: -96.797,
    estimated_value: 450000, damage_probability: 82, year_built: 1998, owner_email: 'owner@example.test'
  });
  fixtures.propertyB = await insert('properties', {
    id: uuid(), company_id: fixtures.companyB.id, address: '999 Rival Rd', city: 'Dallas',
    state: 'TX', zip_code: '75202', latitude: 32.79, longitude: -96.8, damage_probability: 40
  });

  fixtures.storm = await insert('storm_events', {
    id: uuid(), region_name: 'Dallas Metro', storm_type: 'hail', event_type: 'hail',
    severity: 'high', status: 'active', latitude: 32.7767, longitude: -96.797, radius_miles: 25
  });
});

afterAll(async () => { await db.destroy(); });

const auth = (token) => ({ Authorization: `Bearer ${token}` });

/* ------------------------------------------------------------------ auth -- */

describe('authentication and tenancy', () => {
  test('an unauthenticated request is refused', async () => {
    await request(app).get('/api/properties').expect(401);
  });

  test('a company only sees its own properties', async () => {
    const a = await request(app).get('/api/properties').set(auth(fixtures.tokenA)).expect(200);
    const b = await request(app).get('/api/properties').set(auth(fixtures.tokenB)).expect(200);

    expect(a.body.data.map((p) => p.address)).toEqual(['123 Main St']);
    expect(b.body.data.map((p) => p.address)).toEqual(['999 Rival Rd']);
  });

  test('one company cannot read another company property by id', async () => {
    await request(app)
      .get(`/api/properties/${fixtures.propertyB.id}`)
      .set(auth(fixtures.tokenA))
      .expect(404);
  });

  test('a read-only role cannot create a property', async () => {
    await request(app)
      .post('/api/properties')
      .set(auth(fixtures.viewerToken))
      .send({ address: '5 New St', city: 'Dallas', state: 'TX', zip_code: '75201' })
      .expect(403);
  });
});

describe('auth session routes', () => {
  // These read req.user, which only the auth middleware sets. Without it they
  // threw on undefined and returned 500 - so /me, /profile and /logout were all
  // broken for every caller.
  test('GET /me requires a token', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });

  test('GET /me returns the caller and their company', async () => {
    const res = await request(app).get('/api/auth/me').set(auth(fixtures.tokenA)).expect(200);
    const user = res.body.data?.user || res.body.user;

    expect(user.email).toBe('ada@acme.test');
    expect(res.body.data?.company?.name || res.body.company?.name).toBe('Acme Restoration');
  });

  test('logout and profile are behind the same middleware', async () => {
    await request(app).post('/api/auth/logout').expect(401);
    await request(app).put('/api/auth/profile').send({ name: 'X' }).expect(401);
  });
});

/* ------------------------------------------------------------ properties -- */

describe('properties', () => {
  test('validation rejects a property with no address', async () => {
    const res = await request(app)
      .post('/api/properties').set(auth(fixtures.tokenA))
      .send({ city: 'Dallas', state: 'TX', zip_code: '75201' })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.fields.some((f) => f.field === 'address')).toBe(true);
  });

  test('creating the same address twice returns the existing row', async () => {
    const body = { address: '77 Repeat Ave', city: 'Dallas', state: 'TX', zip_code: '75201' };

    const first = await request(app).post('/api/properties').set(auth(fixtures.tokenA)).send(body).expect(201);
    const second = await request(app).post('/api/properties').set(auth(fixtures.tokenA)).send(body).expect(200);

    expect(second.body.meta.created).toBe(false);
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  test('a radius search returns distance and orders by it', async () => {
    const res = await request(app)
      .get('/api/properties')
      .query({ latitude: 32.7767, longitude: -96.797, radius: 50 })
      .set(auth(fixtures.tokenA))
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('distance_miles');
    const distances = res.body.data.map((p) => p.distance_miles);
    expect([...distances].sort((x, y) => x - y)).toEqual(distances);
  });

  test('radius without coordinates is rejected rather than ignored', async () => {
    await request(app).get('/api/properties').query({ radius: 10 })
      .set(auth(fixtures.tokenA)).expect(400);
  });

  test('a risk filter excludes low-scoring properties', async () => {
    const res = await request(app).get('/api/properties').query({ min_risk: 90 })
      .set(auth(fixtures.tokenA)).expect(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('list responses carry pagination metadata', async () => {
    const res = await request(app).get('/api/properties').query({ limit: 1 })
      .set(auth(fixtures.tokenA)).expect(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1 });
    expect(res.body.meta.total).toBeGreaterThan(0);
  });
});

/* ---------------------------------------------------------------- storms -- */

describe('storms', () => {
  test('active storms are readable without authentication', async () => {
    const res = await request(app).get('/api/storms').expect(200);
    expect(res.body.data.map((s) => s.region_name)).toContain('Dallas Metro');
  });

  test('a viewport query filters by bounding box', async () => {
    const far = await request(app).get('/api/storms')
      .query({ latitude: 47.6, longitude: -122.3, radius: 25 }).expect(200);
    expect(far.body.data).toHaveLength(0);

    const near = await request(app).get('/api/storms')
      .query({ latitude: 32.78, longitude: -96.8, radius: 25 }).expect(200);
    expect(near.body.data).toHaveLength(1);
  });

  test('storm detail hides company exposure from anonymous callers', async () => {
    const anon = await request(app).get(`/api/storms/${fixtures.storm.id}`).expect(200);
    expect(anon.body.data.exposure).toBeNull();
  });

  test('registering a tracking region requires a manager', async () => {
    await request(app).post('/api/storms/track').set(auth(fixtures.viewerToken))
      .send({ name: 'Nope', center: { lat: 32.7, lng: -96.8 } })
      .expect(403);
  });

  test('an unknown storm is a 404', async () => {
    await request(app).get('/api/storms/00000000-0000-0000-0000-000000000000').expect(404);
  });
});

/* ----------------------------------------------------------------- leads -- */

describe('leads', () => {
  test('scoring weights fresh storm damage above property value', async () => {
    const now = new Date().toISOString();
    const damaged = scoreLead({ damage_probability: 95, estimated_value: 200000, created_at: now });
    const valuable = scoreLead({ damage_probability: 10, estimated_value: 750000, created_at: now });
    expect(damaged).toBeGreaterThan(valuable);
  });

  test('a stale lead scores below an identical fresh one', async () => {
    const fresh = scoreLead({ damage_probability: 80, estimated_value: 400000, created_at: new Date().toISOString() });
    const stale = scoreLead({
      damage_probability: 80, estimated_value: 400000,
      created_at: new Date(Date.now() - 20 * 86400000).toISOString()
    });
    expect(stale).toBeLessThan(fresh);
  });

  test('scores stay inside 0-100 for extreme inputs', () => {
    expect(scoreLead({ damage_probability: 1e6, estimated_value: 1e12, created_at: new Date().toISOString() })).toBe(100);
    expect(scoreLead({ damage_probability: -50, estimated_value: -5, created_at: '1990-01-01' })).toBe(0);
  });

  test('a second open lead on the same property is refused', async () => {
    const body = { property_id: fixtures.propertyA.id, contact_name: 'Homeowner' };

    const first = await request(app).post('/api/leads').set(auth(fixtures.tokenA)).send(body).expect(201);
    const second = await request(app).post('/api/leads').set(auth(fixtures.tokenA)).send(body).expect(200);

    expect(second.body.meta).toMatchObject({ created: false, reason: 'open_lead_exists' });
    expect(second.body.data.id).toBe(first.body.data.id);
    fixtures.lead = first.body.data;
  });

  test('a lead cannot be created against another company property', async () => {
    await request(app).post('/api/leads').set(auth(fixtures.tokenA))
      .send({ property_id: fixtures.propertyB.id }).expect(404);
  });

  test('leads list carries a computed score', async () => {
    const res = await request(app).get('/api/leads').set(auth(fixtures.tokenA)).expect(200);
    expect(res.body.data[0]).toHaveProperty('score');
    expect(res.body.data[0].score).toBeGreaterThan(0);
  });

  test('CSV export quotes fields so an address with a comma survives', async () => {
    const res = await request(app).post('/api/leads/export').set(auth(fixtures.tokenA))
      .send({ status: 'new', format: 'csv' }).expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text.split('\n')[0]).toContain('address');
    expect(res.text.split('\n')[1].startsWith('"')).toBe(true);
  });

  test('an export matching nothing is a 404 rather than an empty file', async () => {
    await request(app).post('/api/leads/export').set(auth(fixtures.tokenA))
      .send({ status: 'won', format: 'csv' }).expect(404);
  });
});

/* ------------------------------------------------------------- estimates -- */

describe('estimates', () => {
  test('totals are derived from line items in whole cents', () => {
    const priced = priceEstimate(
      [
        { description: 'Shingles', quantity: 30, unit_price: 3.33 },
        { description: 'Labor', quantity: 1, unit_price: 1200 }
      ],
      { taxRate: 0.0825, overheadRate: 0.1, profitRate: 0.1 }
    );

    expect(priced.subtotal).toBe(1299.9);
    expect(priced.overhead).toBe(129.99);
    expect(priced.profit).toBe(129.99);
    // Rounded once at the end, so the figures reconcile exactly.
    expect(priced.total).toBe(
      Number((priced.subtotal + priced.overhead + priced.profit + priced.tax).toFixed(2))
    );
  });

  test('creating an estimate persists the derived total', async () => {
    const res = await request(app).post('/api/estimates').set(auth(fixtures.tokenA)).send({
      property_id: fixtures.propertyA.id,
      line_items: [{ description: 'Roof replacement', quantity: 1, unit_price: 18500 }],
      tax_rate: 0.0825
    }).expect(201);

    expect(Number(res.body.data.subtotal)).toBe(18500);
    expect(Number(res.body.data.total)).toBeGreaterThan(18500);
  });

  test('a draft can be sent once, and then is frozen', async () => {
    // Self-contained: a test that depends on another test's leftovers fails
    // for the wrong reason the moment the suite is filtered or reordered.
    const created = await request(app).post('/api/estimates').set(auth(fixtures.tokenA)).send({
      property_id: fixtures.propertyA.id,
      line_items: [{ description: 'Gutters', quantity: 1, unit_price: 900 }]
    }).expect(201);

    const sent = await request(app)
      .post(`/api/estimates/${created.body.data.id}/send`)
      .set(auth(fixtures.tokenA)).send({}).expect(200);

    expect(sent.body.data.status).toBe('sent');
    expect(sent.body.data.sent_to).toBe('owner@example.test');

    // Sending twice would put a second set of numbers in front of the homeowner.
    await request(app).post(`/api/estimates/${created.body.data.id}/send`)
      .set(auth(fixtures.tokenA)).send({}).expect(409);

    // And a sent estimate cannot be silently repriced.
    const repriced = await request(app).put(`/api/estimates/${created.body.data.id}`)
      .set(auth(fixtures.tokenA))
      .send({ line_items: [{ description: 'Cheaper', quantity: 1, unit_price: 1 }] })
      .expect(409);

    expect(repriced.body.code).toBe('ESTIMATE_LOCKED');
  });

  test('an estimate for another company property is refused', async () => {
    await request(app).post('/api/estimates').set(auth(fixtures.tokenA)).send({
      property_id: fixtures.propertyB.id,
      line_items: [{ description: 'x', quantity: 1, unit_price: 1 }]
    }).expect(404);
  });

  test('an estimate with no line items is rejected', async () => {
    await request(app).post('/api/estimates').set(auth(fixtures.tokenA))
      .send({ property_id: fixtures.propertyA.id, line_items: [] }).expect(400);
  });
});

/* ----------------------------------------------------------- assessments -- */

describe('assessments', () => {
  test('an assessment against another company property is refused', async () => {
    await request(app).post('/api/assessments').set(auth(fixtures.tokenA))
      .field('property_id', fixtures.propertyB.id)
      .expect(404);
  });

  test('history is scoped through the property join', async () => {
    const a = await request(app).get('/api/assessments/history').set(auth(fixtures.tokenA)).expect(200);
    const b = await request(app).get('/api/assessments/history').set(auth(fixtures.tokenB)).expect(200);

    expect(Array.isArray(a.body.data)).toBe(true);
    expect(Array.isArray(b.body.data)).toBe(true);
    // Neither company's history may contain the other's property ids.
    const idsB = new Set(b.body.data.map((r) => r.property_id));
    expect(a.body.data.every((r) => !idsB.has(r.property_id))).toBe(true);
  });
});
