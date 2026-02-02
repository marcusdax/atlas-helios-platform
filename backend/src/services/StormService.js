const axios = require('axios');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const logger = require('../utils/logger');

/**
 * Storm Intelligence Service
 * Integrates with NOAA and other weather APIs to provide real-time storm tracking
 */
class StormService {
  constructor() {
    this.io = null;
    this.activeStorms = new Map();
    this.noaaApiKey = process.env.NOAA_API_KEY;
    this.weatherApiKey = process.env.WEATHER_API_KEY;
    this.isInitialized = false;
    this.monitoringRegions = [];
  }

  /**
   * Initialize Storm Service
   */
  async initialize(io) {
    try {
      this.io = io;
      this.isInitialized = true;
      
      // Setup weather API monitoring
      await this.setupWeatherMonitoring();
      
      // Start storm tracking cron jobs
      this.startStormTrackingJobs();
      
      // Setup WebSocket broadcasting
      this.setupWebSocketBroadcasting();
      
      logger.info('Storm Service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Storm Service:', error);
      throw error;
    }
  }

  /**
   * Setup weather monitoring regions
   */
  async setupWeatherMonitoring() {
    // Default monitoring regions (can be configured via environment)
    const defaultRegions = [
      {
        id: 'dallas_metro',
        name: 'Dallas Metro Area',
        center: { lat: 32.7767, lng: -96.7970 },
        radius: 50, // miles
        bounds: {
          north: 33.2,
          south: 32.2,
          east: -96.2,
          west: -97.4
        }
      },
      {
        id: 'houston_metro',
        name: 'Houston Metro Area',
        center: { lat: 29.7604, lng: -95.3698 },
        radius: 40,
        bounds: {
          north: 30.3,
          south: 29.1,
          east: -94.8,
          west: -95.9
        }
      },
      {
        id: 'austin_metro',
        name: 'Austin Metro Area',
        center: { lat: 30.2672, lng: -97.7431 },
        radius: 30,
        bounds: {
          north: 30.7,
          south: 29.7,
          east: -97.2,
          west: -98.1
        }
      }
    ];

    this.monitoringRegions = JSON.parse(process.env.MONITORING_REGIONS || JSON.stringify(defaultRegions));
    
    // Save regions to database
    for (const region of this.monitoringRegions) {
      await this.saveMonitoringRegion(region);
    }
  }

