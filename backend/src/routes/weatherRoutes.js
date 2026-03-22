/**
 * NOAA Weather API Routes for Atlas Helios Platform
 * 
 * Provides real-time weather data from api.weather.gov
 * Adapted from Luminall PropertyInsight
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// Import NOAA Weather Service
let NOAAWeatherService;
try {
  NOAAWeatherService = require('../services/NOAAWeatherService');
} catch (e) {
  logger.warn('NOAA Weather Service not available:', e.message);
}

/**
 * @route   GET /api/weather/status
 * @desc    Get NOAA Weather Service status
 * @access  Public
 */
router.get('/status', async (req, res) => {
  try {
    if (!NOAAWeatherService) {
      return res.status(503).json({
        available: false,
        message: 'NOAA Weather Service not loaded'
      });
    }

    const status = NOAAWeatherService.getStatus();
    res.json({
      available: true,
      ...status
    });
  } catch (error) {
    logger.error('Error getting NOAA Weather status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/weather/forecast
 * @desc    Get forecast for location
 * @query   {number} lat - Latitude (required)
 * @query   {number} lng - Longitude (required)
 * @access  Public
 */
router.get('/forecast', async (req, res) => {
  try {
    if (!NOAAWeatherService) {
      return res.status(503).json({ error: 'NOAA Weather Service not available' });
    }

    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lng'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates. lat and lng must be numbers.'
      });
    }

    logger.info(`Getting forecast for ${latitude}, ${longitude}`);
    const forecast = await NOAAWeatherService.getForecast(latitude, longitude);

    res.json({
      success: true,
      data: forecast,
      location: { lat: latitude, lng: longitude },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting forecast:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/weather/forecast/hourly
 * @desc    Get hourly forecast for location
 * @query   {number} lat - Latitude (required)
 * @query   {number} lng - Longitude (required)
 * @access  Public
 */
router.get('/forecast/hourly', async (req, res) => {
  try {
    if (!NOAAWeatherService) {
      return res.status(503).json({ error: 'NOAA Weather Service not available' });
    }

    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lng'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates. lat and lng must be numbers.'
      });
    }

    logger.info(`Getting hourly forecast for ${latitude}, ${longitude}`);
    const forecast = await NOAAWeatherService.getHourlyForecast(latitude, longitude);

    res.json({
      success: true,
      data: forecast,
      location: { lat: latitude, lng: longitude },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting hourly forecast:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/weather/alerts
 * @desc    Get active weather alerts
 * @access  Public
 */
router.get('/alerts', async (req, res) => {
  try {
    if (!NOAAWeatherService) {
      return res.status(503).json({ error: 'NOAA Weather Service not available' });
    }

    logger.info('Getting active weather alerts');
    const alerts = await NOAAWeatherService.getActiveAlerts();

    res.json({
      success: true,
      data: alerts,
      count: alerts.features?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/weather/alerts/area
 * @desc    Get weather alerts for specific area
 * @query   {number} lat - Latitude (required)
 * @query   {number} lng - Longitude (required)
 * @query   {number} radius - Radius in miles (optional, default: 25)
 * @access  Public
 */
router.get('/alerts/area', async (req, res) => {
  try {
    if (!NOAAWeatherService) {
      return res.status(503).json({ error: 'NOAA Weather Service not available' });
    }

    const { lat, lng, radius = 25 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lng'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusMiles = parseInt(radius);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates. lat and lng must be numbers.'
      });
    }

    logger.info(`Getting area alerts for ${latitude}, ${longitude}, radius: ${radiusMiles} miles`);
    const alerts = await NOAAWeatherService.getAlertsByArea(latitude, longitude, radiusMiles);

    res.json({
      success: true,
      data: alerts,
      location: { lat: latitude, lng: longitude, radius: radiusMiles },
      count: alerts.features?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting area alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/weather/severe
 * @desc    Check for severe weather at location
 * @query   {number} lat - Latitude (required)
 * @query   {number} lng - Longitude (required)
 * @access  Public
 */
router.get('/severe', async (req, res) => {
  try {
    if (!NOAAWeatherService) {
      return res.status(503).json({ error: 'NOAA Weather Service not available' });
    }

    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lng'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates. lat and lng must be numbers.'
      });
    }

    logger.info(`Checking severe weather for ${latitude}, ${longitude}`);
    const severeWeather = await NOAAWeatherService.checkSevereWeather(latitude, longitude);

    res.json({
      success: true,
      data: severeWeather,
      isSevere: severeWeather.isSevere,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error checking severe weather:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/weather/radar/stations
 * @desc    Get radar stations
 * @access  Public
 */
router.get('/radar/stations', async (req, res) => {
  try {
    if (!NOAAWeatherService) {
      return res.status(503).json({ error: 'NOAA Weather Service not available' });
    }

    logger.info('Getting radar stations');
    const stations = await NOAAWeatherService.getRadarStations();

    res.json({
      success: true,
      data: stations,
      count: stations.features?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting radar stations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/weather/stormreports
 * @desc    Get storm reports
 * @query   {string} start - Start time (ISO 8601, optional)
 * @query   {string} end - End time (ISO 8601, optional)
 * @access  Public
 */
router.get('/stormreports', async (req, res) => {
  try {
    if (!NOAAWeatherService) {
      return res.status(503).json({ error: 'NOAA Weather Service not available' });
    }

    const { start, end } = req.query;

    logger.info(`Getting storm reports from ${start} to ${end}`);
    const reports = await NOAAWeatherService.getStormReports(start, end);

    res.json({
      success: true,
      data: reports,
      count: reports.features?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting storm reports:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/weather/zones
 * @desc    Get weather zones for location
 * @query   {number} lat - Latitude (required)
 * @query   {number} lng - Longitude (required)
 * @access  Public
 */
router.get('/zones', async (req, res) => {
  try {
    if (!NOAAWeatherService) {
      return res.status(503).json({ error: 'NOAA Weather Service not available' });
    }

    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lng'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates. lat and lng must be numbers.'
      });
    }

    logger.info(`Getting weather zones for ${latitude}, ${longitude}`);
    const zones = await NOAAWeatherService.getWeatherZones(latitude, longitude);

    if (!zones) {
      return res.status(404).json({
        error: 'Weather zones not found for location'
      });
    }

    res.json({
      success: true,
      data: zones,
      location: { lat: latitude, lng: longitude },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting weather zones:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/weather/batch/severe
 * @desc    Check severe weather for multiple locations
 * @body    {Array} locations - Array of {lat, lng} objects
 * @access  Private
 */
router.post('/batch/severe', authMiddleware, async (req, res) => {
  try {
    if (!NOAAWeatherService) {
      return res.status(503).json({ error: 'NOAA Weather Service not available' });
    }

    const { locations } = req.body;

    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid locations array'
      });
    }

    if (locations.length > 10) {
      return res.status(400).json({
        error: 'Maximum 10 locations allowed per batch request'
      });
    }

    logger.info(`Batch severe weather check for ${locations.length} locations`);

    const results = await Promise.all(
      locations.map(async (loc) => {
        const result = await NOAAWeatherService.checkSevereWeather(loc.lat, loc.lng);
        return {
          location: loc,
          ...result
        };
      })
    );

    const severeCount = results.filter(r => r.isSevere).length;

    res.json({
      success: true,
      data: results,
      totalChecked: locations.length,
      severeCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in batch severe weather check:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
