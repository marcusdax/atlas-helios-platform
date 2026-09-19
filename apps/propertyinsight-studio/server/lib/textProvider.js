import { AlterRenderError, CODES, withRetry, CircuitBreaker } from '@alter/render-core';

/**
 * Text generation for the assist features (improvement suggestions, campaign
 * one-pagers, market framing, vision parameters).
 *
 * These are deliberately *not* in @alter/render-core. That package renders
 * images; a general "ask a model for some JSON" helper has nothing to do with
 * before/after property rendering and would make the engine harder to adopt.
 * What is reused is the reliability machinery - retry classification and the
 * circuit breaker - because those problems are identical whatever the payload.
 *
 * Like the render engine, this falls back to a deterministic offline stub when
 * no key is configured, so the whole app runs before anyone provisions one.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function classify(status, body) {
  if (status === 429) {
    return new AlterRenderError(CODES.RATE_LIMITED, 'assist provider rate limit reached', {
      status: 429, retryable: true
    });
  }
  if (status >= 500) {
    return new AlterRenderError(CODES.PROVIDER_ERROR, 'assist provider is failing', {
      status: 502, retryable: true
    });
  }
  if (status === 401 || status === 403) {
    return new AlterRenderError(CODES.PROVIDER_ERROR, 'assist provider rejected the credentials', {
      status: 502
    });
  }
  return new AlterRenderError(CODES.PROVIDER_ERROR, 'assist provider rejected the request', {
    status: 502,
    details: { upstreamStatus: status, upstreamMessage: String(body || '').slice(0, 300) }
  });
}

/** Models fence JSON in ```json often enough that it is worth handling here. */
function parseJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch (cause) {
    throw new AlterRenderError(CODES.PROVIDER_ERROR, 'assist provider returned malformed JSON', {
      status: 502, retryable: true, cause
    });
  }
}

function geminiText({ apiKey, model, timeoutMs }) {
  return async function generate({ prompt, schema, signal }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener?.('abort', onAbort, { once: true });

    const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
    if (schema) {
      body.generationConfig = { responseMimeType: 'application/json', responseSchema: schema };
    }

    let response;
    try {
      response = await fetch(`${BASE}/${model}:generateContent`, {
        method: 'POST',
        // The key goes in a header, not the query string: query strings land in
        // access logs, proxy logs and browser history.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (cause) {
      if (signal?.aborted) throw new AlterRenderError(CODES.ABORTED, 'request aborted');
      throw new AlterRenderError(CODES.TIMEOUT, 'assist provider did not respond in time', {
        status: 504, retryable: true, cause
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
    }

    if (!response.ok) throw classify(response.status, await response.text().catch(() => ''));

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
    if (!text) {
      throw new AlterRenderError(CODES.PROVIDER_ERROR, 'assist provider returned no content', {
        status: 502, retryable: true
      });
    }
    return schema ? parseJson(text) : text;
  };
}

/**
 * Offline stub. Deterministic and shaped exactly like the real responses, so
 * the UI, the tests, and a demo on a plane all exercise the same code paths.
 */
function stubText() {
  return async function generate({ prompt, schema }) {
    if (!schema) {
      return (
        'Offline assist: this is placeholder analysis. Configure ALTER_RENDER_API_KEY to ' +
        'generate real output. The request was understood and the pipeline is working.'
      );
    }
    if (schema.type === 'ARRAY' && schema.items?.type === 'STRING') {
      return [
        'Replace the most visibly degraded street-facing surface first',
        'Correct anything that reads as deferred maintenance from the curb',
        'Tidy bed edges and trim growth away from the facade',
        'Refresh trim and the front door for the cheapest perceived lift'
      ];
    }
    if (schema.type === 'ARRAY') {
      // The campaign one-pager shape: echo the addresses back from the prompt.
      const addresses = [...prompt.matchAll(/^\s*\d+\.\s+(.+)$/gm)].map((m) => m[1].trim());
      return (addresses.length ? addresses : ['123 Example St']).map((address, index) => ({
        address,
        slug: `offline-${index + 1}`,
        summary:
          'Offline placeholder: the live version renders this property, prices the work, ' +
          'and attaches a booking link.'
      }));
    }
    return {};
  };
}

export function createTextProvider(env = process.env) {
  const apiKey = env.ALTER_RENDER_API_KEY || env.GEMINI_API_KEY;
  const offline = !apiKey || env.ALTER_RENDER_PROVIDER === 'mock';

  const generate = offline
    ? stubText()
    : geminiText({
        apiKey,
        model: env.ALTER_ASSIST_MODEL || env.ALTER_RENDER_PLAN_MODEL || 'gemini-2.5-flash',
        timeoutMs: Number.parseInt(env.ALTER_ASSIST_TIMEOUT_MS, 10) || 45000
      });

  const breaker = new CircuitBreaker({ threshold: 5, cooldownMs: 30000 });
  const attempts = Number.parseInt(env.ALTER_RENDER_ATTEMPTS, 10) || 3;

  return {
    offline,

    async generate({ prompt, schema, signal }) {
      breaker.assertClosed();
      try {
        const result = await withRetry(() => generate({ prompt, schema, signal }), {
          attempts, baseMs: 400, signal
        });
        breaker.recordSuccess();
        return result;
      } catch (error) {
        breaker.recordFailure(error);
        throw error;
      }
    }
  };
}
