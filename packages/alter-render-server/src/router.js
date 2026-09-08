'use strict';

const { AlterRenderError, CODES } = require('@alter/render-core');
const { MemoryJobStore } = require('./store/memory');

const randomId = () =>
  `rnd_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/**
 * createAlterRenderRouter - mountable Express router for the render pipeline.
 *
 *   app.use('/api/renders', createAlterRenderRouter({ engine, authorize }));
 *
 * A router factory rather than a server, because the host already has one, with
 * its own auth, logging, CORS, and rate limiting. This adds four routes and
 * borrows everything else - which is the difference between a package you can
 * adopt in an afternoon and a service you have to operate.
 *
 * Its real job is to be the only place the vendor API key exists. The client
 * half (`createRenderClient`) has the same render() signature and no key.
 *
 * Options
 *   engine     AlterRenderEngine (required)
 *   store      job store, defaults to in-memory (see store/memory.js)
 *   authorize  async (req) => context | throws; runs before any spend
 *   maxImageChars  reject oversized bodies before parsing them as images
 *   onEvent    (event) => void, for host-side audit logging
 */
function createAlterRenderRouter(options = {}) {
  const {
    engine,
    express: expressModule,
    store = new MemoryJobStore(),
    authorize,
    maxImageChars = 16 * 1024 * 1024,
    onEvent = () => {}
  } = options;

  if (!engine || typeof engine.render !== 'function') {
    throw new Error('createAlterRenderRouter requires an engine with render()');
  }

  // eslint-disable-next-line global-require
  const express = expressModule || require('express');
  const router = express.Router();

  const fail = (res, error) => {
    const err = error instanceof AlterRenderError
      ? error
      : new AlterRenderError(CODES.PROVIDER_ERROR, 'render failed', { status: 500 });
    // Never echo `error.cause` or upstream bodies: they can contain the prompt,
    // the vendor's own error text, and occasionally fragments of credentials.
    return res.status(err.status || 500).json(err.toJSON());
  };

  const guard = (handler) => async (req, res) => {
    try {
      if (authorize) req.alterContext = await authorize(req);
      await handler(req, res);
    } catch (error) {
      onEvent({ type: 'render.route_error', code: error?.code, path: req.path });
      fail(res, error);
    }
  };

  /** Presets, so a client can populate its picker without hardcoding the list. */
  router.get('/industries', guard(async (req, res) => {
    res.json({ industries: engine.listIndustries() });
  }));

  /**
   * POST / - run a render.
   *
   * Synchronous by default: renders take 5-30s, which fits inside a normal
   * request when the proxy allows it, and a single round trip is far simpler
   * for the caller. `?mode=async` returns 202 + a job id for hosts behind a
   * short proxy timeout or doing batch work.
   */
  router.post('/', guard(async (req, res) => {
    const { image, description, industry, copy } = req.body || {};

    if (typeof image === 'string' && image.length > maxImageChars) {
      throw new AlterRenderError(CODES.INVALID_INPUT, 'image payload is too large', { status: 413 });
    }

    // Client-supplied key wins so a retried POST is recognised even if the
    // client re-encoded the JPEG; otherwise the engine derives one from content.
    const idempotencyKey = req.get('Idempotency-Key') || undefined;

    if (idempotencyKey) {
      const existing = await store.findByKey(idempotencyKey);
      if (existing) {
        onEvent({ type: 'render.idempotent_replay', id: existing.id });
        return respondWithJob(res, existing, 200);
      }
    }

    const job = await store.create({
      id: randomId(),
      status: 'rendering',
      idempotencyKey,
      industry,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      result: null,
      error: null
    });

    const work = engine.render({ image, description, industry, copy, idempotencyKey });

    if (req.query.mode === 'async') {
      work
        .then((result) => store.update(job.id, { status: 'done', result }))
        .catch((error) => store.update(job.id, {
          status: 'failed',
          error: { code: error?.code || CODES.PROVIDER_ERROR, message: error?.message }
        }));

      res.status(202)
        .location(`${req.baseUrl}/${job.id}`)
        .json({ id: job.id, status: 'rendering' });
      return undefined;
    }

    try {
      const result = await work;
      await store.update(job.id, { status: 'done', result });
      onEvent({ type: 'render.completed', id: job.id, cached: result.meta?.cached });
      return res.status(200).json(result);
    } catch (error) {
      await store.update(job.id, {
        status: 'failed',
        error: { code: error?.code || CODES.PROVIDER_ERROR, message: error?.message }
      });
      throw error;
    }
  }));

  /** GET /:id - poll an async job, or re-read a completed one. */
  router.get('/:id', guard(async (req, res) => {
    const job = await store.get(req.params.id);
    if (!job) {
      throw new AlterRenderError(CODES.NOT_FOUND, 'render not found or expired', { status: 404 });
    }
    return respondWithJob(res, job, 200);
  }));

  function respondWithJob(res, job, status) {
    if (job.status === 'done' && job.result) return res.status(status).json(job.result);
    if (job.status === 'failed') {
      return res.status(502).json({ error: job.error || { code: CODES.PROVIDER_ERROR, message: 'render failed' } });
    }
    return res.status(status).json({ id: job.id, status: job.status });
  }

  return router;
}

module.exports = { createAlterRenderRouter };
