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
    logger.error('Error getting Nexus Mind status:', error);
    res.status(500).json({ error: error.message });
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
    logger.error('Storm analysis error:', error);
    res.status(500).json({ error: error.message });
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
    logger.error('Property analysis error:', error);
    res.status(500).json({ error: error.message });
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
    logger.error('Image classification error:', error);
    res.status(500).json({ error: error.message });
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
    logger.error('Cognitive processing error:', error);
    res.status(500).json({ error: error.message });
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
    logger.error('Error getting Nexus config:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
