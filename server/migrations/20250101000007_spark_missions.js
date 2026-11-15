/**
 * SparkMissions table for ATLAS-HELIOS
 * Stores gig economy spark missions (citizen data capture)
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('spark_missions', table => {
      table.increments('id').primary();
      table.string('mission_id', 50).notNullable();
      table.string('property_address', 500);
      table.string('status', 50);
      table.decimal('reward', 10, 2);
      table.decimal('lat', 10, 8);
      table.decimal('lng', 11, 8);
      table.timestamp('eta').defaultTo(knex.fn.now());
      table.string('difficulty', 50);
      table.timestamp('completed_at');
      table.string('completed_by');
      table.jsonb('capture_data');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index(['status']);
      table.index(['lat', 'lng']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('spark_missions');
};