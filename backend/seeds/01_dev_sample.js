'use strict';

/**
 * A development dataset, so `npm run dev` shows a working product.
 *
 * This is not the mock data the dashboard spent three commits removing. The
 * difference is where it lives: these are rows in a real database, read
 * through the real API by the real data layer. Delete them and the dashboard
 * honestly shows an empty tenant; stop the backend and it honestly shows
 * OFFLINE. Nothing here is substituted for a failed request.
 *
 *   DB_CLIENT=sqlite3 npm run migrate && DB_CLIENT=sqlite3 npm run seed
 *
 * Sign in with dev@atlashelios.test / atlas-dev-password.
 *
 * The addresses are fictional and the coordinates sit inside the Dallas metro
 * monitoring region, so the map, the dispatch queue and the forecast all
 * describe the same place.
 */

const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');

const iso = (offsetMinutes = 0) => new Date(Date.now() + offsetMinutes * 60_000).toISOString();

/** Fictional streets, real-ish geography: a spread across the DFW metroplex. */
const PROPERTIES = [
  ['1247 Oak Ridge Dr', 'Dallas', '75201', 32.7767, -96.7970, 94, 'high', 412000],
  ['3856 Maple Ave', 'Dallas', '75219', 32.8012, -96.8104, 87, 'high', 358000],
  ['2109 Pine Street', 'Irving', '75061', 32.8140, -96.9489, 79, 'high', 295000],
  ['884 Cedar Hollow Ct', 'Plano', '75024', 33.0198, -96.6989, 72, 'high', 521000],
  ['5510 Birchwood Ln', 'Garland', '75040', 32.9126, -96.6389, 68, 'medium', 268000],
  ['77 Juniper Bend', 'Richardson', '75080', 32.9483, -96.7299, 61, 'medium', 334000],
  ['4402 Sycamore Row', 'Arlington', '76011', 32.7357, -97.1081, 55, 'medium', 247000],
  ['9183 Alder Gate', 'Frisco', '75034', 33.1507, -96.8236, 48, 'medium', 612000],
  ['321 Hawthorn Walk', 'Mesquite', '75149', 32.7668, -96.5992, 37, 'low', 198000],
  ['6650 Linden Park', 'Carrollton', '75006', 32.9537, -96.8903, 29, 'low', 289000],
  ['118 Magnolia Rise', 'Grand Prairie', '75050', 32.7459, -96.9978, 22, 'low', 231000],
  // No coordinates: the map must drop it rather than pin it at 0,0, and the
  // queue must show it as "not yet assessed" rather than "0 min ago".
  ['4 Unsurveyed Way', 'Dallas', '75207', null, null, 76, 'high', 305000]
];

