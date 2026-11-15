/**
 * heirs table for ATLAS-HELIOS
 * Stores heirs data for probate cases
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('heirs', table => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('relationship', 100).notNullable();
      table.decimal('confidence', 5, 2).notNullable(); // 0-100%
      table.string('status', 50).notNullable();
      table.string('location', 200);
      table.string('contact', 255);
      table.decimal('claimShare', 10, 2); // percentage share
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index(['status']);
      table.index(['confidence']);
      table.index(['name']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('heirs');
};