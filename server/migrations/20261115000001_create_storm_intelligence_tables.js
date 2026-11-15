/**
 * Migration: Create storm intelligence tables
 * Creates monitoring_regions, storm_events, and storm_alerts tables
 * required by StormService.js
 */

exports.up = async function(knex) {
  const hasMonitoringRegions = await knex.schema.hasTable('monitoring_regions');
  if (!hasMonitoringRegions) {
    await knex.schema.createTable('monitoring_regions', table => {
      table.string('id', 100).primary();
      table.string('name', 255).notNullable();
      table.jsonb('center');
      table.integer('radius');
      table.jsonb('bounds');
      table.timestamps(true, true);
    });
  }

  const hasStormEvents = await knex.schema.hasTable('storm_events');
  if (!hasStormEvents) {
    await knex.schema.createTable('storm_events', table => {
      table.string('id', 100).primary();
      table.string('regionId', 100);
      table.string('regionName', 255);
      table.string('type', 100);
      table.string('severity', 100);
      table.jsonb('conditions');
      table.jsonb('center');
      table.timestamp('detectedAt');
      table.string('estimatedDuration', 100);
      table.jsonb('affectedProperties');
      table.string('alertLevel', 50);
      table.string('status', 50).defaultTo('active');
      table.timestamp('dissipatedAt');
      table.timestamp('lastUpdate');
      table.jsonb('currentConditions');
      table.timestamps(true, true);
    });
  }

  const hasStormAlerts = await knex.schema.hasTable('storm_alerts');
  if (!hasStormAlerts) {
    await knex.schema.createTable('storm_alerts', table => {
      table.string('id', 100).primary();
      table.string('stormEventId', 100);
      table.string('alertLevel', 50);
      table.text('message');
      table.timestamp('createdAt');
      table.boolean('acknowledged').defaultTo(false);
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('storm_alerts');
  await knex.schema.dropTableIfExists('storm_events');
  await knex.schema.dropTableIfExists('monitoring_regions');
};
