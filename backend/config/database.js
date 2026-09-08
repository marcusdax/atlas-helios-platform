const knex = require('knex');
const path = require('node:path');

// Absolute, so migrations resolve no matter which directory the process was
// started from. Relative './migrations' silently resolved against the CWD,
// which broke every runner that does not happen to launch from backend/.
const MIGRATIONS = path.resolve(__dirname, '../migrations');
const SEEDS = path.resolve(__dirname, '../seeds');

const config = {
  /**
   * Tests run on an in-memory SQLite database.
   *
   * The alternative is requiring every contributor and every CI job to have a
   * Postgres server before `npm test` does anything, which in practice means
   * the API tests do not get run. The migration is written to work on both.
   */
  test: {
    client: 'sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    // One shared connection: a :memory: database exists per connection, so a
    // pool of two would migrate one of them and query the other.
    pool: {
      min: 1,
      max: 1,
      afterCreate: (conn, done) => conn.run('PRAGMA foreign_keys = ON', done)
    },
    migrations: { directory: MIGRATIONS, tableName: 'knex_migrations' },
    seeds: { directory: SEEDS }
  },

  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'atlas_helios_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: MIGRATIONS,
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: SEEDS
    }
  },
  
  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 2,
      max: 20
    },
    migrations: {
      directory: MIGRATIONS,
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: SEEDS
    }
  }
};

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