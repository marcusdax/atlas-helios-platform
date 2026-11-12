'use strict';

/**
 * The auth lifecycle, end to end against a real migrated database.
 *
 * Why this file exists: every database access in `authRoutes.js` addressed its
 * columns in camelCase (`companyId`, `emailVerified`, `createdAt`, `userId`,
 * `expiresAt`) while the migration creates them in snake_case. Register,
 * login, refresh, profile update, email verification and both halves of
 * password reset therefore threw "no such column" on their first query -
 * nobody could create an account or sign in. The one handler that worked,
 * `GET /me`, was also the only one with a test.
 *
 * So these run the whole sequence a real user goes through, on the real schema.
 * A column-name regression fails here immediately.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

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
  name: 'Dana Reyes',
  email: 'dana@example-restoration.test',
  password: 'correct horse battery staple',
  companyName: 'Example Restoration',
  role: 'manager'
};

beforeAll(async () => {
  await db.migrate.latest();
});

afterAll(async () => {
  await db.destroy();
});

describe('registration', () => {
  test('a new account is created, with its company and a usable token pair', async () => {
    const res = await request(app).post('/api/auth/register').send(account).expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(account.email);
    expect(res.body.data.user.companyId).toBeTruthy();
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.tokens.refreshToken).toBeTruthy();

    // The row really landed, in the columns the schema has.
    const row = await db('users').where('email', account.email).first();
    expect(row.company_id).toBe(res.body.data.user.companyId);
    expect(row.status).toBe('active');
    expect(row.password).not.toBe(account.password);

    // And the refresh token was persisted against that user.
    const saved = await db('refresh_tokens').where('user_id', row.id).first();
    expect(saved.token).toBe(res.body.data.tokens.refreshToken);
    expect(saved.expires_at).toBeTruthy();
  });

  test('the company is reused rather than duplicated', async () => {
    await request(app).post('/api/auth/register').send({
      ...account, name: 'Sam Okafor', email: 'sam@example-restoration.test'
    }).expect(201);

    const companies = await db('companies').where('name', account.companyName);
    expect(companies).toHaveLength(1);
  });

  test('a missing field is a 400', async () => {
    await request(app).post('/api/auth/register').send({ email: 'x@y.test' }).expect(400);
  });
});

describe('login', () => {
  test('correct credentials return the user and a token pair', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(200);

    expect(res.body.data.user.email).toBe(account.email);
    expect(res.body.data.user.companyId).toBeTruthy();
    expect(res.body.data.tokens.accessToken).toBeTruthy();

    // Logging in records when, which is one of the columns that did not exist.
    const row = await db('users').where('email', account.email).first();
    expect(row.last_login_at).toBeTruthy();
  });

  test('a wrong password is 401, and says nothing more', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: account.email, password: 'not it' })
      .expect(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  test('an unknown email is the same 401, so accounts cannot be enumerated', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@example.test', password: 'whatever' })
      .expect(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  test('a missing field is a 400', async () => {
    await request(app).post('/api/auth/login').send({ email: account.email }).expect(400);
  });

  test('an inactive account cannot sign in', async () => {
    await db('users').where('email', account.email).update({ status: 'suspended' });
    await request(app).post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(401);
    await db('users').where('email', account.email).update({ status: 'active' });
  });
});

describe('the token the login hands out', () => {
  let tokens;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(200);
    tokens = res.body.data.tokens;
  });

  test('opens /me, with the caller and their company', async () => {
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .expect(200);
    expect(res.body.data.user.email).toBe(account.email);
    expect(res.body.data.user.companyId).toBeTruthy();
  });

  test('refreshes into a new pair', async () => {
    const res = await request(app).post('/api/auth/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect(200);

    // The refresh response carries the new access token directly, not under a
    // `tokens` object the way login does.
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(account.email);
  });

  test('the stored expiry is a comparable instant', async () => {
    // The bug this guards: `expires_at` was given a `Date`, the driver did not
    // serialise it, and the column held the literal text "[object Object]" -
    // so the `> now` filter never matched and no token could be redeemed.
    const rows = await db('refresh_tokens').select('expires_at');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(String(row.expires_at)).not.toBe('[object Object]');
      expect(Number.isNaN(Date.parse(row.expires_at))).toBe(false);
      expect(Date.parse(row.expires_at)).toBeGreaterThan(Date.now());
    }
  });

  test('a refresh token that was never issued is refused', async () => {
    await request(app).post('/api/auth/refresh').send({ refreshToken: 'made up' }).expect(401);
  });

  test('updates a profile', async () => {
    const res = await request(app).put('/api/auth/profile')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .send({ name: 'Dana R. Reyes' })
      .expect(200);
    expect(res.body.data.user.name).toBe('Dana R. Reyes');

    const row = await db('users').where('email', account.email).first();
    expect(row.name).toBe('Dana R. Reyes');
    expect(row.updated_at).toBeTruthy();
  });
});

describe('password reset', () => {
  test('a reset token is issued, stored, and exchanges for a new password', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: account.email }).expect(200);

    const row = await db('users').where('email', account.email).first();
    const reset = await db('password_resets').where('user_id', row.id).orderBy('created_at', 'desc').first();
    expect(reset).toBeTruthy();

    await request(app).post('/api/auth/reset-password')
      .send({ token: reset.token, newPassword: 'a whole new passphrase' })
      .expect(200);

    // The new password works and the old one does not.
    await request(app).post('/api/auth/login')
      .send({ email: account.email, password: 'a whole new passphrase' })
      .expect(200);
    await request(app).post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(401);

    // And the used token is gone, so it cannot be replayed.
    const after = await db('password_resets').where('token', reset.token).first();
    expect(after).toBeUndefined();
  });

  test('an unknown email answers the same either way', async () => {
    const res = await request(app).post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.test' })
      .expect(200);
    expect(res.body.message).toMatch(/If the email exists/);
  });

  test('an invalid reset token is refused', async () => {
    await request(app).post('/api/auth/reset-password')
      .send({ token: 'nope', newPassword: 'irrelevant' })
      .expect(400);
  });
});
