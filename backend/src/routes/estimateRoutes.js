const express = require('express');
const router = express.Router();
const PropertyService = require('../services/PropertyService');
const ComputerVisionService = require('../services/ComputerVisionService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

// Get all estimates for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20, 
      status,
      priority,
      propertyId,
      dateFrom,
      dateTo
    } = req.query;
    
    const estimates = await PropertyService.getUserEstimates(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      filters: {
        status,
        priority,
        propertyId,
        dateFrom: dateFrom ? new Date(dateFrom) : null,
        dateTo: dateTo ? new Date(dateTo) : null
      }
    });
    
    res.json({
      success: true,
      data: estimates.estimates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: estimates.total,
        pages: Math.ceil(estimates.total / parseInt(limit))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching estimates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch estimates'
    });
  }
});

// Get estimate by ID
router.get('/:estimateId', authMiddleware, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const userId = req.user.id;
    
    const estimate = await PropertyService.getEstimateById(estimateId, userId);
    
    if (!estimate) {
      return res.status(404).json({
        success: false,
        error: 'Estimate not found'
      });
    }
    
    res.json({
      success: true,
      data: estimate,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching estimate ${req.params.estimateId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch estimate details'
    });
  }
});

// Create new estimate
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const estimateData = {
      ...req.body,
      userId,
      status: 'draft',
      createdAt: new Date()
    };
    
    const estimate = await PropertyService.createEstimate(estimateData);
    
    res.status(201).json({
      success: true,
      data: estimate,
      message: 'Estimate created successfully'
    });
  } catch (error) {
    logger.error('Error creating estimate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create estimate'
    });
  }
});

// Update estimate
router.put('/:estimateId', authMiddleware, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;
    
    const estimate = await PropertyService.updateEstimate(estimateId, userId, updateData);
    
    if (!estimate) {
      return res.status(404).json({
        success: false,
        error: 'Estimate not found'
      });
    }
    
    res.json({
      success: true,
      data: estimate,
      message: 'Estimate updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating estimate ${req.params.estimateId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update estimate'
    });
  }
});

// Delete estimate
router.delete('/:estimateId', authMiddleware, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const userId = req.user.id;
    
    const deleted = await PropertyService.deleteEstimate(estimateId, userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Estimate not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Estimate deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting estimate ${req.params.estimateId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete estimate'
    });
  }
});

// Generate estimate from assessment
router.post('/from-assessment', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { assessmentId, pricingModel = 'standard' } = req.body;
    
    const estimate = await PropertyService.generateEstimateFromAssessment(assessmentId, userId, pricingModel);
    
    res.status(201).json({
      success: true,
      data: estimate,
      message: 'Estimate generated from assessment successfully'
    });
  } catch (error) {
    logger.error('Error generating estimate from assessment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate estimate from assessment'
    });
  }
});

// Add line item to estimate
router.post('/:estimateId/items', authMiddleware, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const userId = req.user.id;
    const { description, quantity, unitPrice, category, notes } = req.body;
    
    const lineItem = await PropertyService.addEstimateLineItem(estimateId, userId, {
      description,
      quantity: parseFloat(quantity),
      unitPrice: parseFloat(unitPrice),
      category,
      notes
    });
    
    res.status(201).json({
      success: true,
      data: lineItem,
      message: 'Line item added successfully'
    });
  } catch (error) {
    logger.error(`Error adding line item to estimate ${req.params.estimateId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to add line item'
    });
  }
});

// Update line item
router.put('/:estimateId/items/:itemId', authMiddleware, async (req, res) => {
  try {
    const { estimateId, itemId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;
    
    const lineItem = await PropertyService.updateEstimateLineItem(estimateId, itemId, userId, updateData);
    
    if (!lineItem) {
      return res.status(404).json({
        success: false,
        error: 'Line item not found'
      });
    }
    
    res.json({
      success: true,
      data: lineItem,
      message: 'Line item updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating line item ${req.params.itemId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update line item'
    });
  }
});

// Remove line item
router.delete('/:estimateId/items/:itemId', authMiddleware, async (req, res) => {
  try {
    const { estimateId, itemId } = req.params;
    const userId = req.user.id;
    
    const removed = await PropertyService.removeEstimateLineItem(estimateId, itemId, userId);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Line item not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Line item removed successfully'
    });
  } catch (error) {
    logger.error(`Error removing line item ${req.params.itemId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove line item'
    });
  }
});

// Calculate estimate totals
router.get('/:estimateId/calculate', authMiddleware, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const userId = req.user.id;
    
    const totals = await PropertyService.calculateEstimateTotals(estimateId, userId);
    
    res.json({
      success: true,
      data: totals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error calculating totals for estimate ${req.params.estimateId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate estimate totals'
    });
  }
});

// Generate estimate PDF
router.get('/:estimateId/pdf', authMiddleware, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const userId = req.user.id;
    const { includeImages = true, includeTerms = true } = req.query;
    
    const pdfBuffer = await PropertyService.generateEstimatePDF(estimateId, userId, {
      includeImages: includeImages === 'true',
      includeTerms: includeTerms === 'true'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="estimate-${estimateId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error(`Error generating PDF for estimate ${req.params.estimateId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate estimate PDF'
    });
  }
});

// Send estimate to client
router.post('/:estimateId/send', authMiddleware, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const userId = req.user.id;
    const { recipientEmail, subject, message, includePdf = true } = req.body;
    
    const result = await PropertyService.sendEstimateToClient(estimateId, userId, {
      recipientEmail,
      subject,
      message,
      includePdf
    });
    
    res.json({
      success: true,
      data: result,
      message: 'Estimate sent to client successfully'
    });
  } catch (error) {
    logger.error(`Error sending estimate ${req.params.estimateId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to send estimate'
    });
  }
});

// Get estimate templates
router.get('/templates/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category } = req.query;
    
    const templates = await PropertyService.getEstimateTemplates(userId, category);
    
    res.json({
      success: true,
      data: templates,
      count: templates.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching estimate templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch estimate templates'
    });
  }
});

// Create estimate from template
router.post('/from-template', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { templateId, propertyId, customizations = {} } = req.body;
    
    const estimate = await PropertyService.createEstimateFromTemplate(templateId, propertyId, userId, customizations);
    
    res.status(201).json({
      success: true,
      data: estimate,
      message: 'Estimate created from template successfully'
    });
  } catch (error) {
    logger.error('Error creating estimate from template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create estimate from template'
    });
  }
});

// Get estimate statistics
router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30d' } = req.query;
    
    const stats = await PropertyService.getEstimateStatistics(userId, period);
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching estimate statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch estimate statistics'
    });
  }
});

// Convert estimate to job/order
router.post('/:estimateId/convert', authMiddleware, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const userId = req.user.id;
    const { conversionType = 'job', notes } = req.body;
    
    const result = await PropertyService.convertEstimate(estimateId, userId, {
      conversionType,
      notes
    });
    
    res.json({
      success: true,
      data: result,
      message: 'Estimate converted successfully'
    });
  } catch (error) {
    logger.error(`Error converting estimate ${req.params.estimateId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to convert estimate'
    });
  }
});

// Get estimate history
router.get('/:estimateId/history', authMiddleware, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const userId = req.user.id;
    
    const history = await PropertyService.getEstimateHistory(estimateId, userId);
    
    res.json({
      success: true,
      data: history,
      count: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching estimate history ${req.params.estimateId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch estimate history'
    });
  }
});

module.exports = router;