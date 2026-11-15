/**
 * Add hail, wind, time columns to storms table
 * These columns are used by API endpoint /api/recon/storms
 */

exports.up = function(knex) {
  return knex.schema.table('storms', table => {
    table.string('hail', 100);
    table.string('wind', 100);
    table.string('time', 100);
  });
};

exports.down = function(knex) {
  return knex.schema.table('storms', table => {
    table.dropColumn('hail');
    table.dropColumn('wind');
    table.dropColumn('time');
  });
};