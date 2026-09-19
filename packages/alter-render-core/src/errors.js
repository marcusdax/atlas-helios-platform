'use strict';

/**
 * Every failure the engine surfaces is an AlterRenderError with a stable `code`.
 * Hosts branch on `code`, never on message text, so copy can change without
 * breaking a caller's error handling.
 */
const CODES = {
  INVALID_INPUT: 'INVALID_INPUT',       // caller's fault, never retry
  UNSUPPORTED: 'UNSUPPORTED',           // provider can't do this capability
  PROVIDER_ERROR: 'PROVIDER_ERROR',     // upstream returned an error
  RATE_LIMITED: 'RATE_LIMITED',         // upstream 429 / quota
  TIMEOUT: 'TIMEOUT',
  ABORTED: 'ABORTED',                   // caller aborted via AbortSignal
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',         // breaker tripped, fail fast
  NOT_FOUND: 'NOT_FOUND'
};

class AlterRenderError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'AlterRenderError';
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable === true;
    this.details = options.details;
    if (options.cause) this.cause = options.cause;
  }

  /** Safe to hand straight to res.json() — carries no keys or upstream bodies. */
  toJSON() {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

const invalid = (message, details) =>
  new AlterRenderError(CODES.INVALID_INPUT, message, { status: 400, details });

module.exports = { AlterRenderError, CODES, invalid };
