/**
 * Initial database schema for ATLAS-HELIOS
 * Creates tables for properties, storms, assessments, and integrations
 */

exports.up = async function(knex) {
  if (await knex.schema.hasTable('properties')) {
    return;
  }
  return knex.schema
    // Properties table
    .createTable('properties', table => {
      table.increments('id').primary();
      table.string('address').notNullable();
      table.string('city').notNullable();
      table.string('state', 2).notNullable();
      table.string('zip_code', 10).notNullable();
      table.decimal('latitude', 10, 8);
      table.decimal('longitude', 11, 8);
      table.integer('year_built');
      table.integer('square_feet');
      table.string('roof_type');
      table.enum('property_type', ['residential', 'commercial', 'industrial']).defaultTo('residential');
      table.jsonb('metadata');
      table.timestamps(true, true);
      
      // Indexes
      table.index(['latitude', 'longitude']);
      table.index(['state', 'city']);
    })
    
    // Storms table
    .createTable('storms', table => {
      table.increments('id').primary();
      table.string('storm_id').unique().notNullable();
      table.string('name').notNullable();
      table.enum('type', ['hurricane', 'tornado', 'hail', 'flood', 'wildfire', 'other']).notNullable();
      table.enum('severity', ['low', 'moderate', 'high', 'extreme']).notNullable();
      table.timestamp('start_date');
      table.timestamp('end_date');
      table.jsonb('affected_areas');
      table.jsonb('track_data');
      table.decimal('max_wind_speed', 5, 2);
      table.decimal('max_hail_size', 4, 2);
      table.timestamps(true, true);
      
      table.index(['storm_id']);
      table.index(['type', 'severity']);
    })
    
    // Storm impacts table
    .createTable('storm_impacts', table => {
      table.increments('id').primary();
      table.integer('storm_id').unsigned().references('id').inTable('storms').onDelete('CASCADE');
      table.integer('property_id').unsigned().references('id').inTable('properties').onDelete('CASCADE');
      table.decimal('damage_probability', 3, 2);
      table.decimal('estimated_damage_cost', 12, 2);
      table.enum('damage_type', ['roof', 'structural', 'flood', 'wind', 'hail', 'fire']);
      table.enum('severity', ['none', 'minor', 'moderate', 'severe', 'total']);
      table.text('assessment_notes');
      table.timestamps(true, true);
      
      table.unique(['storm_id', 'property_id']);
      table.index(['property_id']);
    })
    
    // Assessments table
    .createTable('assessments', table => {
      table.increments('id').primary();
      table.integer('property_id').unsigned().references('id').inTable('properties').onDelete('CASCADE');
      table.integer('storm_id').unsigned().references('id').inTable('storms').onDelete('SET NULL');
      table.enum('status', ['pending', 'in_progress', 'completed', 'cancelled']).defaultTo('pending');
      table.timestamp('scheduled_date');
      table.timestamp('completed_date');
      table.jsonb('damage_report');
      table.jsonb('images');
      table.decimal('total_estimate', 12, 2);
      table.text('notes');
      table.timestamps(true, true);
      
      table.index(['property_id']);
      table.index(['status']);
    })
    
    // Integration logs table
    .createTable('integration_logs', table => {
      table.increments('id').primary();
      table.string('integration_name').notNullable();
      table.enum('level', ['info', 'warning', 'error']).defaultTo('info');
      table.text('message');
      table.jsonb('data');
      table.decimal('latency_ms', 8, 2);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index(['integration_name']);
      table.index(['created_at']);
    })
    
    // Weather data cache table
    .createTable('weather_cache', table => {
      table.increments('id').primary();
      table.string('location_key').notNullable();
      table.jsonb('data').notNullable();
      table.timestamp('expires_at').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.unique(['location_key']);
      table.index(['expires_at']);
    })
    
    // Users table (for authentication)
    .createTable('users', table => {
      table.increments('id').primary();
      table.string('email').unique().notNullable();
      table.string('password_hash').notNullable();
      table.string('first_name');
      table.string('last_name');
      table.enum('role', ['admin', 'contractor', 'adjuster', 'viewer']).defaultTo('viewer');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('last_login');
      table.timestamps(true, true);
      
      table.index(['email']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('users')
    .dropTableIfExists('weather_cache')
    .dropTableIfExists('integration_logs')
    .dropTableIfExists('assessments')
    .dropTableIfExists('storm_impacts')
    .dropTableIfExists('storms')
    .dropTableIfExists('properties');
};
