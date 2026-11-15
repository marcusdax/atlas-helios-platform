/**
 * Leads table for ATLAS-HELIOS
 * Stores property inspection leads from the prospect pipeline
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('leads', table => {
      table.increments('id').primary();
      table.string('address', 500).notNullable();
      table.decimal('score', 3, 1).notNullable(); // 0-100
      table.string('roof', 200);
      table.integer('sqft');
      table.string('status', 50);
      table.string('value', 50);
      table.decimal('lat', 10, 8);
      table.decimal('lng', 11, 8);
      table.string('damage_type', 100);
      table.string('last_contact');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index(['score']);
      table.index(['status']);
      table.index(['lat', 'lng']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('leads');
};