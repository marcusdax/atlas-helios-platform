'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  toEpoch, toNumber, countOf, rowsOf, riskBandFor, humanize,
  propertiesLane, stormsLane, assessmentsLane, alertsLane, toLane,
  mergeActivity, composeSnapshot, eventToActivity, mergeSummaryPatch,
  HIGH_RISK_THRESHOLD
} = require('../src/index.js');

const NOW = 1_700_000_000_000;

/* --------------------------------------------------------------- scalars -- */

test('instants normalise to epoch ms from every shape the API emits', () => {
  assert.equal(toEpoch(NOW), NOW);
  assert.equal(toEpoch(new Date(NOW)), NOW);
  assert.equal(toEpoch('2023-11-14T22:13:20.000Z'), NOW);
  assert.equal(toEpoch(null), null);
  assert.equal(toEpoch(''), null);
  assert.equal(toEpoch('not a date'), null);
  assert.equal(toEpoch(new Date('nope')), null);
  assert.equal(toEpoch(NaN), null);
});

test('numbers survive knex returning decimals as strings', () => {
  // SQLite and Postgres disagree about whether DECIMAL comes back as a number
  // or a string. Both have to produce the same tile.
  assert.equal(toNumber('94.50'), 94.5);
  assert.equal(toNumber(94.5), 94.5);
  assert.equal(toNumber(undefined), 0);
  assert.equal(toNumber('abc'), 0);
  assert.equal(toNumber(null, -1), -1);
  assert.equal(toNumber(Infinity), 0);
});

test('a count is the total, not the page size', () => {
  // The original bug this guards: a tile labelled "Total Properties" showing
  // 25 because that is the default page limit.
  assert.equal(countOf({ data: new Array(25).fill({}), meta: { total: 1284, limit: 25 } }), 1284);
  assert.equal(countOf({ features: [{}, {}], meta: { count: 7 } }), 7, 'GeoJSON uses meta.count');
  assert.equal(countOf({ data: [{}, {}] }), 2, 'no meta: the page is all there is');
  assert.equal(countOf([{}, {}, {}]), 3, 'a bare array');
  assert.equal(countOf(null), 0);
  assert.equal(countOf({ meta: { total: 'lots' } }), 0, 'a non-numeric total is not a count');
});

test('rows are found wherever the envelope puts them', () => {
  assert.deepEqual(rowsOf({ data: [1] }), [1]);
  assert.deepEqual(rowsOf({ features: [1] }), [1]);
  assert.deepEqual(rowsOf([1]), [1]);
  assert.deepEqual(rowsOf(undefined), []);
});

test('the risk band matches the threshold the API filters on', () => {
  assert.equal(riskBandFor(HIGH_RISK_THRESHOLD), 'high');
  assert.equal(riskBandFor(HIGH_RISK_THRESHOLD - 1), 'medium');
  assert.equal(riskBandFor(39), 'low');
  assert.equal(riskBandFor(null), 'low');
});

test('enum values are humanised for display', () => {
  assert.equal(humanize('severe_thunderstorm'), 'Severe thunderstorm');
  assert.equal(humanize(''), '');
  assert.equal(humanize(null, 'Storm event'), 'Storm event');
});

/* ----------------------------------------------------------------- lanes -- */

test('the properties lane reads both counts and ranks the dispatch queue', () => {
  const lane = propertiesLane({
    total: { data: [], meta: { total: 1284 } },
    highRisk: {
      meta: { total: 47 },
      data: [
        { id: 'b', address: '3856 Maple Ave', city: 'Dallas', state: 'TX', damage_probability: '87.00', last_assessment_date: '2023-11-14T21:10:00Z' },
        { id: 'a', address: '1247 Oak Ridge Dr', damage_probability: '91.00', last_assessment_score: '94.00' },
        { id: 'c', address: '2109 Pine St', damage_probability: '71.00' }
      ]
    }
  });

  assert.equal(lane.summary.totalProperties, 1284);
  assert.equal(lane.summary.highRiskProperties, 47);
  assert.deepEqual(lane.priorityProperties.map((p) => p.id), ['a', 'b', 'c'], 'worst first');
  assert.equal(lane.priorityProperties[0].score, 94, 'a measured score beats a modelled one');
  assert.equal(lane.priorityProperties[0].risk, 'high');
  assert.equal(lane.priorityProperties[1].timestamp, Date.parse('2023-11-14T21:10:00Z'));
});

