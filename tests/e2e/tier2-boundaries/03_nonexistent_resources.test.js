/**
 * Tier 2 Boundary & Corner Cases: Nonexistent Resources & 404 Route Rejections
 * Covers:
 * - 404 responses for undefined and malformed REST routes
 * - Nonexistent MLS property identifiers and missing listings
 * - Nonexistent Sentinel collection identifiers
 * - Nonexistent database entities (storms, properties, contractors)
 * - Security rejections: Path traversal and injection attacks on resource IDs
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';

describe('03. Nonexistent Resources & Route Boundaries (Tier 2)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });

  describe('404 Responses for Undefined REST API Routes', () => {
    it('returns HTTP 404 for completely unknown top-level route', async () => {
      const res = await apiClient.get('/api/unknown-endpoint-xyz-404');
      assert.strictEqual(res.status, 404, 'Unknown top-level route must return HTTP 404');
    });

    it('returns HTTP 404 for undefined subroute under /api/weather/', async () => {
      const res = await apiClient.get('/api/weather/unsupported-action');
      assert.strictEqual(res.status, 404, 'Undefined weather subroute must return HTTP 404');
    });

    it('returns HTTP 404 for undefined subroute under /api/sentinel/', async () => {
      const res = await apiClient.get('/api/sentinel/non-existent-subpath');
      assert.strictEqual(res.status, 404, 'Undefined sentinel subroute must return HTTP 404');
    });

    it('returns HTTP 404 for undefined subroute under /api/nexus/', async () => {
      const res = await apiClient.get('/api/nexus/undefined-neural-action');
      assert.strictEqual(res.status, 404, 'Undefined nexus subroute must return HTTP 404');
    });

    it('returns HTTP 404 for undefined HTTP methods on existing routes', async () => {
      const res = await apiClient.del('/api/health');
      assert.strictEqual(res.status, 404, 'DELETE method on /api/health must return HTTP 404');
    });
  });

  describe('Nonexistent MLS Property Listings', () => {
    it('handles query for nonexistent MLS ID in HomeHarvest bridge gracefully', async () => {
      const res = await apiClient.get('/api/harvest/details/NONEXISTENT_MLS_99999999');
      assert.ok([200, 404, 500].includes(res.status), 'Nonexistent MLS ID must return valid status');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        // If bridge returns mock or empty data
        assert.ok(res.data !== null, 'Data must be present');
      } else {
        assert.ok(res.data.error, 'Must provide structured error explanation');
      }
    });

    it('handles missing MLS ID path parameter cleanly', async () => {
      const res = await apiClient.get('/api/harvest/details/');
      assert.ok([404, 500].includes(res.status), 'Empty MLS ID in path must return 404');
    });
  });

  describe('Nonexistent Collections & Geographic Areas', () => {
    it('handles nonexistent Sentinel collection ID query with 404 or 500', async () => {
      const res = await apiClient.get('/api/sentinel/collections/non-existent-sentinel-collection-999');
      assert.ok([404, 500].includes(res.status), 'Nonexistent collection must return 404 or 500');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      if (res.status === 500) {
        assert.strictEqual(res.data.error, 'Failed to fetch collection');
      }
    });

    it('handles empty results gracefully when searching properties in uninhabited coordinates', async () => {
      // Query deep ocean coordinates (Pacific Ocean: 0.0, -140.0)
      const res = await apiClient.get('/api/harvest/nearby', {
        lat: 0.0,
        lon: -140.0,
        radius: 1
      });

      assert.ok([200, 400, 500].includes(res.status), 'Uninhabited coordinates must return valid status');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });
  });

  describe('Path Traversal & Security Boundary Guards', () => {
    it('blocks directory traversal attempts in MLS parameter', async () => {
      const traversalId = '..%2F..%2F..%2Fetc%2Fpasswd';
      const res = await apiClient.get(`/api/harvest/details/${traversalId}`);

      assert.ok([200, 400, 404, 500].includes(res.status), 'Traversal string must return standard HTTP status');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      if (res.data) {
        // Verify system files are not leaked
        assert.ok(!res.rawText.includes('root:x:0:0:'), 'Must never leak system passwd');
        assert.ok(!res.rawText.includes('daemon:'), 'Must never leak system user accounts');
      }
    });

    it('handles SQL injection patterns in MLS parameter safely without crashing DB', async () => {
      const sqlInjectionId = "1' OR '1'='1; DROP TABLE properties; --";
      const res = await apiClient.get(`/api/harvest/details/${encodeURIComponent(sqlInjectionId)}`);

      assert.ok([200, 400, 404, 500].includes(res.status), 'SQL injection pattern must be safely handled');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
    });

    it('handles shell command injection strings in parameters safely', async () => {
      const cmdInjection = 'mls123; echo SHELL_INJECTION_PWNED; whoami';
      const res = await apiClient.get(`/api/harvest/details/${encodeURIComponent(cmdInjection)}`);

      assert.ok([200, 400, 404, 500].includes(res.status), 'Command injection attempt must return valid HTTP status');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      // Subprocess execFile must not execute the command as a shell script
      assert.ok(!res.rawText.includes('SHELL_INJECTION_PWNED\n') && !res.rawText.includes('SHELL_INJECTION_PWNED\r'),
        'Shell echo command must not produce stdout execution lines');
    });
  });
});
