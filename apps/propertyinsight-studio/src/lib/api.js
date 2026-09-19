import { createRenderClient } from '@alter/render-core';

/**
 * The one place the client decides where work happens.
 *
 * `renderer` satisfies the same contract as a server-side AlterRenderEngine, so
 * every component below this file is unaware that a network exists. That is the
 * whole reason the engine was extracted: the browser holds no credential and no
 * provider logic, only a URL.
 */
export const renderer = createRenderClient({ endpoint: '/api/renders' });

/** Copy for the stable error codes the API can return. */
const ERROR_COPY = {
  INVALID_INPUT: 'That request could not be processed. Check your inputs and try again.',
  RATE_LIMITED: 'Quota reached for now. Try again in a few minutes.',
  CIRCUIT_OPEN: 'The provider is temporarily unavailable, so we stopped sending requests to let it recover.',
  TIMEOUT: 'That took too long to come back. Try again, or use a smaller photo.',
  NOT_FOUND: 'That resource is no longer available.',
  PROVIDER_ERROR: 'The AI provider returned an error. Try again shortly.'
};

export const messageFor = (error) =>
  ERROR_COPY[error?.code] || error?.message || 'Something went wrong. Please try again.';

class ApiError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

async function post(path, body, signal) {
  let response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });
  } catch (error) {
    if (signal?.aborted) throw new ApiError('ABORTED', 'aborted');
    throw new ApiError('PROVIDER_ERROR', 'Could not reach the server.');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const err = payload?.error || {};
    throw new ApiError(err.code || 'PROVIDER_ERROR', err.message || `Request failed (${response.status})`, err.details);
  }
  return payload;
}

export const api = {
  status: (signal) => fetch('/api/assist/status', { signal }).then((r) => r.json()),
  suggestions: (body, signal) => post('/api/assist/suggestions', body, signal),
  campaign: (body, signal) => post('/api/assist/campaign', body, signal),
  market: (body, signal) => post('/api/assist/market', body, signal),
  visionParams: (body, signal) => post('/api/assist/vision-params', body, signal)
};
