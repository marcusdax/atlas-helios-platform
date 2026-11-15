/**
 * Estimates table for ATLAS-HELIOS
 * Stores restoration estimates with line items
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('estimates', table => {
      table.increments('id').primary();
      table.integer('lead_id').unsigned().references('id').inTable('leads').onDelete('CASCADE');
      table.decimal('subtotal', 12, 2);
      table.decimal('tax', 12, 2);
      table.decimal('total', 12, 2);
      table.string('status', 50);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index(['lead_id']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('estimates');
};