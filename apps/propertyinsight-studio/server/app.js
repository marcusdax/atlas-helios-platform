import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { AlterRenderError, CODES } from '@alter/render-core';
import { createAssistRouter } from './routes/assist.js';
import { createTextProvider } from './lib/textProvider.js';

// @alter/render-server is CommonJS - it is built to drop into the Express apps
// that already exist in the world, and most of those are CJS.
const require = createRequire(import.meta.url);
const { createAlterRenderRouter, createEngineFromEnv } = require('@alter/render-server');

const root = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(root, '../dist');

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Builds the whole API. A factory rather than a module-level singleton so tests
 * can stand up an isolated instance per case - with its own engine, its own
 * cache and its own rate-limit counters - instead of sharing hidden state.
 */
export function createApp(env = process.env, { logger = console } = {}) {
  const production = env.NODE_ENV === 'production';
  const app = express();

  // Rate limiting reads the client IP; behind a proxy that is X-Forwarded-For.
  // Left at 0 by default because trusting the header when you are *not* behind
  // a proxy lets any caller spoof their way past the quota.
  app.set('trust proxy', int(env.TRUST_PROXY_HOPS, 0));
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: production
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            // Renders arrive as data: URLs; the map panel embeds openstreetmap.org.
            imgSrc: ["'self'", 'data:', 'blob:'],
            frameSrc: ["'self'", 'https://www.openstreetmap.org'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"]
          }
        }
      : false,
    // The OSM embed is a cross-origin iframe; COEP would block it.
    crossOriginEmbedderPolicy: false
  }));
  app.use(compression());

  // Photos are posted as base64 data URLs, which inflate ~4/3 over the file.
  // 25mb comfortably covers the 1600px JPEG the client downscales to.
  app.use(express.json({ limit: env.MAX_BODY_SIZE || '25mb' }));

  const engine = createEngineFromEnv(env, { logger });
  const textProvider = createTextProvider(env);

  const budget = (max) => rateLimit({
    windowMs: int(env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: CODES.RATE_LIMITED, message: 'Quota reached, please try again shortly.' } }
  });

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      offline: textProvider.offline,
      provider: engine.provider.name,
      uptime: Math.round(process.uptime())
    });
  });

  // Image generation is the expensive call; text assist is cheap. Separate
  // budgets so a burst of suggestion clicks cannot exhaust the render quota.
  app.use('/api/renders', budget(int(env.RENDER_RATE_LIMIT, 40)), createAlterRenderRouter({
    engine,
    // Hand the router our own express. Installed from a registry it would
    // resolve express from the consumer's node_modules on its own, but here it
    // is a file: link into ../../packages, whose resolution chain does not
    // reach this app's dependencies. Injecting it removes the guesswork.
    express
  }));
  app.use('/api/assist', budget(int(env.ASSIST_RATE_LIMIT, 200)), createAssistRouter({
    provider: textProvider,
    publicBaseUrl: env.PUBLIC_BASE_URL || ''
  }));

  app.use('/api', (req, res) => {
    res.status(404).json({
      error: { code: CODES.NOT_FOUND, message: `no route for ${req.method} ${req.originalUrl}` }
    });
  });

  // Serve the built SPA when it exists. In dev, Vite serves the client on its
  // own port and proxies here, so a missing dist/ is expected, not fatal.
  if (fs.existsSync(DIST)) {
    app.use(express.static(DIST, { maxAge: production ? '1y' : 0, index: false }));
    app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
  } else {
    app.get('/', (req, res) => {
      res.type('text/plain').send(
        'API is running. The client is not built yet - run `npm run dev` for the dev server, ' +
        'or `npm run build` to produce dist/.'
      );
    });
  }

  // One error boundary. Every layer throws AlterRenderError, so the wire format
  // is a single shape no matter which one failed.
  app.use((error, req, res, next) => {
    const known = error instanceof AlterRenderError;
    if (!known) logger.error?.('[propertyinsight] unhandled error', error);
    res.status(known ? error.status || 500 : 500).json(
      known
        ? error.toJSON()
        // Never surface an unexpected error's message: it can carry upstream
        // response bodies, file paths, or fragments of a credential.
        : { error: { code: CODES.PROVIDER_ERROR, message: 'Something went wrong handling that request.' } }
    );
  });

  app.locals.engine = engine;
  app.locals.textProvider = textProvider;
  return app;
}
