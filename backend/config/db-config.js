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

  /**
   * Development, on Postgres by default - or on a SQLite file with
   * `DB_CLIENT=sqlite3`.
   *
   * The same reasoning as the test config above, applied one step further out:
   * requiring a running Postgres before `npm run dev` shows anything means a
   * contributor who wants to look at the dashboard has to provision a database
   * first, and in practice they don't - they read the code instead. The
   * migration already works on both engines because the test suite runs on
   * SQLite, so the only thing missing was a way to ask for it.
   *
   * Postgres stays the default, because that is what production runs and a
   * dev/prod split that nobody ever exercises is its own bug factory. This is
   * the "just let me see it" path, not the recommended one.
   */
  development: process.env.DB_CLIENT === 'sqlite3'
    ? {
      client: 'sqlite3',
      connection: {
        filename: process.env.DB_SQLITE_FILE || path.resolve(__dirname, '../dev.sqlite3')
      },
      useNullAsDefault: true,
      pool: {
        min: 1,
        max: 1,
        afterCreate: (conn, done) => conn.run('PRAGMA foreign_keys = ON', done)
      },
      migrations: { directory: MIGRATIONS, tableName: 'knex_migrations' },
      seeds: { directory: SEEDS }
    }
    : {
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

module.exports = config;
