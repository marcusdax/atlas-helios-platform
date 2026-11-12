const knex = require('knex');
const config = require('./db-config');

/**
 * The live Knex instance every router queries.
 *
 * The per-environment config lives in `./db-config`, which has no side
 * effects, so the Knex CLI can read the same settings through `knexfile.js`
 * without opening a connection pool that then keeps the process alive.
 */
const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

// Initialize Knex
const database = knex(dbConfig);

// Probe the connection at boot so a misconfigured database is obvious in the
// log rather than at the first request. Skipped under test, where an eager
// query would race the migration and keep the process alive after the suite.
if (environment !== 'test') {
  database.raw('SELECT 1')
    .then(() => console.log('✅ Database connection successful'))
    .catch((error) => console.error('❌ Database connection failed:', error.message));
}

module.exports = database;

/**
 * The raw per-environment config, so `knexfile.js` can hand the CLI exactly
 * what the server runs.
 *
 * Attached to the instance rather than exported separately because every
 * existing consumer does `require('../config/database')` and uses the result
 * as a query builder; changing that shape would touch every router.
 */
module.exports.knexConfig = config;