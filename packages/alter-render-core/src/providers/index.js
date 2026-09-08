'use strict';

const { geminiProvider } = require('./gemini');
const { mockProvider } = require('./mock');
const { AlterRenderError, CODES } = require('../errors');

/**
 * Split planning and image generation across vendors.
 *
 * These are different markets with different price curves: a cheap text model
 * writes the copy, a specialist image model does the edit. Binding both to one
 * vendor is a procurement decision, not an architectural one, so the engine
 * never assumes they are the same object.
 *
 *   composeProvider({ planner: openAiLikeProvider, renderer: geminiProvider({...}) })
 */
function composeProvider({ planner, renderer, name }) {
  if (!planner?.plan) throw new AlterRenderError(CODES.INVALID_INPUT, 'composeProvider requires a planner with plan()');
  if (!renderer?.transform) throw new AlterRenderError(CODES.INVALID_INPUT, 'composeProvider requires a renderer with transform()');
  return {
    name: name || `${planner.name}+${renderer.name}`,
    capabilities: { plan: true, transform: true },
    plan: (args) => planner.plan(args),
    transform: (args) => renderer.transform(args)
  };
}

/**
 * The provider contract, for anyone writing an adapter (Stability, Replicate,
 * Bedrock, an internal diffusion service):
 *
 *   {
 *     name: string,
 *     capabilities: { plan: boolean, transform: boolean },
 *     plan({ prompt, signal })            -> { imagePrompt, headline, body, roi }
 *     transform({ image, prompt, signal }) -> { mimeType, data }   // data = base64, no prefix
 *   }
 *
 * Throw AlterRenderError with `retryable: true` for transient upstream faults;
 * anything else is treated as terminal.
 */
function assertProvider(provider) {
  if (!provider || typeof provider.transform !== 'function') {
    throw new AlterRenderError(CODES.INVALID_INPUT, 'provider must implement transform()');
  }
  return provider;
}

module.exports = { geminiProvider, mockProvider, composeProvider, assertProvider };
