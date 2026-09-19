'use strict';

const { postJson } = require('./http');
const { AlterRenderError, CODES } = require('../errors');

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    imagePrompt: { type: 'STRING' },
    headline: { type: 'STRING' },
    body: { type: 'STRING' },
    roi: { type: 'STRING' }
  },
  required: ['imagePrompt', 'headline', 'body', 'roi']
};

/** Models return JSON wrapped in ```json fences often enough to handle it here. */
function parseJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new AlterRenderError(CODES.PROVIDER_ERROR, 'planner returned malformed JSON', {
      status: 502, retryable: true, cause: error
    });
  }
}

/**
 * Google Gemini provider.
 *
 * The API key belongs here, on whichever side of the wire this provider is
 * constructed. Construct it on a server. Constructing it in a browser bundle
 * publishes the key to every visitor — see `httpTransport` for the client half.
 */
function geminiProvider(options = {}) {
  const {
    apiKey,
    planModel = 'gemini-2.5-flash',
    imageModel = 'gemini-2.5-flash-image',
    fetchImpl,
    timeoutMs = 90000
  } = options;

  if (!apiKey) {
    throw new AlterRenderError(CODES.INVALID_INPUT, 'geminiProvider requires an apiKey');
  }

  // The key travels in a header, not the query string: query strings land in
  // access logs, proxy logs, and browser history.
  const call = (model, payload, signal) =>
    postJson(`${BASE}/${model}:generateContent`, payload, {
      signal,
      fetchImpl,
      timeoutMs,
      headers: { 'x-goog-api-key': apiKey }
    });

  return {
    name: 'gemini',
    capabilities: { plan: true, transform: true },

    async plan({ prompt, signal }) {
      const result = await call(planModel, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: PLAN_SCHEMA }
      }, signal);

      const text = result?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
      if (!text) {
        throw new AlterRenderError(CODES.PROVIDER_ERROR, 'planner returned no content', {
          status: 502, retryable: true, details: { finishReason: result?.candidates?.[0]?.finishReason }
        });
      }
      return parseJson(text);
    },

    async transform({ image, prompt, signal }) {
      const result = await call(imageModel, {
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: image.mimeType, data: image.data } }
          ]
        }],
        generationConfig: { responseModalities: ['IMAGE'] }
      }, signal);

      const part = result?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part) {
        // A safety block is a distinct product event from an outage: the same
        // prompt will fail again, so it must not be retried or trip the breaker.
        const reason = result?.candidates?.[0]?.finishReason;
        throw new AlterRenderError(
          reason === 'SAFETY' ? CODES.INVALID_INPUT : CODES.PROVIDER_ERROR,
          reason === 'SAFETY'
            ? 'the image or instruction was refused by the provider safety filter'
            : 'image model returned no image',
          { status: reason === 'SAFETY' ? 422 : 502, retryable: reason !== 'SAFETY', details: { finishReason: reason } }
        );
      }
      return { mimeType: part.inlineData.mimeType || 'image/png', data: part.inlineData.data };
    }
  };
}

module.exports = { geminiProvider };
