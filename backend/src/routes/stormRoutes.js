const express = require('express');
const router = express.Router();
const StormService = require('../services/StormService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

// Get all active storms
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { region, severity, limit = 50, offset = 0 } = req.query;
    const storms = await StormService.getActiveStorms({
      region,
      severity,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: storms,
      count: storms.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching storms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch storm data'
    });
  }
});

// Get storm by ID
router.get('/:stormId', authMiddleware, async (req, res) => {
  try {
    const { stormId } = req.params;
    const storm = await StormService.getStormById(stormId);
    
    if (!storm) {
      return res.status(404).json({
        success: false,
        error: 'Storm not found'
      });
    }
    
    res.json({
      success: true,
      data: storm,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching storm ${req.params.stormId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch storm details'
    });
  }
});

// Get storm track history
router.get('/:stormId/track', authMiddleware, async (req, res) => {
  try {
    const { stormId } = req.params;
    const track = await StormService.getStormTrack(stormId);
    
    res.json({
      success: true,
      data: track,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching storm track ${req.params.stormId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch storm track'
    });
  }
});

// Get properties at risk from storm
router.get('/:stormId/properties-at-risk', authMiddleware, async (req, res) => {
  try {
    const { stormId } = req.params;
    const { radius = 50, limit = 100 } = req.query;
    
    const properties = await StormService.getPropertiesAtRisk(stormId, {
      radius: parseFloat(radius),
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: properties,
      count: properties.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching at-risk properties for storm ${req.params.stormId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch at-risk properties'
    });
  }
});

// Get storm alerts for user's properties
router.get('/alerts/user', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const alerts = await StormService.getUserStormAlerts(userId);
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching user storm alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch storm alerts'
    });
  }
});

// Create custom storm alert subscription
router.post('/alerts/subscribe', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { region, severityThreshold, notificationMethods } = req.body;
    
    const subscription = await StormService.createAlertSubscription({
      userId,
      region,
      severityThreshold,
      notificationMethods
    });
    
    res.status(201).json({
      success: true,
      data: subscription,
      message: 'Storm alert subscription created successfully'
    });
  } catch (error) {
    logger.error('Error creating storm alert subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create alert subscription'
    });
  }
});

// Get storm predictions
router.get('/:stormId/predictions', authMiddleware, async (req, res) => {
  try {
    const { stormId } = req.params;
    const { timeHorizon = 72 } = req.query;
    
    const predictions = await StormService.getStormPredictions(stormId, {
      timeHorizon: parseInt(timeHorizon)
    });
    
    res.json({
      success: true,
      data: predictions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching storm predictions ${req.params.stormId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch storm predictions'
    });
  }
});

// Get historical storm data
router.get('/history/region/:region', authMiddleware, async (req, res) => {
  try {
    const { region } = req.params;
    const { startDate, endDate, severity } = req.query;
    
    const historicalData = await StormService.getHistoricalStorms(region, {
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      severity
    });
    
    res.json({
      success: true,
      data: historicalData,
      count: historicalData.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching historical storms for region ${req.params.region}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch historical storm data'
    });
  }
});

// Generate storm impact report
router.get('/:stormId/impact-report', authMiddleware, async (req, res) => {
  try {
    const { stormId } = req.params;
    const { format = 'json' } = req.query;
    
    const report = await StormService.generateImpactReport(stormId, format);
    
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.send(report);
    } else {
      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error(`Error generating impact report for storm ${req.params.stormId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate impact report'
    });
  }
});

// Delete storm alert subscription
router.delete('/alerts/:subscriptionId', authMiddleware, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user.id;
    
    await StormService.deleteAlertSubscription(subscriptionId, userId);
    
    res.json({
      success: true,
      message: 'Storm alert subscription deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting alert subscription ${req.params.subscriptionId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete alert subscription'
    });
  }
});

module.exports = router;