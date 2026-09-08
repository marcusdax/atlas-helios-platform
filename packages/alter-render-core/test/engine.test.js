'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AlterRenderEngine,
  mockProvider,
  MemoryCache,
  CircuitBreaker,
  AlterRenderError,
  CODES,
  EVENTS,
  defineIndustry,
  buildTransformPrompt,
  encodePng
} = require('../src/index.js');

/** A small but structurally valid PNG, used as the "before" photo. */
const BEFORE = `data:image/png;base64,${encodePng(32, 32, (x, y) => [x * 8, y * 8, 60])}`;

const baseInput = {
  image: BEFORE,
  description: 'The garage door is dented and the paint is peeling',
  industry: 'garage-doors'
};

const newEngine = (options = {}) =>
  new AlterRenderEngine({ provider: mockProvider(), ...options });

test('renders a before/after pair with copy and metadata', async () => {
  const result = await newEngine().render(baseInput);

  assert.equal(result.before, BEFORE);
  assert.match(result.after, /^data:image\/png;base64,/);
  assert.notEqual(result.after, result.before, 'after image must differ from before');
  assert.equal(result.industry, 'garage-doors');
  assert.ok(result.copy.headline && result.copy.body && result.copy.roi);
  assert.equal(result.meta.provider, 'mock');
  assert.equal(result.meta.cached, false);
  assert.equal(result.meta.degraded, false);
});

test('transform prompt carries the geometry guardrails', async () => {
  const result = await newEngine().render(baseInput);

  assert.match(result.prompt, /camera position, focal length, perspective, and framing identical/);
  assert.match(result.prompt, /Change only the garage door/);
  assert.match(result.prompt, /Leave unchanged:.*roofline/);
});

test('identical input is served from cache without a second provider call', async () => {
  let transforms = 0;
  const counting = mockProvider();
  const wrapped = { ...counting, transform: (args) => { transforms += 1; return counting.transform(args); } };
  const engine = new AlterRenderEngine({ provider: wrapped });

  const first = await engine.render(baseInput);
  const second = await engine.render(baseInput);

  assert.equal(transforms, 1, 'second identical render must not hit the provider');
  assert.equal(second.meta.cached, true);
  assert.equal(second.id, first.id);
  assert.equal(second.after, first.after);
});

test('a changed description produces a different idempotency key', async () => {
  const engine = newEngine();
  const a = await engine.render(baseInput);
  const b = await engine.render({ ...baseInput, description: 'The garage door will not close' });
  assert.notEqual(a.id, b.id);
});

test('concurrent identical renders collapse onto one provider call', async () => {
  let transforms = 0;
  const slow = mockProvider({ latencyMs: 20 });
  const wrapped = { ...slow, transform: (args) => { transforms += 1; return slow.transform(args); } };
  const engine = new AlterRenderEngine({ provider: wrapped });

  const [a, b, c] = await Promise.all([
    engine.render(baseInput),
    engine.render(baseInput),
    engine.render(baseInput)
  ]);

  assert.equal(transforms, 1, 'in-flight de-duplication must prevent duplicate spend');
  assert.equal(a.id, b.id);
  assert.equal(b.after, c.after);
});

test('transient provider failures are retried', async () => {
  const engine = new AlterRenderEngine({
    provider: mockProvider({ failTimes: 2 }),
    retry: { attempts: 3, baseMs: 1, jitter: false }
  });
  const result = await engine.render({ ...baseInput, copy: false });
  assert.match(result.after, /^data:image\/png;base64,/);
});

test('failures beyond the retry budget surface to the caller', async () => {
  const engine = new AlterRenderEngine({
    provider: mockProvider({ failTimes: 99 }),
    retry: { attempts: 2, baseMs: 1, jitter: false }
  });
  await assert.rejects(() => engine.render({ ...baseInput, copy: false }), /transient failure/);
});

test('the planner degrading does not fail the render', async () => {
  const events = [];
  const provider = mockProvider();
  const brokenPlanner = {
    ...provider,
    plan: async () => { throw new AlterRenderError(CODES.PROVIDER_ERROR, 'planner down'); }
  };
  const engine = new AlterRenderEngine({
    provider: brokenPlanner,
    retry: { attempts: 1 },
    telemetry: (e) => events.push(e.type)
  });

  const result = await engine.render(baseInput);

  assert.equal(result.meta.degraded, true, 'degraded renders must be labelled');
  assert.ok(result.after, 'the image still renders when only the copy fails');
  assert.ok(result.copy.headline, 'fallback copy is present');
  assert.ok(events.includes(EVENTS.PLAN_DEGRADED));
});

test('degradeGracefully:false makes planner failure fatal', async () => {
  const provider = mockProvider();
  const engine = new AlterRenderEngine({
    provider: { ...provider, plan: async () => { throw new AlterRenderError(CODES.PROVIDER_ERROR, 'planner down'); } },
    retry: { attempts: 1 },
    degradeGracefully: false
  });
  await assert.rejects(() => engine.render(baseInput), /planner down/);
});

test('input validation rejects bad images, descriptions and industries', async () => {
  const engine = newEngine();

  await assert.rejects(() => engine.render({ ...baseInput, image: 'https://example.com/x.jpg' }),
    (e) => e.code === CODES.INVALID_INPUT);
  await assert.rejects(() => engine.render({ ...baseInput, image: 'data:application/pdf;base64,AAAA' }),
    (e) => e.code === CODES.INVALID_INPUT);
  await assert.rejects(() => engine.render({ ...baseInput, description: '   ' }),
    (e) => e.code === CODES.INVALID_INPUT);
  await assert.rejects(() => engine.render({ ...baseInput, description: 'x'.repeat(601) }),
    (e) => e.code === CODES.INVALID_INPUT);
  await assert.rejects(() => engine.render({ ...baseInput, industry: 'submarines' }),
    (e) => e.code === CODES.INVALID_INPUT);
});

