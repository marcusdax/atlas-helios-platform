/**
 * Flywheel table for ATLAS-HELIOS
 * Stores flywheel ecosystem metrics and progression data
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('flywheel', table => {
      table.increments('id').primary();
      table.string('step_name', 100).notNullable();
      table.integer('step_order');
      table.text('description');
      table.jsonb('metrics');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index(['step_order']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('flywheel');
};