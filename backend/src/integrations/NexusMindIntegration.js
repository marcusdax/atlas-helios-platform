/**
 * Nexus Mind AI Integration Service
 * 
 * Connects Atlas Helios Platform to the Nexus Mind Bridge Service,
 * which in turn connects to:
 * - G:\nexus-mind-ai (Cognitive Engine)
 * - G:\perception_models (Vision Encoder)
 * - G:\perception_models_shared (Shared Module)
 */

const axios = require('axios');
const { logger } = require('../utils/logger');

class NexusMindIntegration {
  constructor() {
    this.baseURL = process.env.NEXUS_BRIDGE_URL || 'http://localhost:5051';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 second timeout for AI processing
      headers: {
        'Content-Type': 'application/json'
      }
    });
    this.isInitialized = false;
    this.components = {
      nexusMind: false,
      perceptionEncoder: false,
      heliosBridge: false
    };
  }

  /**
   * Initialize the Nexus Mind integration
   */
  async initialize(config = {}) {
    try {
      logger.info('Initializing Nexus Mind Integration...');
      logger.info(`Bridge URL: ${this.baseURL}`);

      // Check health first
      const health = await this.healthCheck();
      
      if (!health.status === 'healthy') {
        throw new Error('Nexus Bridge is not healthy');
      }

      this.components = health.components || {};

      // Initialize the bridge if not already initialized
      if (!health.initialized) {
        await this.client.post('/initialize', {
          device: config.device || 'cpu',
          perception_config: config.perceptionConfig || 'PE-Core-B16-224'
        });
        logger.info('Nexus Bridge initialized');
      } else {
        logger.info('Nexus Bridge already initialized');
      }

      this.isInitialized = true;
      logger.info('Nexus Mind Integration ready');
      
      return {
        success: true,
        components: this.components
      };
    } catch (error) {
      logger.error('Failed to initialize Nexus Mind Integration:', error.message);
      throw error;
    }
  }

  /**
   * Health check for the bridge service
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      logger.error('Nexus Bridge health check failed:', error.message);
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Process storm event through Nexus Mind cognitive pipeline
   * @param {Object} stormData - Storm event data
   * @returns {Promise<Object>} Enhanced analysis with cognitive insights
   */
  async processStormEvent(stormData) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info(`Processing storm event through Nexus Mind: ${stormData.id || 'unknown'}`);
      
      const response = await this.client.post('/storm/analyze', stormData);
      
      if (response.data.success) {
        logger.info('Storm event processed successfully with Nexus Mind');
        return response.data.analysis;
      } else {
        throw new Error(response.data.error || 'Processing failed');
      }
    } catch (error) {
      logger.error('Storm processing through Nexus Mind failed:', error.message);
      // Return original data with error info
      return {
        storm_data: stormData,
        cognitive_analysis: null,
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * Analyze property with cognitive enhancement
   * @param {Object} propertyData - Property information
   * @param {Object} cvAnalysis - Computer vision analysis results
   * @returns {Promise<Object>} Enhanced property analysis
   */
  async analyzeProperty(propertyData, cvAnalysis) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info(`Analyzing property through Nexus Mind: ${propertyData.id || 'unknown'}`);
      
      const response = await this.client.post('/property/analyze', {
        property: propertyData,
        cv_analysis: cvAnalysis
      });
      
      if (response.data.success) {
        logger.info('Property analyzed successfully with Nexus Mind');
        return response.data.analysis;
      } else {
        throw new Error(response.data.error || 'Analysis failed');
      }
    } catch (error) {
      logger.error('Property analysis through Nexus Mind failed:', error.message);
      // Return combined data without cognitive enhancement
      return {
        property: propertyData,
        cv_analysis: cvAnalysis,
        cognitive_insights: null,
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * Encode image using Perception Encoder
   * @param {string} imagePath - Path to image file
   * @returns {Promise<Object>} Image features
   */
  async encodeImage(imagePath) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.components.perceptionEncoder) {
        throw new Error('Perception Encoder not available');
      }

      logger.info(`Encoding image with Perception Encoder: ${imagePath}`);
      
      const response = await this.client.post('/vision/encode', {
        image_path: imagePath
      });
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.error || 'Encoding failed');
      }
    } catch (error) {
      logger.error('Image encoding failed:', error.message);
      throw error;
    }
  }

  /**
   * Classify image using Perception Encoder (zero-shot)
   * @param {string} imagePath - Path to image file
   * @param {string[]} labels - Labels to classify against
   * @returns {Promise<Object>} Classification results
   */
  async classifyImage(imagePath, labels) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.components.perceptionEncoder) {
        throw new Error('Perception Encoder not available');
      }

      logger.info(`Classifying image with Perception Encoder: ${imagePath}`);
      
      const response = await this.client.post('/vision/classify', {
        image_path: imagePath,
        labels: labels
      });
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.error || 'Classification failed');
      }
    } catch (error) {
      logger.error('Image classification failed:', error.message);
      throw error;
    }
  }

  /**
   * Process sensor data through cognitive pipeline
   * @param {number[]} sensorData - Sensor input data
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Cognitive processing results
   */
  async cognitiveProcess(sensorData, context = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.components.nexusMind) {
        throw new Error('Nexus Mind not available');
      }

      logger.info('Processing through cognitive pipeline');
      
      const response = await this.client.post('/cognitive/process', {
        sensor_data: sensorData,
        context: context
      });
      
      if (response.data.success) {
        return response.data.result;
      } else {
        throw new Error(response.data.error || 'Processing failed');
      }
    } catch (error) {
      logger.error('Cognitive processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Get bridge configuration
   * @returns {Promise<Object>} Bridge configuration
   */
  async getConfig() {
    try {
      const response = await this.client.get('/config');
      return response.data;
    } catch (error) {
      logger.error('Failed to get bridge config:', error.message);
      throw error;
    }
  }

  /**
   * Check if Nexus Mind is available
   * @returns {boolean}
   */
  isNexusAvailable() {
    return this.components.nexusMind;
  }

  /**
   * Check if Perception Encoder is available
   * @returns {boolean}
   */
  isPerceptionAvailable() {
    return this.components.perceptionEncoder;
  }

  /**
   * Get integration status
   * @returns {Object}
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      bridge_url: this.baseURL,
      components: this.components,
      nexus_available: this.components.nexusMind,
      perception_available: this.components.perceptionEncoder
    };
  }
}

// Export singleton instance
module.exports = new NexusMindIntegration();
