/**
 * Estimate line items table for ATLAS-HELIOS
 * Stores detailed line items for estimates/proposals
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('estimate_line_items', table => {
      table.increments('id').primary();
      table.string('code', 50).notNullable();
      table.string('desc', 500).notNullable();
      table.decimal('qty', 12, 4).notNullable(); // quantity
      table.string('unit', 50);
      table.decimal('price', 12, 4).notNullable(); // unit price
      table.decimal('total', 14, 2).notNullable(); // total price
      table.string('category', 100);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index(['code']);
      table.index(['category']);
      table.index(['total']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('estimate_line_items');
};