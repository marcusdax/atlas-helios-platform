/**
 * Project timeline table for ATLAS-HELIOS
 * Stores project phase data for timeline visualization
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('project_timeline', table => {
      table.increments('id').primary();
      table.string('phase', 100).notNullable();
      table.integer('start').notNullable();
      table.integer('duration').notNullable();
      table.string('status', 50).notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index(['start']);
      table.index(['status']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('project_timeline');
};