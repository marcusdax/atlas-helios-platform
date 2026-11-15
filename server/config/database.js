const knex = require('knex');
const path = require('path');

// Database configuration
const config = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'atlas_helios',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      // For debugging - expose connection errors
      connectionTimeoutMillis: 10000,
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: path.join(__dirname, '../migrations'),
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(__dirname, '../seeds')
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
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 20
    },
    migrations: {
      directory: path.join(__dirname, '../migrations'),
      tableName: 'knex_migrations'
    }
  }
};

const environment = process.env.NODE_ENV || 'development';
const db = knex(config[environment]);

// Test connection
db.raw('SELECT 1')
  .then(() => {
    console.log('✅ Database connected successfully');
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
  });

module.exports = db;
module.exports.config = config;
