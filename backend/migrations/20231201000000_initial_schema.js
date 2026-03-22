/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // Companies table (first, as users reference it)
    .createTable('companies', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
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
    })
    
    // Users table
    .createTable('users', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('name').notNullable();
      table.string('email').unique().notNullable();
      table.string('password').notNullable();
      table.enum('role', ['super_admin', 'admin', 'manager', 'user']).defaultTo('user');
      table.uuid('company_id').references('id').inTable('companies').onDelete('SET NULL');
      table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active');
      table.boolean('email_verified').defaultTo(false);
      table.timestamp('last_login_at');
      table.timestamps(true, true);
      
      table.index('email');
      table.index('company_id');
      table.index('status');
    })
    
    // Properties table
    .createTable('properties', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('company_id').references('id').inTable('companies').onDelete('CASCADE');
      table.string('address').notNullable();
      table.string('city').notNullable();
      table.string('state').notNullable();
      table.string('zip_code').notNullable();
      table.decimal('latitude', 10, 8);
      table.decimal('longitude', 11, 8);
      table.enum('property_type', ['residential', 'commercial', 'industrial', 'land']).defaultTo('residential');
      table.integer('year_built');
      table.integer('square_footage');
      table.integer('lot_size');
      table.integer('bedrooms');
      table.decimal('bathrooms', 3, 1);
      table.string('roof_type');
      table.string('construction_type');
      table.decimal('estimated_value', 12, 2);
      table.decimal('last_sale_price', 12, 2);
      table.timestamp('last_sale_date');
      table.string('owner_name');
      table.decimal('tax_assessed_value', 12, 2);
      table.integer('tax_year');
      table.string('data_source');
      table.enum('current_risk_level', ['minimal', 'low', 'moderate', 'high', 'critical']).defaultTo('low');
      table.integer('last_assessment_score');
      table.timestamp('last_assessment_date');
      table.enum('assessment_status', ['none', 'in_progress', 'completed', 'failed']).defaultTo('none');
      table.uuid('last_assessment_id').references('id').inTable('property_assessments').onDelete('SET NULL');
      table.json('metadata');
      table.timestamps(true, true);
      
      table.index(['latitude', 'longitude']);
      table.index('company_id');
      table.index('current_risk_level');
      table.index(['city', 'state']);
      table.index('address');
    })
    
    // Property assessments table
    .createTable('property_assessments', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('property_id').references('id').inTable('properties').onDelete('CASCADE');
      table.uuid('assessor_id').references('id').inTable('users').onDelete('SET NULL');
      table.enum('assessment_type', ['initial', 'follow_up', 'reinspection', 'emergency']).defaultTo('initial');
      table.enum('status', ['scheduled', 'in_progress', 'analyzing', 'completed', 'failed']).defaultTo('scheduled');
      table.integer('overall_score');
      table.integer('damage_score');
      table.enum('risk_level', ['minimal', 'low', 'moderate', 'high', 'critical']);
      table.decimal('estimated_repair_cost', 12, 2);
      table.json('ai_analysis');
      table.json('recommendations');
      table.json('images');
      table.json('metadata');
      table.timestamp('started_at');
      table.timestamp('completed_at');
      table.text('error_message');
      table.timestamps(true, true);
      
      table.index('property_id');
      table.index('assessor_id');
      table.index('status');
      table.index('risk_level');
    })
    
    // Storm events table
    .createTable('storm_events', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('region_id').notNullable();
      table.string('region_name').notNullable();
      table.enum('storm_type', ['hail', 'tornado', 'severe_thunderstorm', 'high_winds', 'flood']).notNullable();
      table.enum('severity', ['minor', 'moderate', 'severe', 'extreme']).notNullable();
      table.json('conditions');
      table.json('center').notNullable(); // {lat, lng}
      table.timestamp('detected_at').notNullable();
      table.timestamp('dissipated_at');
      table.string('estimated_duration');
      table.json('affected_properties'); // Array of property IDs
      table.enum('alert_level', ['info', 'watch', 'warning', 'emergency']).notNullable();
      table.enum('status', ['active', 'dissipated', 'verified']).defaultTo('active');
      table.json('current_conditions');
      table.timestamp('last_update');
      table.json('metadata');
      table.timestamps(true, true);
      
      table.index('region_id');
      table.index('detected_at');
      table.index('status');
      table.index('severity');
    })
    
    // Storm alerts table
    .createTable('storm_alerts', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('storm_event_id').references('id').inTable('storm_events').onDelete('CASCADE');
      table.enum('alert_level', ['info', 'watch', 'warning', 'emergency']).notNullable();
      table.string('message').notNullable();
      table.json('affected_areas');
      table.integer('affected_property_count').defaultTo(0);
      table.boolean('acknowledged').defaultTo(false);
      table.timestamp('acknowledged_at');
      table.uuid('acknowledged_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
      
      table.index('storm_event_id');
      table.index('alert_level');
      table.index('acknowledged');
    })
    
    // Leads table
    .createTable('leads', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('company_id').references('id').inTable('companies').onDelete('CASCADE');
      table.uuid('property_id').references('id').inTable('properties').onDelete('SET NULL');
      table.uuid('storm_event_id').references('id').inTable('storm_events').onDelete('SET NULL');
      table.integer('damage_probability_score').notNullable(); // 0-100
      table.enum('lead_status', ['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost']).defaultTo('new');
      table.string('contact_name');
      table.string('contact_email');
      table.string('contact_phone');
      table.string('assigned_to'); // user ID or team name
      table.timestamp('first_contact_attempt');
      table.timestamp('last_contact_attempt');
      table.json('notes');
      table.json('communications'); // Array of communication records
      table.decimal('estimated_value', 12, 2);
      table.decimal('actual_value', 12, 2);
      table.timestamps(true, true);
      
      table.index('company_id');
      table.index('property_id');
      table.index('storm_event_id');
      table.index('lead_status');
      table.index('damage_probability_score');
      table.index('assigned_to');
    })
    
    // Estimates table
    .createTable('estimates', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('company_id').references('id').inTable('companies').onDelete('CASCADE');
      table.uuid('property_id').references('id').inTable('properties').onDelete('SET NULL');
      table.uuid('lead_id').references('id').inTable('leads').onDelete('SET NULL');
      table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.string('estimate_number').unique().notNullable();
      table.enum('status', ['draft', 'sent', 'approved', 'rejected', 'expired']).defaultTo('draft');
      table.decimal('total_amount', 12, 2);
      table.decimal('labor_cost', 12, 2);
      table.decimal('material_cost', 12, 2);
      table.decimal('overhead', 12, 2);
      table.decimal('profit_margin', 5, 2);
      table.integer('estimated_duration_days');
      table.json('line_items'); // Array of estimate line items
      table.json('photos');
      table.text('notes');
      table.text('terms_conditions');
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
    })
    
    // Monitoring regions table
    .createTable('monitoring_regions', function(table) {
      table.string('id').primary();
      table.string('name').notNullable();
      table.json('center').notNullable(); // {lat, lng}
      table.integer('radius').notNullable(); // miles
      table.json('bounds').notNullable(); // {north, south, east, west}
      table.boolean('active').defaultTo(true);
      table.json('settings');
      table.timestamps(true, true);
      
      table.index('active');
    })
    
    // Refresh tokens table
    .createTable('refresh_tokens', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('token').notNullable().unique();
      table.timestamp('expires_at').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index('user_id');
      table.index('token');
      table.index('expires_at');
    })
    
    // Password resets table
    .createTable('password_resets', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('token').notNullable().unique();
      table.timestamp('expires_at').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index('user_id');
      table.index('token');
      table.index('expires_at');
    })
    
    // System logs table
    .createTable('system_logs', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('level').notNullable(); // info, warn, error
      table.string('message').notNullable();
      table.string('service'); // service name
      table.json('context');
      table.json('metadata');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index('level');
      table.index('service');
      table.index('created_at');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('system_logs')
    .dropTableIfExists('password_resets')
    .dropTableIfExists('refresh_tokens')
    .dropTableIfExists('monitoring_regions')
    .dropTableIfExists('estimates')
    .dropTableIfExists('leads')
    .dropTableIfExists('storm_alerts')
    .dropTableIfExists('storm_events')
    .dropTableIfExists('property_assessments')
    .dropTableIfExists('properties')
    .dropTableIfExists('users')
    .dropTableIfExists('companies');
};