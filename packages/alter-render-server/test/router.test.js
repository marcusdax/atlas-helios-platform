'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const { AlterRenderEngine, mockProvider, encodePng, AlterRenderError, CODES } = require('@alter/render-core');
const { createAlterRenderRouter } = require('../src/index.js');

const IMAGE = `data:image/png;base64,${encodePng(32, 32, (x, y) => [x * 8, y * 8, 90])}`;

const body = {
  image: IMAGE,
  description: 'Roof shingles are curling and there is moss on the north slope',
  industry: 'roofing'
};

function buildApp({ engine, ...routerOptions } = {}) {
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use('/api/renders', createAlterRenderRouter({
    engine: engine || new AlterRenderEngine({ provider: mockProvider() }),
    ...routerOptions
  }));
  return app;
}

test('POST / renders synchronously and returns the pair', async () => {
  const response = await request(buildApp()).post('/api/renders').send(body).expect(200);

  assert.equal(response.body.before, IMAGE);
  assert.match(response.body.after, /^data:image\/png;base64,/);
  assert.equal(response.body.industry, 'roofing');
  assert.ok(response.body.copy.headline);
  assert.equal(response.body.meta.provider, 'mock');
});

test('GET /industries lists the presets', async () => {
  const response = await request(buildApp()).get('/api/renders/industries').expect(200);

  const ids = response.body.industries.map((i) => i.id);
  assert.ok(ids.includes('roofing'));
  assert.ok(ids.includes('storm-restoration'));
  assert.ok(response.body.industries.every((i) => i.label && i.roiBasis));
});

test('a replayed Idempotency-Key returns the first result without re-rendering', async () => {
  let transforms = 0;
  const provider = mockProvider();
  const engine = new AlterRenderEngine({
    provider: { ...provider, transform: (a) => { transforms += 1; return provider.transform(a); } }
  });
  const app = buildApp({ engine });

  const first = await request(app).post('/api/renders').set('Idempotency-Key', 'abc-123').send(body).expect(200);
  const second = await request(app).post('/api/renders').set('Idempotency-Key', 'abc-123').send(body).expect(200);

  assert.equal(transforms, 1, 'a replayed request must not bill a second render');
  assert.equal(second.body.after, first.body.after);
});

test('invalid input is a 400 with a stable error code', async () => {
  const response = await request(buildApp())
    .post('/api/renders')
    .send({ ...body, industry: 'submarines' })
    .expect(400);

  assert.equal(response.body.error.code, CODES.INVALID_INPUT);
  assert.ok(Array.isArray(response.body.error.details.available));
});

test('oversized payloads are rejected as 413 before any render', async () => {
  let called = false;
  const provider = mockProvider();
  const engine = new AlterRenderEngine({
    provider: { ...provider, transform: (a) => { called = true; return provider.transform(a); } }
  });

  await request(buildApp({ engine, maxImageChars: 100 }))
    .post('/api/renders')
    .send(body)
    .expect(413);

  assert.equal(called, false);
});

test('provider failures map to 502 and never leak upstream detail', async () => {
  const provider = mockProvider();
  const engine = new AlterRenderEngine({
    provider: {
      ...provider,
      transform: async () => {
        throw new AlterRenderError(CODES.PROVIDER_ERROR, 'render provider rejected the request', {
          status: 502,
          details: { upstreamStatus: 400 },
          cause: new Error('API_KEY=sk-secret-value is invalid')
        });
      }
    },
    retry: { attempts: 1 }
  });

  const response = await request(buildApp({ engine })).post('/api/renders').send(body).expect(502);

  assert.equal(response.body.error.code, CODES.PROVIDER_ERROR);
  assert.ok(!JSON.stringify(response.body).includes('sk-secret-value'), 'error responses must not carry credentials');
});

test('authorize runs before any spend and its rejection is honoured', async () => {
  let called = false;
  const provider = mockProvider();
  const engine = new AlterRenderEngine({
    provider: { ...provider, transform: (a) => { called = true; return provider.transform(a); } }
  });

  const app = buildApp({
    engine,
    authorize: async (req) => {
      if (req.get('Authorization') !== 'Bearer good-token') {
        throw new AlterRenderError(CODES.INVALID_INPUT, 'unauthorized', { status: 401 });
      }
      return { userId: 'u1' };
    }
  });

  await request(app).post('/api/renders').send(body).expect(401);
  assert.equal(called, false, 'unauthorized requests must not reach the provider');

  await request(app).post('/api/renders').set('Authorization', 'Bearer good-token').send(body).expect(200);
  assert.equal(called, true);
});

test('async mode returns 202 and the job completes on poll', async () => {
  const app = buildApp({ engine: new AlterRenderEngine({ provider: mockProvider({ latencyMs: 30 }) }) });

  const accepted = await request(app).post('/api/renders?mode=async').send(body).expect(202);
  assert.equal(accepted.body.status, 'rendering');
  assert.match(accepted.headers.location, /\/api\/renders\/rnd_/);

  let final;
  for (let i = 0; i < 40; i++) {
    final = await request(app).get(accepted.headers.location);
    if (final.status === 200 && final.body.after) break;
    await new Promise((r) => setTimeout(r, 25));
  }

  assert.equal(final.status, 200);
  assert.match(final.body.after, /^data:image\/png;base64,/);
});

test('an unknown job id is a 404', async () => {
  const response = await request(buildApp()).get('/api/renders/rnd_nope').expect(404);
  assert.equal(response.body.error.code, CODES.NOT_FOUND);
});
