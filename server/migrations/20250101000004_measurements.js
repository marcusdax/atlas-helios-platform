/**
 * Measurements table for ATLAS-HELIOS
 * Stores property assessment measurements
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('measurements', table => {
      table.increments('id').primary();
      table.integer('estimate_id').unsigned().references('id').inTable('estimates').onDelete('CASCADE');
      table.decimal('length', 8, 2);
      table.decimal('width', 8, 2);
      table.decimal('height', 8, 2);
      table.decimal('area', 8, 2);
      table.string('notes', 500);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index(['estimate_id']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('measurements');
};