  /**
   * Start storm tracking cron jobs
   */
  startStormTrackingJobs() {
    // Check for severe weather every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        await this.checkForSevereWeather();
      } catch (error) {
        logger.error('Severe weather check failed:', error);
      }
    });

    // Update storm data every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      try {
        await this.updateStormData();
      } catch (error) {
        logger.error('Storm data update failed:', error);
      }
    });

    // Clean up old storm data daily
    cron.schedule('0 2 * * *', async () => {
      try {
        await this.cleanupOldStormData();
      } catch (error) {
        logger.error('Storm data cleanup failed:', error);
      }
    });
  }

  /**
   * Setup WebSocket broadcasting for real-time updates
   */
  setupWebSocketBroadcasting() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      // Subscribe to storm alerts
      socket.on('subscribe_storms', () => {
        socket.join('storm_alerts');
        logger.info(`Client ${socket.id} subscribed to storm alerts`);
      });

      // Unsubscribe from storm alerts
      socket.on('unsubscribe_storms', () => {
        socket.leave('storm_alerts');
        logger.info(`Client ${socket.id} unsubscribed from storm alerts`);
      });
    });
  }

  /**
   * Get current weather conditions for a location
   */
  async getCurrentWeather(lat, lng) {
    try {
      const response = await axios.get('https://api.weather.gov/points/' + lat + ',' + lng, {
        headers: {
          'User-Agent': 'PropertyInsight-AI/1.0 (contact@propertyinsight.ai)',
          'Accept': 'application/geo+json'
        },
        timeout: 10000
      });

      const gridInfo = response.data;
      
      // Get forecast from grid point
      const forecastResponse = await axios.get(gridInfo.properties.forecast, {
        headers: {
          'User-Agent': 'PropertyInsight-AI/1.0 (contact@propertyinsight.ai)'
        },
        timeout: 10000
      });

      return {
        gridInfo,
        forecast: forecastResponse.data
      };

    } catch (error) {
      logger.error('Failed to get current weather:', error);
      
      // Fallback to mock data for demo
      return this.getMockWeatherData(lat, lng);
    }
  }

  /**
   * Check for severe weather in monitored regions
   */
  async checkForSevereWeather() {
    for (const region of this.monitoringRegions) {
      try {
        const weatherData = await this.getCurrentWeather(region.center.lat, region.center.lng);
        
        // Check for severe weather conditions
        const severeConditions = this.identifySevereConditions(weatherData);
        
        if (severeConditions.length > 0) {
          await this.processSevereWeather(region, weatherData, severeConditions);
        }

      } catch (error) {
        logger.error(`Severe weather check failed for region ${region.id}:`, error);
      }
    }
  }

  /**
   * Identify severe weather conditions
   */
  identifySevereConditions(weatherData) {
    const severeConditions = [];
    
    try {
      const periods = weatherData.forecast?.properties?.periods || [];
      
      for (const period of periods) {
        const conditions = [];
        
        // Check for severe weather keywords
        if (period.shortForecast) {
          const forecast = period.shortForecast.toLowerCase();
          
          if (forecast.includes('hail')) {
            conditions.push({
              type: 'hail',
              severity: this.extractSeverityFromForecast(forecast),
              description: period.shortForecast
            });
          }
          
          if (forecast.includes('tornado') || forecast.includes('funnel')) {
            conditions.push({
              type: 'tornado',
              severity: 'extreme',
              description: period.shortForecast
            });
          }
          
          if (forecast.includes('thunderstorm') && (forecast.includes('severe') || forecast.includes('strong'))) {
            conditions.push({
              type: 'severe_thunderstorm',
              severity: this.extractSeverityFromForecast(forecast),
              description: period.shortForecast
            });
          }
          
          if (forecast.includes('wind') && period.windSpeed && this.parseWindSpeed(period.windSpeed) > 50) {
            conditions.push({
              type: 'high_winds',
              severity: this.extractWindSeverity(period.windSpeed),
              description: `${period.shortForecast} - ${period.windSpeed} winds`
            });
          }
        }
        
        if (conditions.length > 0) {
          severeConditions.push({
            period,
            conditions,
            validTime: period.validTime
          });
        }
      }

    } catch (error) {
      logger.error('Error identifying severe conditions:', error);
    }

    return severeConditions;
  }

  /**
   * Process severe weather event
   */
  async processSevereWeather(region, weatherData, severeConditions) {
    const stormEvent = {
      id: uuidv4(),
      regionId: region.id,
      regionName: region.name,
      type: this.determinePrimarySevereType(severeConditions),
      severity: this.calculateOverallSeverity(severeConditions),
      conditions: severeConditions,
      center: region.center,
      detectedAt: new Date().toISOString(),
      estimatedDuration: this.estimateStormDuration(severeConditions),
      affectedProperties: await this.identifyAffectedProperties(region),
      alertLevel: this.calculateAlertLevel(severeConditions)
    };

    // Save storm event to database
    await this.saveStormEvent(stormEvent);
    
    // Store in memory for real-time tracking
    this.activeStorms.set(stormEvent.id, stormEvent);
    
    // Broadcast to connected clients
    this.broadcastStormAlert(stormEvent);
    
    // Log the event
    logger.info(`Severe weather detected: ${stormEvent.type} in ${region.name}`);
  }

  /**
   * Update existing storm data
   */
  async updateStormData() {
    for (const [stormId, storm] of this.activeStorms) {
      try {
        // Check if storm is still active
        const currentWeather = await this.getCurrentWeather(storm.center.lat, storm.center.lng);
        const currentConditions = this.identifySevereConditions(currentWeather);
        
        if (currentConditions.length === 0) {
          // Storm has dissipated
          await this.markStormDissipated(stormId);
          this.activeStorms.delete(stormId);
        } else {
          // Update storm data
          await this.updateStormTracking(stormId, currentConditions);
        }

      } catch (error) {
        logger.error(`Failed to update storm ${stormId}:`, error);
      }
    }
  }

  /**
   * Get property damage probability scores
   */
  async getPropertyDamageScores(lat, lng, radius = 5) {
    try {
      // Get nearby properties
      const properties = await this.getNearbyProperties(lat, lng, radius);
      
      // Calculate damage scores for each property
      const scoredProperties = [];
      
      for (const property of properties) {
        const score = await this.calculatePropertyDamageScore(property);
        scoredProperties.push({
          property,
          damageScore: score,
          riskLevel: this.categorizeRiskLevel(score),
          factors: score.factors
        });
      }
      
      return scoredProperties;

    } catch (error) {
      logger.error('Failed to calculate property damage scores:', error);
      throw error;
    }
  }

  /**
   * Calculate damage probability for a specific property
   */
  async calculatePropertyDamageScore(property) {
    try {
      // Get current weather conditions
      const weatherData = await this.getCurrentWeather(property.latitude, property.longitude);
      
      // Analyze multiple risk factors
      const factors = {
        propertyAge: this.calculateAgeRisk(property.yearBuilt),
        roofCondition: this.assessRoofCondition(property),
        buildingType: this.assessBuildingTypeRisk(property),
        locationExposure: this.assessLocationExposure(property),
        recentMaintenance: this.assessMaintenanceRisk(property),
        weatherIntensity: this.calculateWeatherIntensity(weatherData)
      };
      
      // Calculate weighted risk score
      const weights = {
        propertyAge: 0.2,
        roofCondition: 0.25,
        buildingType: 0.15,
        locationExposure: 0.15,
        recentMaintenance: 0.1,
        weatherIntensity: 0.15
      };
      
      const totalScore = Object.keys(factors).reduce((score, factor) => {
        return score + (factors[factor] * weights[factor]);
      }, 0);
      
      return {
        score: Math.round(totalScore * 100),
        factors,
        confidence: this.calculateConfidenceLevel(factors, weatherData),
        recommendations: this.generatePropertyRecommendations(factors)
      };

    } catch (error) {
      logger.error('Failed to calculate property damage score:', error);
      throw error;
    }
  }

  /**
   * Generate storm intelligence report
   */
  async generateStormReport(regionId, timeRange = 24) {
    try {
      const storms = await this.getStormHistory(regionId, timeRange);
      
      return {
        regionId,
        timeRange,
        generatedAt: new Date().toISOString(),
        summary: {
          totalStorms: storms.length,
          averageSeverity: this.calculateAverageSeverity(storms),
          mostCommonType: this.findMostCommonStormType(storms),
          affectedProperties: storms.reduce((sum, storm) => sum + storm.affectedProperties.length, 0)
        },
        storms: storms.map(storm => ({
          id: storm.id,
          type: storm.type,
          severity: storm.severity,
          detectedAt: storm.detectedAt,
          affectedProperties: storm.affectedProperties.length,
          alertLevel: storm.alertLevel
        })),
        recommendations: this.generateRegionalRecommendations(storms)
      };

    } catch (error) {
      logger.error('Failed to generate storm report:', error);
      throw error;
    }
  }

  // Helper methods

  async saveMonitoringRegion(region) {
    try {
      await db('monitoring_regions')
        .insert(region)
        .onConflict('id')
        .merge();
    } catch (error) {
      logger.error('Failed to save monitoring region:', error);
    }
  }

  async saveStormEvent(stormEvent) {
    try {
      await db('storm_events').insert(stormEvent);
      
      // Also save to storm_alerts table for notifications
      await db('storm_alerts').insert({
        id: uuidv4(),
        stormEventId: stormEvent.id,
        alertLevel: stormEvent.alertLevel,
        message: `${stormEvent.type} detected in ${stormEvent.regionName}`,
        createdAt: new Date().toISOString(),
        acknowledged: false
      });

    } catch (error) {
      logger.error('Failed to save storm event:', error);
    }
  }

  broadcastStormAlert(stormEvent) {
    if (!this.io) return;

    this.io.to('storm_alerts').emit('storm_alert', {
      id: stormEvent.id,
      type: stormEvent.type,
      severity: stormEvent.severity,
      region: stormEvent.regionName,
      affectedProperties: stormEvent.affectedProperties.length,
      message: `Severe weather detected: ${stormEvent.type} in ${stormEvent.regionName}`,
      timestamp: stormEvent.detectedAt,
      alertLevel: stormEvent.alertLevel
    });
  }

  async getNearbyProperties(lat, lng, radius) {
    // Query properties within radius
    const earthRadius = 3959; // miles
    
    return await db('properties')
      .select('*')
      .whereRaw(`
        3959 * acos(
          cos(radians(?)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(?)) +
          sin(radians(?)) * sin(radians(latitude))
        ) < ?
      `, [lat, lng, lat, radius]);

  }

  async markStormDissipated(stormId) {
    await db('storm_events')
      .where('id', stormId)
      .update({
        dissipatedAt: new Date().toISOString(),
        status: 'dissipated'
      });
  }

  async updateStormTracking(stormId, currentConditions) {
    await db('storm_events')
      .where('id', stormId)
      .update({
        lastUpdate: new Date().toISOString(),
        currentConditions: JSON.stringify(currentConditions),
        status: 'active'
      });
  }

  async cleanupOldStormData() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    await db('storm_events')
      .where('detectedAt', '<', thirtyDaysAgo.toISOString())
      .delete();
      
    await db('storm_alerts')
      .where('createdAt', '<', thirtyDaysAgo.toISOString())
      .delete();
  }

  // Mock data methods for demo
  getMockWeatherData(lat, lng) {
    return {
      gridInfo: {
        gridX: 83,
        gridY: 67,
        gridId: 'FWD'
      },
      forecast: {
        properties: {
          periods: [
            {
              number: 1,
              name: 'Tonight',
              startTime: new Date().toISOString(),
              endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
              isDaytime: false,
              temperature: 65,
              temperatureUnit: 'F',
              windSpeed: '25 to 35 mph',
              windDirection: 'S',
              shortForecast: 'Showers And Thunderstorms Likely then Chance Showers And Thunderstorms',
              probabilityOfPrecipitation: {
                unit: 'percent',
                value: 80
              }
            }
          ]
        }
      }
    };
  }

  extractSeverityFromForecast(forecast) {
    if (forecast.includes('severe')) return 'severe';
    if (forecast.includes('strong')) return 'moderate';
    return 'minor';
  }

  extractWindSeverity(windSpeed) {
    if (windSpeed > 70) return 'extreme';
    if (windSpeed > 50) return 'high';
    return 'moderate';
  }

  parseWindSpeed(windSpeed) {
    const match = windSpeed.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  determinePrimarySevereType(severeConditions) {
    const types = severeConditions.flatMap(cond => cond.conditions.map(c => c.type));
    const typeCounts = {};
    types.forEach(type => typeCounts[type] = (typeCounts[type] || 0) + 1);
    
    return Object.keys(typeCounts).reduce((a, b) => 
      typeCounts[a] > typeCounts[b] ? a : b
    );
  }

  calculateOverallSeverity(severeConditions) {
    const severities = severeConditions.flatMap(cond => 
      cond.conditions.map(c => {
        switch (c.severity) {
          case 'extreme': return 5;
          case 'severe': return 4;
          case 'high': return 3;
          case 'moderate': return 2;
          default: return 1;
        }
      })
    );
    
    const avg = severities.reduce((sum, s) => sum + s, 0) / severities.length;
    
    if (avg >= 4.5) return 'extreme';
    if (avg >= 3.5) return 'severe';
    if (avg >= 2.5) return 'moderate';
    return 'minor';
  }

  estimateStormDuration(severeConditions) {
    // Estimate based on forecast periods
    const periods = severeConditions.length;
    return `${periods * 6} hours`; // 6 hours per forecast period
  }

  async identifyAffectedProperties(region) {
    const properties = await this.getNearbyProperties(region.center.lat, region.center.lng, region.radius);
    return properties.map(prop => prop.id);
  }

  calculateAlertLevel(severeConditions) {
    const maxSeverity = Math.max(...severeConditions.flatMap(cond => 
      cond.conditions.map(c => {
        switch (c.severity) {
          case 'extreme': return 4;
          case 'severe': return 3;
          case 'high': return 2;
          default: return 1;
        }
      })
    ));
    
    return ['info', 'watch', 'warning', 'emergency'][Math.min(maxSeverity - 1, 3)];
  }

  calculateAgeRisk(yearBuilt) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - yearBuilt;
    return Math.min(age / 50, 1);
  }

  assessRoofCondition(property) {
    // Mock roof condition assessment
    const roofAges = {
      'asphalt_shingles': 15,
      'metal': 30,
      'tile': 50,
      'slate': 75
    };
    
    const expectedLife = roofAges[property.roofType] || 20;
    const roofAge = currentYear - (property.yearBuilt || currentYear);
    
    return Math.min(roofAge / expectedLife, 1);
  }

  assessBuildingTypeRisk(property) {
    const riskScores = {
      'residential': 0.3,
      'commercial': 0.6,
      'industrial': 0.8
    };
    
    return riskScores[property.buildingType] || 0.5;
  }

  assessLocationExposure(property) {
    // Assess based on geographic location
    return 0.4; // Mock value
  }

  assessMaintenanceRisk(property) {
    // Assess based on last maintenance date
    return 0.3; // Mock value
  }

  calculateWeatherIntensity(weatherData) {
    // Calculate based on forecast data
    return 0.6; // Mock value
  }

  calculateConfidenceLevel(factors, weatherData) {
    // Base confidence on data availability
    let confidence = 0.7;
    
    if (factors.propertyAge) confidence += 0.1;
    if (factors.roofCondition) confidence += 0.1;
    if (weatherData) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  generatePropertyRecommendations(factors) {
    const recommendations = [];
    
    if (factors.propertyAge > 0.8) {
      recommendations.push('Consider roof replacement');
    }
    
    if (factors.roofCondition > 0.7) {
      recommendations.push('Schedule immediate roof inspection');
    }
    
    return recommendations;
  }

  categorizeRiskLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'moderate';
    if (score >= 20) return 'low';
    return 'minimal';
  }

  async getStormHistory(regionId, timeRange) {
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    return await db('storm_events')
      .where('regionId', regionId)
      .where('detectedAt', '>=', startDate.toISOString())
      .orderBy('detectedAt', 'desc');
  }

  calculateAverageSeverity(storms) {
    const severityScores = storms.map(storm => {
      switch (storm.severity) {
        case 'extreme': return 5;
        case 'severe': return 4;
        case 'moderate': return 3;
        case 'minor': return 2;
        default: return 1;
      }
    });
    
    return severityScores.reduce((sum, score) => sum + score, 0) / storms.length || 0;
  }

  findMostCommonStormType(storms) {
    const types = {};
    storms.forEach(storm => {
      types[storm.type] = (types[storm.type] || 0) + 1;
    });
    
    return Object.keys(types).reduce((a, b) => types[a] > types[b] ? a : b) || 'none';
  }

  generateRegionalRecommendations(storms) {
    return [
      'Monitor weather conditions closely',
      'Review and update emergency procedures',
      'Ensure adequate insurance coverage'
    ];
  }
}

module.exports = new StormService();