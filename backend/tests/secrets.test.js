'use strict';

/**
 * Sign-in with no JWT_SECRET configured.
 *
 * Why this file exists: it is the one case the rest of the suite cannot see.
 * `tests/auth.test.js` and `tests/api.test.js` both set `JWT_SECRET`
 * themselves, so 64 backend tests passed while every real sign-in answered
 *
 *     500 {"error":"secretOrPrivateKey must have a value"}
 *
 * because `jwt.sign` read `process.env.JWT_SECRET` at the moment it signed and
 * the variable was unset. The server booted, reported healthy, and served
 * every other route — so it read as a server fault rather than a missing
 * setting, and nothing in CI disagreed.
 *
 * This file therefore deletes the variable before loading anything, which is
 * why it has to be a file of its own: the resolution happens once, at require
 * time, and Jest gives each file its own module registry.
 */

process.env.NODE_ENV = 'test';
delete process.env.JWT_SECRET;
delete process.env.JWT_REFRESH_SECRET;

const express = require('express');
const request = require('supertest');

const db = require('../config/database');
const { errorHandler } = require('../src/middleware/errorHandler');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/authRoutes'));
  app.use(errorHandler);
  return app;
}

const app = buildApp();

const account = {
  name: 'Unset Secret',
  email: 'no-secret@example-restoration.test',
  password: 'correct horse battery staple',
  companyName: 'Example Restoration'
};

beforeAll(async () => {
  await db.migrate.latest();
});

afterAll(async () => {
  await db.destroy();
});

describe('with JWT_SECRET unset outside production', () => {
  test('an ephemeral secret is generated and declared as such', () => {
    const secrets = require('../config/secrets');
    expect(secrets.ephemeral).toBe(true);
    expect(secrets.accessSecret).toMatch(/^[0-9a-f]{96}$/);
    // A refresh token must not verify as an access token.
    expect(secrets.refreshSecret).not.toBe(secrets.accessSecret);
  });

  test('registration issues a usable token pair rather than answering 500', async () => {
    const res = await request(app).post('/api/auth/register').send(account).expect(201);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.tokens.refreshToken).toBeTruthy();
  });

  test('sign-in succeeds — the regression that broke every login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
  });

  test('the issued token is accepted by the middleware that verifies it', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(200);

    // Signing and verifying must agree on which secret they used; reading the
    // env var twice happened to, and reading it zero times did not.
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.tokens.accessToken}`)
      .expect(200);

    expect(me.body.data.user.email).toBe(account.email);
  });
});

describe('with JWT_SECRET unset in production', () => {
  test('the server refuses to start rather than invent a signing key', () => {
    jest.resetModules();
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => require('../config/secrets')).toThrow(/JWT_SECRET is not set/);
    } finally {
      process.env.NODE_ENV = previous;
      jest.resetModules();
    }
  });
});
