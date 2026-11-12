/**
 * Nexus Mind AI API Routes
 * 
 * Exposes Nexus Mind cognitive capabilities through REST API
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// Import Nexus Mind Integration
let NexusMindIntegration;
try {
  NexusMindIntegration = require('../integrations/NexusMindIntegration');
} catch (e) {
  logger.warn('Nexus Mind Integration not available:', e.message);
}

/**
 * Report a Nexus failure without misreporting it or leaking the estate.
 *
 * Every handler here used to end `res.status(500).json({ error: error.message })`,
 * which got two things wrong at once. Nexus runs as a separate service, so when
 * it is simply not running the request failed for want of a *dependency* - a
 * 503, something the caller can sensibly retry - not because this server broke.
 * And `error.message` for a refused connection is literally
 * `connect ECONNREFUSED 127.0.0.1:5051`, so the browser was being handed the
 * internal address and port of a backend service by any unauthenticated caller
 * who could reach the route.
 *
 * Connection-shaped failures therefore become a 503 carrying a stable code and
 * a sentence meant for a person. Anything else stays a 500, logged in full here
 * but reported to the caller as a generic failure.
 */
const UNREACHABLE = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EHOSTUNREACH', 'ETIMEDOUT', 'EAI_AGAIN'
]);

const failNexus = (res, error, what) => {
  const cause = error?.code || error?.cause?.code;

  if (UNREACHABLE.has(cause) || error?.name === 'AbortError') {
    logger.warn(`${what}: Nexus is unreachable (${cause || error?.name})`);
    return res.status(503).json({
      error: 'The Nexus analysis service is not reachable.',
      code: 'NEXUS_UNAVAILABLE'
    });
  }

  logger.error(`${what}:`, error?.message || error);
  return res.status(500).json({ error: 'Request failed', code: 'INTERNAL_ERROR' });
};

/**
 * @route   GET /api/nexus/status
 * @desc    Get Nexus Mind integration status
 * @access  Public
 */
router.get('/status', async (req, res) => {
  try {
    if (!NexusMindIntegration) {
      return res.json({
        available: false,
        message: 'Nexus Mind Integration not loaded'
      });
    }

    const status = NexusMindIntegration.getStatus();
    res.json({
      available: true,
      ...status
    });
  } catch (error) {
    return failNexus(res, error, 'Error getting Nexus Mind status');
  }
});

/**
 * @route   POST /api/nexus/storm/analyze
 * @desc    Analyze storm event with cognitive enhancement
 * @access  Private
 */
router.post('/storm/analyze', authMiddleware, async (req, res) => {
  try {
    if (!NexusMindIntegration) {
      return res.status(503).json({
        error: 'Nexus Mind Integration not available'
      });
    }

    const stormData = req.body;
    logger.info(`Processing storm analysis request: ${stormData.id || 'unknown'}`);

    const result = await NexusMindIntegration.processStormEvent(stormData);
    
    res.json({
      success: true,
      data: result,
      enhanced: !result.fallback
    });
  } catch (error) {
    return failNexus(res, error, 'Storm analysis error');
  }
});

/**
 * @route   POST /api/nexus/property/analyze
 * @desc    Analyze property with cognitive enhancement
 * @access  Private
 */
router.post('/property/analyze', authMiddleware, async (req, res) => {
  try {
    if (!NexusMindIntegration) {
      return res.status(503).json({
        error: 'Nexus Mind Integration not available'
      });
    }

    const { property, cv_analysis } = req.body;
    logger.info(`Processing property analysis request: ${property?.id || 'unknown'}`);

    const result = await NexusMindIntegration.analyzeProperty(property, cv_analysis);
    
    res.json({
      success: true,
      data: result,
      enhanced: !result.fallback
    });
  } catch (error) {
    return failNexus(res, error, 'Property analysis error');
  }
});

/**
 * @route   POST /api/nexus/vision/classify
 * @desc    Classify image using Perception Encoder
 * @access  Private
 */
router.post('/vision/classify', authMiddleware, async (req, res) => {
  try {
    if (!NexusMindIntegration) {
      return res.status(503).json({
        error: 'Nexus Mind Integration not available'
      });
    }

    const { image_path, labels } = req.body;
    
    if (!image_path || !labels || !Array.isArray(labels)) {
      return res.status(400).json({
        error: 'Missing required fields: image_path, labels (array)'
      });
    }

    logger.info(`Processing image classification: ${image_path}`);
    const result = await NexusMindIntegration.classifyImage(image_path, labels);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return failNexus(res, error, 'Image classification error');
  }
});

/**
 * @route   POST /api/nexus/cognitive/process
 * @desc    Process sensor data through cognitive pipeline
 * @access  Private
 */
router.post('/cognitive/process', authMiddleware, async (req, res) => {
  try {
    if (!NexusMindIntegration) {
      return res.status(503).json({
        error: 'Nexus Mind Integration not available'
      });
    }

    const { sensor_data, context } = req.body;
    
    if (!sensor_data || !Array.isArray(sensor_data)) {
      return res.status(400).json({
        error: 'Missing required field: sensor_data (array)'
      });
    }

    logger.info(`Processing cognitive request with ${sensor_data.length} sensors`);
    const result = await NexusMindIntegration.cognitiveProcess(sensor_data, context);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return failNexus(res, error, 'Cognitive processing error');
  }
});

/**
 * @route   GET /api/nexus/config
 * @desc    Get Nexus Mind bridge configuration
 * @access  Private (Admin)
 */
router.get('/config', authMiddleware, async (req, res) => {
  try {
    if (!NexusMindIntegration) {
      return res.status(503).json({
        error: 'Nexus Mind Integration not available'
      });
    }

    const config = await NexusMindIntegration.getConfig();
    res.json(config);
  } catch (error) {
    return failNexus(res, error, 'Error getting Nexus config');
  }
});

module.exports = router;
