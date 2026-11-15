/**
 * HarvestResults table for ATLAS-HELIOS
 * Stores harvested data from spark missions and other sources
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('harvest_results', table => {
      table.increments('id').primary();
      table.integer('mission_id').unsigned().references('id').inTable('spark_missions').onDelete('CASCADE');
      table.string('data_type', 100);
      table.jsonb('data');
      table.decimal('quality_score', 3, 1);
      table.timestamp('harvested_at').defaultTo(knex.fn.now());
      table.string('harvested_by');
      table.string('source');
      
      table.index(['mission_id']);
      table.index(['data_type']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('harvest_results');
};