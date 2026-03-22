const express = require('express');
const router = express.Router();
const PropertyService = require('../services/PropertyService');
let ComputerVisionService;
try {
  ComputerVisionService = require('../services/ComputerVisionService');
} catch (e) {
  ComputerVisionService = null;
}
const { authMiddleware } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// Get all assessments for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20, 
      status,
      severity,
      propertyId,
      dateFrom,
      dateTo
    } = req.query;
    
    const assessments = await PropertyService.getUserAssessments(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      filters: {
        status,
        severity,
        propertyId,
        dateFrom: dateFrom ? new Date(dateFrom) : null,
        dateTo: dateTo ? new Date(dateTo) : null
      }
    });
    
    res.json({
      success: true,
      data: assessments.assessments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: assessments.total,
        pages: Math.ceil(assessments.total / parseInt(limit))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching assessments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assessments'
    });
  }
});

// Get assessment by ID
router.get('/:assessmentId', authMiddleware, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;
    
    const assessment = await PropertyService.getAssessmentById(assessmentId, userId);
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: 'Assessment not found'
      });
    }
    
    res.json({
      success: true,
      data: assessment,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching assessment ${req.params.assessmentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assessment details'
    });
  }
});

// Create new property assessment
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const assessmentData = {
      ...req.body,
      userId,
      status: 'pending',
      createdAt: new Date()
    };
    
    const assessment = await PropertyService.createAssessment(assessmentData);
    
    res.status(201).json({
      success: true,
      data: assessment,
      message: 'Assessment created successfully'
    });
  } catch (error) {
    logger.error('Error creating assessment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create assessment'
    });
  }
});

// Update assessment
router.put('/:assessmentId', authMiddleware, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;
    
    const assessment = await PropertyService.updateAssessment(assessmentId, userId, updateData);
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: 'Assessment not found'
      });
    }
    
    res.json({
      success: true,
      data: assessment,
      message: 'Assessment updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating assessment ${req.params.assessmentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update assessment'
    });
  }
});

// Delete assessment
router.delete('/:assessmentId', authMiddleware, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;
    
    const deleted = await PropertyService.deleteAssessment(assessmentId, userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Assessment not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Assessment deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting assessment ${req.params.assessmentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete assessment'
    });
  }
});

// Upload assessment images
router.post('/:assessmentId/images', authMiddleware, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;
    const { images, imageType = 'damage' } = req.body;
    
    const uploadedImages = await PropertyService.uploadAssessmentImages(assessmentId, userId, images, imageType);
    
    res.json({
      success: true,
      data: uploadedImages,
      message: 'Assessment images uploaded successfully'
    });
  } catch (error) {
    logger.error(`Error uploading images for assessment ${req.params.assessmentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload assessment images'
    });
  }
});

// Run AI damage analysis
router.post('/:assessmentId/analyze-damage', authMiddleware, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;
    const { analysisType = 'comprehensive' } = req.body;
    
    const analysis = await ComputerVisionService.analyzePropertyDamage(assessmentId, userId, analysisType);
    
    res.json({
      success: true,
      data: analysis,
      message: 'Damage analysis completed successfully'
    });
  } catch (error) {
    logger.error(`Error analyzing damage for assessment ${req.params.assessmentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze damage'
    });
  }
});

// Get assessment statistics
router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30d' } = req.query;
    
    const stats = await PropertyService.getAssessmentStatistics(userId, period);
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching assessment statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assessment statistics'
    });
  }
});

// Get assessment timeline
router.get('/:assessmentId/timeline', authMiddleware, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;
    
    const timeline = await PropertyService.getAssessmentTimeline(assessmentId, userId);
    
    res.json({
      success: true,
      data: timeline,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching assessment timeline ${req.params.assessmentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assessment timeline'
    });
  }
});

// Generate assessment report
router.get('/:assessmentId/report', authMiddleware, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;
    const { format = 'json', includeImages = true } = req.query;
    
    const report = await PropertyService.generateAssessmentReport(assessmentId, userId, {
      format,
      includeImages: includeImages === 'true'
    });
    
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
    logger.error(`Error generating assessment report ${req.params.assessmentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate assessment report'
    });
  }
});

// Submit assessment for review
router.post('/:assessmentId/submit', authMiddleware, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;
    const { notes, priority = 'normal' } = req.body;
    
    const assessment = await PropertyService.submitAssessmentForReview(assessmentId, userId, {
      notes,
      priority
    });
    
    res.json({
      success: true,
      data: assessment,
      message: 'Assessment submitted for review successfully'
    });
  } catch (error) {
    logger.error(`Error submitting assessment ${req.params.assessmentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit assessment'
    });
  }
});

// Get assessment recommendations
router.get('/:assessmentId/recommendations', authMiddleware, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;
    
    const recommendations = await PropertyService.getAssessmentRecommendations(assessmentId, userId);
    
    res.json({
      success: true,
      data: recommendations,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching assessment recommendations ${req.params.assessmentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assessment recommendations'
    });
  }
});

module.exports = router;