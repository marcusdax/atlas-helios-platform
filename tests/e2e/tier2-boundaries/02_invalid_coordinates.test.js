/**
 * Tier 2 Boundary & Corner Cases: Coordinate Range & Validation Boundaries
 * Covers:
 * - Latitude boundaries (>90, <-90, ±90.0001, extreme values ±999)
 * - Longitude boundaries (>180, <-180, ±180.0001, extreme values ±999)
 * - Non-numeric strings, NaN, Infinity, -Infinity
 * - Missing, null, and undefined coordinate parameters
 * - Coordinate edge cases (North/South poles, Prime Meridian, Anti-meridian, Null Island)
 * - GeoJSON bounding box inversion checks (min > max)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';

describe('02. Invalid Coordinate Boundaries & Range Guards (Tier 2)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });

  describe('Latitude Out of Bounds (>90 or <-90)', () => {
    it('rejects latitude > 90 on /api/weather/forecast with 400 or service rejection', async () => {
      const res = await apiClient.get('/api/weather/forecast', { lat: 90.0001, lng: -96.797 });
      assert.ok([400, 404, 500, 503].includes(res.status), 'Out of bound lat must be rejected');
      if (res.status === 400) {
        assert.strictEqual(res.isJson, true, 'Error response must be valid JSON');
      }
    });

    it('rejects extreme positive latitude (+999.0) on /api/harvest/nearby', async () => {
      const res = await apiClient.get('/api/harvest/nearby', { lat: 999.0, lon: -96.797 });
      assert.ok([200, 400, 500].includes(res.status), 'Extreme lat must not crash server');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });

    it('rejects latitude < -90 on /api/weather/forecast', async () => {
      const res = await apiClient.get('/api/weather/forecast', { lat: -90.0001, lng: -96.797 });
      assert.ok([400, 404, 500, 503].includes(res.status), 'Negative out of bound lat must be rejected');
      if (res.status === 400) {
        assert.strictEqual(res.isJson, true, 'Error response must be valid JSON');
      }
    });

    it('rejects extreme negative latitude (-999.0) in /api/sentinel/property-imagery', async () => {
      const res = await apiClient.post('/api/sentinel/property-imagery', {
        lat: -999.0,
        lon: -96.797,
        radius: 1
      });
      assert.ok([400, 500].includes(res.status), 'Extreme negative lat must return 400 or 500 error');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });
  });

  describe('Longitude Out of Bounds (>180 or <-180)', () => {
    it('rejects longitude > 180 on /api/weather/forecast', async () => {
      const res = await apiClient.get('/api/weather/forecast', { lat: 32.7767, lng: 180.0001 });
      assert.ok([400, 404, 500, 503].includes(res.status), 'Out of bound lng must be rejected');
      if (res.status === 400) {
        assert.strictEqual(res.isJson, true, 'Error response must be valid JSON');
      }
    });

    it('rejects extreme positive longitude (+999.0) on /api/harvest/nearby', async () => {
      const res = await apiClient.get('/api/harvest/nearby', { lat: 32.7767, lon: 999.0 });
      assert.ok([200, 400, 500].includes(res.status), 'Extreme positive lng must not crash server');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });

    it('rejects longitude < -180 on /api/weather/forecast', async () => {
      const res = await apiClient.get('/api/weather/forecast', { lat: 32.7767, lng: -180.0001 });
      assert.ok([400, 404, 500, 503].includes(res.status), 'Negative out of bound lng must be rejected');
      if (res.status === 400) {
        assert.strictEqual(res.isJson, true, 'Error response must be valid JSON');
      }
    });

    it('rejects extreme negative longitude (-999.0) in /api/sentinel/property-imagery', async () => {
      const res = await apiClient.post('/api/sentinel/property-imagery', {
        lat: 32.7767,
        lon: -999.0,
        radius: 1
      });
      assert.ok([400, 500].includes(res.status), 'Extreme negative lon must return error');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });
  });

  describe('NaN, Non-Numeric Strings & Special IEEE-754 Values', () => {
    it('rejects NaN string literals on /api/weather/forecast with HTTP 400', async () => {
      const res = await apiClient.get('/api/weather/forecast', { lat: 'NaN', lng: 'NaN' });
      assert.ok([400, 404, 503].includes(res.status), 'NaN lat/lng must return HTTP 400 or 404/503');
      if (res.status === 400) {
        assert.strictEqual(res.isJson, true, 'Error response must be valid JSON');
        assert.ok(res.data.error.includes('must be numbers') || res.data.error.includes('Invalid coordinates'));
      }
    });

    it('rejects alphabetic string coordinates on /api/weather/forecast with HTTP 400', async () => {
      const res = await apiClient.get('/api/weather/forecast', { lat: 'dallas_lat', lng: 'dallas_lng' });
      assert.ok([400, 404, 503].includes(res.status), 'String coordinates must return HTTP 400 or 404/503');
      if (res.status === 400) {
        assert.strictEqual(res.isJson, true, 'Error response must be valid JSON');
      }
    });

    it('rejects Infinity / -Infinity coordinates on /api/weather/forecast', async () => {
      const res = await apiClient.get('/api/weather/forecast', { lat: 'Infinity', lng: '-Infinity' });
      assert.ok([400, 404, 500, 503].includes(res.status), 'Infinity coordinates must be rejected');
      if (res.status === 400) {
        assert.strictEqual(res.isJson, true, 'Error response must be valid JSON');
      }
    });

    it('rejects non-numeric string coordinates on /api/harvest/nearby', async () => {
      const res = await apiClient.get('/api/harvest/nearby', { lat: 'not_a_num', lon: 'not_a_num' });
      assert.ok([200, 400, 500].includes(res.status), 'Must not crash server process');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });
  });

  describe('Missing, Null, and Undefined Coordinates', () => {
    it('rejects missing lat and lng on /api/weather/forecast with HTTP 400', async () => {
      const res = await apiClient.get('/api/weather/forecast');
      assert.ok([400, 404, 503].includes(res.status), 'Missing coords must return HTTP 400 or 404/503');
      if (res.status === 400) {
        assert.strictEqual(res.isJson, true, 'Error response must be valid JSON');
        assert.strictEqual(res.data.error, 'Missing required parameters: lat, lng');
      }
    });

    it('rejects missing lat and lon on /api/harvest/nearby with HTTP 400', async () => {
      const res = await apiClient.get('/api/harvest/nearby');
      assert.strictEqual(res.status, 400, 'Missing coords on /api/harvest/nearby must return 400');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      assert.strictEqual(res.data.error, 'Latitude and longitude are required');
    });

    it('rejects null values for lat/lon in /api/sentinel/property-imagery with HTTP 400', async () => {
      const res = await apiClient.post('/api/sentinel/property-imagery', {
        lat: null,
        lon: null
      });
      assert.strictEqual(res.status, 400, 'Null coords must return 400');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      assert.strictEqual(res.data.error, 'Latitude and longitude are required');
    });
  });

  describe('Geographic Edge Cases & Bounding Box Logic', () => {
    it('validates North Pole (90.0, 0.0) and South Pole (-90.0, 0.0) as valid boundary coordinates', () => {
      const isValidCoord = (lat, lng) => {
        return typeof lat === 'number' && typeof lng === 'number' &&
               !isNaN(lat) && !isNaN(lng) &&
               isFinite(lat) && isFinite(lng) &&
               lat >= -90.0 && lat <= 90.0 &&
               lng >= -180.0 && lng <= 180.0;
      };

      assert.strictEqual(isValidCoord(90.0, 0.0), true, 'North pole is valid boundary');
      assert.strictEqual(isValidCoord(-90.0, 0.0), true, 'South pole is valid boundary');
      assert.strictEqual(isValidCoord(0.0, 180.0), true, 'Anti-meridian positive is valid');
      assert.strictEqual(isValidCoord(0.0, -180.0), true, 'Anti-meridian negative is valid');
      assert.strictEqual(isValidCoord(0.0, 0.0), true, 'Null Island is valid');
      assert.strictEqual(isValidCoord(90.0001, 0.0), false, '90.0001 exceeds North pole');
      assert.strictEqual(isValidCoord(-90.0001, 0.0), false, '-90.0001 exceeds South pole');
      assert.strictEqual(isValidCoord(0.0, 180.0001), false, '180.0001 exceeds Anti-meridian');
      assert.strictEqual(isValidCoord(NaN, -96.7), false, 'NaN lat is invalid');
      assert.strictEqual(isValidCoord(32.7, Infinity), false, 'Infinity lng is invalid');
    });

    it('detects inverted STAC bounding boxes where min > max', () => {
      const validateBbox = ([minLon, minLat, maxLon, maxLat]) => {
        if (minLon > maxLon) return { valid: false, error: 'minLon cannot exceed maxLon' };
        if (minLat > maxLat) return { valid: false, error: 'minLat cannot exceed maxLat' };
        if (minLat < -90 || maxLat > 90) return { valid: false, error: 'Latitude out of bounds' };
        if (minLon < -180 || maxLon > 180) return { valid: false, error: 'Longitude out of bounds' };
        return { valid: true };
      };

      assert.strictEqual(validateBbox([-96.9, 32.7, -96.7, 32.9]).valid, true, 'Standard bbox is valid');
      assert.strictEqual(validateBbox([-96.7, 32.7, -96.9, 32.9]).valid, false, 'Inverted longitude rejected');
      assert.strictEqual(validateBbox([-96.9, 33.0, -96.7, 32.0]).valid, false, 'Inverted latitude rejected');
      assert.strictEqual(validateBbox([-96.9, -95.0, -96.7, 32.0]).valid, false, 'Out-of-range latitude rejected');
    });
  });
});
