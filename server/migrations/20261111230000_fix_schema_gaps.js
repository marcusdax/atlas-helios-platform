/**
 * Fix schema gaps for frontend compatibility
 * 1. missions.eta: change from timestamp to varchar(50) for display strings like "0.4mi"
 * 2. flywheel: add icon column for emoji display
 * 3. storms: add lat, lng, leads, score, properties, affected_area columns
 */

exports.up = function(knex) {
  return knex.schema
    // Fix missions.eta column type
    .table('missions', table => {
      // no-op: handled by raw SQL below
    })
    .then(() => knex.raw(`
      ALTER TABLE missions
      ALTER COLUMN eta TYPE varchar(50)
      USING eta::text;
    `))
    .then(() => knex.schema.table('flywheel', table => {
      table.string('icon', 16);
    }))
    .then(() => knex.schema.table('storms', table => {
      table.decimal('lat', 10, 8);
      table.decimal('lng', 11, 8);
      table.integer('leads');
      table.decimal('score', 3, 1);
      table.integer('properties');
      table.integer('affected_area');
    }));
};

exports.down = function(knex) {
  return knex.schema
    .table('storms', table => {
      table.dropColumn('lat');
      table.dropColumn('lng');
      table.dropColumn('leads');
      table.dropColumn('score');
      table.dropColumn('properties');
      table.dropColumn('affected_area');
    })
    .table('flywheel', table => {
      table.dropColumn('icon');
    })
    .then(() => knex.raw(`
      ALTER TABLE missions
      ALTER COLUMN eta TYPE timestamp
      USING eta::timestamp;
    `));
};