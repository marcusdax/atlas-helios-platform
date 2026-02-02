const tf = require('@tensorflow/tfjs-node');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Computer Vision Service for Property Analysis
 * Handles damage detection, roof assessment, and property condition analysis
 */
class ComputerVisionService {
  constructor() {
    this.models = {
      damageDetection: null,
      roofClassification: null,
      materialDetection: null,
      severityAssessment: null
    };
    this.isInitialized = false;
    this.processingQueue = [];
    this.maxConcurrentProcessing = 5;
    this.currentProcessing = 0;
  }

  /**
   * Initialize all computer vision models
   */
  async initialize() {
    try {
      logger.info('Initializing Computer Vision Service...');

      // Initialize TensorFlow.js with Node.js backend
      await tf.ready();
      
      // Load pre-trained models (in production, these would be custom-trained models)
      await this.loadModels();
      
      // Set up image processing pipeline
      this.setupImagePipeline();
      
      this.isInitialized = true;
      logger.info('Computer Vision Service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Computer Vision Service:', error);
      throw error;
    }
  }

  /**
   * Load TensorFlow.js models
   */
  async loadModels() {
    try {
      // In production, these would be your custom-trained models
      const modelPaths = {
        damageDetection: process.env.CV_DAMAGE_MODEL_PATH || '/models/damage-detection',
        roofClassification: process.env.CV_ROOF_MODEL_PATH || '/models/roof-classification',
        materialDetection: process.env.CV_MATERIAL_MODEL_PATH || '/models/material-detection',
        severityAssessment: process.env.CV_SEVERITY_MODEL_PATH || '/models/severity-assessment'
      };

      // For demo purposes, we'll simulate model loading
      // In production, load actual TensorFlow.js models:
      // this.models.damageDetection = await tf.loadLayersModel(`file://${modelPaths.damageDetection}/model.json`);
      
      logger.info('Computer Vision models loaded (simulated for demo)');
      
    } catch (error) {
      logger.error('Error loading CV models:', error);
      throw error;
    }
  }

  /**
   * Setup image processing pipeline
   */
  setupImagePipeline() {
    // Preprocessing configurations
    this.preprocessingConfig = {
      maxImageSize: 2048,
      minImageSize: 256,
      targetSize: 224,
      normalize: true,
      augmentation: {
        rotate: true,
        flip: true,
        brightness: true,
        contrast: true
      }
    };
  }

  /**
   * Analyze property damage from images
   */
  async analyzePropertyDamage(imageBuffer, propertyData = {}) {
    const startTime = Date.now();
    const analysisId = uuidv4();
    
    try {
      if (!this.isInitialized) {
        throw new Error('Computer Vision Service not initialized');
      }

      logger.info(`Starting damage analysis: ${analysisId}`);

      // Add to processing queue
      const processPromise = this.processDamageAnalysis(imageBuffer, propertyData, analysisId);
      this.processingQueue.push(processPromise);

      // Process with concurrency limit
      const result = await this.processWithConcurrencyLimit(processPromise);
      
      const processingTime = Date.now() - startTime;
      
      // Log performance
      logger.info(`Damage analysis completed: ${analysisId} in ${processingTime}ms`);
      
      return {
        success: true,
        analysisId,
        processingTime,
        timestamp: new Date().toISOString(),
        ...result
      };

    } catch (error) {
      logger.error(`Damage analysis failed: ${analysisId}`, error);
      throw new Error(`Damage analysis failed: ${error.message}`);
    }
  }

