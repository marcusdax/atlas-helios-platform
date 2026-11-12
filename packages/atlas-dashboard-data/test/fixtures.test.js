'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { DATA_STATES, deriveState, describeState } = require('../src/index.js');
const { dashboardFixtures, stateInputsOf, REFERENCE_NOW } = require('../src/fixtures.js');

/**
 * The fixtures back the Storybook gallery and the component tests, so they are
 * the one place where a "state" is asserted by hand rather than derived. These
 * tests feed each fixture's own inputs back through the real state machine and
 * check the answer, which is what stops a story labelled DEGRADED from quietly
 * drifting into showing something the app would never call DEGRADED.
 */

const fixtures = dashboardFixtures();

test('every lifecycle state has a fixture', () => {
  for (const state of Object.values(DATA_STATES)) {
    assert.ok(fixtures[state], `no fixture for ${state}`);
  }
});

test('each fixture derives the state it claims', () => {
  for (const [name, view] of Object.entries(fixtures)) {
    const derived = deriveState(stateInputsOf(view, REFERENCE_NOW));
    assert.equal(derived, view.state, `fixture ${name} claims ${view.state} but derives ${derived}`);
  }
});

test('each fixture is shaped like a real view', () => {
  for (const [name, view] of Object.entries(fixtures)) {
    assert.equal(typeof view.description, 'string', `${name} needs a description for the story`);
    assert.ok(describeState(view.state).label, `${name} has an undescribable state`);

    for (const key of ['totalProperties', 'activeStorms', 'highRiskProperties', 'recentAssessments', 'weatherAlerts']) {
      assert.equal(typeof view.summary[key], 'number', `${name}.summary.${key} must be a number`);
    }
    assert.ok(Array.isArray(view.activity), `${name}.activity must be an array`);
    assert.ok(Array.isArray(view.priorityProperties));
    assert.ok(Array.isArray(view.forecast), `${name}.forecast must be an array`);
    assert.ok(
      view.forecastSource === null || view.forecastSource === 'nws' || view.forecastSource === 'mock',
      `${name}.forecastSource must be nws, mock or null`
    );
    for (const point of view.forecast) {
      assert.equal(typeof point.time, 'number', 'forecast instants are epoch ms');
      assert.ok(point.precipitationProbability >= 0 && point.precipitationProbability <= 100);
    }
    assert.ok(Array.isArray(view.failedSources));
    assert.ok(view.fetchedAt === null || typeof view.fetchedAt === 'number');

    for (const event of view.activity) {
      assert.equal(typeof event.id, 'string');
      assert.equal(typeof event.message, 'string');
      assert.equal(typeof event.timestamp, 'number', 'instants are epoch ms, never Dates');
      assert.ok(['info', 'warning', 'error'].includes(event.severity));
    }
    for (const property of view.priorityProperties) {
      assert.equal(typeof property.score, 'number');
      assert.ok(['low', 'medium', 'high'].includes(property.risk));
    }
  }
});

test('the failed-source list agrees with the source report', () => {
  for (const [name, view] of Object.entries(fixtures)) {
    const failed = Object.entries(view.sources)
      .filter(([, s]) => s.at !== null && !s.ok)
      .map(([source]) => source);
    assert.deepEqual([...view.failedSources].sort(), failed.sort(), `${name} misreports its failures`);
  }
});

test('fixtures are deterministic, so a story is not a moving target', () => {
  assert.deepEqual(dashboardFixtures(), dashboardFixtures());
});

test('fixtures can be re-based onto another instant for a live-looking story', () => {
  const now = Date.parse('2030-01-01T00:00:00Z');
  const rebased = dashboardFixtures({ now });
  assert.equal(rebased[DATA_STATES.LIVE].fetchedAt, now - 8_000);
  assert.equal(deriveState(stateInputsOf(rebased[DATA_STATES.LIVE], now)), DATA_STATES.LIVE);
});

test('the DEGRADED fixture keeps a last-known count rather than a zero', () => {
  // The point of the state: a failed alert lane must not read as "no weather".
  const degraded = fixtures[DATA_STATES.DEGRADED];
  assert.equal(degraded.failedSources.includes('alerts'), true);
  assert.ok(degraded.summary.weatherAlerts > 0, 'a confident zero here would be a lie');
});

test('the EMPTY fixture is a healthy tenant with nothing on file', () => {
  const empty = fixtures.EMPTY;
  assert.equal(empty.state, DATA_STATES.LIVE);
  assert.equal(empty.summary.totalProperties, 0);
  assert.deepEqual(empty.activity, []);
  assert.deepEqual(empty.failedSources, [], 'otherwise it is indistinguishable from an outage');
});
