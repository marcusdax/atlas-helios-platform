import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createRequire } from 'node:module';

import { createApp } from './app.js';

const require = createRequire(import.meta.url);
const { encodePng } = require('@alter/render-core');

const IMAGE = `data:image/png;base64,${encodePng(32, 32, (x, y) => [x * 8, y * 8, 90])}`;

// Offline by default: no key, so the mock render provider and the stub text
// provider are used. That is the point - the whole suite runs with no network.
const silent = { log() {}, warn() {}, error() {}, debug() {}, info() {} };
const app = (env = {}) => createApp({ ...env }, { logger: silent });

test('health reports the active providers', async () => {
  const response = await request(app()).get('/api/health').expect(200);

  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.provider, 'mock');
  assert.equal(response.body.offline, true);
});

test('a render returns a before/after pair with copy', async () => {
  const response = await request(app())
    .post('/api/renders')
    .send({ image: IMAGE, description: 'Curling shingles and moss on the north slope', industry: 'roofing' })
    .expect(200);

  assert.equal(response.body.before, IMAGE);
  assert.match(response.body.after, /^data:image\/png;base64,/);
  assert.notEqual(response.body.after, response.body.before);
  assert.ok(response.body.copy.headline);
  // The guardrails must survive the trip through this app's router.
  assert.match(response.body.prompt, /camera position, focal length, perspective, and framing identical/);
});

test('an unknown trade is a 400 with a stable code', async () => {
  const response = await request(app())
    .post('/api/renders')
    .send({ image: IMAGE, description: 'anything', industry: 'submarines' })
    .expect(400);

  assert.equal(response.body.error.code, 'INVALID_INPUT');
});

test('assist status lists the trades and the offline flag', async () => {
  const response = await request(app()).get('/api/assist/status').expect(200);

  assert.equal(response.body.offline, true);
  assert.ok(response.body.industries.some((i) => i.id === 'roofing'));
});

test('suggestions returns a bounded list', async () => {
  const response = await request(app())
    .post('/api/assist/suggestions')
    .send({ industry: 'landscaping', observation: 'A neglected backyard with patchy turf' })
    .expect(200);

  assert.ok(Array.isArray(response.body.suggestions));
  assert.ok(response.body.suggestions.length > 0);
  assert.ok(response.body.suggestions.length <= 8);
});

test('campaign links are server-derived, deterministic, and cover every address', async () => {
  const body = {
    industry: 'roofing',
    neighborhood: 'Lakewood Heights',
    bounds: 'Bounded by Abrams Rd',
    addresses: ['123 Main St', '456 Oak Ave']
  };

  const first = await request(app()).post('/api/assist/campaign').send(body).expect(200);
  const second = await request(app()).post('/api/assist/campaign').send(body).expect(200);

  assert.equal(first.body.onePagers.length, 2);
  assert.deepEqual(
    first.body.onePagers.map((p) => p.address),
    ['123 Main St', '456 Oak Ave']
  );
  // Deterministic slugs: collateral already printed stays valid on a re-run.
  assert.deepEqual(
    first.body.onePagers.map((p) => p.slug),
    second.body.onePagers.map((p) => p.slug)
  );
  // Distinct addresses must not collide onto one link.
  assert.notEqual(first.body.onePagers[0].slug, first.body.onePagers[1].slug);
  assert.ok(first.body.onePagers.every((p) => p.summary));
});

test('campaign accepts a newline-delimited string and rejects an empty list', async () => {
  const response = await request(app())
    .post('/api/assist/campaign')
    .send({ industry: 'roofing', neighborhood: 'X', addresses: '1 A St\n\n  \n2 B St' })
    .expect(200);
  assert.equal(response.body.onePagers.length, 2);

  const empty = await request(app())
    .post('/api/assist/campaign')
    .send({ industry: 'roofing', neighborhood: 'X', addresses: '   \n  ' })
    .expect(400);
  assert.equal(empty.body.error.code, 'INVALID_INPUT');
});

test('market analysis works with or without a prior ROI', async () => {
  const withRoi = await request(app())
    .post('/api/assist/market')
    .send({ industry: 'windows', location: 'Dallas, TX', roi: 'Recovers 60-70% at resale' })
    .expect(200);
  assert.ok(withRoi.body.analysis.length > 0);

  const withoutRoi = await request(app())
    .post('/api/assist/market')
    .send({ industry: 'windows', location: 'Dallas, TX' })
    .expect(200);
  assert.ok(withoutRoi.body.analysis.length > 0);
});

test('assist endpoints reject missing and oversized fields', async () => {
  const missing = await request(app())
    .post('/api/assist/suggestions')
    .send({ industry: 'roofing' })
    .expect(400);
  assert.equal(missing.body.error.code, 'INVALID_INPUT');

  const oversized = await request(app())
    .post('/api/assist/vision-params')
    .send({ industry: 'roofing', parameters: 'x'.repeat(601) })
    .expect(400);
  assert.equal(oversized.body.error.code, 'INVALID_INPUT');
  assert.equal(oversized.body.error.details.max, 600);
});

test('unknown API routes are a JSON 404, not the SPA shell', async () => {
  const response = await request(app()).get('/api/nope').expect(404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('the render quota is enforced and reported in headers', async () => {
  const server = app({ RENDER_RATE_LIMIT: '2' });
  const send = (description) =>
    request(server).post('/api/renders').send({ image: IMAGE, description, industry: 'roofing' });

  const first = await send('first distinct description');
  assert.equal(first.status, 200);
  assert.equal(first.headers['ratelimit-limit'], '2');

  await send('second distinct description');
  const third = await send('third distinct description');

  assert.equal(third.status, 429);
  assert.equal(third.body.error.code, 'RATE_LIMITED');
});

test('quotas are independent, so assist traffic cannot exhaust the render budget', async () => {
  const server = app({ ASSIST_RATE_LIMIT: '1' });

  await request(server).post('/api/assist/suggestions')
    .send({ industry: 'roofing', observation: 'tired roof' }).expect(200);
  await request(server).post('/api/assist/suggestions')
    .send({ industry: 'roofing', observation: 'tired roof' }).expect(429);

  // Assist is exhausted; rendering must still work.
  await request(server).post('/api/renders')
    .send({ image: IMAGE, description: 'Curling shingles', industry: 'roofing' })
    .expect(200);
});

test('an identical render is served from cache without a second provider call', async () => {
  const server = app();
  const body = { image: IMAGE, description: 'Curling shingles on the rear slope', industry: 'roofing' };

  const first = await request(server).post('/api/renders').send(body).expect(200);
  const second = await request(server).post('/api/renders').send(body).expect(200);

  assert.equal(first.body.meta.cached, false);
  assert.equal(second.body.meta.cached, true);
  assert.equal(second.body.after, first.body.after);
});
