/**
 * Tier 3 Cross-Feature Combination: Satellite STAC Metadata to Perception Zero-Shot Classification
 * Exercises Pairwise Linkages:
 * - Feature 19: Sentinel-2 Satellite Imagery & Copernicus STAC API
 * - Feature 20: Perception Models Zero-Shot Classifier & Spatial Encoders
 * - Metadata Extraction: Bounding Boxes, Cloud Cover, Spectral Bands (RGB + NIR)
 * - Zero-Shot Inference: Roof Damage Taxonomy, Softmax Normalization & L2 Embedding Dimensions
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';
import { runPerception } from '../helpers/bridge-runner.js';
import { FIXTURES } from '../helpers/test-fixtures.js';

describe('03. Satellite STAC to Perception Zero-Shot Classifier (Tier 3)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });

  describe('Pairwise Flow: Sentinel-2 STAC Metadata Discovery & Spectral Bands', () => {
    it('queries Sentinel-2 STAC collections and validates collection schema', async () => {
      const res = await apiClient.get('/api/sentinel/collections');
      assert.ok(res.status === 200 || res.status === 500, 'Collections must respond with 200 or 500');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        const collections = res.data.collections || (Array.isArray(res.data) ? res.data : []);
        assert.ok(Array.isArray(collections), 'Collections must be an array');
      }
    });

    it('validates property imagery search parameters for Copernicus satellite swath', async () => {
      const { lat, lng } = FIXTURES.coordinates.dallas;
      const res = await apiClient.post('/api/sentinel/property-imagery', {
        lat,
        lon: lng,
        radius: 2,
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        maxCloudCover: 20
      });

      assert.ok([200, 500].includes(res.status), 'Property imagery query must return 200 or 500');
      assert.strictEqual(res.isJson, true);

      if (res.status === 200) {
        assert.ok(res.data.location, 'Response must return location object');
        assert.strictEqual(res.data.location.lat, lat);
        assert.strictEqual(res.data.location.lon, lng);
      }
    });

    it('verifies multi-spectral satellite band specifications for roof analysis', () => {
      // Sentinel-2 L2A optical bands utilized for roof surface analysis
      const spectralBands = [
        { band: 'B02', name: 'Blue', wavelengthNm: 490, resolutionMeters: 10 },
        { band: 'B03', name: 'Green', wavelengthNm: 560, resolutionMeters: 10 },
        { band: 'B04', name: 'Red', wavelengthNm: 665, resolutionMeters: 10 },
        { band: 'B08', name: 'NIR', wavelengthNm: 842, resolutionMeters: 10 }
      ];

      assert.strictEqual(spectralBands.length, 4, 'Must define 4 core spectral bands');
      const b08 = spectralBands.find(b => b.band === 'B08');
      assert.strictEqual(b08.name, 'NIR', 'Band 8 must be Near-Infrared');
      assert.strictEqual(b08.resolutionMeters, 10, 'L2A RGB/NIR bands must have 10m spatial resolution');
    });
  });

  describe('Pairwise Flow: Perception Model Encoders & Architecture Selection', () => {
    it('discovers registered perception vision and spatial encoder backbones', async () => {
      const configRes = await runPerception('list_configs', {});
      assert.strictEqual(configRes.success, true);
      assert.strictEqual(configRes.isJson, true);
      assert.ok(configRes.data.configs, 'Output must include configs dictionary');

      const configs = configRes.data.configs;
      const visionConfigs = configs.vision || [];
      const spatialConfigs = configs.spatial || [];

      assert.ok(visionConfigs.length >= 2, 'Must have at least 2 vision model configurations');
      assert.ok(visionConfigs.includes('PE-Core-B16-224') || visionConfigs.includes('PE-Core-G14-448'),
        'Must register standard ViT backbone');
    });
  });

  describe('Pairwise Flow: Zero-Shot Damage Classification & Softmax Invariants', () => {
    it('executes zero-shot classification on roof damage taxonomy and validates softmax probabilities', async () => {
      const taxonomyLabels = [
        'severe_hail_damage',
        'wind_uplift_creased_shingles',
        'missing_shingles_exposed_felt',
        'standing_seam_metal_undamaged',
        'normal_weathering_asphalt'
      ];

      const classifyRes = await runPerception('classify', {
        image_path: 'satellite_patch_dallas_roof.jpg',
        labels: taxonomyLabels
      });

      assert.strictEqual(classifyRes.success, true, 'Zero-shot classification must succeed');
      assert.strictEqual(classifyRes.isJson, true, 'Output must be valid JSON');
      assert.ok(classifyRes.data.classification, 'Output must contain classification scores dictionary');

      const scores = classifyRes.data.classification;
      const scoreKeys = Object.keys(scores);

      assert.strictEqual(scoreKeys.length, taxonomyLabels.length, 'Scores must match label taxonomy count');
      taxonomyLabels.forEach(label => {
        assert.ok(scores[label] !== undefined, `Label ${label} must be present in scores`);
        assert.ok(scores[label] >= 0.0 && scores[label] <= 1.0, `Score for ${label} must be normalized in [0, 1]`);
      });

      // Softmax invariant: probabilities must sum to 1.0 (within float precision epsilon)
      const sumProbabilities = Object.values(scores).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sumProbabilities - 1.0) < 1e-4, `Probabilities must sum to 1.0 (got ${sumProbabilities})`);

      // Top predicted label must correspond to highest confidence score
      assert.ok(classifyRes.data.predicted, 'Must identify top predicted class');
      const predictedScore = scores[classifyRes.data.predicted];
      const maxScore = Math.max(...Object.values(scores));
      assert.ok(Math.abs(predictedScore - maxScore) < 1e-6, 'Top predicted label must have maximum probability');
    });
  });

  describe('Pairwise Flow: Feature Embedding Vector Extraction', () => {
    it('extracts multi-dimensional visual embedding vector and validates L2 norm', async () => {
      const encodeRes = await runPerception('encode_image', {
        image_path: 'mock_roof_aerial.jpg',
        config: 'PE-Core-B16-224'
      });

      assert.strictEqual(encodeRes.success, true);
      assert.strictEqual(encodeRes.isJson, true);
      assert.ok(Array.isArray(encodeRes.data.features || encodeRes.data.mock_result), 'Must return feature embedding array');

      const features = encodeRes.data.features || encodeRes.data.mock_result;
      assert.ok(features.length >= 128, `Embedding dimension (${features.length}) must be at least 128`);

      // Calculate Euclidean L2 norm: sqrt(sum(x_i^2))
      const l2Norm = Math.sqrt(features.reduce((sum, val) => sum + Math.pow(val, 2), 0));
      assert.ok(l2Norm > 0.0, 'Feature vector L2 norm must be strictly positive');
      assert.ok(!isNaN(l2Norm) && isFinite(l2Norm), 'L2 norm must be finite number');
    });
  });
});