test('coordinates are carried, and an ungeocoded row is not placed at 0,0', () => {
  // The map pins these same rows, so the coordinates ride along rather than
  // costing a second read. `Number(null)` is 0 and 0,0 is open ocean off
  // Africa, so an ungeocoded property has to come through as null.
  const lane = propertiesLane({
    highRisk: {
      data: [
        { id: 'a', address: 'geocoded', latitude: '32.7767', longitude: '-96.7970', damage_probability: 90 },
        { id: 'b', address: 'ungeocoded', latitude: null, longitude: '', damage_probability: 80 },
        { id: 'c', address: 'junk coords', latitude: 'north a bit', longitude: 'left', damage_probability: 70 }
      ]
    }
  });

  const [a, b, c] = lane.priorityProperties;
  assert.equal(a.latitude, 32.7767);
  assert.equal(a.longitude, -96.797);
  assert.equal(b.latitude, null);
  assert.equal(b.longitude, null);
  assert.equal(c.latitude, null);
  assert.equal(c.longitude, null);
});

test('a property with no id is dropped rather than rendered without a key', () => {
  const lane = propertiesLane({ highRisk: { data: [{ address: 'nowhere' }, { id: 'x', address: 'somewhere' }] } });
  assert.deepEqual(lane.priorityProperties.map((p) => p.id), ['x']);
});

test('the priority queue honours its limit', () => {
  const data = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, address: `${i} Main St`, damage_probability: i }));
  const lane = propertiesLane({ highRisk: { data } }, { priorityLimit: 3 });
  assert.equal(lane.priorityProperties.length, 3);
  assert.equal(lane.priorityProperties[0].score, 19);
});

test('the storms lane turns rows into readable activity', () => {
  const lane = stormsLane({
    meta: { total: 2 },
    data: [
      { id: 's1', event_type: 'severe_thunderstorm', severity: 'extreme', region_name: 'Dallas County, TX', affected_properties: 47, detected_at: '2023-11-14T22:00:00Z' },
      { id: 's2', storm_type: 'hail', severity: 'moderate', detected_at: '2023-11-14T21:00:00Z' }
    ]
  });

  assert.equal(lane.summary.activeStorms, 2);
  assert.equal(
    lane.activity[0].message,
    'Severe thunderstorm active in Dallas County, TX — 47 properties exposed'
  );
  assert.equal(lane.activity[0].severity, 'error', 'extreme reads as an error');
  assert.equal(lane.activity[1].message, 'Hail active in an unmonitored region');
  assert.equal(lane.activity[1].severity, 'warning');
  assert.equal(lane.activity[0].id, 'storm:s1');
});

test('one exposed property is not "1 properties"', () => {
  const lane = stormsLane({ data: [{ id: 's', event_type: 'hail', affected_properties: 1 }] });
  assert.match(lane.activity[0].message, /1 property exposed$/);
});

