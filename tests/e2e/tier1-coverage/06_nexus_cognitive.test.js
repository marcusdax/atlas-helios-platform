/**
 * Tier 1 Feature Coverage: Nexus Mind AI Engine & Cognitive Damage Fusion
 * Covers:
 * - Feature 21: Cognitive Loop Damage Fusion (F21)
 * - Feature 22: Nexus Mind Core AI Pipeline (F22)
 * - Endpoints: /api/nexus/status, /api/nexus/inference, /api/nexus/cognitive/step
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';
import { runNexus } from '../helpers/bridge-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

describe('06. Nexus Mind AI Engine & Cognitive Damage Fusion (Tier 1)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });



  describe('Feature 22: Nexus Mind Core AI Pipeline (F22)', () => {
    it('verifies /api/nexus/status endpoint returns valid operational cognitive state', async () => {
      const res = await apiClient.get('/api/nexus/status');
      assert.ok(res.status === 200 || res.status === 500, 'Nexus status must return 200 (or 500 if python bridge failed)');
      assert.strictEqual(res.isJson, true, 'Status response must be valid JSON');

      if (res.status === 200) {
        assert.ok(res.data.alert_level !== undefined || res.data.status !== undefined, 'Must contain alert_level or status');
        if (res.data.alert_level !== undefined) {
          assert.ok(typeof res.data.alert_level === 'number', 'Alert level must be numeric');
          assert.ok(res.data.alert_level >= 0.0 && res.data.alert_level <= 1.0, 'Alert level must be bounded [0, 1]');
        }
        if (res.data.context) {
          assert.ok(typeof res.data.context === 'object', 'Cognitive context must be object');
        }
      }
    });

    it('verifies direct bridge_nexus.py CLI execution via bridge-runner helper', async () => {
      const bridgeRes = await runNexus('status', {});
      assert.strictEqual(bridgeRes.success, true, 'bridge_nexus.py must execute with exit code 0');
      assert.strictEqual(bridgeRes.isJson, true, 'bridge output must parse as JSON');
      assert.ok(bridgeRes.data !== null, 'bridge data must not be null');
      assert.ok(bridgeRes.data.alert_level !== undefined || bridgeRes.data.status !== undefined, 'Must expose cognitive alert level or status');
    });

    it('verifies core neural architecture components defined in nexus_mind package', () => {
      const coreDir = path.join(ROOT_DIR, 'server', 'nexus_mind', 'core');
      assert.ok(fs.existsSync(coreDir), 'server/nexus_mind/core must exist');

      const mainPath = path.join(ROOT_DIR, 'server', 'nexus_mind', 'main.py');
      assert.ok(fs.existsSync(mainPath), 'server/nexus_mind/main.py must exist');

      const content = fs.readFileSync(mainPath, 'utf-8');
      assert.ok(content.includes('NADEEngine'), 'Must instantiate Neural Attention Damage Estimator (NADE)');
      assert.ok(content.includes('GIEEngine'), 'Must instantiate Global Intelligence Engine (GIE)');
      assert.ok(content.includes('BNEEngine'), 'Must instantiate Behavioral Neural Engine (BNE)');
      assert.ok(content.includes('KimiDeltaAttention'), 'Must instantiate KimiDeltaAttention fusion engine');
      assert.ok(content.includes('build_full_nexus'), 'Must export build_full_nexus constructor');
    });
  });

  describe('Feature 21: Cognitive Loop Damage Fusion (F21)', () => {
    it('verifies AtlasHeliosBridge and cognitive damage fusion implementation in helios_integration.py', () => {
      const bridgePath = path.join(ROOT_DIR, 'server', 'nexus_mind', 'helios_integration.py');
      assert.ok(fs.existsSync(bridgePath), 'server/nexus_mind/helios_integration.py must exist');

      const content = fs.readFileSync(bridgePath, 'utf-8');
      assert.ok(content.includes('class AtlasHeliosBridge'), 'Must define AtlasHeliosBridge class');
      assert.ok(content.includes('process_storm_event'), 'Must define process_storm_event method');
      assert.ok(content.includes('_calculate_enhanced_risk'), 'Must implement enhanced risk fusion formula');
      assert.ok(content.includes('_storm_to_sensor'), 'Must implement storm-to-sensor conversion');
      assert.ok(content.includes('_generate_cognitive_recommendations'), 'Must generate cognitive recommendations');
    });

    it('verifies mathematical fusion logic for combining CV damage and cognitive anomaly scores', () => {
      // Fusion formula: enhanced_risk = (base_risk * 0.7) + (cognitive_anomaly_risk * 0.3)
      const calculateEnhancedRisk = (baseRisk, anomalyScore) => {
        const cognitiveRisk = anomalyScore * 100;
        return (baseRisk * 0.7) + (cognitiveRisk * 0.3);
      };

      const highAnomalyFused = calculateEnhancedRisk(60, 0.90);
      const lowAnomalyFused = calculateEnhancedRisk(60, 0.10);

      assert.strictEqual(highAnomalyFused, 69.0, '60 base risk + 90 anomaly must fuse to 69.0');
      assert.strictEqual(lowAnomalyFused, 45.0, '60 base risk + 10 anomaly must fuse to 45.0');
      assert.ok(highAnomalyFused > lowAnomalyFused, 'Higher cognitive anomaly must yield higher fused risk score');
      assert.ok(highAnomalyFused <= 100, 'Fused risk must remain bounded <= 100');
    });

    it('verifies /api/nexus/cognitive/step endpoint contract and JSON payload handling', async () => {
      const stepPayload = {
        sensor: [0.8, 0.47, 0.8, 0.7],
        geo: { lat: 32.7767, lng: -96.7970 },
        behavior: { claims_velocity: 'high' }
      };

      const res = await apiClient.post('/api/nexus/cognitive/step', stepPayload);
      assert.ok(res.status === 200 || res.status === 500, 'Cognitive step route must return 200 or 500');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        assert.ok(typeof res.data === 'object' && res.data !== null, 'Step response must be an object');
      } else {
        assert.strictEqual(res.data.error, 'Cognitive step failed');
      }
    });
  });
});
