'use strict';

const {
  AlterRenderEngine,
  geminiProvider,
  mockProvider,
  MemoryCache
} = require('@alter/render-core');

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Build a configured engine from environment variables.
 *
 * The point is that adopting this package in a new platform is a config change,
 * not a code change. A host wires `createEngineFromEnv()` into its container
 * once; switching providers, tightening concurrency, or shrinking the cache
 * afterwards is a deploy-time decision made by whoever is carrying the pager.
 *
 * Environment
 *   ALTER_RENDER_PROVIDER      "gemini" | "mock"  (default: gemini if a key
 *                              exists, otherwise mock)
 *   ALTER_RENDER_API_KEY       provider credential (falls back to GEMINI_API_KEY)
 *   ALTER_RENDER_PLAN_MODEL    planning model id
 *   ALTER_RENDER_IMAGE_MODEL   image model id
 *   ALTER_RENDER_CONCURRENCY   max simultaneous provider calls (default 4)
 *   ALTER_RENDER_CACHE_SIZE    cached renders held in memory (default 100)
 *   ALTER_RENDER_CACHE_TTL_MS  cache lifetime (default 24h)
 *   ALTER_RENDER_MAX_BYTES     largest accepted source image (default 12MB)
 *   ALTER_RENDER_TIMEOUT_MS    per-provider-call timeout (default 90s)
 *   ALTER_RENDER_ATTEMPTS      attempts per provider call (default 3)
 */
function createEngineFromEnv(env = process.env, { telemetry, logger = console } = {}) {
  const apiKey = env.ALTER_RENDER_API_KEY || env.GEMINI_API_KEY;
  const requested = env.ALTER_RENDER_PROVIDER || (apiKey ? 'gemini' : 'mock');

  let provider;
  if (requested === 'mock') {
    provider = mockProvider();
    // Loud, but not fatal. A host that boots into a working mocked pipeline can
    // build and demo the whole feature before procurement finishes; a host that
    // crashes on a missing key cannot.
    logger?.warn?.(
      '[alter-render] using the MOCK provider - renders are synthetic placeholders. ' +
      'Set ALTER_RENDER_API_KEY to enable real renders.'
    );
  } else if (requested === 'gemini') {
    if (!apiKey) {
      throw new Error('ALTER_RENDER_PROVIDER=gemini requires ALTER_RENDER_API_KEY');
    }
    provider = geminiProvider({
      apiKey,
      planModel: env.ALTER_RENDER_PLAN_MODEL || undefined,
      imageModel: env.ALTER_RENDER_IMAGE_MODEL || undefined,
      timeoutMs: int(env.ALTER_RENDER_TIMEOUT_MS, 90000)
    });
  } else {
    throw new Error(`unknown ALTER_RENDER_PROVIDER "${requested}" (expected "gemini" or "mock")`);
  }

  return new AlterRenderEngine({
    provider,
    telemetry,
    concurrency: int(env.ALTER_RENDER_CONCURRENCY, 4),
    retry: { attempts: int(env.ALTER_RENDER_ATTEMPTS, 3) },
    limits: { maxBytes: int(env.ALTER_RENDER_MAX_BYTES, 12 * 1024 * 1024) },
    cache: new MemoryCache({
      max: int(env.ALTER_RENDER_CACHE_SIZE, 100),
      ttlMs: int(env.ALTER_RENDER_CACHE_TTL_MS, 24 * 60 * 60 * 1000)
    })
  });
}

module.exports = { createEngineFromEnv };
