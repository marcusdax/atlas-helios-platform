/**
 * Atlas & Helios initial schema.
 *
 * Three things this migration has to get right that the first draft did not:
 *
 * 1. Creation order. `users` referenced `companies`, and `properties`
 *    referenced `property_assessments`, before either existed. Postgres
 *    resolves foreign keys at DDL time, so the migration aborted on the first
 *    table. Parents are created first, and the one genuinely circular
 *    reference (properties <-> property_assessments) is closed with an ALTER
 *    after both tables exist.
 *
 * 2. UUID generation. `uuid_generate_v4()` lives in the uuid-ossp extension,
 *    which was never created. `gen_random_uuid()` is built into Postgres 13+,
 *    which the README already requires, so there is no extension to install
 *    and no superuser needed to install it.
 *
 * 3. Geographic columns. Storm centres were JSON only, which cannot be
 *    indexed for the viewport queries the map makes on every pan. Latitude and
 *    longitude are stored as real columns alongside the JSON.
 *
 * @param { import("knex").Knex } knex
 */

/** Postgres has gen_random_uuid() built in; SQLite (tests) has no default. */
const uuidPk = (knex, table) => {
  const column = table.uuid('id').primary();
  if (knex.client.config.client !== 'sqlite3') column.defaultTo(knex.raw('gen_random_uuid()'));
  return column;
};

