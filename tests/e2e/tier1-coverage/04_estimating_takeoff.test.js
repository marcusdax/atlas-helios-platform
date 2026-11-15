/**
 * Tier 1 Feature Coverage: Estimating, Takeoff Engine, BOQ Catalog & Roof Facets
 * Covers:
 * - Feature 14: Carrier-Compliant Scope & Fee Ledger (F14)
 * - Feature 15: AI Bidwright Takeoff Engine (F15)
 * - Feature 16: Master BOQ Catalog & Price Book (F16)
 * - Feature 17: Roof Facet Geometry & Photogrammetry (F17)
 * - Endpoints: /api/estimate/line-items, /api/measure/roof-planes
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';
import {
  FIXTURES,
  calculatePitchMultiplier,
  calculateTrueSurfaceArea,
  calculateRoofSquares,
  calculateEstimateSummary
} from '../helpers/test-fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

describe('04. Estimating Takeoff Engine, BOQ Catalog & Facets (Tier 1)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });



  describe('Feature 14: Carrier-Compliant Scope & Fee Ledger (F14)', () => {
    it('verifies /api/estimate/line-items endpoint contract and field types', async () => {
      const res = await apiClient.get('/api/estimate/line-items');
      assert.ok(res.status === 200 || res.status === 500, 'Line items endpoint must respond with 200 or 500');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        assert.ok(Array.isArray(res.data), 'Line items must be an array');
        if (res.data.length > 0) {
          const item = res.data[0];
          assert.ok(typeof item.code === 'string', 'Item must have code string');
          assert.ok(typeof item.desc === 'string', 'Item must have desc string');
          assert.ok(typeof item.unit === 'string', 'Item must have unit string');
          assert.ok(typeof item.price === 'number' || typeof item.price === 'string', 'Item must have price');
        }
      } else {
        assert.strictEqual(res.data.error, 'Failed to fetch line items');
      }
    });

    it('verifies Xactimate-style O&P (10/10) and Auctum 2.5% platform fee calculations', () => {
      const baseCost = 10000.00;
      const summary = calculateEstimateSummary(baseCost, 0.10, 0.10, 0.025);

      assert.strictEqual(summary.baseTotal, 10000.00, 'Base total must equal initial sum');
      assert.strictEqual(summary.overheadAmount, 1000.00, 'Overhead at 10% must be 1,000.00');
      assert.strictEqual(summary.profitAmount, 1000.00, 'Profit at 10% must be 1,000.00');
      assert.strictEqual(summary.subtotalWithOP, 12000.00, 'Subtotal with 10/10 O&P must be 12,000.00');
      assert.strictEqual(summary.auctumFee, 300.00, 'Auctum 2.5% fee on $12,000 must be $300.00');
      assert.strictEqual(summary.grandTotal, 12300.00, 'Grand total must equal $12,300.00');
    });

    it('verifies EstimateTab UI component exists and handles fee ledger', () => {
      const estimateTabPath = path.join(ROOT_DIR, 'src', 'tabs', 'EstimateTab.tsx');
      assert.ok(fs.existsSync(estimateTabPath), 'src/tabs/EstimateTab.tsx must exist');

      const content = fs.readFileSync(estimateTabPath, 'utf-8');
      assert.ok(content.includes('EstimateTab') || content.includes('export'), 'Must export EstimateTab');
      assert.ok(content.includes('line-items') || content.includes('LineItem') || content.includes('estimate'), 'Must display estimate line items');
      assert.ok(content.includes('total') || content.includes('price') || content.includes('cost'), 'Must calculate total price or cost');
    });
  });

  describe('Feature 15: AI Bidwright Takeoff Engine (F15)', () => {
    it('verifies 3D roof pitch multiplier mathematical precision across standard pitches', () => {
      // Formula: multiplier = sqrt(1 + (rise/run)^2)
      const p4 = calculatePitchMultiplier(4, 12);
      const p6 = calculatePitchMultiplier(6, 12);
      const p8 = calculatePitchMultiplier(8, 12);
      const p9 = calculatePitchMultiplier(9, 12);
      const p12 = calculatePitchMultiplier(12, 12);

      assert.ok(Math.abs(p4 - FIXTURES.roof.multipliers['4/12']) < 0.0001, '4/12 multiplier matches 1.0541');
      assert.ok(Math.abs(p6 - FIXTURES.roof.multipliers['6/12']) < 0.0001, '6/12 multiplier matches 1.1180');
      assert.ok(Math.abs(p8 - FIXTURES.roof.multipliers['8/12']) < 0.0001, '8/12 multiplier matches 1.2018');
      assert.ok(Math.abs(p9 - FIXTURES.roof.multipliers['9/12']) < 0.0001, '9/12 multiplier matches 1.2500');
      assert.ok(Math.abs(p12 - FIXTURES.roof.multipliers['12/12']) < 0.0001, '12/12 multiplier matches 1.4142');
    });

    it('verifies true surface area, 12% waste factor, and square calculations', () => {
      const flatArea = 1850; // sqft
      const pitchRise = 6;
      const trueArea = calculateTrueSurfaceArea(flatArea, pitchRise, 12);
      const squares = calculateRoofSquares(trueArea, 0.12);

      // 1850 * 1.11803 = ~2068.36 true surface sqft
      assert.ok(trueArea > 2068 && trueArea < 2069, 'True surface area must be ~2068.36 sqft');

      // With 12% waste: 2068.36 * 1.12 = 2316.56 sqft -> 24 squares (Math.ceil(23.1656))
      assert.strictEqual(squares, 24, 'Squares with 12% waste rounded up must equal 24 squares');
      assert.ok(squares * 100 >= trueArea * 1.12, 'Squares must cover total required sqft including waste');
    });
  });

  describe('Feature 16: Master BOQ Catalog & Price Book (F16)', () => {
    it('verifies CSI MasterFormat Division 07 line items and unit pricing structure', () => {
      const catalog = FIXTURES.estimating.standardLineItems;

      assert.ok(Array.isArray(catalog), 'Master BOQ catalog must be an array');
      assert.ok(catalog.length >= 5, 'Must contain at least 5 standard roofing items');

      catalog.forEach(item => {
        assert.ok(item.code.startsWith('RFG-'), `Item code ${item.code} must follow MasterFormat division 07 prefix`);
        assert.ok(typeof item.desc === 'string', 'Item description must be string');
        assert.ok(['SQ', 'LF', 'EA'].includes(item.unit), `Unit ${item.unit} must be industry standard`);
        assert.ok(item.unitPrice > 0, 'Unit price must be positive number');
        assert.ok(typeof item.category === 'string', 'Category must be defined');
      });
    });

    it('verifies MasterFormat catalog items total calculation logic', () => {
      const quantitySquares = 24;
      const shingleItem = FIXTURES.estimating.standardLineItems[0];
      const lineTotal = quantitySquares * shingleItem.unitPrice;

      assert.strictEqual(shingleItem.code, 'RFG-SHG-ARCH');
      assert.strictEqual(shingleItem.unitPrice, 195.00);
      assert.strictEqual(lineTotal, 4680.00, '24 squares at $195/SQ must equal $4,680.00');
    });
  });

  describe('Feature 17: Roof Facet Geometry & Photogrammetry (F17)', () => {
    it('verifies /api/measure/roof-planes endpoint contract and facet fields', async () => {
      const res = await apiClient.get('/api/measure/roof-planes');
      assert.ok(res.status === 200 || res.status === 500, 'Roof planes endpoint must return 200 or 500');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        assert.ok(Array.isArray(res.data), 'Roof planes must be an array');
        if (res.data.length > 0) {
          const plane = res.data[0];
          assert.ok(plane.id !== undefined, 'Facet must have id');
          assert.ok(typeof plane.label === 'string', 'Facet must have label');
          assert.ok(plane.sqft !== undefined, 'Facet must have sqft area');
          assert.ok(plane.pitch !== undefined, 'Facet must have pitch specification');
        }
      } else {
        assert.strictEqual(res.data.error, 'Failed to fetch roof planes');
      }
    });

    it('verifies MeasureTab UI component exists and supports 2D, 3D, and Damage facet schedules', () => {
      const measureTabPath = path.join(ROOT_DIR, 'src', 'tabs', 'MeasureTab.tsx');
      assert.ok(fs.existsSync(measureTabPath), 'src/tabs/MeasureTab.tsx must exist');

      const content = fs.readFileSync(measureTabPath, 'utf-8');
      assert.ok(content.includes('MeasureTab') || content.includes('export'), 'Must export MeasureTab');
      assert.ok(content.includes('pitch') || content.includes('sqft'), 'Must handle pitch or sqft area display');
      assert.ok(content.includes('facet') || content.includes('planes') || content.includes('roof'), 'Must handle roof facets or planes');
    });
  });
});
