/**
 * NOAA Weather API Service for Atlas Helios Platform
 * 
 * Integrates api.weather.gov endpoints for real-time weather data
 * Adapted from Luminall PropertyInsight NOAA Weather Client
 * 
 * Documentation: https://api.weather.gov/
 */

const axios = require('axios');
const NodeCache = require('node-cache');
const { logger } = require('../utils/logger');

class NOAAWeatherService {
  constructor() {
    this.baseUrl = 'https://api.weather.gov';
    this.userAgent = 'AtlasHelios-Platform/1.0 (contact@atlashelios.ai)';
    
    // Cache with TTL: 5 minutes default, 1 minute for alerts, 1 hour for radar
    this.cache = new NodeCache({ 
      stdTTL: 300,
      checkperiod: 60 
    });
    
    this.httpClient = axios.create({
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/geo+json'
      },
      timeout: 10000
    });

    this.isInitialized = false;
  }

  /**
   * Initialize the NOAA Weather Service
   */
  async initialize() {
    try {
      logger.info('Initializing NOAA Weather Service...');
      
      // Test connection by getting radar stations
      const stations = await this.getRadarStations();
      
      this.isInitialized = true;
      logger.info(`NOAA Weather Service initialized. ${stations.features?.length || 0} radar stations available.`);
      
      return {
        success: true,
        message: 'NOAA Weather Service initialized',
        radarStations: stations.features?.length || 0
      };
    } catch (error) {
      logger.error('Failed to initialize NOAA Weather Service:', error.message);
      this.isInitialized = false;
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get forecast for a location
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<Object>} Forecast data
   */
  async getForecast(lat, lng) {
    try {
      const gridPoint = await this.getGridPoint(lat, lng);
      if (!gridPoint?.properties?.forecast) {
        logger.warn(`No grid point forecast available for ${lat}, ${lng}`);
        return this.getMockForecast();
      }

      const response = await this.httpClient.get(gridPoint.properties.forecast);
      return response.data;
    } catch (error) {
      logger.error(`Error getting forecast for ${lat}, ${lng}:`, error.message);
      return this.getMockForecast();
    }
  }

  /**
   * Get hourly forecast
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<Object>} Hourly forecast data
   */
  async getHourlyForecast(lat, lng) {
    try {
      const gridPoint = await this.getGridPoint(lat, lng);
      if (!gridPoint?.properties?.forecastHourly) {
        logger.warn(`No hourly forecast available for ${lat}, ${lng}`);
        return this.getMockHourlyForecast();
      }

      const response = await this.httpClient.get(gridPoint.properties.forecastHourly);
      return response.data;
    } catch (error) {
      logger.error(`Error getting hourly forecast for ${lat}, ${lng}:`, error.message);
      return this.getMockHourlyForecast();
    }
  }

  /**
   * Get grid point for coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<Object>} Grid point data
   */
  async getGridPoint(lat, lng) {
    const cacheKey = `grid_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.httpClient.get(
        `${this.baseUrl}/points/${lat},${lng}`
      );
      
      this.cache.set(cacheKey, response.data, 3600); // Cache for 1 hour
      return response.data;
    } catch (error) {
      logger.error(`Error getting grid point for ${lat}, ${lng}:`, error.message);
      return null;
    }
  }

  /**
   * Get active weather alerts
   * @returns {Promise<Object>} Active alerts
   */
  async getActiveAlerts() {
    const cacheKey = 'active_alerts';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.httpClient.get(
        `${this.baseUrl}/alerts/active`
      );
      
      this.cache.set(cacheKey, response.data, 60); // Cache for 1 minute
      return response.data;
    } catch (error) {
      logger.error('Error getting active alerts:', error.message);
      return this.getMockAlerts();
    }
  }

  /**
   * Get alerts for specific area
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} radius - Radius in miles
   * @returns {Promise<Object>} Area alerts
   */
  async getAlertsByArea(lat, lng, radius = 25) {
    try {
      const response = await this.httpClient.get(
        `${this.baseUrl}/alerts/active`,
        {
          params: {
            point: `${lat},${lng}`,
            radius: radius
          }
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error(`Error getting area alerts for ${lat}, ${lng}:`, error.message);
      return this.getMockAlerts();
    }
  }

  /**
   * Get radar stations
   * @returns {Promise<Object>} Radar stations
   */
  async getRadarStations() {
    const cacheKey = 'radar_stations';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.httpClient.get(
        `${this.baseUrl}/radar/stations`
      );
      
      this.cache.set(cacheKey, response.data, 3600); // Cache for 1 hour
      return response.data;
    } catch (error) {
      logger.error('Error getting radar stations:', error.message);
      return { features: [] };
    }
  }

  /**
   * Get storm reports
   * @param {string} startTime - ISO 8601 start time
   * @param {string} endTime - ISO 8601 end time
   * @returns {Promise<Object>} Storm reports
   */
  async getStormReports(startTime = null, endTime = null) {
    try {
      const params = {};
      if (startTime) params.start = startTime;
      if (endTime) params.end = endTime;

      const response = await this.httpClient.get(
        `${this.baseUrl}/stormreports`,
        { params }
      );
      
      return response.data;
    } catch (error) {
      logger.error('Error getting storm reports:', error.message);
      return { features: [] };
    }
  }

  /**
   * Check for severe weather at location
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<Object>} Severe weather check
   */
  async checkSevereWeather(lat, lng) {
    try {
      const [forecast, alerts] = await Promise.all([
        this.getForecast(lat, lng),
        this.getAlertsByArea(lat, lng)
      ]);

      const severeConditions = [];

      // Check forecast for severe conditions
      if (forecast?.properties?.periods) {
        forecast.properties.periods.slice(0, 3).forEach(period => {
          const conditions = this.identifySevereConditions(period);
          if (conditions.length > 0) {
            severeConditions.push({
              period: period.name,
              conditions,
              validTime: period.validTime
            });
          }
        });
      }

      // Check active alerts
      const activeAlerts = alerts?.features || [];

      return {
        location: { lat, lng },
        severeConditions,
        activeAlerts: activeAlerts.map(alert => ({
          event: alert.properties.event,
          severity: alert.properties.severity,
          urgency: alert.properties.urgency,
          description: alert.properties.description,
          instruction: alert.properties.instruction,
          effective: alert.properties.effective,
          expires: alert.properties.expires
        })),
        isSevere: severeConditions.length > 0 || activeAlerts.length > 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error checking severe weather for ${lat}, ${lng}:`, error.message);
      return this.getMockSevereWeather(lat, lng);
    }
  }

  /**
   * Get weather zones for an area
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<Object>} Weather zones
   */
  async getWeatherZones(lat, lng) {
    try {
      const gridPoint = await this.getGridPoint(lat, lng);
      if (!gridPoint?.properties) {
        return null;
      }

      return {
        forecastZone: gridPoint.properties.forecastZone,
        forecastOffice: gridPoint.properties.cwa,
        gridX: gridPoint.properties.gridX,
        gridY: gridPoint.properties.gridY,
        timeZone: gridPoint.properties.timeZone
      };
    } catch (error) {
      logger.error(`Error getting weather zones for ${lat}, ${lng}:`, error.message);
      return null;
    }
  }

  /**
   * Identify severe conditions from forecast period
   * @param {Object} period - Forecast period
   * @returns {Array} Severe conditions
   */
  identifySevereConditions(period) {
    const conditions = [];
    const forecast = (period.shortForecast || '').toLowerCase();
    const detailed = (period.detailedForecast || '').toLowerCase();
    const combined = `${forecast} ${detailed}`;

    const severeIndicators = [
      { keyword: 'tornado', type: 'tornado', severity: 'extreme' },
      { keyword: 'hail', type: 'hail', severity: 'severe' },
      { keyword: 'severe thunderstorm', type: 'severe_thunderstorm', severity: 'severe' },
      { keyword: 'damaging wind', type: 'high_winds', severity: 'severe' },
      { keyword: 'flash flood', type: 'flash_flood', severity: 'severe' },
      { keyword: 'excessive heat', type: 'heat', severity: 'moderate' },
      { keyword: 'blizzard', type: 'blizzard', severity: 'severe' },
      { keyword: 'ice storm', type: 'ice_storm', severity: 'severe' },
      { keyword: 'hurricane', type: 'hurricane', severity: 'extreme' },
      { keyword: 'tropical storm', type: 'tropical_storm', severity: 'severe' },
      { keyword: 'winter storm', type: 'winter_storm', severity: 'severe' },
      { keyword: 'flood', type: 'flood', severity: 'moderate' }
    ];

    severeIndicators.forEach(indicator => {
      if (combined.includes(indicator.keyword)) {
        conditions.push({
          type: indicator.type,
          severity: indicator.severity,
          description: period.shortForecast
        });
      }
    });

    // Check wind speed
    if (period.windSpeed) {
      const windMatch = period.windSpeed.match(/(\d+)/);
      if (windMatch) {
        const windSpeed = parseInt(windMatch[1]);
        if (windSpeed >= 58) {
          conditions.push({
            type: 'damaging_winds',
            severity: 'severe',
            description: `Winds ${period.windSpeed}`
          });
        }
      }
    }

    return conditions;
  }

  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      baseUrl: this.baseUrl,
      cacheStats: this.cache.getStats(),
      userAgent: this.userAgent
    };
  }

  // ===== Mock Data for Demo/Fallback =====

  getMockForecast() {
    return {
      properties: {
        periods: [
          {
            number: 1,
            name: 'Today',
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
            isDaytime: true,
            temperature: 75,
            temperatureUnit: 'F',
            windSpeed: '10 to 15 mph',
            windDirection: 'S',
            shortForecast: 'Slight Chance Showers And Thunderstorms',
            detailedForecast: 'A slight chance of showers and thunderstorms. Partly sunny, with a high near 75.',
            probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 20 }
          },
          {
            number: 2,
            name: 'Tonight',
            startTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
            endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            isDaytime: false,
            temperature: 58,
            temperatureUnit: 'F',
            windSpeed: '10 to 15 mph',
            windDirection: 'S',
            shortForecast: 'Showers And Thunderstorms Likely',
            detailedForecast: 'Showers and thunderstorms likely. Mostly cloudy, with a low around 58.',
            probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 60 }
          }
        ]
      }
    };
  }

  getMockHourlyForecast() {
    const periods = [];
    for (let i = 0; i < 24; i++) {
      periods.push({
        number: i + 1,
        startTime: new Date(Date.now() + i * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + (i + 1) * 60 * 60 * 1000).toISOString(),
        isDaytime: i >= 6 && i < 18,
        temperature: Math.round(65 + Math.sin(i / 24 * Math.PI) * 15),
        temperatureUnit: 'F',
        windSpeed: '10 mph',
        windDirection: 'S',
        shortForecast: i % 3 === 0 ? 'Chance Rain Showers' : 'Partly Cloudy',
        probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: i % 3 === 0 ? 40 : 10 }
      });
    }
    return { properties: { periods } };
  }

  getMockAlerts() {
    return {
      features: [
        {
          properties: {
            event: 'Severe Thunderstorm Warning',
            severity: 'Severe',
            urgency: 'Immediate',
            description: 'The National Weather Service has issued a Severe Thunderstorm Warning...',
            instruction: 'Take shelter immediately. Move to an interior room on the lowest floor.',
            effective: new Date().toISOString(),
            expires: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
          }
        }
      ]
    };
  }

  getMockSevereWeather(lat, lng) {
    return {
      location: { lat, lng },
      severeConditions: [
        {
          period: 'Tonight',
          conditions: [
            { type: 'severe_thunderstorm', severity: 'severe', description: 'Showers and thunderstorms likely' }
          ],
          validTime: new Date().toISOString()
        }
      ],
      activeAlerts: [
        {
          event: 'Severe Thunderstorm Warning',
          severity: 'Severe',
          urgency: 'Immediate',
          description: 'Severe thunderstorms with damaging winds and large hail',
          instruction: 'Take shelter immediately',
          effective: new Date().toISOString(),
          expires: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        }
      ],
      isSevere: true,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
module.exports = new NOAAWeatherService();