test('the assessments lane distinguishes completed from failed', () => {
  const lane = assessmentsLane({
    meta: { total: 18 },
    data: [
      { id: 'a1', status: 'completed', address: '1247 Oak Ridge Dr', overall_score: '94.00', completed_at: '2023-11-14T22:00:00Z' },
      { id: 'a2', status: 'failed', address: '12 Elm St', created_at: '2023-11-14T21:00:00Z' },
      { id: 'a3', status: 'processing', address: '9 Ash Ln', created_at: '2023-11-14T20:00:00Z' }
    ]
  });

  assert.equal(lane.summary.recentAssessments, 18);
  assert.equal(lane.activity[0].message, 'Assessment completed at 1247 Oak Ridge Dr — 94% damage probability');
  assert.equal(lane.activity[0].severity, 'warning', 'a high score is worth noticing');
  assert.equal(lane.activity[1].message, 'Assessment failed at 12 Elm St');
  assert.equal(lane.activity[1].severity, 'error');
  assert.equal(lane.activity[2].message, 'Assessment processing at 9 Ash Ln');
  assert.equal(lane.activity[2].severity, 'info');
});

test('the alerts lane prefers the NWS headline', () => {
  const lane = alertsLane({
    type: 'FeatureCollection',
    meta: { count: 3 },
    features: [
      { properties: { id: 'nws-1', event: 'Severe Thunderstorm Warning', headline: 'Severe Thunderstorm Warning issued for Dallas County', actionable: true, onset: '2023-11-14T22:00:00Z' } },
      { properties: { id: 'nws-2', event: 'Frost Advisory', area: 'Collin County', actionable: false } }
    ]
  });

  assert.equal(lane.summary.weatherAlerts, 3);
  assert.equal(lane.activity[0].message, 'Severe Thunderstorm Warning issued for Dallas County');
  assert.equal(lane.activity[0].severity, 'error');
  assert.equal(lane.activity[1].message, 'Frost Advisory for Collin County', 'composed when there is no headline');
  assert.equal(lane.activity[1].severity, 'warning');
});

test('every lane survives an empty, null or junk payload', () => {
  for (const payload of [undefined, null, {}, { data: null }, 'nonsense', 42]) {
    for (const name of ['properties', 'storms', 'assessments', 'alerts']) {
      const lane = toLane(name, payload);
      assert.ok(lane.summary, `${name} with ${JSON.stringify(payload)} produced no summary`);
      for (const value of Object.values(lane.summary)) assert.equal(typeof value, 'number');
      for (const row of lane.activity || []) assert.equal(typeof row.message, 'string');
    }
  }
});

test('an unknown lane name is a programming error, not a silent empty card', () => {
  assert.throws(() => toLane('weather_vibes', {}), /Unknown dashboard source/);
});

/* --------------------------------------------------------------- compose -- */

test('activity merges newest first and dedupes by id', () => {
  // The scenario: a push lands an assessment row, then the refresh it triggers
  // brings the same assessment back from the history endpoint.
  const pushed = [{ id: 'assessment:a1', type: 'assessment', message: 'pushed copy', timestamp: NOW, severity: 'info' }];
  const fetched = [{ id: 'assessment:a1', type: 'assessment', message: 'fetched copy', timestamp: NOW + 10, severity: 'info' }];
  const older = [{ id: 'storm:s1', type: 'storm', message: 'older', timestamp: NOW - 5000, severity: 'info' }];

  const merged = mergeActivity([pushed, fetched, older]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].message, 'fetched copy', 'the later copy wins');
  assert.equal(merged[1].id, 'storm:s1');
});

test('a copy with no instant never displaces one that has a real timestamp', () => {
  const real = [{ id: 'x', message: 'real', timestamp: NOW }];
  const vague = [{ id: 'x', message: 'vague', timestamp: 0 }];
  assert.equal(mergeActivity([real, vague])[0].message, 'real');
});

test('activity is bounded, and malformed rows are skipped', () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: `e${i}`, message: `m${i}`, timestamp: NOW - i }));
  const merged = mergeActivity([rows, [null, undefined, { message: 'no id' }]], { limit: 5 });
  assert.equal(merged.length, 5);
  assert.equal(merged[0].id, 'e0');
});

