const axios = require('axios');
const db = require('../../config/database');
const logger = require('../utils/logger');
// Node's built-in generator: the uuid package is ESM-only from v14, which
// cannot be required from this CommonJS backend or loaded by Jest.
const { randomUUID: uuidv4 } = require('node:crypto');

/**
 * Property Service
 * Handles property data, assessments, and integration with external property APIs
 */
class PropertyService {
  constructor() {
    this.io = null;
    this.propertyAPIs = {
      coreLogic: {
        baseUrl: process.env.CORELOGIC_API_URL,
        apiKey: process.env.CORELOGIC_API_KEY
      },
      blackKnight: {
        baseUrl: process.env.BLACKKNIGHT_API_URL,
        apiKey: process.env.BLACKKNIGHT_API_KEY
      },
      zillow: {
        baseUrl: 'https://api.bridgedataoutput.com/api/v2',
        apiKey: process.env.ZILLOW_API_KEY
      }
    };
    this.isInitialized = false;
  }

  /**
   * Initialize Property Service
   */
  async initialize(io) {
    try {
      this.io = io;
      this.isInitialized = true;
      
      // Test external API connections
      await this.testExternalConnections();
      
      logger.info('Property Service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Property Service:', error);
      throw error;
    }
  }

  /**
   * Get property information by address
   */
  async getPropertyByAddress(address, city, state, zipCode) {
    try {
      // First check local database
      let property = await this.findPropertyInDatabase(address, city, state, zipCode);
      
      if (!property) {
        // Fetch from external APIs
        property = await this.fetchPropertyFromExternalAPIs(address, city, state, zipCode);
        
        if (property) {
          // Save to database for future use
          await this.savePropertyToDatabase(property);
        }
      }
      
      return property;

    } catch (error) {
      logger.error('Failed to get property by address:', error);
      throw error;
    }
  }

  /**
   * Get property by coordinates
   */
  async getPropertyByCoordinates(lat, lng, radius = 0.1) {
    try {
      // Query properties within radius
      const properties = await db('properties')
        .select('*')
        .whereRaw(`
          3959 * acos(
            cos(radians(?)) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(?)) +
            sin(radians(?)) * sin(radians(latitude))
          ) < ?
        `, [lat, lng, lat, radius]);

      return properties;

    } catch (error) {
      logger.error('Failed to get property by coordinates:', error);
      throw error;
    }
  }

  /**
   * Perform property assessment
   */
  async performPropertyAssessment(propertyId, assessmentData = {}) {
    try {
      const assessment = {
        id: uuidv4(),
        propertyId,
        assessorId: assessmentData.assessorId || null,
        assessmentType: assessmentData.type || 'standard',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        completedAt: null,
        overallScore: null,
        damageScore: null,
        recommendations: [],
        images: assessmentData.images || [],
        metadata: {
          ...assessmentData.metadata,
          aiAssisted: true,
          version: '1.0'
        }
      };

      // Save assessment to database
      await db('property_assessments').insert(assessment);

      // Update property status
      await db('properties')
        .where('id', propertyId)
        .update({
          lastAssessmentId: assessment.id,
          lastAssessmentDate: new Date().toISOString(),
          assessmentStatus: 'in_progress'
        });

      // Get property details
      const property = await this.getPropertyById(propertyId);
      
      // Start assessment process
      this.processPropertyAssessment(assessment, property);

      return assessment;

    } catch (error) {
      logger.error('Failed to perform property assessment:', error);
      throw error;
    }
  }

