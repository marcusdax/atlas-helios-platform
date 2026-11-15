/**
 * Intel cards table for ATLAS-HELIOS
 * Stores intel card data for dashboard metrics
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('intel_cards', table => {
      table.increments('id').primary();
      table.string('label', 200).notNullable();
      table.string('value', 100);
      table.decimal('delta', 10, 2);
      table.string('icon', 50);
      table.string('color', 50);
      table.json('trend'); // array of trend values
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index(['label']);
      table.index(['value']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('intel_cards');
};