'use strict';

const { AlterRenderError, CODES } = require('./errors');
const { parseDataUrl, toDataUrl, DEFAULT_LIMITS } = require('./util/image');
const { sha256 } = require('./util/hash');
const { withRetry, CircuitBreaker } = require('./util/retry');
const { createSemaphore } = require('./util/semaphore');
const { MemoryCache } = require('./cache');
const { createTelemetry, EVENTS } = require('./telemetry');
const { assertProvider } = require('./providers');
const { getIndustry, listIndustries } = require('./prompts/industries');
const {
  buildPlanPrompt,
  buildTransformPrompt,
  fallbackPlan,
  normalizeDescription
} = require('./prompts/compose');

/** Bump when prompt construction changes, so cached renders are not stale. */
const PROMPT_VERSION = 'v1';

/**
 * AlterRenderEngine - the whole before/after pipeline, with no framework, no
 * HTTP server, and no DOM in it.
 *
 * That constraint is the point of the package: the same object runs in an
 * Express route, a Lambda, a worker, a CLI, or (through a proxy transport) a
 * browser. Hosts differ in how they authenticate, store, and present; they do
 * not differ in what a good property render is.
 *
 * Pipeline: validate, key, cache, plan, transform, emit.
 */
class AlterRenderEngine {
  constructor(options = {}) {
    const {
      provider,
      cache = new MemoryCache(),
      telemetry,
      limits = {},
      retry = { attempts: 3 },
      breaker = {},
      concurrency = 4,
      degradeGracefully = true
    } = options;

    this.provider = assertProvider(provider);
    this.cache = cache;
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.retry = retry;
    this.breaker = breaker instanceof CircuitBreaker ? breaker : new CircuitBreaker(breaker);
    this.gate = createSemaphore(concurrency);
    this.degradeGracefully = degradeGracefully;
    this.emit = createTelemetry(telemetry);
    /** Collapses concurrent identical requests onto one upstream call. */
    this.inFlight = new Map();
  }

  listIndustries() {
    return listIndustries();
  }

  /**
   * Stable key for "this exact render was already asked for".
   *
   * Derived from content rather than accepted from the caller, so a retry after
   * a dropped connection - the case that actually causes double billing - hits
   * the cache without the client having to remember anything. Callers may still
   * pass an explicit key to scope idempotency more narrowly.
   */
  idempotencyKey({ image, description, industry }) {
    return sha256([
      PROMPT_VERSION,
      this.provider.name,
      industry,
      normalizeDescription(description),
      sha256(image.data)
    ].join(' '));
  }

  /**
   * @param {object} input
   * @param {string} input.image        base64 data URL of the "before" photo
   * @param {string} input.description  what is wrong / what should change
   * @param {string} input.industry     preset id, e.g. "roofing"
   * @param {string} [input.idempotencyKey]
   * @param {boolean} [input.copy=true] also generate marketing copy and ROI
   * @param {AbortSignal} [input.signal]
   */
  async render(input = {}) {
    const started = Date.now();
    const image = parseDataUrl(input.image, this.limits);
    const description = normalizeDescription(input.description);
    const preset = getIndustry(input.industry);
    const wantsCopy = input.copy !== false;
    const signal = input.signal;

    const key = input.idempotencyKey || this.idempotencyKey({ image, description, industry: preset.id });

    const cached = await this.cache.get(key);
    if (cached) {
      this.emit(EVENTS.CACHED, { key, industry: preset.id });
      return { ...cached, meta: { ...cached.meta, cached: true, durationMs: Date.now() - started } };
    }

    // A second identical request arriving mid-flight waits on the first rather
    // than paying for a duplicate generation.
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const work = this._run({ key, image, description, preset, wantsCopy, signal, started })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, work);
    return work;
  }

  async _run({ key, image, description, preset, wantsCopy, signal, started }) {
    this.emit(EVENTS.STARTED, { key, industry: preset.id, bytes: image.bytes, provider: this.provider.name });
    this.breaker.assertClosed();

    const release = await this.gate.acquire();
    try {
      const plan = await this._plan({ key, preset, description, wantsCopy, signal });
      const prompt = buildTransformPrompt({ industryId: preset.id, imagePrompt: plan.imagePrompt });

      const output = await withRetry(
        () => this.provider.transform({ image, prompt, signal }),
        {
          ...this.retry,
          signal,
          onRetry: (info) => this.emit(EVENTS.RETRY, { key, stage: 'transform', attempt: info.attempt, delay: info.delay, code: info.error?.code })
        }
      );

      if (!output || !output.data) {
        throw new AlterRenderError(CODES.PROVIDER_ERROR, 'provider returned an empty image', { status: 502 });
      }
      this.emit(EVENTS.TRANSFORMED, { key, mimeType: output.mimeType });

      const result = {
        id: key,
        industry: preset.id,
        description,
        before: image.dataUrl,
        after: toDataUrl(output.mimeType || 'image/png', output.data),
        prompt,
        copy: wantsCopy ? { headline: plan.headline, body: plan.body, roi: plan.roi } : null,
        meta: {
          provider: this.provider.name,
          promptVersion: PROMPT_VERSION,
          cached: false,
          degraded: plan.degraded === true,
          durationMs: Date.now() - started
        }
      };

      await this.cache.set(key, result);
      this.breaker.recordSuccess();
      this.emit(EVENTS.SUCCEEDED, { key, durationMs: result.meta.durationMs, degraded: result.meta.degraded });
      return result;
    } catch (error) {
      const wasClosed = this.breaker.state === 'closed';
      this.breaker.recordFailure(error);
      if (wasClosed && this.breaker.state === 'open') this.emit(EVENTS.BREAKER_OPEN, { key, failures: this.breaker.failures });
      this.emit(EVENTS.FAILED, { key, code: error && error.code ? error.code : 'UNKNOWN', durationMs: Date.now() - started });
      throw error;
    } finally {
      release();
    }
  }

  async _plan({ key, preset, description, wantsCopy, signal }) {
    const canPlan = wantsCopy && this.provider.capabilities && this.provider.capabilities.plan && typeof this.provider.plan === 'function';
    if (!canPlan) {
      return fallbackPlan({ industryId: preset.id, description });
    }

    const prompt = buildPlanPrompt({ industryId: preset.id, description });
    try {
      const plan = await withRetry(
        () => this.provider.plan({ prompt, signal }),
        {
          ...this.retry,
          signal,
          onRetry: (info) => this.emit(EVENTS.RETRY, { key, stage: 'plan', attempt: info.attempt, delay: info.delay, code: info.error?.code })
        }
      );
      if (!plan || !plan.imagePrompt) {
        throw new AlterRenderError(CODES.PROVIDER_ERROR, 'plan is missing imagePrompt');
      }
      this.emit(EVENTS.PLANNED, { key });
      return plan;
    } catch (error) {
      // The image is the product; the copy is an accessory. Losing the planner
      // degrades the output instead of failing the render - unless the host
      // asked for strictness, or the caller itself went away.
      if (!this.degradeGracefully || (error && error.code === CODES.ABORTED)) throw error;
      this.emit(EVENTS.PLAN_DEGRADED, { key, code: error && error.code });
      return fallbackPlan({ industryId: preset.id, description });
    }
  }
}

module.exports = { AlterRenderEngine, PROMPT_VERSION };
