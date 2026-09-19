'use strict';

const { AlterRenderEngine, PROMPT_VERSION } = require('./engine');
const { createRenderClient } = require('./client');
const { geminiProvider, mockProvider, composeProvider, assertProvider } = require('./providers');
const { MemoryCache, nullCache } = require('./cache');
const { AlterRenderError, CODES } = require('./errors');
const { EVENTS } = require('./telemetry');
const { PRESETS, listIndustries, getIndustry, defineIndustry } = require('./prompts/industries');
const { buildPlanPrompt, buildTransformPrompt, guardrails, fallbackPlan } = require('./prompts/compose');
const { parseDataUrl, toDataUrl } = require('./util/image');
const { CircuitBreaker, withRetry } = require('./util/retry');
const { sha256 } = require('./util/hash');
const { encodePng } = require('./util/png');

module.exports = {
  // Engine and client - same render() signature, different sides of the wire.
  AlterRenderEngine,
  createRenderClient,

  // Providers
  geminiProvider,
  mockProvider,
  composeProvider,
  assertProvider,

  // Verticals
  PRESETS,
  listIndustries,
  getIndustry,
  defineIndustry,

  // Prompt layer, exported so hosts can audit or A/B the exact text sent
  buildPlanPrompt,
  buildTransformPrompt,
  guardrails,
  fallbackPlan,
  PROMPT_VERSION,

  // Infrastructure primitives, reusable on their own
  MemoryCache,
  nullCache,
  CircuitBreaker,
  withRetry,

  // Errors and observability
  AlterRenderError,
  CODES,
  EVENTS,

  // Utilities
  parseDataUrl,
  toDataUrl,
  sha256,
  encodePng
};
