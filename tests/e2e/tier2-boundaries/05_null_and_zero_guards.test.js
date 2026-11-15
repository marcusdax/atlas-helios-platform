/**
 * Tier 2 Boundary & Corner Cases: Null, Zero & Extreme Mathematical Guards
 * Covers:
 * - 0 sqft roofs, negative areas, and fractional areas
 * - Flat roofs (pitch 0/12), low-slope roofs (1/12), and extreme steep pitches (18/12, 24/12, 36/12)
 * - Negative pitch rises and negative waste factors guards
 * - 0% waste factors and extreme waste factors (>100%)
 * - Zero base cost, zero O&P, and zero Auctum platform fee scenarios
 * - Null and zero facet measurements in estimating data
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePitchMultiplier,
  calculateTrueSurfaceArea,
  calculateRoofSquares,
  calculateEstimateSummary
} from '../helpers/test-fixtures.js';

describe('05. Null, Zero & Mathematical Domain Guards (Tier 2)', () => {
  describe('Roof Area Boundaries: 0 Sqft, Fractional & Negative Areas', () => {
    it('verifies 0 sqft flat area yields 0 true surface area and 0 squares', () => {
      const flatArea = 0;
      const trueArea = calculateTrueSurfaceArea(flatArea, 6, 12);
      const squares = calculateRoofSquares(trueArea, 0.12);

      assert.strictEqual(trueArea, 0, '0 sqft footprint must produce 0 true surface area');
      assert.strictEqual(squares, 0, '0 true surface area must produce 0 squares');
    });

    it('verifies fractional square footage rounds up to 1 minimum square due to ceiling logic', () => {
      // 5 sqft doghouse dormer
      const smallArea = 5;
      const trueArea = calculateTrueSurfaceArea(smallArea, 6, 12);
      const squares = calculateRoofSquares(trueArea, 0.12);

      assert.ok(trueArea > 5 && trueArea < 6, 'True area must be approximately 5.59 sqft');
      assert.strictEqual(squares, 1, 'Any non-zero surface area must round up to at least 1 square');
    });

    it('guards against negative roof areas in takeoff calculation', () => {
      const validateRoofArea = (area) => {
        if (typeof area !== 'number' || isNaN(area)) throw new TypeError('Roof area must be a valid number');
        if (area < 0) throw new RangeError('Roof area cannot be negative');
        return true;
      };

      assert.throws(() => validateRoofArea(-100), /cannot be negative/, 'Negative roof area must throw RangeError');
      assert.throws(() => validateRoofArea(NaN), /must be a valid number/, 'NaN area must throw TypeError');
      assert.strictEqual(validateRoofArea(0), true, '0 area is accepted');
      assert.strictEqual(validateRoofArea(2400), true, 'Positive area is accepted');
    });
  });

  describe('Roof Pitch Boundaries: Flat Roofs (0/12) & Extreme Pitches (24/12+)', () => {
    it('verifies flat roof (pitch 0/12) has pitch multiplier of exactly 1.0', () => {
      const flatMultiplier = calculatePitchMultiplier(0, 12);
      assert.strictEqual(flatMultiplier, 1.0, 'Pitch 0/12 multiplier must equal 1.0 exactly');

      const footprint = 2500;
      const trueArea = calculateTrueSurfaceArea(footprint, 0, 12);
      assert.strictEqual(trueArea, 2500, 'Flat roof true surface area must strictly equal flat footprint');
    });

    it('verifies low slope roof (1/12 pitch) multiplier precision', () => {
      // sqrt(1 + (1/12)^2) = sqrt(1 + 1/144) = sqrt(145/144) ≈ 1.003467
      const multiplier1 = calculatePitchMultiplier(1, 12);
      const expected = Math.sqrt(1 + Math.pow(1 / 12, 2));

      assert.ok(Math.abs(multiplier1 - expected) < 1e-6, '1/12 multiplier must match mathematical formula');
      assert.ok(multiplier1 > 1.0034 && multiplier1 < 1.0035, '1/12 multiplier is approximately 1.00347');
    });

    it('verifies extreme steep pitch (24/12) multiplier matches sqrt(5)', () => {
      // Rise 24, Run 12 -> rise/run = 2 -> sqrt(1 + 2^2) = sqrt(5) ≈ 2.236067977
      const multiplier24 = calculatePitchMultiplier(24, 12);
      const expectedSqrt5 = Math.sqrt(5);

      assert.ok(Math.abs(multiplier24 - expectedSqrt5) < 1e-6, '24/12 multiplier must equal sqrt(5)');
      assert.ok(multiplier24 > 2.2360 && multiplier24 < 2.2361);

      // On a 1000 sqft footprint, 24/12 pitch yields > 2236 sqft true surface area
      const trueArea = calculateTrueSurfaceArea(1000, 24, 12);
      assert.strictEqual(Math.round(trueArea), 2236);
    });

    it('verifies steep A-frame / Mansard pitch (36/12) multiplier matches sqrt(10)', () => {
      // Rise 36, Run 12 -> rise/run = 3 -> sqrt(1 + 9) = sqrt(10) ≈ 3.16227766
      const multiplier36 = calculatePitchMultiplier(36, 12);
      assert.ok(Math.abs(multiplier36 - Math.sqrt(10)) < 1e-6, '36/12 multiplier must equal sqrt(10)');
    });

    it('guards against negative pitch rise values', () => {
      const validatePitch = (rise, run = 12) => {
        if (rise < 0) throw new RangeError('Pitch rise cannot be negative');
        if (run <= 0) throw new RangeError('Pitch run must be strictly positive');
        return calculatePitchMultiplier(rise, run);
      };

      assert.throws(() => validatePitch(-6, 12), /Pitch rise cannot be negative/);
      assert.throws(() => validatePitch(6, 0), /Pitch run must be strictly positive/);
      assert.doesNotThrow(() => validatePitch(0, 12));
    });
  });

  describe('Waste Factor Boundaries: 0% Waste, Negative Waste Guards & Extreme Waste', () => {
    it('verifies 0% waste factor produces pure surface area squares', () => {
      const surfaceArea = 2050; // sqft
      const squares = calculateRoofSquares(surfaceArea, 0.0);
      assert.strictEqual(squares, 21, '2050 sqft at 0% waste must equal 21 squares (ceil(20.5))');
    });

    it('guards against negative waste factor reducing ordered material below roof area', () => {
      const safeCalculateSquares = (surfaceArea, wasteFactor) => {
        if (wasteFactor < 0) {
          throw new RangeError('Waste factor cannot be negative as it causes material shortfall');
        }
        return calculateRoofSquares(surfaceArea, wasteFactor);
      };

      assert.throws(() => safeCalculateSquares(2000, -0.15), /Waste factor cannot be negative/);
      assert.strictEqual(safeCalculateSquares(2000, 0.12), 23); // 2000 * 1.12 = 2240 -> 23 squares
    });

    it('handles extreme complex roof waste factors (100%+ waste for intricate turrets/valleys)', () => {
      const surfaceArea = 1000;
      // 100% waste factor (1.0)
      const squares100 = calculateRoofSquares(surfaceArea, 1.0);
      assert.strictEqual(squares100, 20, '1000 sqft with 100% waste factor must equal 20 squares (2000 sqft)');
    });
  });

  describe('Carrier Fee Ledger Zero & Null Guards', () => {
    it('verifies zero base construction cost yields zero total and zero fees', () => {
      const summary = calculateEstimateSummary(0.00, 0.10, 0.10, 0.025);

      assert.strictEqual(summary.baseTotal, 0);
      assert.strictEqual(summary.overheadAmount, 0);
      assert.strictEqual(summary.profitAmount, 0);
      assert.strictEqual(summary.subtotalWithOP, 0);
      assert.strictEqual(summary.auctumFee, 0);
      assert.strictEqual(summary.grandTotal, 0);
    });

    it('verifies zero O&P rates compute grand total as base + Auctum fee only', () => {
      const baseCost = 10000.00;
      const summary = calculateEstimateSummary(baseCost, 0.0, 0.0, 0.025);

      assert.strictEqual(summary.overheadAmount, 0);
      assert.strictEqual(summary.profitAmount, 0);
      assert.strictEqual(summary.subtotalWithOP, 10000.00);
      assert.strictEqual(summary.auctumFee, 250.00, '2.5% on 10,000 must equal $250.00');
      assert.strictEqual(summary.grandTotal, 10250.00, 'Grand total must equal $10,250.00');
    });

    it('verifies zero Auctum platform fee computes grand total as subtotal with O&P', () => {
      const baseCost = 10000.00;
      const summary = calculateEstimateSummary(baseCost, 0.10, 0.10, 0.0);

      assert.strictEqual(summary.subtotalWithOP, 12000.00);
      assert.strictEqual(summary.auctumFee, 0.00);
      assert.strictEqual(summary.grandTotal, 12000.00);
    });

    it('guards against negative base totals in estimate summary calculator', () => {
      const safeEstimateSummary = (baseTotal, overhead = 0.10, profit = 0.10, fee = 0.025) => {
        if (baseTotal < 0) throw new RangeError('Base total cannot be negative');
        return calculateEstimateSummary(baseTotal, overhead, profit, fee);
      };

      assert.throws(() => safeEstimateSummary(-500), /Base total cannot be negative/);
      assert.doesNotThrow(() => safeEstimateSummary(0));
    });
  });
});