  /**
   * Process damage analysis with pipeline
   */
  async processDamageAnalysis(imageBuffer, propertyData, analysisId) {
    try {
      // Step 1: Preprocess image
      const processedImage = await this.preprocessImage(imageBuffer);
      
      // Step 2: Detect damage areas
      const damageDetection = await this.detectDamageAreas(processedImage);
      
      // Step 3: Classify damage types
      const damageClassification = await this.classifyDamageTypes(damageDetection);
      
      // Step 4: Assess severity
      const severityAssessment = await this.assessDamageSeverity(damageClassification, propertyData);
      
      // Step 5: Generate recommendations
      const recommendations = await this.generateDamageRecommendations(severityAssessment);
      
      // Step 6: Calculate confidence scores
      const confidence = this.calculateOverallConfidence([damageDetection, damageClassification, severityAssessment]);
      
      return {
        processedImage: processedImage, // Base64 encoded
        damageDetection,
        damageClassification,
        severityAssessment,
        recommendations,
        confidence,
        metadata: {
          analysisId,
          imageSize: imageBuffer.length,
          processingSteps: 6,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error(`Damage analysis pipeline error: ${analysisId}`, error);
      throw error;
    }
  }

  /**
   * Preprocess image for analysis
   */
  async preprocessImage(imageBuffer) {
    try {
      // Use sharp for image preprocessing
      const processedImage = await sharp(imageBuffer)
        .resize(this.preprocessingConfig.targetSize, this.preprocessingConfig.targetSize, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 90 })
        .toBuffer();

      // Convert to base64 for response
      const base64Image = processedImage.toString('base64');
      
      return {
        buffer: processedImage,
        base64: base64Image,
        dimensions: {
          width: this.preprocessingConfig.targetSize,
          height: this.preprocessingConfig.targetSize
        },
        format: 'jpeg'
      };

    } catch (error) {
      logger.error('Image preprocessing failed:', error);
      throw error;
    }
  }

  /**
   * Detect potential damage areas
   */
  async detectDamageAreas(processedImage) {
    try {
      // In production, this would use the actual TensorFlow.js model
      // For demo purposes, we'll return simulated results
      
      const mockDamageAreas = [
        {
          id: 1,
          boundingBox: {
            x: 120,
            y: 80,
            width: 150,
            height: 100
          },
          confidence: 0.85,
          damageType: 'hail_damage',
          severity: 'moderate',
          description: 'Potential hail impact on roof surface'
        },
        {
          id: 2,
          boundingBox: {
            x: 300,
            y: 200,
            width: 80,
            height: 60
          },
          confidence: 0.72,
          damageType: 'water_damage',
          severity: 'minor',
          description: 'Possible water staining'
        }
      ];

      return {
        areas: mockDamageAreas,
        totalDetected: mockDamageAreas.length,
        averageConfidence: mockDamageAreas.reduce((sum, area) => sum + area.confidence, 0) / mockDamageAreas.length
      };

    } catch (error) {
      logger.error('Damage area detection failed:', error);
      throw error;
    }
  }

  /**
   * Classify damage types
   */
  async classifyDamageTypes(damageDetection) {
    try {
      // In production, this would use classification models
      // For demo, we'll simulate classification results
      
      const classifications = damageDetection.areas.map(area => ({
        ...area,
        detailedClassification: this.getDetailedClassification(area.damageType),
        likelihood: Math.random() * 0.3 + 0.7, // Random 70-100%
        affectedComponents: this.identifyAffectedComponents(area.damageType)
      }));

      return {
        classifications,
        overallType: this.determinePrimaryDamageType(classifications),
        complexity: this.assessDamageComplexity(classifications)
      };

    } catch (error) {
      logger.error('Damage classification failed:', error);
      throw error;
    }
  }

  /**
   * Assess damage severity
   */
  async assessDamageSeverity(damageClassification, propertyData) {
    try {
      // Calculate severity based on multiple factors
      const severityFactors = {
        areaAffected: this.calculateAreaImpact(damageClassification.classifications),
        damageType: this.weightByDamageType(damageClassification.classifications),
        ageOfProperty: this.calculateAgeFactor(propertyData.yearBuilt),
        weatherIntensity: this.calculateWeatherFactor(propertyData.weatherData)
      };

      const overallSeverity = this.calculateOverallSeverity(severityFactors);

      return {
        severity: overallSeverity.level,
        score: overallSeverity.score, // 0-100
        factors: severityFactors,
        priority: this.determinePriority(overallSeverity.score),
        estimatedCost: this.estimateRepairCost(overallSeverity, propertyData),
        urgencyLevel: this.determineUrgency(overallSeverity.score)
      };

    } catch (error) {
      logger.error('Severity assessment failed:', error);
      throw error;
    }
  }

  /**
   * Generate repair recommendations
   */
  async generateDamageRecommendations(severityAssessment) {
    try {
      const recommendations = [];
      
      // Add immediate safety recommendations
      if (severityAssessment.score > 70) {
        recommendations.push({
          type: 'immediate_action',
          priority: 'critical',
          title: 'Immediate Professional Inspection Required',
          description: 'Significant damage detected. Schedule professional assessment within 24 hours.',
          timeframe: '24 hours'
        });
      }

      // Add damage-specific recommendations
      const damageRecommendations = this.getDamageSpecificRecommendations(severityAssessment.severity);
      recommendations.push(...damageRecommendations);

      // Add preventive recommendations
      const preventiveRecommendations = this.getPreventiveRecommendations(severityAssessment);
      recommendations.push(...preventiveRecommendations);

      return {
        immediate: recommendations.filter(r => r.priority === 'critical'),
        shortTerm: recommendations.filter(r => r.priority === 'high'),
        longTerm: recommendations.filter(r => r.priority === 'medium'),
        all: recommendations
      };

    } catch (error) {
      logger.error('Recommendation generation failed:', error);
      throw error;
    }
  }

  /**
   * Process image with concurrency limit
   */
  async processWithConcurrencyLimit(processPromise) {
    return new Promise(async (resolve, reject) => {
      // Wait for available processing slot
      while (this.currentProcessing >= this.maxConcurrentProcessing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.currentProcessing++;
      
      try {
        const result = await processPromise;
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        this.currentProcessing--;
      }
    });
  }

  /**
   * Calculate overall confidence score
   */
  calculateOverallConfidence(analyses) {
    const weights = [0.4, 0.35, 0.25]; // Damage detection, classification, severity
    const confidences = [
      analyses[0]?.averageConfidence || 0,
      analyses[1]?.overallType?.confidence || 0,
      analyses[2]?.score / 100 || 0
    ];

    return confidences.reduce((sum, confidence, index) => {
      return sum + (confidence * weights[index]);
    }, 0);
  }

  // Helper methods for mock data generation
  getDetailedClassification(damageType) {
    const classifications = {
      hail_damage: ['bruising', 'granule_loss', 'cracking'],
      water_damage: ['staining', 'mold_growth', 'structural_weakness'],
      wind_damage: ['missing_materials', 'loose_fasteners', 'exposed_underlayment'],
      structural: ['foundation_cracks', 'wall_shift', 'roof_sagging']
    };
    
    return classifications[damageType] || ['unknown'];
  }

  identifyAffectedComponents(damageType) {
    const components = {
      hail_damage: ['roof_shingles', 'gutters', 'skylights'],
      water_damage: ['interior_walls', 'ceiling', 'insulation'],
      wind_damage: ['roof_decking', 'flashings', 'chimney'],
      structural: ['foundation', 'load_bearing_walls', 'roof_structure']
    };
    
    return components[damageType] || ['unknown_components'];
  }

  determinePrimaryDamageType(classifications) {
    const typeCounts = {};
    classifications.forEach(classification => {
      typeCounts[classification.damageType] = (typeCounts[classification.damageType] || 0) + 1;
    });
    
    const primaryType = Object.keys(typeCounts).reduce((a, b) => 
      typeCounts[a] > typeCounts[b] ? a : b
    );
    
    return { type: primaryType, count: typeCounts[primaryType], confidence: 0.85 };
  }

  assessDamageComplexity(classifications) {
    const uniqueTypes = new Set(classifications.map(c => c.damageType)).size;
    return uniqueTypes > 2 ? 'complex' : uniqueTypes > 1 ? 'moderate' : 'simple';
  }

  calculateAreaImpact(classifications) {
    return classifications.reduce((total, area) => {
      return total + (area.boundingBox.width * area.boundingBox.height);
    }, 0);
  }

  weightByDamageType(classifications) {
    const weights = {
      structural: 1.0,
      water_damage: 0.8,
      hail_damage: 0.6,
      wind_damage: 0.5
    };
    
    return classifications.reduce((weighted, classification) => {
      return weighted + (weights[classification.damageType] || 0.3);
    }, 0) / classifications.length;
  }

  calculateAgeFactor(yearBuilt) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - yearBuilt;
    return Math.min(age / 50, 1); // Cap at 50 years
  }

  calculateWeatherFactor(weatherData) {
    return weatherData?.intensity || 0.5; // Default medium intensity
  }

  calculateOverallSeverity(factors) {
    const weights = {
      areaAffected: 0.3,
      damageType: 0.4,
      ageOfProperty: 0.2,
      weatherIntensity: 0.1
    };
    
    const score = Object.keys(factors).reduce((total, factor) => {
      return total + (factors[factor] * weights[factor]);
    }, 0) * 100;
    
    let level = 'minor';
    if (score > 80) level = 'severe';
    else if (score > 60) level = 'major';
    else if (score > 40) level = 'moderate';
    else if (score > 20) level = 'minor';
    
    return { score: Math.round(score), level };
  }

  determinePriority(score) {
    if (score > 80) return 'emergency';
    if (score > 60) return 'high';
    if (score > 40) return 'medium';
    return 'low';
  }

  estimateRepairCost(severity, propertyData) {
    const baseCost = propertyData.squareFootage * 10; // $10 per sq ft base
    const multiplier = severity.score / 100;
    return Math.round(baseCost * multiplier);
  }

  determineUrgency(score) {
    if (score > 80) return 'immediate';
    if (score > 60) return 'within_week';
    if (score > 40) return 'within_month';
    return 'routine';
  }

  getDamageSpecificRecommendations(severity) {
    const recommendations = [];
    
    if (severity.severity === 'severe' || severity.severity === 'major') {
      recommendations.push({
        type: 'professional_assessment',
        priority: 'high',
        title: 'Professional Contractor Inspection',
        description: 'Schedule comprehensive professional assessment',
        timeframe: '48-72 hours'
      });
    }
    
    return recommendations;
  }

  getPreventiveRecommendations(severityAssessment) {
    return [
      {
        type: 'preventive',
        priority: 'low',
        title: 'Regular Maintenance Program',
        description: 'Implement scheduled maintenance to prevent future damage',
        timeframe: 'ongoing'
      }
    ];
  }
}

// Export singleton instance
module.exports = new ComputerVisionService();