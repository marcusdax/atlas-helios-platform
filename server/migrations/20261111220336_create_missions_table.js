/**
 * Create missions table for ATLAS-HELIOS
 * Stores gig economy spark missions (citizen data capture)
 * Frontend interface expects: id (string), addr, type, reward, tier, status, eta, difficulty
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('missions', table => {
      table.increments('db_id').primary();
      table.string('id', 50).notNullable();
      table.string('addr', 500).notNullable();
      table.string('type', 50).notNullable();
      table.decimal('reward', 10, 2).notNullable();
      table.string('tier', 50).notNullable();
      table.string('status', 50).notNullable();
      table.timestamp('eta').defaultTo(knex.fn.now());
      table.string('difficulty', 50).notNullable();
      table.timestamp('completed_at');
      table.string('completed_by');
      table.jsonb('capture_data');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index(['status']);
      table.index(['addr']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('missions');
};