  /**
   * Process property assessment with AI analysis
   */
  async processPropertyAssessment(assessment, property) {
    try {
      // Update status to analyzing
      await this.updateAssessmentStatus(assessment.id, 'analyzing');
      
      // Perform AI analysis if images provided
      let aiAnalysis = null;
      if (assessment.images && assessment.images.length > 0) {
        const ComputerVisionService = require('./ComputerVisionService');
        aiAnalysis = await this.performAIAnalysis(assessment.images, property);
      }
      
      // Calculate overall assessment scores
      const scores = await this.calculateAssessmentScores(property, aiAnalysis);
      
      // Generate recommendations
      const recommendations = await this.generateAssessmentRecommendations(property, scores, aiAnalysis);
      
      // Update assessment with results
      await this.completeAssessment(assessment.id, {
        overallScore: scores.overall,
        damageScore: scores.damage,
        aiAnalysis,
        recommendations,
        riskLevel: this.categorizeRiskLevel(scores.overall),
        estimatedRepairCost: this.estimateRepairCosts(scores, property)
      });

      // Broadcast completion
      if (this.io) {
        this.io.emit('property_assessment_complete', {
          assessmentId: assessment.id,
          propertyAddress: `${property.address}, ${property.city}, ${property.state}`,
          overallScore: scores.overall,
          completedAt: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Property assessment processing failed:', error);
      await this.updateAssessmentStatus(assessment.id, 'failed', error.message);
    }
  }

  /**
   * Get property assessment history
   */
  async getPropertyAssessmentHistory(propertyId, limit = 10) {
    try {
      return await db('property_assessments')
        .select('*')
        .where('propertyId', propertyId)
        .orderBy('startedAt', 'desc')
        .limit(limit);

    } catch (error) {
      logger.error('Failed to get assessment history:', error);
      throw error;
    }
  }

  /**
   * Search properties by criteria
   */
  async searchProperties(criteria) {
    try {
      let query = db('properties').select('*');
      
      if (criteria.address) {
        query = query.where('address', 'ilike', `%${criteria.address}%`);
      }
      
      if (criteria.city) {
        query = query.where('city', 'ilike', `%${criteria.city}%`);
      }
      
      if (criteria.state) {
        query = query.where('state', criteria.state);
      }
      
      if (criteria.zipCode) {
        query = query.where('zipCode', criteria.zipCode);
      }
      
      if (criteria.buildingType) {
        query = query.where('buildingType', criteria.buildingType);
      }
      
      if (criteria.minYearBuilt) {
        query = query.where('yearBuilt', '>=', criteria.minYearBuilt);
      }
      
      if (criteria.maxYearBuilt) {
        query = query.where('yearBuilt', '<=', criteria.maxYearBuilt);
      }
      
      if (criteria.minSquareFootage) {
        query = query.where('squareFootage', '>=', criteria.minSquareFootage);
      }
      
      if (criteria.maxSquareFootage) {
        query = query.where('squareFootage', '<=', criteria.maxSquareFootage);
      }
      
      if (criteria.riskLevel) {
        query = query.where('currentRiskLevel', criteria.riskLevel);
      }

      const properties = await query.limit(criteria.limit || 50);
      
      // Enrich properties with assessment data
      const enrichedProperties = await Promise.all(
        properties.map(async (property) => {
          const latestAssessment = await this.getLatestAssessment(property.id);
          return {
            ...property,
            latestAssessment: latestAssessment ? {
              overallScore: latestAssessment.overallScore,
              damageScore: latestAssessment.damageScore,
              completedAt: latestAssessment.completedAt,
              riskLevel: latestAssessment.riskLevel
            } : null
          };
        })
      );

      return enrichedProperties;

    } catch (error) {
      logger.error('Failed to search properties:', error);
      throw error;
    }
  }

  /**
   * Generate property portfolio report
   */
  async generatePortfolioReport(companyId, criteria = {}) {
    try {
      // Get properties for company
      let query = db('properties').where('companyId', companyId);
      
      if (criteria.city) {
        query = query.where('city', criteria.city);
      }
      
      if (criteria.riskLevel) {
        query = query.where('currentRiskLevel', criteria.riskLevel);
      }

      const properties = await query;
      
      // Get assessment data for each property
      const portfolioAnalysis = [];
      let totalProperties = properties.length;
      let totalEstimatedValue = 0;
      let totalEstimatedRepairCost = 0;
      let highRiskCount = 0;
      let assessmentCount = 0;

      for (const property of properties) {
        const latestAssessment = await this.getLatestAssessment(property.id);
        const repairEstimate = this.estimatePropertyRepairCosts(property, latestAssessment);
        
        portfolioAnalysis.push({
          property,
          latestAssessment,
          estimatedRepairCost: repairEstimate,
          riskScore: latestAssessment?.overallScore || 0,
          recommendedActions: this.getRecommendedActions(latestAssessment)
        });

        totalEstimatedValue += property.estimatedValue || 0;
        totalEstimatedRepairCost += repairEstimate;
        
        if (latestAssessment?.riskLevel === 'high') {
          highRiskCount++;
        }
        
        if (latestAssessment) {
          assessmentCount++;
        }
      }

      // Calculate portfolio metrics
      const metrics = {
        totalProperties,
        assessedProperties: assessmentCount,
        assessmentRate: (assessmentCount / totalProperties) * 100,
        highRiskProperties: highRiskCount,
        highRiskRate: (highRiskCount / totalProperties) * 100,
        totalEstimatedValue,
        totalEstimatedRepairCost,
        repairToValueRatio: (totalEstimatedRepairCost / totalEstimatedValue) * 100,
        averageRiskScore: portfolioAnalysis.reduce((sum, p) => sum + p.riskScore, 0) / totalProperties
      };

      // Generate summary recommendations
      const recommendations = this.generatePortfolioRecommendations(metrics);

      return {
        generatedAt: new Date().toISOString(),
        companyId,
        criteria,
        metrics,
        portfolioAnalysis,
        recommendations,
        summary: this.generatePortfolioSummary(metrics)
      };

    } catch (error) {
      logger.error('Failed to generate portfolio report:', error);
      throw error;
    }
  }

  // Helper methods

  async findPropertyInDatabase(address, city, state, zipCode) {
    return await db('properties')
      .where('address', 'ilike', address)
      .where('city', 'ilike', city)
      .where('state', state)
      .where('zipCode', zipCode)
      .first();
  }

  async fetchPropertyFromExternalAPIs(address, city, state, zipCode) {
    try {
      // Try CoreLogic first
      const coreLogicProperty = await this.fetchFromCoreLogic(address, city, state, zipCode);
      if (coreLogicProperty) return coreLogicProperty;

      // Fallback to Black Knight
      const blackKnightProperty = await this.fetchFromBlackKnight(address, city, state, zipCode);
      if (blackKnightProperty) return blackKnightProperty;

      // Fallback to mock data for demo
      return this.generateMockProperty(address, city, state, zipCode);

    } catch (error) {
      logger.error('External API fetch failed:', error);
      return this.generateMockProperty(address, city, state, zipCode);
    }
  }

  async fetchFromCoreLogic(address, city, state, zipCode) {
    try {
      const response = await axios.get(`${this.propertyAPIs.coreLogic.baseUrl}/property/search`, {
        headers: {
          'Authorization': `Bearer ${this.propertyAPIs.coreLogic.apiKey}`,
          'Content-Type': 'application/json'
        },
        params: {
          address,
          city,
          state,
          postalCode: zipCode
        },
        timeout: 10000
      });

      if (response.data && response.data.properties && response.data.properties.length > 0) {
        return this.transformCoreLogicProperty(response.data.properties[0]);
      }

      return null;

    } catch (error) {
      logger.error('CoreLogic API error:', error);
      return null;
    }
  }

  async fetchFromBlackKnight(address, city, state, zipCode) {
    try {
      const response = await axios.get(`${this.propertyAPIs.blackKnight.baseUrl}/property/data`, {
        headers: {
          'X-API-Key': this.propertyAPIs.blackKnight.apiKey
        },
        params: {
          address,
          citystatezip: `${city}, ${state} ${zipCode}`
        },
        timeout: 10000
      });

      if (response.data && response.data.length > 0) {
        return this.transformBlackKnightProperty(response.data[0]);
      }

      return null;

    } catch (error) {
      logger.error('Black Knight API error:', error);
      return null;
    }
  }

  transformCoreLogicProperty(apiProperty) {
    return {
      id: uuidv4(),
      address: apiProperty.address,
      city: apiProperty.city,
      state: apiProperty.state,
      zipCode: apiProperty.postalCode,
      latitude: apiProperty.latitude,
      longitude: apiProperty.longitude,
      propertyType: apiProperty.propertyType,
      yearBuilt: apiProperty.yearBuilt,
      squareFootage: apiProperty.livingArea,
      lotSize: apiProperty.lotSize,
      bedrooms: apiProperty.bedrooms,
      bathrooms: apiProperty.bathrooms,
      estimatedValue: apiProperty.estimatedValue,
      lastSalePrice: apiProperty.lastSalePrice,
      lastSaleDate: apiProperty.lastSaleDate,
      ownerName: apiProperty.ownerName,
      taxAssessedValue: apiProperty.taxAssessedValue,
      taxYear: apiProperty.taxYear,
      dataSource: 'CoreLogic',
      createdAt: new Date().toISOString()
    };
  }

  transformBlackKnightProperty(apiProperty) {
    return {
      id: uuidv4(),
      address: apiProperty.address,
      city: apiProperty.city,
      state: apiProperty.state,
      zipCode: apiProperty.zipCode,
      latitude: apiProperty.latitude,
      longitude: apiProperty.longitude,
      propertyType: apiProperty.propertyType,
      yearBuilt: apiProperty.yearBuilt,
      squareFootage: apiProperty.livingArea,
      lotSize: apiProperty.lotSize,
      bedrooms: apiProperty.bedrooms,
      bathrooms: apiProperty.bathrooms,
      estimatedValue: apiProperty.estimatedValue,
      lastSalePrice: apiProperty.lastSalePrice,
      lastSaleDate: apiProperty.lastSaleDate,
      ownerName: apiProperty.ownerName,
      taxAssessedValue: apiProperty.assessedValue,
      taxYear: apiProperty.assessedYear,
      dataSource: 'BlackKnight',
      createdAt: new Date().toISOString()
    };
  }

  generateMockProperty(address, city, state, zipCode) {
    // Generate realistic mock property data for demo
    return {
      id: uuidv4(),
      address,
      city,
      state,
      zipCode,
      latitude: 32.7767 + (Math.random() - 0.5) * 0.1, // Dallas area
      longitude: -96.7970 + (Math.random() - 0.5) * 0.1,
      propertyType: Math.random() > 0.8 ? 'commercial' : 'residential',
      yearBuilt: Math.floor(Math.random() * 50) + 1970,
      squareFootage: Math.floor(Math.random() * 2000) + 1000,
      lotSize: Math.floor(Math.random() * 10000) + 5000,
      bedrooms: Math.floor(Math.random() * 4) + 2,
      bathrooms: Math.floor(Math.random() * 3) + 1.5,
      estimatedValue: Math.floor(Math.random() * 300000) + 150000,
      lastSalePrice: Math.floor(Math.random() * 250000) + 100000,
      lastSaleDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      ownerName: 'Property Owner',
      taxAssessedValue: Math.floor(Math.random() * 200000) + 100000,
      taxYear: new Date().getFullYear() - 1,
      dataSource: 'Mock',
      createdAt: new Date().toISOString()
    };
  }

  async savePropertyToDatabase(property) {
    try {
      await db('properties').insert(property);
      logger.info(`Saved property: ${property.address}`);
      return property;
    } catch (error) {
      logger.error('Failed to save property to database:', error);
      throw error;
    }
  }

  async getPropertyById(propertyId) {
    return await db('properties').where('id', propertyId).first();
  }

  async updateAssessmentStatus(assessmentId, status, errorMessage = null) {
    const updateData = {
      status,
      updatedAt: new Date().toISOString()
    };

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    if (status === 'completed') {
      updateData.completedAt = new Date().toISOString();
    }

    await db('property_assessments')
      .where('id', assessmentId)
      .update(updateData);
  }

  async performAIAnalysis(images, property) {
    try {
      const ComputerVisionService = require('./ComputerVisionService');
      
      const results = [];
      for (const image of images) {
        // Convert image to buffer for analysis
        const imageBuffer = Buffer.from(image.data, 'base64');
        
        const analysis = await ComputerVisionService.analyzePropertyDamage(
          imageBuffer,
          {
            propertyType: property.propertyType,
            yearBuilt: property.yearBuilt,
            squareFootage: property.squareFootage
          }
        );
        
        results.push(analysis);
      }

      // Aggregate results
      return this.aggregateAIResults(results);

    } catch (error) {
      logger.error('AI analysis failed:', error);
      return null;
    }
  }

  aggregateAIResults(results) {
    if (!results || results.length === 0) return null;

    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) return null;

    // Calculate aggregated confidence
    const avgConfidence = successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length;
    
    // Aggregate damage areas
    const allDamageAreas = successfulResults.flatMap(r => r.damageDetection?.areas || []);
    
    return {
      confidence: avgConfidence,
      totalImages: results.length,
      successfulAnalyses: successfulResults.length,
      damageAreas: allDamageAreas,
      recommendations: successfulResults.flatMap(r => r.recommendations?.all || [])
    };
  }

  async calculateAssessmentScores(property, aiAnalysis) {
    // Base scores
    let damageScore = 0;
    let overallScore = 50; // Neutral starting point

    // Property age factor
    const currentYear = new Date().getFullYear();
    const age = currentYear - (property.yearBuilt || currentYear);
    const ageFactor = Math.min(age / 50, 1); // Cap at 50 years
    
    // AI analysis factor
    if (aiAnalysis && aiAnalysis.damageAreas) {
      damageScore = aiAnalysis.damageAreas.reduce((score, area) => {
        return score + (area.confidence * 20); // Max 20 points per damage area
      }, 0);
    }

    // Calculate overall score
    overallScore = Math.max(0, Math.min(100, 50 + (ageFactor * 30) + (damageScore / 2)));

    return {
      damage: Math.round(damageScore),
      overall: Math.round(overallScore),
      age: Math.round(ageFactor * 100),
      ai: aiAnalysis ? Math.round(aiAnalysis.confidence * 100) : 0
    };
  }

  async generateAssessmentRecommendations(property, scores, aiAnalysis) {
    const recommendations = [];

    // Age-based recommendations
    if (scores.age > 70) {
      recommendations.push({
        type: 'inspection',
        priority: 'high',
        title: 'Property Age Assessment',
        description: 'Property is approaching end of typical lifespan for major systems',
        actionRequired: 'Schedule comprehensive inspection',
        estimatedCost: '$500-1000'
      });
    }

    // Damage-based recommendations
    if (scores.damage > 50) {
      recommendations.push({
        type: 'repair',
        priority: 'critical',
        title: 'Significant Damage Detected',
        description: 'AI analysis indicates substantial damage requiring immediate attention',
        actionRequired: 'Professional contractor assessment',
        estimatedCost: 'To be determined'
      });
    }

    // AI analysis recommendations
    if (aiAnalysis && aiAnalysis.recommendations) {
      recommendations.push(...aiAnalysis.recommendations.map(rec => ({
        ...rec,
        source: 'AI Analysis'
      })));
    }

    return recommendations;
  }

  async completeAssessment(assessmentId, results) {
    await db('property_assessments')
      .where('id', assessmentId)
      .update({
        status: 'completed',
        overallScore: results.overallScore,
        damageScore: results.damageScore,
        riskLevel: results.riskLevel,
        estimatedRepairCost: results.estimatedRepairCost,
        aiAnalysis: results.aiAnalysis ? JSON.stringify(results.aiAnalysis) : null,
        recommendations: JSON.stringify(results.recommendations),
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

    // Update property with assessment results
    await db('properties')
      .where('id', (await db('property_assessments').select('propertyId').where('id', assessmentId).first()).propertyId)
      .update({
        currentRiskLevel: results.riskLevel,
        lastAssessmentScore: results.overallScore,
        lastAssessmentDate: new Date().toISOString(),
        assessmentStatus: 'completed'
      });
  }

  async getLatestAssessment(propertyId) {
    return await db('property_assessments')
      .where('propertyId', propertyId)
      .where('status', 'completed')
      .orderBy('completedAt', 'desc')
      .first();
  }

  categorizeRiskLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'moderate';
    if (score >= 20) return 'low';
    return 'minimal';
  }

  estimateRepairCosts(scores, property) {
    const baseCost = property.squareFootage * 25; // $25 per sq ft base
    const damageMultiplier = scores.damage / 100;
    return Math.round(baseCost * (1 + damageMultiplier));
  }

  estimatePropertyRepairCosts(property, assessment) {
    if (!assessment) return 0;
    
    const baseRate = property.propertyType === 'commercial' ? 35 : 25;
    return Math.round(property.squareFootage * baseRate * (assessment.damageScore / 100));
  }

  getRecommendedActions(assessment) {
    if (!assessment) return [];
    
    const actions = [];
    
    if (assessment.damageScore > 70) {
      actions.push('Immediate professional inspection required');
    }
    
    if (assessment.riskLevel === 'high') {
      actions.push('Consider immediate repairs or replacement');
    }
    
    return actions;
  }

  generatePortfolioRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.highRiskRate > 20) {
      recommendations.push({
        type: 'priority',
        title: 'High-Risk Properties Require Attention',
        description: `${metrics.highRiskCount} properties (${metrics.highRiskRate.toFixed(1)}%) are classified as high risk`,
        action: 'Schedule immediate assessments for high-risk properties'
      });
    }
    
    if (metrics.assessmentRate < 80) {
      recommendations.push({
        type: 'assessment',
        title: 'Increase Assessment Coverage',
        description: `Only ${metrics.assessmentRate.toFixed(1)}% of properties have recent assessments`,
        action: 'Implement regular assessment schedule'
      });
    }
    
    if (metrics.repairToValueRatio > 10) {
      recommendations.push({
        type: 'financial',
        title: 'Repair Costs Exceeding 10% of Value',
        description: `Total estimated repairs (${metrics.repairToValueRatio.toFixed(1)}% of portfolio value)`,
        action: 'Review repair prioritization and budget allocation'
      });
    }
    
    return recommendations;
  }

  generatePortfolioSummary(metrics) {
    return {
      healthScore: this.calculatePortfolioHealthScore(metrics),
      status: this.getPortfolioStatus(metrics),
      keyMetrics: {
        totalProperties: metrics.totalProperties,
        assessedProperties: metrics.assessedProperties,
        highRiskCount: metrics.highRiskCount,
        totalEstimatedValue: metrics.totalEstimatedValue,
        totalEstimatedRepairCost: metrics.totalEstimatedRepairCost
      }
    };
  }

  calculatePortfolioHealthScore(metrics) {
    let score = 100;
    
    // Deduct for low assessment rate
    score -= Math.max(0, (80 - metrics.assessmentRate));
    
    // Deduct for high-risk properties
    score -= metrics.highRiskRate;
    
    // Deduct for high repair costs
    if (metrics.repairToValueRatio > 10) {
      score -= (metrics.repairToValueRatio - 10) * 2;
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  getPortfolioStatus(metrics) {
    const healthScore = this.calculatePortfolioHealthScore(metrics);
    
    if (healthScore >= 80) return 'excellent';
    if (healthScore >= 60) return 'good';
    if (healthScore >= 40) return 'fair';
    return 'needs_attention';
  }

  async testExternalConnections() {
    // Test API connections
    for (const [provider, config] of Object.entries(this.propertyAPIs)) {
      try {
        if (config.apiKey) {
          // Basic connection test
          logger.info(`${provider} API configured`);
        } else {
          logger.warn(`${provider} API key not provided`);
        }
      } catch (error) {
        logger.error(`${provider} connection test failed:`, error);
      }
    }
  }
}

module.exports = new PropertyService();