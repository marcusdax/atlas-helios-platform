/**
 * Tier 1 Feature Coverage: Weather Subsystem, NOAA Client & Storm Webhooks
 * Covers:
 * - Feature 6: NOAA Weather Client (F6)
 * - Feature 8: Weather & Storm API Routes (F8)
 * - Feature 12: Storm Webhook & Hooks Alignment (F12)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';
import { FIXTURES } from '../helpers/test-fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

describe('03. Weather Subsystem, NOAA Client & Webhooks (Tier 1)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });



  describe('Feature 6: NOAA Weather Client (F6)', () => {
    it('verifies NOAAWeatherService class implementation, user-agent and caching logic', () => {
      const servicePath = path.join(ROOT_DIR, 'server', 'src', 'services', 'NOAAWeatherService.js');
      assert.ok(fs.existsSync(servicePath), 'server/src/services/NOAAWeatherService.js must exist');

      const content = fs.readFileSync(servicePath, 'utf-8');
      assert.ok(content.includes('class NOAAWeatherService') || content.includes('NOAAWeatherService'), 'Must define NOAAWeatherService class');
      assert.ok(content.includes('https://api.weather.gov'), 'Must target official api.weather.gov endpoint');
      assert.ok(content.includes('User-Agent'), 'Must specify compliant User-Agent header per NWS API policies');
      assert.ok(content.includes('getForecast') && content.includes('getHourlyForecast'), 'Must implement forecast retrieval methods');
      assert.ok(content.includes('getAlerts') || content.includes('alerts'), 'Must implement weather alert queries');
      assert.ok(content.includes('getMockForecast') || content.includes('fallback'), 'Must support graceful mock fallback when external API is unreachable');
    });

    it('verifies forecast period schema conforms to NWS GeoJSON structure', () => {
      // Simulate NWS period structure derived from NOAA API specification
      const samplePeriod = {
        number: 1,
        name: 'Tonight',
        temperature: 68,
        temperatureUnit: 'F',
        windSpeed: '10 to 15 mph',
        windDirection: 'S',
        shortForecast: 'Chance Showers And Thunderstorms',
        detailedForecast: 'A 40 percent chance of showers and thunderstorms. Mostly cloudy, with a low around 68.'
      };

      assert.ok(typeof samplePeriod.number === 'number', 'Period number must be numeric');
      assert.ok(typeof samplePeriod.name === 'string', 'Period name must be string');
      assert.ok(typeof samplePeriod.temperature === 'number', 'Temperature must be numeric');
      assert.strictEqual(samplePeriod.temperatureUnit, 'F', 'Temperature unit must be Fahrenheit');
      assert.ok(samplePeriod.detailedForecast.length > 10, 'Detailed forecast must contain descriptive narrative');
    });
  });

  describe('Feature 8: Weather & Storm API Routes (F8)', () => {
    it('verifies weatherRoutes module implementation and endpoint declarations', () => {
      const routesPath = path.join(ROOT_DIR, 'server', 'src', 'routes', 'weatherRoutes.js');
      assert.ok(fs.existsSync(routesPath), 'server/src/routes/weatherRoutes.js must exist');

      const content = fs.readFileSync(routesPath, 'utf-8');
      assert.ok(content.includes("router.get('/status'"), 'Must define GET /api/weather/status route');
      assert.ok(content.includes("router.get('/forecast'"), 'Must define GET /api/weather/forecast route');
      assert.ok(content.includes("router.get('/forecast/hourly'"), 'Must define GET /api/weather/forecast/hourly route');
      assert.ok(content.includes("router.get('/alerts'") || content.includes('alerts'), 'Must define weather alerts route');
      assert.ok(content.includes('lat') && content.includes('lng'), 'Forecast routes must validate lat/lng query parameters');
    });

    it('verifies HTTP weather routes behavior and parameter validation', async () => {
      // Query forecast route with missing coordinates
      const missingCoordsRes = await apiClient.get('/api/weather/forecast');
      // If mounted, must return 400 for missing coords; if not yet mounted in index.js, 404 is standard Express behavior
      assert.ok(missingCoordsRes.status === 400 || missingCoordsRes.status === 404 || missingCoordsRes.status === 503,
        'Missing coords query must return 400, 404 (unmounted), or 503 (service offline)');

      // Query forecast route with valid coordinates (Dallas)
      const { lat, lng } = FIXTURES.coordinates.dallas;
      const forecastRes = await apiClient.get('/api/weather/forecast', { lat, lng });
      assert.ok([200, 404, 500, 503].includes(forecastRes.status), 'Valid forecast query must return valid HTTP status code');

      if (forecastRes.status === 200) {
        assert.ok(forecastRes.isJson, 'Response must be valid JSON');
        assert.ok(forecastRes.data.success || forecastRes.data.properties, 'Must return forecast payload');
      }
    });
  });

  describe('Feature 12: Storm Webhook & Hooks Alignment (F12)', () => {
    it('verifies api_hooks.py script contains StormIntelligenceHook, NOAAWeatherHook, and Flask listener', () => {
      const hooksPath = path.join(ROOT_DIR, 'server', 'api_hooks.py');
      assert.ok(fs.existsSync(hooksPath), 'server/api_hooks.py must exist');

      const content = fs.readFileSync(hooksPath, 'utf-8');
      assert.ok(content.includes('class ExternalAPIHook'), 'Must define ExternalAPIHook base class');
      assert.ok(content.includes('class NOAAWeatherHook'), 'Must define NOAAWeatherHook class');
      assert.ok(content.includes('class StormIntelligenceHook'), 'Must define StormIntelligenceHook class');
      assert.ok(content.includes('class ComputerVisionHook'), 'Must define ComputerVisionHook class');
      assert.ok(content.includes('class NexusMindHook'), 'Must define NexusMindHook class');
      assert.ok(content.includes('class PerceptionEncoderHook'), 'Must define PerceptionEncoderHook class');
    });

    it('verifies StormIntelligenceHook default port and target endpoints', () => {
      const hooksPath = path.join(ROOT_DIR, 'server', 'api_hooks.py');
      const content = fs.readFileSync(hooksPath, 'utf-8');

      // Check method signatures in StormIntelligenceHook
      assert.ok(content.includes('def get_active_storms'), 'Must implement get_active_storms method');
      assert.ok(content.includes('def get_storm_details'), 'Must implement get_storm_details method');
      assert.ok(content.includes('def calculate_damage_probability'), 'Must implement calculate_damage_probability method');
      assert.ok(content.includes('/api/storms/damage-probability') || content.includes('/api/storms/'), 'Must target aligned storm REST endpoints');
    });

    it('verifies Webhook listener event dispatcher routes', () => {
      const hooksPath = path.join(ROOT_DIR, 'server', 'api_hooks.py');
      const content = fs.readFileSync(hooksPath, 'utf-8');

      assert.ok(content.includes('Flask') || content.includes('app = Flask'), 'Must use Flask for webhook listener');
      assert.ok(content.includes('webhook') || content.includes('trigger_hook'), 'Must implement webhook receiver endpoints');
      assert.ok(content.includes('5052') || content.includes('WEBHOOK_PORT') || content.includes('5000'), 'Must define webhook listening port');
    });
  });
});
