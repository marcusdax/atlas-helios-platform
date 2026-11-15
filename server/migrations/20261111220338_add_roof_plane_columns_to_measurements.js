/**
 * Add roof plane columns to measurements table
 * Frontend interface expects: label, sqft, pitch, color, border, damage
 */

exports.up = function(knex) {
  return knex.schema
    .table('measurements', table => {
      table.string('label', 500);
      table.decimal('sqft', 8, 2);
      table.string('pitch', 50);
      table.string('color', 100);
      table.string('border', 100);
      table.string('damage', 100);
    });
};

exports.down = function(knex) {
  return knex.schema
    .table('measurements', table => {
      table.dropColumn('label');
      table.dropColumn('sqft');
      table.dropColumn('pitch');
      table.dropColumn('color');
      table.dropColumn('border');
      table.dropColumn('damage');
    });
};