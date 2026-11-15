/**
 * ReconIntel table for ATLAS-HELIOS
 * Stores reconnaissance intelligence data
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('recon_intel', table => {
      table.increments('id').primary();
      table.string('mission_id', 50).notNullable();
      table.string('location', 100);
      table.decimal('lat', 10, 8);
      table.decimal('lng', 11, 8);
      table.string('data_type', 100);
      table.jsonb('data');
      table.timestamp('recorded_at').defaultTo(knex.fn.now());
      table.string('recorded_by');
      
      table.index(['mission_id']);
      table.index(['lat', 'lng']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('recon_intel');
};