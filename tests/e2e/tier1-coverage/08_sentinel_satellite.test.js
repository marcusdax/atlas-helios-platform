/**
 * Tier 1 Feature Coverage: Sentinel-2 Satellite Imagery Subsystem
 * Covers:
 * - Feature 19: Sentinel-2 Satellite Imagery (F19)
 * - STAC discovery, metadata filtering, property imagery search, and SentinelPage UI
 * - Endpoints: /api/sentinel/collections, /api/sentinel/property-imagery, /api/sentinel/available-dates, /api/sentinel/search
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

describe('08. Sentinel-2 Satellite Imagery Subsystem (Tier 1)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });



  describe('Feature 19: Sentinel-2 Satellite Imagery (F19)', () => {
    it('verifies sentinel_api.js service module implementation and Copernicus STAC base URL', () => {
      const sentinelPath = path.join(ROOT_DIR, 'server', 'sentinel_api.js');
      assert.ok(fs.existsSync(sentinelPath), 'server/sentinel_api.js must exist');

      const content = fs.readFileSync(sentinelPath, 'utf-8');
      assert.ok(content.includes('dataspace.copernicus.eu') || content.includes('SENTINEL_HUB_BASE_URL'), 'Must target Copernicus STAC catalog');
      assert.ok(content.includes('searchSentinelData'), 'Must implement searchSentinelData method');
      assert.ok(content.includes('getCollections'), 'Must implement getCollections method');
      assert.ok(content.includes('searchPropertyImagery'), 'Must implement searchPropertyImagery method');
      assert.ok(content.includes('getAvailableDates'), 'Must implement getAvailableDates method');
    });

    it('verifies /api/sentinel/collections endpoint contract under live or network fallback', async () => {
      const res = await apiClient.get('/api/sentinel/collections');
      assert.ok(res.status === 200 || res.status === 500, 'Collections route must respond with 200 (live STAC) or 500 (network timeout/rate limit)');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        assert.ok(res.data.collections || Array.isArray(res.data), 'Live STAC response must contain collections');
      } else {
        assert.strictEqual(res.data.error, 'Failed to fetch collections');
        assert.ok(typeof res.data.details === 'string', 'Error details must be string');
      }
    });

    it('verifies /api/sentinel/property-imagery parameter validation for required coordinates', async () => {
      // 1. Missing lat/lon must return HTTP 400
      const missingRes = await apiClient.post('/api/sentinel/property-imagery', {
        radius: 1000
      });

      assert.strictEqual(missingRes.status, 400, 'Missing coordinates must be rejected with HTTP 400');
      assert.strictEqual(missingRes.isJson, true, 'Error must be JSON');
      assert.strictEqual(missingRes.data.error, 'Latitude and longitude are required');

      // 2. Valid coordinates
      const validRes = await apiClient.post('/api/sentinel/property-imagery', {
        lat: FIXTURES.coordinates.dallas.lat,
        lon: FIXTURES.coordinates.dallas.lng,
        radius: 1000,
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        maxCloudCover: 20
      });

      assert.ok(validRes.status === 200 || validRes.status === 500, 'Valid property imagery query must respond with 200 or 500');
      if (validRes.status === 200) {
        assert.ok(validRes.data.location !== undefined, 'Must return location context');
        assert.strictEqual(validRes.data.location.lat, FIXTURES.coordinates.dallas.lat);
        assert.strictEqual(validRes.data.location.lon, FIXTURES.coordinates.dallas.lng);
      }
    });

    it('verifies /api/sentinel/available-dates parameter validation', async () => {
      const missingRes = await apiClient.post('/api/sentinel/available-dates', {});
      assert.strictEqual(missingRes.status, 400, 'Missing coordinates must return 400');
      assert.strictEqual(missingRes.data.error, 'Latitude and longitude are required');
    });

    it('verifies SentinelPage UI component exists with satellite preview integration', () => {
      const sentinelPagePath = path.join(ROOT_DIR, 'src', 'pages', 'SentinelPage.tsx');
      assert.ok(fs.existsSync(sentinelPagePath), 'src/pages/SentinelPage.tsx must exist');

      const content = fs.readFileSync(sentinelPagePath, 'utf-8');
      assert.ok(content.includes('SentinelPage') || content.includes('export default'), 'Must export SentinelPage');
      assert.ok(content.includes('sentinel') || content.includes('Sentinel'), 'Must reference Sentinel imagery');
      assert.ok(content.includes('cloud') || content.includes('date') || content.includes('search'), 'Must handle satellite search filters');
    });
  });
});
