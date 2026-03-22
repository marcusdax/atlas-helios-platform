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

// Get all properties for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      propertyType,
      status,
      city,
      state,
      zipCode
    } = req.query;
    
    const properties = await PropertyService.getUserProperties(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      filters: {
        propertyType,
        status,
        city,
        state,
        zipCode
      }
    });
    
    res.json({
      success: true,
      data: properties.properties,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: properties.total,
        pages: Math.ceil(properties.total / parseInt(limit))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch properties'
    });
  }
});

// Get property by ID
router.get('/:propertyId', authMiddleware, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;
    
    const property = await PropertyService.getPropertyById(propertyId, userId);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }
    
    res.json({
      success: true,
      data: property,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching property ${req.params.propertyId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch property details'
    });
  }
});

// Create new property
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const propertyData = {
      ...req.body,
      userId
    };
    
    const property = await PropertyService.createProperty(propertyData);
    
    res.status(201).json({
      success: true,
      data: property,
      message: 'Property created successfully'
    });
  } catch (error) {
    logger.error('Error creating property:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create property'
    });
  }
});

// Update property
router.put('/:propertyId', authMiddleware, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;
    
    const property = await PropertyService.updateProperty(propertyId, userId, updateData);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }
    
    res.json({
      success: true,
      data: property,
      message: 'Property updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating property ${req.params.propertyId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update property'
    });
  }
});

// Delete property
router.delete('/:propertyId', authMiddleware, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;
    
    const deleted = await PropertyService.deleteProperty(propertyId, userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting property ${req.params.propertyId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete property'
    });
  }
});

// Upload property images
router.post('/:propertyId/images', authMiddleware, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;
    const { images } = req.body;
    
    const uploadedImages = await PropertyService.uploadPropertyImages(propertyId, userId, images);
    
    res.json({
      success: true,
      data: uploadedImages,
      message: 'Images uploaded successfully'
    });
  } catch (error) {
    logger.error(`Error uploading images for property ${req.params.propertyId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload images'
    });
  }
});

// Analyze property with computer vision
router.post('/:propertyId/analyze', authMiddleware, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;
    const { analysisType = 'full' } = req.body;
    
    const analysis = await ComputerVisionService.analyzeProperty(propertyId, userId, analysisType);
    
    res.json({
      success: true,
      data: analysis,
      message: 'Property analysis completed successfully'
    });
  } catch (error) {
    logger.error(`Error analyzing property ${req.params.propertyId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze property'
    });
  }
});

// Get property valuations
router.get('/:propertyId/valuations', authMiddleware, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;
    
    const valuations = await PropertyService.getPropertyValuations(propertyId, userId);
    
    res.json({
      success: true,
      data: valuations,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching valuations for property ${req.params.propertyId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch property valuations'
    });
  }
});

// Get property assessment history
router.get('/:propertyId/assessments', authMiddleware, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;
    
    const assessments = await PropertyService.getPropertyAssessments(propertyId, userId);
    
    res.json({
      success: true,
      data: assessments,
      count: assessments.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching assessments for property ${req.params.propertyId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch property assessments'
    });
  }
});

// Search properties
router.get('/search/query', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      query, 
      city, 
      state, 
      zipCode, 
      propertyType,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      squareFootage,
      page = 1,
      limit = 20
    } = req.query;
    
    const searchResults = await PropertyService.searchProperties(userId, {
      query,
      city,
      state,
      zipCode,
      propertyType,
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      bedrooms: bedrooms ? parseInt(bedrooms) : null,
      bathrooms: bathrooms ? parseInt(bathrooms) : null,
      squareFootage: squareFootage ? parseInt(squareFootage) : null,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: searchResults.properties,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: searchResults.total,
        pages: Math.ceil(searchResults.total / parseInt(limit))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error searching properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search properties'
    });
  }
});

// Get property risk assessment
router.get('/:propertyId/risk', authMiddleware, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;
    
    const riskAssessment = await PropertyService.getPropertyRiskAssessment(propertyId, userId);
    
    res.json({
      success: true,
      data: riskAssessment,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching risk assessment for property ${req.params.propertyId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch risk assessment'
    });
  }
});

// Generate property report
router.get('/:propertyId/report', authMiddleware, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;
    const { format = 'json', reportType = 'full' } = req.query;
    
    const report = await PropertyService.generatePropertyReport(propertyId, userId, {
      format,
      reportType
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
    logger.error(`Error generating report for property ${req.params.propertyId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate property report'
    });
  }
});

module.exports = router;