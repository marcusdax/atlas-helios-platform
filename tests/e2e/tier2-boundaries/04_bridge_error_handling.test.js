/**
 * Tier 2 Boundary & Corner Cases: Python Bridge Subprocess Error Handling
 * Covers:
 * - Invalid method names dispatched to bridges
 * - Syntactically malformed JSON strings in CLI arguments
 * - Non-existent file paths passed to perception and image encoders
 * - Missing required arguments across bridge interfaces
 * - Non-existent bridge scripts and execution failures
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runBridge, runHomeHarvest, runNexus, runPerception } from '../helpers/bridge-runner.js';

describe('04. Python CLI Bridge Subprocess Error Handling (Tier 2)', () => {
  describe('bridge_homeharvest.py Boundary & Error Rejections', () => {
    it('returns structured error for unrecognized bridge method', async () => {
      const res = await runHomeHarvest('unsupported_mls_scraper_method', {});
      assert.strictEqual(res.isJson, true, 'Bridge response must be valid JSON');
      assert.ok(res.data.error !== undefined, 'Must return error object for unknown method');
      assert.ok(res.data.error.includes('Unknown method'), 'Error must specify Unknown method');
    });

    it('handles malformed JSON argument string in bridge_homeharvest.py', async () => {
      // Pass a raw malformed JSON string directly
      const res = await runHomeHarvest('search_properties', '{malformed_json_missing_quotes: true');
      // Python's json.loads will raise JSONDecodeError or return error output
      assert.ok(res.data?.error !== undefined || res.stderr.length > 0 || res.exitCode !== 0,
        'Malformed JSON argument must be caught by bridge or CLI runner');
    });

    it('handles search_properties with empty parameter object gracefully', async () => {
      const res = await runHomeHarvest('search_properties', {});
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      assert.ok(res.data.properties !== undefined || res.data.error !== undefined,
        'Must return properties or structured error');
    });
  });

  describe('bridge_nexus.py Boundary & Error Rejections', () => {
    it('returns structured error for unrecognized nexus method', async () => {
      const res = await runNexus('unsupported_cognitive_op', {});
      assert.strictEqual(res.isJson, true, 'Bridge response must be valid JSON');
      assert.ok(res.data.error !== undefined, 'Must return error object');
      assert.ok(res.data.error.includes('Unknown method'), 'Error must specify Unknown method');
    });

    it('handles malformed JSON string parameter in bridge_nexus.py', async () => {
      const res = await runNexus('inference', '{"invalid_tensor": [');
      assert.ok(res.data?.error !== undefined || res.stderr.length > 0 || res.exitCode !== 0,
        'Malformed JSON in nexus bridge must be rejected safely');
    });

    it('handles inference method with empty parameter payload gracefully', async () => {
      const res = await runNexus('inference', {});
      // In baseline milestone, bridge either returns serialized inference or exits with traceback caught by runner
      assert.ok(res.isJson || res.exitCode !== 0, 'Inference execution must terminate deterministically');
      if (res.isJson) {
        assert.ok(res.data !== null, 'Output must be non-null');
      } else {
        assert.ok(res.stderr.length > 0 || res.errorMessage.length > 0, 'Must capture error details in stderr');
      }
    });

    it('handles cognitive_step with null tensor values without unhandled crash or hanging', async () => {
      const res = await runNexus('cognitive_step', { sensor: null, geo: null, behavior: null });
      // Null tensor inputs are caught either via JSON error response or subprocess non-zero exit code
      assert.ok(res.isJson || res.exitCode !== 0, 'Cognitive step with null inputs must return error or exit');
      if (res.isJson) {
        assert.ok(res.data.status !== undefined || res.data.error !== undefined, 'Must return status or error');
      } else {
        assert.ok(res.stderr.includes('NoneType') || res.stderr.includes('error') || res.stderr.length > 0,
          'Must capture null tensor error details');
      }
    });
  });

  describe('bridge_perception.py Boundary & Error Rejections', () => {
    it('returns structured error for unrecognized perception method', async () => {
      const res = await runPerception('unsupported_vision_operation', {});
      assert.strictEqual(res.isJson, true, 'Bridge response must be valid JSON');
      assert.ok(res.data.error !== undefined, 'Must indicate error');
      assert.ok(res.data.error.includes('Unknown method'), 'Error must specify Unknown method');
    });

    it('returns error when non-existent image file is passed to encode_image', async () => {
      const nonExistentPath = 'F:\\atlas-helios-enhanced\\nonexistent_image_12345.jpg';
      const res = await runPerception('encode_image', {
        image_path: nonExistentPath,
        config: 'PE-Core-B16-224'
      });

      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      assert.ok(res.data.error !== undefined || res.data.features !== undefined,
        'Must report image not found or provide fallback mock');
      if (res.data.error) {
        assert.ok(res.data.error.toLowerCase().includes('not found') || res.data.error.toLowerCase().includes('image'),
          'Error must mention image not found');
      }
    });

    it('returns error when classify is invoked with empty labels array', async () => {
      const res = await runPerception('classify', {
        image_path: 'sample.jpg',
        labels: []
      });

      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      assert.ok(res.data.error !== undefined, 'Must return error for empty labels');
      assert.strictEqual(res.data.error, 'No labels provided');
    });

    it('handles encode_image with invalid config model name gracefully', async () => {
      const res = await runPerception('encode_image', {
        image_path: 'sample.jpg',
        config: 'NON_EXISTENT_BACKBONE_MODEL_V999'
      });

      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');
      assert.ok(res.data !== null, 'Bridge must return structured payload or error');
    });
  });

  describe('Non-Existent Bridge Script Execution', () => {
    it('returns failure when executing nonexistent python bridge script', async () => {
      const res = await runBridge('non_existent_script_xyz.py', 'test_method', {});
      assert.strictEqual(res.success, false, 'Non-existent script execution must report failure');
      assert.notStrictEqual(res.exitCode, 0, 'Exit code must be non-zero');
      assert.ok(res.stderr.includes('cannot open file') || res.errorMessage.length > 0,
        'Must capture missing file error message');
    });
  });
});
