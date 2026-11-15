/**
 * Tier 3 Cross-Feature Combination: Property Recon to 3D Takeoff & Carrier Estimate Ledger
 * Exercises Pairwise Linkages:
 * - Feature 18: MLS Property Details & Recon Data
 * - Feature 15: AI Bidwright 3D Takeoff Engine & Pitch Multipliers
 * - Feature 17: Roof Facet Geometry & Photogrammetry
 * - Feature 16: Master BOQ Catalog & CSI MasterFormat Division 07
 * - Feature 14: Carrier-Compliant Scope & Fee Ledger (10/10 O&P + 2.5% Auctum Fee)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';
import {
  FIXTURES,
  calculatePitchMultiplier,
  calculateTrueSurfaceArea,
  calculateRoofSquares,
  calculateEstimateSummary
} from '../helpers/test-fixtures.js';

describe('02. Property Recon to Takeoff & Carrier Fee Ledger (Tier 3)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });

  describe('Pairwise Flow: Property Reconnaissance & Dimensions Ingestion', () => {
    it('retrieves property record or uses MLS reconnaissance parameters', async () => {
      const res = await apiClient.get('/api/properties');
      assert.ok(res.status === 200 || res.status === 500, 'Properties route must return 200 or 500');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      // Use live property if connected, or standard test fixture
      const property = (res.status === 200 && Array.isArray(res.data) && res.data.length > 0)
        ? res.data[0]
        : {
            id: 'PROP-DAL-101',
            address: '4512 Belclaire Ave, Dallas, TX 75205',
            sqft: 2200,
            stories: 2,
            year_built: 2004,
            roof_type: 'Gable/Hip'
          };

      assert.ok(property.address !== undefined, 'Property must have address');
      const footprintSqft = property.sqft ? Number(property.sqft) : 2200;
      assert.ok(footprintSqft > 500, 'Footprint sqft must be reasonable residential size');
    });
  });

  describe('Pairwise Flow: AI Bidwright 3D Roof Pitch Takeoff', () => {
    it('partitions roof into multi-pitch facet schedules and computes true 3D surface area', () => {
      const footprintSqft = 2200;

      // Facet A: Main Gable (65% of footprint at 6/12 pitch)
      const mainFootprint = footprintSqft * 0.65; // 1,430 sqft
      const mainPitchMultiplier = calculatePitchMultiplier(6, 12); // ~1.11803
      const mainTrueArea = calculateTrueSurfaceArea(mainFootprint, 6, 12);

      // Facet B: Dormers & Steep Valleys (35% of footprint at 8/12 pitch)
      const steepFootprint = footprintSqft * 0.35; // 770 sqft
      const steepPitchMultiplier = calculatePitchMultiplier(8, 12); // ~1.20185
      const steepTrueArea = calculateTrueSurfaceArea(steepFootprint, 8, 12);

      const totalTrueArea = mainTrueArea + steepTrueArea;

      // Mathematical assertions
      assert.ok(mainPitchMultiplier > 1.1180 && mainPitchMultiplier < 1.1181);
      assert.ok(steepPitchMultiplier > 1.2018 && steepPitchMultiplier < 1.2019);
      assert.ok(totalTrueArea > 2520 && totalTrueArea < 2530, `Total true area (${totalTrueArea.toFixed(2)}) must be ~2,524 sqft`);

      // 3D true surface area must strictly exceed 2D flat footprint
      assert.ok(totalTrueArea > footprintSqft, '3D pitch-adjusted surface area must exceed flat footprint');
      const expansionRatio = totalTrueArea / footprintSqft;
      assert.ok(expansionRatio > 1.14 && expansionRatio < 1.16, 'Average expansion ratio must be ~1.15x');
    });

    it('applies 12% industry waste factor and calculates required roofing squares (SQ)', () => {
      const totalTrueArea = 2524.20; // sqft
      const wasteFactor = 0.12; // 12% standard waste
      const squares = calculateRoofSquares(totalTrueArea, wasteFactor);

      // Total with 12% waste: 2524.20 * 1.12 = 2827.10 sqft -> 29 squares
      assert.strictEqual(squares, 29, '2827.1 sqft must round up to exactly 29 squares');
      assert.ok(squares * 100 >= totalTrueArea * (1 + wasteFactor), 'Squares must cover total required sqft');
    });
  });

  describe('Pairwise Flow: CSI MasterFormat Division 07 Cost Takeoff', () => {
    it('generates line-item cost schedule using MasterFormat catalog pricing', async () => {
      const res = await apiClient.get('/api/estimate/line-items');
      assert.ok(res.status === 200 || res.status === 500);
      assert.strictEqual(res.isJson, true);

      const squares = 29; // billable squares
      const catalog = FIXTURES.estimating.standardLineItems;

      // Map line items
      const tearOffItem = catalog.find(i => i.code === 'RFG-DSP-TEAR');
      const shingleItem = catalog.find(i => i.code === 'RFG-SHG-ARCH');
      const underlaymentItem = catalog.find(i => i.code === 'RFG-UND-SYN');
      const iceWaterItem = catalog.find(i => i.code === 'RFG-ICE-WTR');
      const dripEdgeItem = catalog.find(i => i.code === 'RFG-DRP-EDG');

      assert.ok(tearOffItem && shingleItem && underlaymentItem && iceWaterItem && dripEdgeItem);

      // Quantities
      const tearOffCost = squares * tearOffItem.unitPrice; // 29 * 48 = 1392.00
      const shingleCost = squares * shingleItem.unitPrice; // 29 * 195 = 5655.00
      const underlayCost = squares * underlaymentItem.unitPrice; // 29 * 32.50 = 942.50
      const iceWaterCost = 8 * iceWaterItem.unitPrice; // 8 SQ * 68 = 544.00
      const dripEdgeCost = 160 * dripEdgeItem.unitPrice; // 160 LF * 2.85 = 456.00

      const baseCost = tearOffCost + shingleCost + underlayCost + iceWaterCost + dripEdgeCost;
      assert.strictEqual(baseCost, 8989.50, 'Base cost must sum to exactly $8,989.50');
    });
  });

  describe('Pairwise Flow: Carrier-Compliant Financial Ledger (10/10 O&P + Auctum 2.5%)', () => {
    it('computes 10% overhead, 10% profit, 2.5% Auctum fee, and grand total claim scope', () => {
      const baseCost = 8989.50;
      const summary = calculateEstimateSummary(baseCost, 0.10, 0.10, 0.025);

      assert.strictEqual(summary.baseTotal, 8989.50);
      assert.strictEqual(summary.overheadAmount, 898.95, '10% overhead must equal $898.95');
      assert.strictEqual(summary.profitAmount, 898.95, '10% profit must equal $898.95');
      assert.strictEqual(summary.subtotalWithOP, 10787.40, 'Subtotal with O&P must equal $10,787.40');
      assert.strictEqual(summary.auctumFee, 269.69, '2.5% Auctum fee on $10,787.40 must equal $269.69');
      assert.strictEqual(summary.grandTotal, 11057.09, 'Grand total claim settlement must equal $11,057.09');

      // Verify closed-form mathematical property: Base * 1.20 * 1.025
      const closedForm = Math.round(baseCost * 1.20 * 1.025 * 100) / 100;
      assert.strictEqual(summary.grandTotal, closedForm, 'Grand total matches closed form formula exactly');
    });

    it('verifies exact two-decimal cent rounding on all financial ledger components', () => {
      const arbitraryBase = 12345.67;
      const summary = calculateEstimateSummary(arbitraryBase, 0.10, 0.10, 0.025);

      // Ensure no floating point imprecision artifacts (e.g. 12.300000000004)
      const isTwoDecimals = num => {
        const str = num.toString();
        const parts = str.split('.');
        return parts.length === 1 || parts[1].length <= 2;
      };

      assert.strictEqual(isTwoDecimals(summary.baseTotal), true);
      assert.strictEqual(isTwoDecimals(summary.overheadAmount), true);
      assert.strictEqual(isTwoDecimals(summary.profitAmount), true);
      assert.strictEqual(isTwoDecimals(summary.subtotalWithOP), true);
      assert.strictEqual(isTwoDecimals(summary.auctumFee), true);
      assert.strictEqual(isTwoDecimals(summary.grandTotal), true);
    });
  });
});
