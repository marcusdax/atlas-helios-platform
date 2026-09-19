'use strict';

const { AlterRenderError, CODES } = require('../errors');

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AlterRenderError(CODES.ABORTED, 'aborted'));
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new AlterRenderError(CODES.ABORTED, 'aborted'));
    }
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });

/**
 * Full-jitter exponential backoff (AWS's variant): sleeping a *random* value in
 * [0, backoff] rather than the backoff itself keeps a fleet of clients from
 * re-colliding in lockstep after a shared upstream blip.
 */
function backoffDelay(attempt, { baseMs = 400, maxMs = 8000, jitter = true } = {}) {
  const ceiling = Math.min(maxMs, baseMs * 2 ** attempt);
  return jitter ? Math.round(Math.random() * ceiling) : ceiling;
}

async function withRetry(fn, options = {}) {
  const { attempts = 3, signal, onRetry, ...backoff } = options;
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal?.aborted) throw new AlterRenderError(CODES.ABORTED, 'aborted');
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const isLast = attempt === attempts - 1;
      if (!error?.retryable || isLast) throw error;
      const delay = backoffDelay(attempt, backoff);
      onRetry?.({ attempt: attempt + 1, delay, error });
      await sleep(delay, signal);
    }
  }
  throw lastError;
}

/**
 * Circuit breaker. Image models are the slowest and priciest dependency in the
 * pipeline; when one is down, queueing 30s timeouts behind it turns a provider
 * outage into a host-app outage. Failing fast keeps the rest of the page alive.
 */
class CircuitBreaker {
  constructor({ threshold = 5, cooldownMs = 30000, now = () => Date.now() } = {}) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.now = now;
    this.failures = 0;
    this.openedAt = null;
  }

  get state() {
    if (this.openedAt === null) return 'closed';
    return this.now() - this.openedAt >= this.cooldownMs ? 'half-open' : 'open';
  }

  assertClosed() {
    if (this.state === 'open') {
      const retryInMs = this.cooldownMs - (this.now() - this.openedAt);
      throw new AlterRenderError(CODES.CIRCUIT_OPEN, 'render provider is unavailable, try again shortly', {
        status: 503,
        details: { retryInMs }
      });
    }
  }

  recordSuccess() {
    this.failures = 0;
    this.openedAt = null;
  }

  /** Only infrastructure failures trip the breaker — bad input is the caller's. */
  recordFailure(error) {
    if (error?.code === CODES.INVALID_INPUT || error?.code === CODES.ABORTED) return;
    this.failures += 1;
    if (this.failures >= this.threshold) this.openedAt = this.now();
  }
}

module.exports = { withRetry, backoffDelay, CircuitBreaker, sleep };
