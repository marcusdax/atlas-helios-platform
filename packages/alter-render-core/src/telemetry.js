'use strict';

/**
 * Telemetry is a single injected function, not an event emitter, so a host can
 * pipe it into whatever it already runs (winston, Datadog, Sentry, Segment)
 * without this package taking an opinion or a dependency.
 *
 *   telemetry: (event) => logger.info(event.type, event)
 *
 * Events never carry image bytes or raw prompts — only shapes, sizes, and
 * outcomes — so they are safe to ship to a third-party analytics sink.
 */
const EVENTS = {
  STARTED: 'render.started',
  CACHED: 'render.cached',
  PLANNED: 'render.planned',
  PLAN_DEGRADED: 'render.plan_degraded',
  TRANSFORMED: 'render.transformed',
  SUCCEEDED: 'render.succeeded',
  FAILED: 'render.failed',
  RETRY: 'provider.retry',
  BREAKER_OPEN: 'provider.breaker_open'
};

function createTelemetry(sink) {
  if (typeof sink !== 'function') return () => {};
  return (type, payload = {}) => {
    try {
      sink({ type, at: new Date().toISOString(), ...payload });
    } catch {
      // Telemetry must never be able to fail a render.
    }
  };
}

module.exports = { createTelemetry, EVENTS };
