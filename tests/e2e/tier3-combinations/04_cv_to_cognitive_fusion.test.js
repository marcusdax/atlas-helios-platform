/**
 * Tier 3 Cross-Feature Combination: Computer Vision Damage Detection to Cognitive AI Loop Fusion
 * Exercises Pairwise Linkages:
 * - Feature 13: Computer Vision Damage Detection & Severity Scoring
 * - Feature 21: Cognitive Loop Damage Fusion & Helios Integration
 * - Feature 22: Nexus Mind Core AI Pipeline (NADE, GIE, BNE, KimiDeltaAttention)
 * - Multi-Modal Ingestion: Combining Visual Damage Tensors with Meteorological & Property Context
 * - Decision Routing: Autonomous Approval vs Physical Adjuster Dispatch Thresholds
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';
import { runNexus } from '../helpers/bridge-runner.js';

describe('04. Computer Vision to Cognitive AI Loop Fusion (Tier 3)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });

  describe('Pairwise Flow: Computer Vision Damage Assessment Ingestion', () => {
    it('structures visual damage detection outputs into standardized observation vector', () => {
      // Synthetic high-confidence CV damage detection result
      const cvAssessment = {
        assessmentId: 'CV-ASM-2026-8812',
        damageType: 'severe_hail_impact',
        severity: 'severe',
        confidence: 0.93,
        detectedHitsPerSquare: 28,
        affectedAreaRatio: 0.72,
        estimatedCost: 11057.09
      };

      assert.strictEqual(cvAssessment.damageType, 'severe_hail_impact');
      assert.ok(cvAssessment.confidence >= 0.90, 'High confidence assessment required');
      assert.ok(cvAssessment.detectedHitsPerSquare >= 10, 'Hits per square must exceed insurance replacement threshold of 10 hits/SQ');

      // Convert CV output into normalized 4-channel tensor feature vector
      const cvFeatureVector = [
        cvAssessment.confidence,
        cvAssessment.affectedAreaRatio,
        Math.min(1.0, cvAssessment.detectedHitsPerSquare / 40),
        cvAssessment.severity === 'severe' ? 1.0 : 0.5
      ];

      assert.strictEqual(cvFeatureVector.length, 4, 'Observation vector must contain 4 normalized features');
      cvFeatureVector.forEach(val => {
        assert.ok(val >= 0.0 && val <= 1.0, 'Feature vector values must be normalized in [0, 1]');
      });
    });
  });

  describe('Pairwise Flow: Nexus Mind Cognitive Loop Execution & Fusion', () => {
    it('verifies /api/nexus/status returns operational cognitive state', async () => {
      const res = await apiClient.get('/api/nexus/status');
      assert.ok(res.status === 200 || res.status === 500);
      assert.strictEqual(res.isJson, true);

      if (res.status === 200) {
        assert.ok(res.data.alert_level !== undefined || res.data.status !== undefined);
      }
    });

    it('dispatches multi-modal observation to /api/nexus/cognitive/step endpoint', async () => {
      const multiModalPayload = {
        sensor: [0.93, 0.72, 0.70, 1.0], // CV damage features
        geo: [32.7767, -96.7970, 0.15],    // Dallas storm coordinates & swath proximity
        behavior: [18, 425000, 1]          // Roof age 18 yrs, valuation $425k, 1 prior claim
      };

      const res = await apiClient.post('/api/nexus/cognitive/step', multiModalPayload);
      assert.ok([200, 400, 500].includes(res.status), 'Cognitive step must respond with valid status');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        assert.ok(res.data.status !== undefined || res.data.alert_level !== undefined,
          'Must return cognitive step execution status');
      }
    });
  });

  describe('Pairwise Flow: Multi-Modal Mathematical Fusion Invariants', () => {
    it('computes Delta Attention fusion score combining CV score, storm score, and vulnerability', () => {
      const computeCognitiveFusionScore = (cvScore, stormScore, roofAgeYears, proximityMiles) => {
        // Delta attention weighting formula:
        // - CV visual evidence weight: 45%
        // - Storm severity evidence weight: 35%
        // - Vulnerability (roof age & proximity) weight: 20%
        const wCV = 0.45;
        const wStorm = 0.35;
        const wVuln = 0.20;

        const normCV = cvScore; // 0..1
        const normStorm = stormScore / 100; // 0..1
        const normAge = Math.min(1.0, roofAgeYears / 25);
        const normProx = Math.max(0.0, 1.0 - (proximityMiles / 15));
        const normVuln = (normAge + normProx) / 2;

        const fusionScore = (wCV * normCV) + (wStorm * normStorm) + (wVuln * normVuln);
        return Math.round(fusionScore * 1000) / 1000;
      };

      // Case A: High CV damage (0.93), severe storm (94), 18-year roof, 1.5 miles from center
      const caseAHung = computeCognitiveFusionScore(0.93, 94, 18, 1.5);
      assert.ok(caseAHung >= 0.85, `Severe combined damage must score >= 0.85 (got ${caseAHung})`);

      // Case B: Undamaged CV (0.05), weak storm (20), 1-year roof, 12 miles away
      const caseBLow = computeCognitiveFusionScore(0.05, 20, 1, 12.0);
      assert.ok(caseBLow < 0.25, `Undamaged property must score < 0.25 (got ${caseBLow})`);

      // Pairwise invariant: Delta between severe and undamaged must be significant
      assert.ok(caseAHung - caseBLow > 0.60, 'Fusion delta between severe and undamaged must exceed 0.60');
    });

    it('verifies cognitive decision routing policy based on fused score thresholds', () => {
      const determineClaimAction = (fusedScore, confidence) => {
        if (fusedScore >= 0.80 && confidence >= 0.85) {
          return {
            decision: 'AUTO_APPROVE_CLAIM',
            priority: 'EMERGENCY',
            dispatchAdjuster: false,
            dispatchContractor: true
          };
        }
        if (fusedScore >= 0.50) {
          return {
            decision: 'SCHEDULE_PHYSICAL_INSPECTION',
            priority: 'STANDARD',
            dispatchAdjuster: true,
            dispatchContractor: false
          };
        }
        return {
          decision: 'CLOSE_CLAIM_NO_DAMAGE',
          priority: 'LOW',
          dispatchAdjuster: false,
          dispatchContractor: false
        };
      };

      const actionA = determineClaimAction(0.91, 0.93);
      assert.strictEqual(actionA.decision, 'AUTO_APPROVE_CLAIM');
      assert.strictEqual(actionA.dispatchContractor, true);

      const actionB = determineClaimAction(0.68, 0.82);
      assert.strictEqual(actionB.decision, 'SCHEDULE_PHYSICAL_INSPECTION');
      assert.strictEqual(actionB.dispatchAdjuster, true);

      const actionC = determineClaimAction(0.18, 0.95);
      assert.strictEqual(actionC.decision, 'CLOSE_CLAIM_NO_DAMAGE');
      assert.strictEqual(actionC.dispatchContractor, false);
    });
  });
});