test('a lane that is absent contributes nothing, not zero', () => {
  // This is the whole value of DEGRADED: when the alert feed 503s the previous
  // count stays on the card, rather than flipping to a confident "0 alerts"
  // that an operator would read as good news.
  const lanes = {
    properties: propertiesLane({ total: { meta: { total: 1284 } }, highRisk: { meta: { total: 47 } } }),
    alerts: alertsLane({ meta: { count: 3 } })
  };
  const withAlerts = composeSnapshot(lanes, { fetchedAt: NOW });
  assert.equal(withAlerts.summary.weatherAlerts, 3);

  // ...and on the next pass the alert lane failed, so it is simply retained.
  const retained = composeSnapshot({ ...lanes, storms: stormsLane({ meta: { total: 2 } }) }, { fetchedAt: NOW + 1000 });
  assert.equal(retained.summary.weatherAlerts, 3, 'last known, not reset');
  assert.equal(retained.summary.activeStorms, 2);
  assert.equal(retained.summary.totalProperties, 1284);
});

test('an empty compose is a complete, zeroed model rather than a sparse object', () => {
  const snapshot = composeSnapshot({});
  assert.deepEqual(snapshot.summary, {
    totalProperties: 0, activeStorms: 0, highRiskProperties: 0, recentAssessments: 0, weatherAlerts: 0
  });
  assert.deepEqual(snapshot.activity, []);
  assert.deepEqual(snapshot.priorityProperties, []);
  assert.equal(snapshot.fetchedAt, null);
});

/* -------------------------------------------------------------- realtime -- */

test('socket events become activity rows', () => {
  const storm = eventToActivity('storm_alert', {
    id: 's9', type: 'hail', region: 'Tarrant County, TX', severity: 'extreme'
  }, { now: NOW });
  assert.equal(storm.message, 'Hail detected in Tarrant County, TX');
  assert.equal(storm.severity, 'error');
  assert.equal(storm.id, 'storm:s9');
  assert.equal(storm.timestamp, NOW);

  const done = eventToActivity('property_assessment_complete', {
    id: 'a7', propertyAddress: '1247 Oak Ridge Dr', overallScore: 94
  }, { now: NOW });
  assert.equal(done.message, 'Assessment completed at 1247 Oak Ridge Dr — 94% damage probability');
  assert.equal(done.id, 'assessment:a7', 'the same id the history endpoint will produce');

  const leads = eventToActivity('new_leads_generated', { leadCount: 1 }, { now: NOW });
  assert.equal(leads.message, '1 new lead generated');

  assert.equal(eventToActivity('new_leads_generated', { leadCount: 0 }, { now: NOW }), null);
  assert.equal(eventToActivity('system_notification', {}, { now: NOW }), null);
  assert.equal(eventToActivity('something_else', { id: 1 }, { now: NOW }), null);
});

test('a dissipation event is distinct from the alert that created the storm', () => {
  const alert = eventToActivity('storm_alert', { id: 's1', region: 'X' }, { now: NOW });
  const gone = eventToActivity('storm_dissipated', { id: 's1', region_name: 'X' }, { now: NOW });
  assert.notEqual(alert.id, gone.id, 'otherwise the dissipation would overwrite the alert');
});

test('a server summary patch takes only the five known numeric keys', () => {
  const base = { totalProperties: 10, activeStorms: 1, highRiskProperties: 2, recentAssessments: 3, weatherAlerts: 4 };

  const patched = mergeSummaryPatch(base, { activeStorms: 5, weatherAlerts: '7', nonsense: 99 });
  assert.equal(patched.activeStorms, 5);
  assert.equal(patched.weatherAlerts, 7, 'numeric strings are coerced');
  assert.equal(patched.nonsense, undefined, 'unknown keys never reach the model');
  assert.equal(patched.totalProperties, 10, 'untouched keys keep their value');

  for (const hostile of [{ activeStorms: 'lots' }, { activeStorms: NaN }, { activeStorms: -3 }, { activeStorms: null }, null, 'hi']) {
    assert.equal(
      mergeSummaryPatch(base, hostile),
      base,
      `a push of ${JSON.stringify(hostile)} must change nothing at all`
    );
  }
});
