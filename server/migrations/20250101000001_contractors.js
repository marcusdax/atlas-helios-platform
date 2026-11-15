/**
 * Contractors table for ATLAS-HELIOS
 * Stores contractor profiles for restoration, assessment, and project work
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('contractors', table => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('specialty', 100);
      table.decimal('rating', 3, 2); // 0-5 scale
      table.integer('projects').defaultTo(0);
      table.string('location', 100);
      table.string('availability', 50);
      table.string('insurance', 50);
      table.string('bond', 50);
      table.integer('score').defaultTo(0); // 0-100
      table.text('bio');
      table.string('contact_email');
      table.string('phone');
      table.boolean('verified').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index(['rating']);
      table.index(['score']);
      table.index(['specialty']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('contractors');
};