exports.seed = async function seed(knex) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed sample data into production.');
  }

  // Children first, so the foreign keys that order inserts also order deletes.
  for (const table of ['property_assessments', 'storm_alerts', 'properties',
    'storm_events', 'monitoring_regions', 'refresh_tokens', 'password_resets', 'users', 'companies']) {
    await knex(table).del();
  }

  const companyId = randomUUID();
  await knex('companies').insert({
    id: companyId,
    name: 'Lone Star Restoration',
    city: 'Dallas',
    state: 'TX',
    phone: '214-555-0100',
    email: 'dispatch@lonestar.test',
    created_at: iso(),
    updated_at: iso()
  });

  await knex('users').insert({
    id: randomUUID(),
    name: 'Dev Operator',
    email: 'dev@atlashelios.test',
    password: await bcrypt.hash('atlas-dev-password', 10),
    role: 'manager',
    company_id: companyId,
    status: 'active',
    email_verified: true,
    created_at: iso(),
    updated_at: iso()
  });

  /**
   * The region the dashboard forecasts for.
   *
   * `monitoring_regions` is what the forecast lane reads to decide which point
   * to ask NOAA about, so without one the chart correctly says there is
   * nowhere to forecast for.
   */
  await knex('monitoring_regions').insert({
    // The same stable id StormService uses for its built-in default, so the
    // upsert it runs on boot merges into this row instead of adding a second
    // "Dallas Metro Area" beside it.
    id: 'dallas_metro',
    name: 'Dallas Metro Area',
    center: JSON.stringify({ lat: 32.7767, lng: -96.7970 }),
    radius: 50,
    bounds: JSON.stringify({ north: 33.2, south: 32.2, east: -96.2, west: -97.4 }),
    active: true,
    notify: true,
    created_at: iso(),
    updated_at: iso()
  });

  const propertyRows = PROPERTIES.map(([address, city, zip, lat, lng, risk, band, value]) => ({
    id: randomUUID(),
    company_id: companyId,
    address,
    city,
    state: 'TX',
    zip_code: zip,
    latitude: lat,
    longitude: lng,
    property_type: 'residential',
    year_built: 1985 + (risk % 30),
    square_footage: 1600 + risk * 12,
    roof_type: risk > 70 ? 'asphalt_shingle' : 'architectural_shingle',
    roof_age: Math.max(1, Math.round(risk / 4)),
    stories: risk > 60 ? 2 : 1,
    estimated_value: value,
    owner_name: `Owner of ${address}`,
    current_risk_level: band,
    damage_probability: risk,
    // The ungeocoded one has never been assessed, which the UI has to say.
    last_assessment_score: lat === null ? null : risk,
    last_assessment_date: lat === null ? null : iso(-risk * 3),
    assessment_status: lat === null ? 'pending' : 'completed',
    data_source: 'dev_seed',
    created_at: iso(-60 * 24 * 30),
    updated_at: iso()
  }));
  await knex('properties').insert(propertyRows);

  await knex('storm_events').insert([
    {
      id: randomUUID(),
      region_name: 'Dallas County, TX',
      storm_type: 'thunderstorm',
      event_type: 'severe_thunderstorm',
      severity: 'extreme',
      center: JSON.stringify({ lat: 32.7767, lng: -96.7970 }),
      latitude: 32.7767,
      longitude: -96.7970,
      radius_miles: 25,
      detected_at: iso(-35),
      affected_properties: 47,
      alert_level: 'warning',
      status: 'active',
      created_at: iso(-35),
      updated_at: iso(-5)
    },
    {
      id: randomUUID(),
      region_name: 'Tarrant County, TX',
      storm_type: 'hail',
      event_type: 'hail',
      severity: 'moderate',
      center: JSON.stringify({ lat: 32.7555, lng: -97.3308 }),
      latitude: 32.7555,
      longitude: -97.3308,
      radius_miles: 18,
      detected_at: iso(-95),
      affected_properties: 23,
      alert_level: 'watch',
      status: 'active',
      created_at: iso(-95),
      updated_at: iso(-10)
    }
  ]);

  // Recent assessments, which is what the activity feed and the 24h count read.
  const assessed = propertyRows.filter((p) => p.latitude !== null).slice(0, 6);
  await knex('property_assessments').insert(assessed.map((property, i) => ({
    id: randomUUID(),
    property_id: property.id,
    assessment_type: 'exterior',
    status: i === 5 ? 'failed' : 'completed',
    overall_score: i === 5 ? null : property.damage_probability,
    damage_score: i === 5 ? null : property.damage_probability - 4,
    risk_level: property.current_risk_level,
    estimated_repair_cost: i === 5 ? null : 4800 + property.damage_probability * 180,
    error_message: i === 5 ? 'Vision pass timed out' : null,
    started_at: iso(-(i + 1) * 47 - 3),
    completed_at: i === 5 ? null : iso(-(i + 1) * 47),
    created_at: iso(-(i + 1) * 47 - 3),
    updated_at: iso(-(i + 1) * 47)
  })));

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${propertyRows.length} properties, 2 active storms, ${assessed.length} assessments ` +
    'for Lone Star Restoration. Sign in: dev@atlashelios.test / atlas-dev-password'
  );
};
