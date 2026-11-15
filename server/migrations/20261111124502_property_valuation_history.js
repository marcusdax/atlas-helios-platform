/**
 * Property valuation history table for ATLAS-HELIOS
 * Stores historical property valuation data
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('property_valuation_history', table => {
      table.increments('id').primary();
      table.string('month', 20).notNullable();
      table.decimal('value', 10, 2).notNullable(); // property value
      table.decimal('low', 10, 2).notNullable();   // low value
      table.decimal('high', 10, 2).notNullable(); // high value
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.unique(['month']);
      table.index(['month']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('property_valuation_history');
};