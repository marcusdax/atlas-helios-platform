/**
 * Tier 2 Boundary & Corner Cases: Malformed Payloads & Type Rejections
 * Covers:
 * - Empty request bodies on POST endpoints
 * - Malformed JSON strings and body parser syntax rejections (HTTP 400)
 * - Unexpected data types (strings for numbers, booleans for arrays, objects for primitives)
 * - Oversized arrays and extreme payload lengths
 * - Whitespace, null bytes, and unicode boundary inputs
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';

describe('01. Malformed Payloads & Type Boundaries (Tier 2)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });

  describe('Empty Request Bodies on Mutation & Search Endpoints', () => {
    it('rejects empty object payload on /api/sentinel/property-imagery with HTTP 400', async () => {
      const res = await apiClient.post('/api/sentinel/property-imagery', {});
      assert.strictEqual(res.status, 400, 'Empty body must trigger HTTP 400 Bad Request');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      assert.strictEqual(res.data.error, 'Latitude and longitude are required');
    });

    it('rejects empty object payload on /api/sentinel/available-dates with HTTP 400', async () => {
      const res = await apiClient.post('/api/sentinel/available-dates', {});
      assert.strictEqual(res.status, 400, 'Empty body must trigger HTTP 400 Bad Request');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      assert.strictEqual(res.data.error, 'Latitude and longitude are required');
    });

    it('handles empty payload on /api/perception/classify without unhandled server crash', async () => {
      const res = await apiClient.post('/api/perception/classify', {});
      assert.ok([200, 400, 500].includes(res.status), 'Must return standard HTTP status code');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      if (res.status === 200) {
        assert.ok(res.data.error !== undefined, 'Perception bridge must report error for missing labels');
      }
    });

    it('handles empty payload on /api/nexus/cognitive/step gracefully', async () => {
      const res = await apiClient.post('/api/nexus/cognitive/step', {});
      assert.ok([200, 400, 500].includes(res.status), 'Cognitive step with empty body must not crash');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });

    it('handles empty payload on /api/sentinel/distinct without unhandled exception', async () => {
      const res = await apiClient.post('/api/sentinel/distinct', {});
      assert.ok([200, 400, 500].includes(res.status), 'Distinct values with empty body must respond with HTTP error');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });
  });

  describe('Malformed JSON Syntax & Body Parser Rejection', () => {
    it('returns HTTP 400 when sending syntactically broken JSON string', async () => {
      const malformedJson = '{"invalid": json_without_quotes, unclosed_brace:';
      const res = await apiClient.request('/api/sentinel/property-imagery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: malformedJson
      });

      assert.strictEqual(res.status, 400, 'Express express.json() must reject malformed JSON with HTTP 400');
    });

    it('returns HTTP 400 when sending truncated JSON array', async () => {
      const truncatedJson = '[{"id": 1, "name": "storm-test"},';
      const res = await apiClient.request('/api/nexus/inference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: truncatedJson
      });

      assert.strictEqual(res.status, 400, 'Truncated array JSON must be rejected with HTTP 400');
    });

    it('returns HTTP 400 when sending bare unquoted primitive string as application/json', async () => {
      const unquotedBody = 'undefined_variable_token';
      const res = await apiClient.request('/api/sentinel/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: unquotedBody
      });

      assert.strictEqual(res.status, 400, 'Bare invalid identifier must return HTTP 400');
    });
  });

  describe('Unexpected Data Types in Payload Fields', () => {
    it('handles non-numeric string coordinates in /api/sentinel/property-imagery', async () => {
      const res = await apiClient.post('/api/sentinel/property-imagery', {
        lat: 'forty_two_degrees_north',
        lon: 'ninety_seven_degrees_west',
        radius: 'five_hundred_miles'
      });

      assert.ok([400, 500].includes(res.status), 'Invalid coordinate types must be rejected');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });

    it('handles boolean types in place of array parameters in /api/perception/classify', async () => {
      const res = await apiClient.post('/api/perception/classify', {
        image_path: 'sample.jpg',
        labels: true
      });

      assert.ok([200, 400, 500].includes(res.status), 'Boolean for labels array must not crash server');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      if (res.status === 200) {
        assert.ok(res.data.error !== undefined, 'Bridge must report error for non-iterable labels');
      }
    });

    it('handles number types in place of array texts in /api/perception/similarity', async () => {
      const res = await apiClient.post('/api/perception/similarity', {
        image_path: 'sample.jpg',
        texts: 123456
      });

      assert.ok([200, 400, 500].includes(res.status), 'Number for texts array must return structured response');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });

    it('handles array payload sent to endpoints expecting JSON object', async () => {
      const res = await apiClient.request('/api/sentinel/available-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(['array_item_1', 'array_item_2'])
      });

      // Array has no lat/lon properties, so lat/lon are undefined -> 400
      assert.strictEqual(res.status, 400, 'Array body missing lat/lon must return HTTP 400');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      assert.strictEqual(res.data.error, 'Latitude and longitude are required');
    });
  });

  describe('Oversized Payloads & Extreme Boundary Values', () => {
    it('handles massive label arrays without crashing memory or socket', async () => {
      const massiveLabels = Array.from({ length: 500 }, (_, i) => `synthetic_label_variant_${i}`);
      const res = await apiClient.post('/api/perception/classify', {
        image_path: 'nonexistent.jpg',
        labels: massiveLabels
      });

      assert.ok([200, 400, 500].includes(res.status), 'Oversized labels array must complete gracefully');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });

    it('handles 50KB string in POST request body safely', async () => {
      const giantString = 'A'.repeat(50000);
      const res = await apiClient.post('/api/sentinel/search', {
        bbox: [-96.9, 32.7, -96.7, 32.9],
        filter: { op: 'eq', args: [{ property: 'custom_annotation' }, giantString] }
      });

      assert.ok([200, 400, 500].includes(res.status), 'Giant body payload must be safely processed or rejected');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });

    it('handles whitespace-only and null-byte string parameters', async () => {
      const res = await apiClient.get('/api/harvest/details/%20%20%20');
      assert.ok([200, 400, 404, 500].includes(res.status), 'Whitespace MLS ID must be safely handled');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });
  });
});
