'use strict';

const { AlterRenderError, CODES } = require('../errors');

/**
 * Map an upstream HTTP status onto our error taxonomy.
 *
 * `retryable` is the important column: retrying a 400 burns quota and never
 * succeeds, while not retrying a 503 throws away a request that would have.
 */
function classify(status, body) {
  if (status === 429) {
    return new AlterRenderError(CODES.RATE_LIMITED, 'render provider rate limit reached', {
      status: 429, retryable: true, details: { upstreamStatus: status }
    });
  }
  if (status >= 500) {
    return new AlterRenderError(CODES.PROVIDER_ERROR, 'render provider is failing', {
      status: 502, retryable: true, details: { upstreamStatus: status }
    });
  }
  if (status === 401 || status === 403) {
    return new AlterRenderError(CODES.PROVIDER_ERROR, 'render provider rejected the credentials', {
      status: 502, retryable: false, details: { upstreamStatus: status }
    });
  }
  return new AlterRenderError(CODES.PROVIDER_ERROR, 'render provider rejected the request', {
    status: 502,
    retryable: false,
    // Upstream bodies can echo prompts; keep a short slice for triage only.
    details: { upstreamStatus: status, upstreamMessage: String(body || '').slice(0, 300) }
  });
}

/**
 * POST JSON with a hard timeout, composing the caller's AbortSignal with ours
 * so an aborted render actually releases the socket instead of running to term.
 */
async function postJson(url, payload, { timeoutMs = 60000, signal, fetchImpl, headers } = {}) {
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) {
    throw new AlterRenderError(CODES.UNSUPPORTED, 'no fetch implementation available; pass options.fetchImpl');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.('abort', onAbort, { once: true });

  let response;
  try {
    response = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (signal?.aborted) throw new AlterRenderError(CODES.ABORTED, 'render aborted by caller');
    if (controller.signal.aborted) {
      throw new AlterRenderError(CODES.TIMEOUT, `render provider timed out after ${timeoutMs}ms`, {
        status: 504, retryable: true, cause: error
      });
    }
    throw new AlterRenderError(CODES.PROVIDER_ERROR, 'could not reach the render provider', {
      status: 502, retryable: true, cause: error
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw classify(response.status, text);
  }
  return response.json();
}

module.exports = { postJson, classify };
