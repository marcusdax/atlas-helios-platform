/**
 * Token-signing secrets, resolved once at startup.
 *
 * Until this existed, `process.env.JWT_SECRET` was read inline at the moment a
 * token was signed. With the variable unset that is not a configuration error
 * anyone notices — the server boots, reports healthy, serves every public
 * route, and then answers **500 on every sign-in** with
 * `secretOrPrivateKey must have a value`, which reads as a server fault rather
 * than a missing setting.
 *
 * Worse, the test suite cannot catch it: `tests/auth.test.js` and
 * `tests/api.test.js` set `JWT_SECRET` themselves, so the suite is green while
 * every real login fails. That is the same shape as the `require('uuid')`
 * break — a latent misconfiguration masked by the way it is exercised.
 *
 * So the decision moves to boot time, and differs by environment:
 *
 *   - **Production** refuses to start without `JWT_SECRET`. An auth server with
 *     no signing key should not accept traffic, and it must never invent a key:
 *     a generated default would be a silent, per-instance signing secret, which
 *     is worse than a crash because it looks like it works.
 *
 *   - **Development and test** generate a random ephemeral secret and say so.
 *     Sessions then do not survive a restart — an honest cost, and far better
 *     than a hardcoded fallback that could reach production, or a dev stack
 *     that cannot log in at all until someone guesses which variable is
 *     missing.
 */
const crypto = require('node:crypto');
const logger = require('../src/utils/logger');

const MIN_RECOMMENDED_LENGTH = 32;

const read = (name) => {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
};

const isProduction = process.env.NODE_ENV === 'production';

const configured = read('JWT_SECRET');

let accessSecret;
let ephemeral = false;

if (configured) {
  accessSecret = configured;
  if (configured.length < MIN_RECOMMENDED_LENGTH) {
    // Warned, not refused: an existing deployment running on a short secret
    // should be told, not taken offline by a dependency upgrade.
    logger.warn(
      `JWT_SECRET is only ${configured.length} characters. Use at least ${MIN_RECOMMENDED_LENGTH} ` +
      '(e.g. `openssl rand -hex 32`) — a guessable signing key lets anyone mint a valid session.'
    );
  }
} else if (isProduction) {
  throw new Error(
    'JWT_SECRET is not set. The server will not start in production without a token-signing ' +
    'secret: generate one with `openssl rand -hex 32` and set JWT_SECRET. Refusing to start ' +
    'rather than generate a per-instance secret, which would invalidate every session on ' +
    'restart and differ between instances.'
  );
} else {
  accessSecret = crypto.randomBytes(48).toString('hex');
  ephemeral = true;
  logger.warn(
    'JWT_SECRET is not set — generated a random one for this process. Sign-in works, but every ' +
    'session is invalidated when the server restarts. Set JWT_SECRET (see .env.example) to keep ' +
    'sessions across restarts. This fallback is development-only; production refuses to start.'
  );
}

/*
  Refresh tokens keep the long-standing fallback to the access secret, so an
  existing single-secret deployment is unaffected. When both are generated,
  they are generated separately: a refresh token should not verify as an
  access token.
*/
const configuredRefresh = read('JWT_REFRESH_SECRET');
const refreshSecret = configuredRefresh
  || (ephemeral ? crypto.randomBytes(48).toString('hex') : accessSecret);

module.exports = {
  accessSecret,
  refreshSecret,
  /** True when the secrets were generated for this process and are not durable. */
  ephemeral
};
