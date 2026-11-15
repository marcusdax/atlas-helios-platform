/**
 * Probate cases table for ATLAS-HELIOS
 * Stores probate/estate case records queried by /api/probate/cases
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('probate_cases', table => {
      table.increments('id').primary();
      table.string('case_number', 50).notNullable().unique();
      table.string('decedent', 255).notNullable();
      table.string('status', 50).notNullable();
      table.integer('progress').defaultTo(0);
      table.text('notes');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index(['status']);
      table.index(['case_number']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('probate_cases');
};