exports.up = async function up(knex) {
  const pg = knex.client.config.client !== 'sqlite3';

  // ---- Level 0: no outbound references ------------------------------------

  await knex.schema.createTable('companies', (table) => {
    uuidPk(knex, table);
    table.string('name').notNullable();
    table.string('address');
    table.string('city');
    table.string('state');
    table.string('zip_code');
    table.string('phone');
    table.string('email');
    table.string('website');
    table.json('settings');
    table.timestamps(true, true);

    table.index('name');
  });

  await knex.schema.createTable('monitoring_regions', (table) => {
    uuidPk(knex, table);
    table.string('name').notNullable();
    table.json('center');
    table.decimal('radius', 8, 2).defaultTo(50);
    table.json('bounds');
    table.boolean('active').defaultTo(true);
    table.json('settings');
    // Regions are registered per company by POST /api/storms/track.
    table.uuid('company_id');
    table.boolean('notify').defaultTo(true);
    table.timestamps(true, true);

    table.index('active');
    table.index('company_id');
  });

  await knex.schema.createTable('storm_events', (table) => {
    uuidPk(knex, table);
    table.string('region_id');
    table.string('region_name');
    table.string('storm_type');
    // The API filters on `event_type`; kept alongside storm_type so either
    // name resolves rather than silently returning nothing.
    table.string('event_type');
    table.enum('severity', ['low', 'moderate', 'high', 'extreme']).defaultTo('moderate');
    table.json('conditions');
    table.json('center');
    // Indexed scalars for viewport queries; the JSON centre stays for detail.
    table.decimal('latitude', 10, 7);
    table.decimal('longitude', 10, 7);
    table.decimal('radius_miles', 8, 2).defaultTo(25);
    table.timestamp('detected_at').defaultTo(knex.fn.now());
    table.timestamp('dissipated_at');
    table.integer('estimated_duration');
    table.integer('affected_properties').defaultTo(0);
    table.string('alert_level');
    table.enum('status', ['active', 'dissipated', 'forecast']).defaultTo('active');
    table.json('current_conditions');
    table.timestamp('last_update');
    table.json('metadata');
    table.timestamps(true, true);

    table.index('region_id');
    table.index('detected_at');
    table.index('status');
    table.index('severity');
    table.index(['latitude', 'longitude']);
  });

  // ---- Level 1: reference the above ---------------------------------------

  await knex.schema.createTable('users', (table) => {
    uuidPk(knex, table);
    table.string('name').notNullable();
    table.string('email').unique().notNullable();
    table.string('password').notNullable();
    // 'agent' and 'inspector' are the two field roles the API authorises on;
    // without them every field user would be refused by RBAC.
    table.enum('role', ['super_admin', 'admin', 'manager', 'agent', 'inspector', 'user']).defaultTo('user');
    table.uuid('company_id').references('id').inTable('companies').onDelete('SET NULL');
    table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active');
    table.boolean('email_verified').defaultTo(false);
    table.boolean('platform_admin').defaultTo(false);
    table.timestamp('last_login_at');
    table.timestamps(true, true);

    table.index('email');
    table.index('company_id');
    table.index('status');
  });

  await knex.schema.createTable('properties', (table) => {
    uuidPk(knex, table);
    table.uuid('company_id').references('id').inTable('companies').onDelete('CASCADE');
    table.string('address').notNullable();
    table.string('city');
    table.string('state');
    table.string('zip_code');
    table.decimal('latitude', 10, 7);
    table.decimal('longitude', 10, 7);
    table.enum('property_type', ['residential', 'commercial', 'industrial', 'multi_family']).defaultTo('residential');
    table.integer('year_built');
    table.integer('square_footage');
    table.decimal('lot_size', 12, 2);
    table.integer('bedrooms');
    table.decimal('bathrooms', 4, 1);
    table.integer('stories');
    table.string('roof_type');
    table.integer('roof_age');
    table.string('construction_type');
    table.decimal('estimated_value', 14, 2);
    table.decimal('last_sale_price', 14, 2);
    table.date('last_sale_date');
    table.string('owner_name');
    table.string('owner_phone');
    table.string('owner_email');
    table.decimal('tax_assessed_value', 14, 2);
    table.integer('tax_year');
    table.string('data_source');
    table.string('current_risk_level');
    // The score Atlas ranks exposure by, and the API filters on.
    table.decimal('damage_probability', 5, 2).defaultTo(0);
    table.decimal('last_assessment_score', 6, 2);
    table.timestamp('last_assessment_date');
    table.string('assessment_status');
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.json('metadata');
    table.timestamps(true, true);

    table.index('company_id');
    table.index('current_risk_level');
    table.index('address');
    table.index('zip_code');
    table.index('damage_probability');
    // Composite, because every map query filters on both at once.
    table.index(['latitude', 'longitude']);
  });

  await knex.schema.createTable('property_assessments', (table) => {
    uuidPk(knex, table);
    table.uuid('property_id').references('id').inTable('properties').onDelete('CASCADE');
    table.uuid('assessor_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('assessment_type').defaultTo('exterior');
    table.enum('status', ['pending', 'processing', 'completed', 'failed', 'needs_review']).defaultTo('pending');
    table.decimal('overall_score', 6, 2);
    table.decimal('damage_score', 6, 2);
    table.string('risk_level');
    table.decimal('estimated_repair_cost', 14, 2);
    table.json('ai_analysis');
    table.json('recommendations');
    table.json('images');
    table.json('metadata');
    table.uuid('storm_event_id').references('id').inTable('storm_events').onDelete('SET NULL');
    table.text('notes');
    // Human review of a model output. Kept beside the AI scores rather than
    // overwriting them: the disagreement is the training label.
    table.uuid('reviewed_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('reviewed_at');
    table.string('reviewed_severity');
    table.text('reviewer_notes');
    table.boolean('confirmed');
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.text('error_message');
    table.timestamps(true, true);

    table.index('property_id');
    table.index('assessor_id');
    table.index('status');
    table.index('risk_level');
  });

  // Closes the properties -> property_assessments cycle now both tables exist.
  await knex.schema.alterTable('properties', (table) => {
    table.uuid('last_assessment_id').references('id').inTable('property_assessments').onDelete('SET NULL');
  });

  await knex.schema.createTable('storm_alerts', (table) => {
    uuidPk(knex, table);
    table.uuid('storm_event_id').references('id').inTable('storm_events').onDelete('CASCADE');
    table.string('alert_level');
    table.text('message');
    table.json('affected_areas');
    table.integer('affected_property_count').defaultTo(0);
    table.boolean('acknowledged').defaultTo(false);
    table.timestamp('acknowledged_at');
    table.uuid('acknowledged_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index('storm_event_id');
    table.index('alert_level');
    table.index('acknowledged');
  });

  await knex.schema.createTable('leads', (table) => {
    uuidPk(knex, table);
    table.uuid('company_id').references('id').inTable('companies').onDelete('CASCADE');
    table.uuid('property_id').references('id').inTable('properties').onDelete('SET NULL');
    table.uuid('storm_event_id').references('id').inTable('storm_events').onDelete('SET NULL');
    table.decimal('damage_probability_score', 5, 2);
    // `status` is what the API and UI speak; lead_status is kept as the
    // historical name so existing reports keep resolving.
    table.enum('status', ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost', 'closed']).defaultTo('new');
    table.string('lead_status');
    table.enum('source', ['storm_alert', 'canvass', 'referral', 'inbound', 'campaign']).defaultTo('storm_alert');
    table.string('contact_name');
    table.string('contact_email');
    table.string('contact_phone');
    table.uuid('assigned_to').references('id').inTable('users').onDelete('SET NULL');
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('first_contact_attempt');
    table.timestamp('last_contact_attempt');
    table.text('notes');
    table.json('communications');
    table.decimal('estimated_value', 14, 2);
    table.decimal('actual_value', 14, 2);
    table.timestamps(true, true);

    table.index('company_id');
    table.index('property_id');
    table.index('storm_event_id');
    table.index('status');
    table.index('damage_probability_score');
    table.index('assigned_to');
  });

  await knex.schema.createTable('estimates', (table) => {
    uuidPk(knex, table);
    table.uuid('company_id').references('id').inTable('companies').onDelete('CASCADE');
    table.uuid('property_id').references('id').inTable('properties').onDelete('CASCADE');
    table.uuid('lead_id').references('id').inTable('leads').onDelete('SET NULL');
    table.uuid('assessment_id').references('id').inTable('property_assessments').onDelete('SET NULL');
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.string('estimate_number');
    table.string('title').defaultTo('Property Restoration Estimate');
    table.enum('status', ['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired']).defaultTo('draft');
    // Every money column is derived from line_items on write, so a total can
    // never disagree with the items a homeowner is looking at.
    table.decimal('subtotal', 14, 2).defaultTo(0);
    table.decimal('overhead', 14, 2).defaultTo(0);
    table.decimal('profit', 14, 2).defaultTo(0);
    table.decimal('tax', 14, 2).defaultTo(0);
    table.decimal('tax_rate', 6, 4).defaultTo(0);
    table.decimal('total', 14, 2).defaultTo(0);
    table.decimal('total_amount', 14, 2);
    table.decimal('labor_cost', 14, 2);
    table.decimal('material_cost', 14, 2);
    table.decimal('profit_margin', 6, 4);
    table.integer('estimated_duration_days');
    table.json('line_items');
    table.json('photos');
    table.text('notes');
    table.text('terms_conditions');
    table.date('valid_until');
    table.timestamp('sent_at');
    table.string('sent_to');
    table.uuid('sent_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('sent_date');
    table.timestamp('response_deadline');
    table.timestamp('approved_date');
    table.timestamps(true, true);

    table.index('company_id');
    table.index('property_id');
    table.index('lead_id');
    table.index('created_by');
    table.index('status');
    table.index('estimate_number');
  });

  await knex.schema.createTable('refresh_tokens', (table) => {
    uuidPk(knex, table);
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.text('token').notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('user_id');
    table.index('token');
    table.index('expires_at');
  });

  await knex.schema.createTable('password_resets', (table) => {
    uuidPk(knex, table);
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.text('token').notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('user_id');
    table.index('token');
    table.index('expires_at');
  });

  await knex.schema.createTable('system_logs', (table) => {
    uuidPk(knex, table);
    table.string('level');
    table.text('message');
    table.string('service');
    table.json('context');
    table.json('metadata');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('level');
    table.index('service');
    table.index('created_at');
  });

  if (pg) {
    // Case-insensitive address search is the single most common query in the
    // product; without this the ILIKE in GET /api/properties is a full scan.
    await knex.raw('CREATE INDEX IF NOT EXISTS properties_address_lower_idx ON properties (LOWER(address))');
  }
};

exports.down = async function down(knex) {
  // Children first, so the same foreign keys that ordered `up` order `down`.
  for (const table of [
    'system_logs', 'password_resets', 'refresh_tokens', 'estimates', 'leads',
    'storm_alerts', 'property_assessments', 'properties', 'users',
    'storm_events', 'monitoring_regions', 'companies'
  ]) {
    // properties holds an FK into property_assessments; drop it first so the
    // assessments table is droppable.
    if (table === 'property_assessments' && await knex.schema.hasColumn('properties', 'last_assessment_id')) {
      await knex.schema.alterTable('properties', (t) => t.dropColumn('last_assessment_id'));
    }
    await knex.schema.dropTableIfExists(table);
  }
};