test('oversized images are rejected before any provider call', async () => {
  let called = false;
  const provider = mockProvider();
  const engine = new AlterRenderEngine({
    provider: { ...provider, transform: async (a) => { called = true; return provider.transform(a); } },
    limits: { maxBytes: 1024 }
  });
  const big = `data:image/png;base64,${encodePng(64, 64, () => [1, 2, 3])}`;

  await assert.rejects(() => engine.render({ ...baseInput, image: big }), (e) => e.code === CODES.INVALID_INPUT);
  assert.equal(called, false, 'validation must happen before spend');
});

test('the circuit breaker opens after repeated failures and fails fast', async () => {
  const engine = new AlterRenderEngine({
    provider: mockProvider({ failTimes: 99 }),
    retry: { attempts: 1 },
    breaker: { threshold: 2, cooldownMs: 60000 },
    cache: new MemoryCache({ max: 10 })
  });

  // Distinct descriptions so each attempt is a distinct cache key.
  await assert.rejects(() => engine.render({ ...baseInput, description: 'first attempt' }));
  await assert.rejects(() => engine.render({ ...baseInput, description: 'second attempt' }));

  await assert.rejects(
    () => engine.render({ ...baseInput, description: 'third attempt' }),
    (e) => e.code === CODES.CIRCUIT_OPEN
  );
});

test('the breaker ignores caller-fault errors', () => {
  const breaker = new CircuitBreaker({ threshold: 2 });
  breaker.recordFailure(new AlterRenderError(CODES.INVALID_INPUT, 'bad image'));
  breaker.recordFailure(new AlterRenderError(CODES.INVALID_INPUT, 'bad image'));
  assert.equal(breaker.state, 'closed', 'bad user input must not take the provider offline');
});

test('the breaker half-opens after the cooldown', () => {
  let now = 1000;
  const breaker = new CircuitBreaker({ threshold: 1, cooldownMs: 500, now: () => now });
  breaker.recordFailure(new Error('boom'));
  assert.equal(breaker.state, 'open');
  now += 600;
  assert.equal(breaker.state, 'half-open');
  assert.doesNotThrow(() => breaker.assertClosed());
});

test('an abort signal stops the render', async () => {
  const engine = new AlterRenderEngine({ provider: mockProvider({ latencyMs: 50 }) });
  const controller = new AbortController();
  const promise = engine.render({ ...baseInput, signal: controller.signal });
  controller.abort();
  await assert.rejects(() => promise, (e) => e.code === CODES.ABORTED);
});

test('telemetry emits a full lifecycle without leaking image bytes', async () => {
  const events = [];
  const engine = newEngine({ telemetry: (e) => events.push(e) });
  await engine.render(baseInput);

  const types = events.map((e) => e.type);
  assert.deepEqual(types, [EVENTS.STARTED, EVENTS.PLANNED, EVENTS.TRANSFORMED, EVENTS.SUCCEEDED]);

  const serialized = JSON.stringify(events);
  assert.ok(!serialized.includes(BEFORE.slice(30, 80)), 'telemetry must not carry image payloads');
  assert.ok(events[0].at, 'every event is timestamped');
});

test('telemetry sink failures cannot break a render', async () => {
  const engine = newEngine({ telemetry: () => { throw new Error('sink exploded'); } });
  const result = await engine.render(baseInput);
  assert.ok(result.after);
});

test('custom verticals can be registered without forking', async () => {
  defineIndustry({
    id: 'solar',
    label: 'Solar Installation',
    target: 'the roof-mounted solar array',
    preserve: ['roof geometry', 'landscaping'],
    cues: ['flush-mounted black-frame panels in even rows'],
    roiBasis: 'residential solar typically recovers cost through generation over 7-12 years'
  });

  const result = await newEngine().render({ ...baseInput, industry: 'solar' });
  assert.equal(result.industry, 'solar');
  assert.match(result.prompt, /Change only the roof-mounted solar array/);
  assert.match(result.prompt, /Leave unchanged: roof geometry, landscaping/);
});

test('buildTransformPrompt refuses an empty instruction', () => {
  assert.throws(() => buildTransformPrompt({ industryId: 'roofing', imagePrompt: '  ' }),
    (e) => e.code === CODES.INVALID_INPUT);
});

test('MemoryCache evicts least-recently-used entries and honours TTL', () => {
  let now = 0;
  const cache = new MemoryCache({ max: 2, ttlMs: 100, now: () => now });

  cache.set('a', 1);
  cache.set('b', 2);
  cache.get('a');          // 'a' becomes most-recently-used
  cache.set('c', 3);       // evicts 'b'

  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 1);

  now = 200;
  assert.equal(cache.get('a'), undefined, 'entries expire');
});

test('concurrency gate bounds simultaneous provider calls', async () => {
  let active = 0;
  let peak = 0;
  const provider = mockProvider({ latencyMs: 10 });
  const instrumented = {
    ...provider,
    transform: async (args) => {
      active += 1;
      peak = Math.max(peak, active);
      try { return await provider.transform(args); } finally { active -= 1; }
    }
  };
  const engine = new AlterRenderEngine({ provider: instrumented, concurrency: 2 });

  await Promise.all(
    Array.from({ length: 6 }, (_, i) => engine.render({ ...baseInput, description: `variant number ${i}` }))
  );

  assert.ok(peak <= 2, `expected at most 2 concurrent provider calls, saw ${peak}`);
});
