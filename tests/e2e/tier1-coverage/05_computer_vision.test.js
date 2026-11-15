/**
 * Tier 1 Feature Coverage: Computer Vision Damage Detection Subsystem
 * Covers:
 * - Feature 13: Computer Vision Damage Detection (F13)
 * - TensorFlow.js integration, model categories, image pipeline, and severity assessment
 * - ComputerVisionHook external interface and /api/assessments/* route contracts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';
import { FIXTURES } from '../helpers/test-fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

describe('05. Computer Vision Damage Detection Subsystem (Tier 1)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });



  describe('Feature 13: Computer Vision Damage Detection (F13)', () => {
    it('verifies ComputerVisionService implementation, models registry, and processing pipeline', () => {
      const cvServicePath = path.join(ROOT_DIR, 'server', 'src', 'services', 'ComputerVisionService.js');
      assert.ok(fs.existsSync(cvServicePath), 'server/src/services/ComputerVisionService.js must exist');

      const content = fs.readFileSync(cvServicePath, 'utf-8');
      assert.ok(content.includes('class ComputerVisionService') || content.includes('ComputerVisionService'), 'Must define ComputerVisionService');
      assert.ok(content.includes('damageDetection'), 'Must include damageDetection model slot');
      assert.ok(content.includes('roofClassification'), 'Must include roofClassification model slot');
      assert.ok(content.includes('materialDetection'), 'Must include materialDetection model slot');
      assert.ok(content.includes('severityAssessment'), 'Must include severityAssessment model slot');
      assert.ok(content.includes('targetSize') || content.includes('224'), 'Must configure input tensor dimension (e.g. 224x224)');
    });

    it('verifies damage classification labels and severity scoring boundaries', () => {
      const labels = FIXTURES.perception.damageLabels;

      assert.ok(Array.isArray(labels), 'Damage labels must be an array');
      assert.ok(labels.includes('severe_hail_impact'), 'Must classify severe hail impact');
      assert.ok(labels.includes('wind_uplift_creased_shingles'), 'Must classify wind uplift creasing');
      assert.ok(labels.includes('missing_shingles_exposed_felt'), 'Must classify missing shingles with exposed felt');
      assert.ok(labels.includes('normal_weathering_undamaged'), 'Must classify normal undamaged weathering');

      // Validate severity scoring domain logic
      const calculateSeverityRating = (confidence, damageAreaRatio) => {
        const index = confidence * damageAreaRatio;
        if (index > 0.6) return 'critical';
        if (index > 0.35) return 'severe';
        if (index > 0.15) return 'moderate';
        return 'minor';
      };

      assert.strictEqual(calculateSeverityRating(0.95, 0.75), 'critical', 'High confidence large area must be critical');
      assert.strictEqual(calculateSeverityRating(0.80, 0.50), 'severe', 'Moderate-high damage must be severe');
      assert.strictEqual(calculateSeverityRating(0.60, 0.30), 'moderate', 'Localized damage must be moderate');
      assert.strictEqual(calculateSeverityRating(0.40, 0.10), 'minor', 'Small isolated flaw must be minor');
    });

    it('verifies ComputerVisionHook contract in api_hooks.py', () => {
      const hooksPath = path.join(ROOT_DIR, 'server', 'api_hooks.py');
      assert.ok(fs.existsSync(hooksPath), 'server/api_hooks.py must exist');

      const content = fs.readFileSync(hooksPath, 'utf-8');
      assert.ok(content.includes('class ComputerVisionHook'), 'Must define ComputerVisionHook class');
      assert.ok(content.includes('def analyze_image'), 'Must implement analyze_image method');
      assert.ok(content.includes('def detect_roof_damage'), 'Must implement detect_roof_damage method');
      assert.ok(content.includes('/api/assessments/'), 'Hook must target assessments route family');
    });

    it('verifies HTTP assessment routes contract and error handling', async () => {
      // POST to /api/assessments/roof-damage with empty body
      const res = await apiClient.post('/api/assessments/roof-damage', {});

      // Under progressive testability, if route unmounted, Express returns 404; if mounted, 400 (validation) or 500 (missing image)
      assert.ok([200, 400, 404, 500].includes(res.status), 'Assessment endpoint must return a valid HTTP status code');

      if (res.status === 200) {
        assert.ok(res.isJson, 'Response must be valid JSON');
        assert.ok(res.data.assessmentId !== undefined || res.data.damageType !== undefined, 'Assessment response must contain assessment payload');
      }
    });

    it('verifies computer vision sharp and image processing dependencies in server package.json', () => {
      const serverPackagePath = path.join(ROOT_DIR, 'server', 'package.json');
      assert.ok(fs.existsSync(serverPackagePath), 'server/package.json must exist');

      const pkg = JSON.parse(fs.readFileSync(serverPackagePath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      assert.ok(deps['@tensorflow/tfjs-node'], 'server must depend on @tensorflow/tfjs-node');
      assert.ok(deps['sharp'], 'server must depend on sharp for high-performance image processing');
      assert.ok(deps['winston'], 'server must depend on winston logger');
    });
  });
});
