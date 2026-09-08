'use strict';

const { AlterRenderError, CODES } = require('./errors');
const { listIndustries } = require('./prompts/industries');

/**
 * Browser-side half of the engine.
 *
 * `createRenderClient()` returns an object with the *same* `render()` signature
 * as AlterRenderEngine, but it forwards to your server instead of calling a
 * model vendor. UI code therefore never learns which one it holds:
 *
 *   const renderer = import.meta.env.DEV
 *     ? new AlterRenderEngine({ provider: mockProvider() })   // offline demo
 *     : createRenderClient({ endpoint: '/api/renders' });     // production
 *
 * This is the seam that keeps the vendor API key on the server. The original
 * single-file prototype called the model vendor straight from the component,
 * which ships the key to every visitor and puts unmetered image spend behind a
 * button anyone can hold down.
 */
function createRenderClient(options = {}) {
  const {
    endpoint,
    fetchImpl,
    headers = {},
    credentials = 'same-origin',
    timeoutMs = 120000,
    getAuthHeaders
  } = options;

  if (!endpoint) {
    throw new AlterRenderError(CODES.INVALID_INPUT, 'createRenderClient requires an endpoint');
  }
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!doFetch) {
    throw new AlterRenderError(CODES.UNSUPPORTED, 'no fetch available; pass options.fetchImpl');
  }

  async function request(path, { method = 'GET', body, signal, extraHeaders } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener?.('abort', onAbort, { once: true });

    let response;
    try {
      response = await doFetch(`${endpoint}${path}`, {
        method,
        credentials,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
          ...(getAuthHeaders ? await getAuthHeaders() : {}),
          ...extraHeaders
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
    } catch (error) {
      if (signal?.aborted) throw new AlterRenderError(CODES.ABORTED, 'render aborted');
      if (controller.signal.aborted) {
        throw new AlterRenderError(CODES.TIMEOUT, 'the render service did not respond in time', { status: 504 });
      }
      throw new AlterRenderError(CODES.PROVIDER_ERROR, 'could not reach the render service', { status: 502, cause: error });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      // The server speaks the same error taxonomy, so rehydrate rather than
      // flatten: callers get the same `code` whichever side produced it.
      const err = payload && payload.error ? payload.error : {};
      throw new AlterRenderError(
        err.code || CODES.PROVIDER_ERROR,
        err.message || `render service returned ${response.status}`,
        { status: response.status, details: err.details }
      );
    }
    return payload;
  }

  return {
    name: 'http-client',

    /** Mirrors AlterRenderEngine#render. */
    async render({ image, description, industry, copy = true, idempotencyKey, signal } = {}) {
      return request('', {
        method: 'POST',
        body: { image, description, industry, copy },
        signal,
        extraHeaders: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
      });
    },

    /**
     * Presets, from the server when reachable so a host that registered custom
     * verticals server-side sees them, falling back to the built-in catalog so
     * the picker still populates offline.
     */
    async listIndustries({ signal } = {}) {
      try {
        const result = await request('/industries', { signal });
        return Array.isArray(result?.industries) ? result.industries : listIndustries();
      } catch {
        return listIndustries();
      }
    }
  };
}

module.exports = { createRenderClient };
