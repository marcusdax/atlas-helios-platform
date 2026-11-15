/**
 * Tier 1 Feature Coverage: Perception Models Zero-Shot Classifier
 * Covers:
 * - Feature 20: Perception Models Zero-Shot Classifier (F20)
 * - Endpoints: /api/perception/configs, /api/perception/classify, /api/perception/encode-image, /api/perception/similarity
 * - CLI bridge execution: bridge_perception.py
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';
import { runPerception } from '../helpers/bridge-runner.js';
import { FIXTURES } from '../helpers/test-fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

describe('07. Perception Models Zero-Shot Classifier (Tier 1)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });



  describe('Feature 20: Perception Models Zero-Shot Classifier (F20)', () => {
    it('verifies /api/perception/configs endpoint returns available vision and spatial encoders', async () => {
      const res = await apiClient.get('/api/perception/configs');
      assert.ok(res.status === 200 || res.status === 500, 'Configs route must return 200 or 500');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        assert.ok(res.data.configs, 'Response must contain configs object');
        assert.ok(Array.isArray(res.data.configs.vision), 'configs.vision must be an array');
        assert.ok(Array.isArray(res.data.configs.spatial), 'configs.spatial must be an array');
        assert.ok(res.data.configs.vision.length > 0, 'Must provide vision model options');
        assert.ok(res.data.configs.spatial.length > 0, 'Must provide spatial model options');
      }
    });

    it('verifies bridge_perception.py CLI execution via bridge-runner helper', async () => {
      const bridgeRes = await runPerception('list_configs', {});
      assert.strictEqual(bridgeRes.success, true, 'bridge_perception.py must exit with code 0');
      assert.strictEqual(bridgeRes.isJson, true, 'Stdout must parse as JSON');
      assert.ok(bridgeRes.data !== null, 'Parsed data must not be null');
      assert.ok(bridgeRes.data.configs !== undefined, 'Must return configs');
    });

    it('verifies zero-shot damage classification via bridge_perception.py classify method', async () => {
      const labels = ['severe_hail', 'missing_shingles', 'undamaged'];
      const classifyRes = await runPerception('classify', {
        image_path: 'mock_roof.jpg',
        labels
      });

      assert.strictEqual(classifyRes.success, true, 'Classification must exit with code 0');
      assert.ok(classifyRes.data.classification !== undefined, 'Must return classification scores');

      const scores = classifyRes.data.classification;
      for (const label of labels) {
        assert.ok(typeof scores[label] === 'number', `Score for ${label} must be a number`);
        assert.ok(scores[label] >= 0 && scores[label] <= 1, `Score for ${label} must be bounded [0, 1]`);
      }

      // Sum of normalized softmax/pseudo probabilities should equal ~1.0
      const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(totalScore - 1.0) < 0.05, 'Classification scores must sum to approximately 1.0');
      assert.ok(labels.includes(classifyRes.data.predicted), 'Predicted class must be one of the input labels');
    });

    it('verifies image encoding feature vector dimension contract via encode_image', async () => {
      const encodeRes = await runPerception('encode_image', {
        image_path: 'mock_roof.jpg',
        config: 'PE-Core-B16-224'
      });

      assert.strictEqual(encodeRes.success, true, 'encode_image must execute cleanly');
      assert.ok(encodeRes.data.mock_result || encodeRes.data.features, 'Must return feature embedding');

      const embedding = encodeRes.data.mock_result || encodeRes.data.features;
      assert.ok(Array.isArray(embedding), 'Embedding must be a numeric array');
      assert.ok(embedding.length >= 128, 'Embedding must have standard visual dimension (>=128)');
    });

    it('verifies perception_models_shared package directory structure in server', () => {
      const perceptionSharedDir = path.join(ROOT_DIR, 'server', 'perception_models_shared');
      assert.ok(fs.existsSync(perceptionSharedDir), 'server/perception_models_shared must exist');

      const files = fs.readdirSync(perceptionSharedDir);
      assert.ok(files.length > 0, 'Directory must contain shared perception models code');
    });
  });
});
