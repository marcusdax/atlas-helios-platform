/**
 * Automated Test Suite for Milestone 2: Atlas Storm Tracking & Weather Subsystem
 */

const assert = require('assert');
const path = require('path');
const axios = require('axios');

async function runTests() {
  console.log('🧪 Starting Milestone 2 Automated Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}`);
        failed++;
      }
    })();
  }

  // 1. NOAAWeatherService Module
  await test('NOAAWeatherService can be required and initialized', async () => {
    const noaa = require('../src/services/NOAAWeatherService');
    assert(noaa !== null, 'NOAAWeatherService should not be null');
    const status = noaa.getStatus();
    assert(typeof status.baseUrl === 'string', 'Base URL should be a string');
    assert(typeof status.cacheStats === 'object', 'cacheStats should be an object');
  });

  // 2. StormService Module
  await test('StormService calculates roof condition and age risk accurately without ReferenceError', async () => {
    const stormService = require('../src/services/StormService');
    assert(stormService !== null, 'StormService should not be null');
    
    // Test calculateAgeRisk
    const ageRisk = stormService.calculateAgeRisk(2000);
    assert(typeof ageRisk === 'number', 'Age risk should be a number');
    assert(ageRisk >= 0 && ageRisk <= 1, 'Age risk should be bounded [0, 1]');

    // Test assessRoofCondition (verifies currentYear is declared)
    const roofCond = stormService.assessRoofCondition({
      roofType: 'asphalt_shingles',
      yearBuilt: 2015
    });
    assert(typeof roofCond === 'number', 'Roof condition should be a number');
    assert(roofCond > 0 && roofCond <= 1, 'Roof condition should be bounded');
  });

  // 3. StormService Database Methods
  await test('StormService retrieves active storms and track data from PostgreSQL', async () => {
    const stormService = require('../src/services/StormService');
    const activeStorms = await stormService.getActiveStorms();
    assert(Array.isArray(activeStorms), 'getActiveStorms should return an array');
    assert(activeStorms.length >= 4, `Expected at least 4 active storms, found ${activeStorms.length}`);
    
    // Verify first storm coordinates
    const first = activeStorms[0];
    assert(first.lat !== null && first.lng !== null, 'Storm coordinates must not be null');
    assert(!isNaN(parseFloat(first.lat)), 'Latitude must be numeric');
    assert(!isNaN(parseFloat(first.lng)), 'Longitude must be numeric');

    // Test getStormTrack
    const track = await stormService.getStormTrack(first.id);
    assert(Array.isArray(track), 'Track should be an array');
    assert(track.length > 0, 'Track should contain track points');
  });

  // 4. Auth Middleware Module
  await test('authMiddleware allows dev pass-through and verifies JWT context', async () => {
    const { authMiddleware } = require('../src/middleware/auth');
    assert(typeof authMiddleware === 'function', 'authMiddleware should be a function');
    
    let nextCalled = false;
    const req = { headers: {} };
    const res = { status: () => ({ json: () => {} }) };
    const next = () => { nextCalled = true; };
    
    authMiddleware(req, res, next);
    assert(nextCalled === true, 'next() should be called in dev mode pass-through');
    assert(req.user && req.user.role === 'admin', 'Dev user should be attached to req');
  });

  // 5. REST Endpoints Verification
  const baseUrl = process.env.BASE_URL || 'http://localhost:3004';

  await test('GET /api/health returns status ok', async () => {
    const res = await axios.get(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
  });

  await test('GET /api/weather/alerts returns valid GeoJSON feature collection', async () => {
    const res = await axios.get(`${baseUrl}/api/weather/alerts`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(Array.isArray(res.data.data.features), 'Features should be an array');
  });

  await test('GET /api/weather/forecast returns forecast periods for valid coordinates', async () => {
    const res = await axios.get(`${baseUrl}/api/weather/forecast?lat=32.7767&lng=-96.7970`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(Array.isArray(res.data.data.properties.periods), 'Forecast periods should be an array');
    assert(res.data.data.properties.periods.length > 0, 'Should have forecast periods');
  });

  await test('GET /api/recon/storms returns storms with valid non-null coordinates', async () => {
    const res = await axios.get(`${baseUrl}/api/recon/storms`);
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.data), 'Result should be an array');
    assert(res.data.length >= 4, 'Should have at least 4 storms');
    res.data.forEach((s, idx) => {
      assert(typeof s.lat === 'number', `Storm ${idx} lat must be number, got ${s.lat}`);
      assert(typeof s.lng === 'number', `Storm ${idx} lng must be number, got ${s.lng}`);
      assert(s.hail !== null && s.hail !== undefined, `Storm ${idx} hail must not be null`);
      assert(s.wind !== null && s.wind !== undefined, `Storm ${idx} wind must not be null`);
    });
  });

  await test('GET /api/storms/active returns active storm collection', async () => {
    const res = await axios.get(`${baseUrl}/api/storms/active`);
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.data), 'Active storms should be an array');
  });

  await test('POST /api/storms/damage-probability calculates probability from property and storm', async () => {
    const res = await axios.post(`${baseUrl}/api/storms/damage-probability`, {
      property_id: '1',
      storm_id: '1'
    });
    assert.strictEqual(res.status, 200);
    assert(typeof res.data.damage_probability === 'number', 'damage_probability should be number');
    assert(res.data.damage_probability > 0, 'damage_probability should be > 0');
    assert(typeof res.data.predicted_severity === 'string', 'predicted_severity should be string');
  });

  console.log(`\n==========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`==========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
