/**
 * Knex CLI config — the same settings the server runs on.
 *
 * This file used to carry its own copy: `development` only, Postgres only, and
 * a relative `./migrations` directory. That meant `npm run migrate` could
 * point at a different database than the app reads, silently, and it resolved
 * the migrations folder against whatever directory the command was run from -
 * the exact bug `config/database.js` documents having fixed. It also had no
 * `test` or `production` entry, so `knex migrate:latest` in either crashed.
 *
 * `config/db-config` is deliberately the import rather than
 * `config/database`: the latter opens a connection pool on require, which the
 * CLI does not need and which would stop the process from exiting.
 */
require('dotenv').config({ path: `${__dirname}/.env` });

module.exports = require('./config/db-config');
