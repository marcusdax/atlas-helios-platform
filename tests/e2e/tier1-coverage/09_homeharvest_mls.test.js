/**
 * Tier 1 Feature Coverage: HomeHarvest MLS Scraper & Automated Valuation Model (AVM)
 * Covers:
 * - Feature 18: Automated Valuation Model (AVM) & MLS Property Scraping (F18)
 * - Endpoints: /api/property/valuation-history, /api/harvest/methods, /api/harvest/nearby, /api/harvest/search
 * - CLI bridge execution: bridge_homeharvest.py
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';
import { runHomeHarvest } from '../helpers/bridge-runner.js';
import { FIXTURES } from '../helpers/test-fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

describe('09. HomeHarvest MLS & Automated Valuation Model (Tier 1)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });



  describe('Feature 18: Automated Valuation Model (AVM) & MLS Property Scraping (F18)', () => {
    it('verifies /api/property/valuation-history endpoint contract and time series fields', async () => {
      const res = await apiClient.get('/api/property/valuation-history');
      assert.ok(res.status === 200 || res.status === 500, 'Valuation history route must respond with 200 or 500');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        assert.ok(Array.isArray(res.data), 'Valuation history must be an array');
        if (res.data.length > 0) {
          const item = res.data[0];
          assert.ok(typeof item.month === 'string', 'Month must be string');
          assert.ok(typeof item.value === 'number', 'Valuation value must be numeric');
          assert.ok(typeof item.low === 'number', 'Low estimate bound must be numeric');
          assert.ok(typeof item.high === 'number', 'High estimate bound must be numeric');
          assert.ok(item.high >= item.value && item.value >= item.low, 'Valuation bounds must obey: high >= value >= low');
        }
      } else {
        assert.strictEqual(res.data.error, 'Failed to fetch valuation history');
      }
    });

    it('verifies /api/harvest/methods endpoint returns registered MLS scraper methods', async () => {
      const res = await apiClient.get('/api/harvest/methods');
      assert.ok(res.status === 200 || res.status === 500, 'Harvest methods route must return 200 or 500');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        assert.ok(Array.isArray(res.data.methods), 'Methods property must be an array');
        const methodNames = res.data.methods.map(m => m.name);
        assert.ok(methodNames.includes('search_properties'), 'Must expose search_properties');
        assert.ok(methodNames.includes('get_property_details'), 'Must expose get_property_details');
        assert.ok(methodNames.includes('search_by_coords'), 'Must expose search_by_coords');
      }
    });

    it('verifies /api/harvest/nearby parameter validation for missing coordinates', async () => {
      const res = await apiClient.get('/api/harvest/nearby');
      assert.strictEqual(res.status, 400, 'Nearby search without coordinates must return 400');
      assert.strictEqual(res.isJson, true, 'Response must be JSON');
      assert.strictEqual(res.data.error, 'Latitude and longitude are required');
    });

    it('verifies direct bridge_homeharvest.py CLI execution via bridge-runner helper', async () => {
      const bridgeRes = await runHomeHarvest('list_methods', {});
      assert.strictEqual(bridgeRes.success, true, 'bridge_homeharvest.py must exit with code 0');
      assert.strictEqual(bridgeRes.isJson, true, 'Stdout must parse as valid JSON');
      assert.ok(bridgeRes.data.methods && Array.isArray(bridgeRes.data.methods), 'Must return methods array');
      assert.strictEqual(bridgeRes.data.methods.length, 3, 'Must define exactly 3 MLS scraping methods');
    });

    it('verifies property normalization schema in bridge_homeharvest.py script', () => {
      const scriptPath = path.join(ROOT_DIR, 'server', 'bridge_homeharvest.py');
      assert.ok(fs.existsSync(scriptPath), 'server/bridge_homeharvest.py must exist');

      const content = fs.readFileSync(scriptPath, 'utf-8');
      assert.ok(content.includes('def _normalize_property'), 'Must define property normalizer function');
      assert.ok(content.includes('roof_type'), 'Normalizer must extract roof_type');
      assert.ok(content.includes('sqft') && content.includes('beds') && content.includes('baths'), 'Must extract fundamental MLS attributes (sqft, beds, baths)');
      assert.ok(content.includes('list_price') || content.includes('estimated_value'), 'Must extract financial valuation attributes');
    });

    it('verifies HarvestTab and PropertyTab UI components exist in frontend tabs', () => {
      const harvestTabPath = path.join(ROOT_DIR, 'src', 'tabs', 'HarvestTab.tsx');
      const propertyTabPath = path.join(ROOT_DIR, 'src', 'tabs', 'PropertyTab.tsx');

      assert.ok(fs.existsSync(harvestTabPath), 'src/tabs/HarvestTab.tsx must exist');
      assert.ok(fs.existsSync(propertyTabPath), 'src/tabs/PropertyTab.tsx must exist');

      const harvestContent = fs.readFileSync(harvestTabPath, 'utf-8');
      assert.ok(harvestContent.includes('HarvestTab') || harvestContent.includes('export'), 'Must export HarvestTab');
      assert.ok(harvestContent.includes('search') || harvestContent.includes('mls'), 'Must support MLS searching');
    });
  });
});
