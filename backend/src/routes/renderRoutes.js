'use strict';

/**
 * Alter render routes for Atlas & Helios.
 *
 * This file is deliberately thin: everything specific to *rendering* lives in
 * the @alter/render-* packages, and everything here is specific to *this
 * platform* - its logger, its rate limiter, its auth. That split is what lets
 * the same engine ship into another product without dragging Atlas with it.
 *
 * Mounted at /api/renders by server.js.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { createAlterRenderRouter, createEngineFromEnv } = require('@alter/render-server');
const { logger } = require('../utils/logger');

// One engine per process: it owns the response cache, the concurrency gate, and
// the circuit breaker, none of which are useful unless they are shared.
const engine = createEngineFromEnv(process.env, {
  logger,
  telemetry: (event) => {
    // Failures are operational signal; the rest is volume we only want when
    // someone is actively debugging the pipeline.
    const level = event.type.endsWith('failed') || event.type.includes('breaker') ? 'warn' : 'debug';
    logger[level](`[alter-render] ${event.type}`, event);
  }
});

/**
 * Renders are the most expensive endpoint in the platform by an order of
 * magnitude, so they get their own budget instead of sharing the global
 * 1000-per-15-minutes allowance.
 *
 * Scoped to creation only: polling a job and reading the industry list are
 * cheap, and throttling a poll just makes a slow render look like a broken one.
 */
const renderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.parseInt(process.env.ALTER_RENDER_RATE_LIMIT, 10) || 40,
  message: { error: { code: 'RATE_LIMITED', message: 'Render quota reached, please try again shortly.' } },
  standardHeaders: true,
  legacyHeaders: false
});

const router = express.Router();

router.post('/', renderLimiter);
router.use(createAlterRenderRouter({
  engine,
  onEvent: (event) => logger.info(`[alter-render] ${event.type}`, event)
}));

module.exports = router;
module.exports.engine = engine;
