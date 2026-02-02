const express = require('express');
const router = express.Router();
const PropertyService = require('../services/PropertyService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

// Get all leads for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20, 
      status,
      priority,
      source,
      dateFrom,
      dateTo
    } = req.query;
    
    const leads = await PropertyService.getUserLeads(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      filters: {
        status,
        priority,
        source,
        dateFrom: dateFrom ? new Date(dateFrom) : null,
        dateTo: dateTo ? new Date(dateTo) : null
      }
    });
    
    res.json({
      success: true,
      data: leads.leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: leads.total,
        pages: Math.ceil(leads.total / parseInt(limit))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads'
    });
  }
});

// Get lead by ID
router.get('/:leadId', authMiddleware, async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user.id;
    
    const lead = await PropertyService.getLeadById(leadId, userId);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }
    
    res.json({
      success: true,
      data: lead,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching lead ${req.params.leadId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lead details'
    });
  }
});

// Create new lead
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const leadData = {
      ...req.body,
      userId,
      status: 'new',
      createdAt: new Date()
    };
    
    const lead = await PropertyService.createLead(leadData);
    
    res.status(201).json({
      success: true,
      data: lead,
      message: 'Lead created successfully'
    });
  } catch (error) {
    logger.error('Error creating lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create lead'
    });
  }
});

// Update lead
router.put('/:leadId', authMiddleware, async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;
    
    const lead = await PropertyService.updateLead(leadId, userId, updateData);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }
    
    res.json({
      success: true,
      data: lead,
      message: 'Lead updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating lead ${req.params.leadId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update lead'
    });
  }
});

// Delete lead
router.delete('/:leadId', authMiddleware, async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user.id;
    
    const deleted = await PropertyService.deleteLead(leadId, userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting lead ${req.params.leadId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete lead'
    });
  }
});

// Update lead status
router.patch('/:leadId/status', authMiddleware, async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user.id;
    const { status, notes } = req.body;
    
    const lead = await PropertyService.updateLeadStatus(leadId, userId, status, notes);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }
    
    res.json({
      success: true,
      data: lead,
      message: 'Lead status updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating lead status ${req.params.leadId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update lead status'
    });
  }
});

// Add lead note
router.post('/:leadId/notes', authMiddleware, async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user.id;
    const { content, type = 'general' } = req.body;
    
    const note = await PropertyService.addLeadNote(leadId, userId, {
      content,
      type,
      createdAt: new Date()
    });
    
    res.status(201).json({
      success: true,
      data: note,
      message: 'Lead note added successfully'
    });
  } catch (error) {
    logger.error(`Error adding note to lead ${req.params.leadId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to add lead note'
    });
  }
});

// Get lead activities
router.get('/:leadId/activities', authMiddleware, async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user.id;
    
    const activities = await PropertyService.getLeadActivities(leadId, userId);
    
    res.json({
      success: true,
      data: activities,
      count: activities.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching lead activities ${req.params.leadId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lead activities'
    });
  }
});

// Schedule follow-up
router.post('/:leadId/followup', authMiddleware, async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user.id;
    const { scheduledDate, type, notes, priority = 'medium' } = req.body;
    
    const followUp = await PropertyService.scheduleFollowUp(leadId, userId, {
      scheduledDate: new Date(scheduledDate),
      type,
      notes,
      priority
    });
    
    res.status(201).json({
      success: true,
      data: followUp,
      message: 'Follow-up scheduled successfully'
    });
  } catch (error) {
    logger.error(`Error scheduling follow-up for lead ${req.params.leadId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule follow-up'
    });
  }
});

// Get lead score
router.get('/:leadId/score', authMiddleware, async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user.id;
    
    const score = await PropertyService.calculateLeadScore(leadId, userId);
    
    res.json({
      success: true,
      data: score,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error calculating lead score ${req.params.leadId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate lead score'
    });
  }
});

// Get lead statistics
router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30d' } = req.query;
    
    const stats = await PropertyService.getLeadStatistics(userId, period);
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching lead statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lead statistics'
    });
  }
});

// Convert lead to opportunity
router.post('/:leadId/convert', authMiddleware, async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user.id;
    const { opportunityType, notes, estimatedValue } = req.body;
    
    const opportunity = await PropertyService.convertLeadToOpportunity(leadId, userId, {
      opportunityType,
      notes,
      estimatedValue
    });
    
    res.json({
      success: true,
      data: opportunity,
      message: 'Lead converted to opportunity successfully'
    });
  } catch (error) {
    logger.error(`Error converting lead ${req.params.leadId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to convert lead'
    });
  }
});

// Get lead pipeline
router.get('/pipeline/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { dateRange = '30d' } = req.query;
    
    const pipeline = await PropertyService.getLeadPipeline(userId, dateRange);
    
    res.json({
      success: true,
      data: pipeline,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching lead pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lead pipeline'
    });
  }
});

// Bulk update leads
router.patch('/bulk/update', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { leadIds, updateData } = req.body;
    
    const results = await PropertyService.bulkUpdateLeads(leadIds, userId, updateData);
    
    res.json({
      success: true,
      data: results,
      message: 'Bulk update completed successfully'
    });
  } catch (error) {
    logger.error('Error performing bulk lead update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk update'
    });
  }
});

module.exports = router;