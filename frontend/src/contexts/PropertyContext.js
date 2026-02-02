import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';

const PropertyContext = createContext();

export const useProperty = () => {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
};

export const PropertyProvider = ({ children }) => {
  const { socket, isConnected } = useWebSocket();
  const [properties, setProperties] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propertyFilters, setPropertyFilters] = useState({
    city: '',
    state: 'TX',
    riskLevel: '',
    buildingType: '',
    searchQuery: ''
  });

  useEffect(() => {
    if (socket && isConnected) {
      // Property assessment events
      socket.on('property_assessment_started', (data) => {
        setAssessments(prev => [data, ...prev]);
      });

      socket.on('property_assessment_complete', (data) => {
        setAssessments(prev => 
          prev.map(assessment => 
            assessment.id === data.id ? data : assessment
          )
        );
      });

      socket.on('new_leads_generated', (data) => {
        setLeads(prev => [...data.leads, ...prev]);
      });

      socket.on('lead_updated', (data) => {
        setLeads(prev => 
          prev.map(lead => 
            lead.id === data.id ? data : lead
          )
        );
      });

      // Cleanup
      return () => {
        socket.off('property_assessment_started');
        socket.off('property_assessment_complete');
        socket.off('new_leads_generated');
        socket.off('lead_updated');
      };
    }
  }, [socket, isConnected]);

  // Initialize data on mount
  useEffect(() => {
    initializePropertyData();
  }, []);

  const initializePropertyData = async () => {
    try {
      // Mock data for demo
      const mockProperties = [
        {
          id: 'prop_001',
          address: '1247 Oak Ridge Dr',
          city: 'Dallas',
          state: 'TX',
          zipCode: '75201',
          latitude: 32.7767,
          longitude: -96.7970,
          propertyType: 'residential',
          yearBuilt: 1998,
          squareFootage: 2200,
          roofType: 'architectural_shingles',
          estimatedValue: 350000,
          currentRiskLevel: 'high',
          lastAssessmentScore: 94,
          lastAssessmentDate: new Date(Date.now() - 15 * 60 * 1000),
          assessmentStatus: 'completed'
        },
        {
          id: 'prop_002',
          address: '3856 Maple Ave',
          city: 'Dallas',
          state: 'TX',
          zipCode: '75202',
          latitude: 32.7831,
          longitude: -96.8067,
          propertyType: 'residential',
          yearBuilt: 2005,
          squareFootage: 1800,
          roofType: 'metal',
          estimatedValue: 280000,
          currentRiskLevel: 'medium',
          lastAssessmentScore: 76,
          lastAssessmentDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
          assessmentStatus: 'completed'
        }
      ];

      setProperties(mockProperties);

      const mockLeads = [
        {
          id: 'lead_001',
          propertyId: 'prop_001',
          propertyAddress: '1247 Oak Ridge Dr, Dallas, TX',
          damageProbabilityScore: 94,
          leadStatus: 'new',
          contactName: 'John Smith',
          contactEmail: 'john.smith@email.com',
          estimatedValue: 45000,
          createdAt: new Date(Date.now() - 30 * 60 * 1000)
        },
        {
          id: 'lead_002',
          propertyId: 'prop_002',
          propertyAddress: '3856 Maple Ave, Dallas, TX',
          damageProbabilityScore: 76,
          leadStatus: 'contacted',
          contactName: 'Jane Doe',
          contactEmail: 'jane.doe@email.com',
          estimatedValue: 32000,
          createdAt: new Date(Date.now() - 60 * 60 * 1000)
        }
      ];

      setLeads(mockLeads);

    } catch (error) {
      console.error('Failed to initialize property data:', error);
    }
  };

  // Helper functions
  const getPropertyById = (id) => {
    return properties.find(property => property.id === id);
  };

  const getPropertiesByRiskLevel = (riskLevel) => {
    return properties.filter(property => property.currentRiskLevel === riskLevel);
  };

  const getHighRiskProperties = () => {
    return properties.filter(property => 
      property.currentRiskLevel === 'high' || property.currentRiskLevel === 'critical'
    );
  };

  const getRecentAssessments = (limit = 10) => {
    return assessments
      .sort((a, b) => new Date(b.completedAt || b.startedAt) - new Date(a.completedAt || a.startedAt))
      .slice(0, limit);
  };

  const getLeadsByStatus = (status) => {
    return leads.filter(lead => lead.leadStatus === status);
  };

  const getRecentLeads = (limit = 10) => {
    return leads
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  };

  const getPropertyStats = () => {
    const totalProperties = properties.length;
    const highRiskProperties = properties.filter(p => p.currentRiskLevel === 'high' || p.currentRiskLevel === 'critical').length;
    const assessedProperties = properties.filter(p => p.assessmentStatus === 'completed').length;
    const totalEstimates = estimates.length;
    
    return {
      totalProperties,
      highRiskProperties,
      assessedProperties,
      assessmentRate: totalProperties > 0 ? (assessedProperties / totalProperties * 100) : 0,
      totalEstimates,
      totalLeads: leads.length
    };
  };

  const searchProperties = (query, filters = {}) => {
    let filteredProperties = [...properties];

    // Apply search query
    if (query) {
      const searchTerm = query.toLowerCase();
      filteredProperties = filteredProperties.filter(property =>
        property.address.toLowerCase().includes(searchTerm) ||
        property.city.toLowerCase().includes(searchTerm) ||
        property.zipCode.includes(searchTerm)
      );
    }

    // Apply filters
    if (filters.city) {
      filteredProperties = filteredProperties.filter(property =>
        property.city.toLowerCase().includes(filters.city.toLowerCase())
      );
    }

    if (filters.state) {
      filteredProperties = filteredProperties.filter(property =>
        property.state === filters.state
      );
    }

    if (filters.riskLevel) {
      filteredProperties = filteredProperties.filter(property =>
        property.currentRiskLevel === filters.riskLevel
      );
    }

    if (filters.buildingType) {
      filteredProperties = filteredProperties.filter(property =>
        property.propertyType === filters.buildingType
      );
    }

    return filteredProperties;
  };

  const updateProperty = (propertyId, updates) => {
    setProperties(prev =>
      prev.map(property =>
        property.id === propertyId ? { ...property, ...updates } : property
      )
    );
  };

  const addAssessment = (assessment) => {
    setAssessments(prev => [assessment, ...prev]);
  };

  const updateAssessment = (assessmentId, updates) => {
    setAssessments(prev =>
      prev.map(assessment =>
        assessment.id === assessmentId ? { ...assessment, ...updates } : assessment
      )
    );
  };

  const addLead = (lead) => {
    setLeads(prev => [lead, ...prev]);
  };

  const updateLead = (leadId, updates) => {
    setLeads(prev =>
      prev.map(lead =>
        lead.id === leadId ? { ...lead, ...updates } : lead
      )
    );
  };

  const getAssessmentsByProperty = (propertyId) => {
    return assessments
      .filter(assessment => assessment.propertyId === propertyId)
      .sort((a, b) => new Date(b.completedAt || b.startedAt) - new Date(a.completedAt || a.startedAt));
  };

  const getLeadsByProperty = (propertyId) => {
    return leads
      .filter(lead => lead.propertyId === propertyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const generatePortfolioReport = async (companyId, criteria = {}) => {
    // Mock portfolio report generation
    const companyProperties = properties.filter(p => !companyId || p.companyId === companyId);
    
    const report = {
      generatedAt: new Date(),
      companyId,
      criteria,
      summary: {
        totalProperties: companyProperties.length,
        highRiskCount: companyProperties.filter(p => p.currentRiskLevel === 'high').length,
        averageScore: companyProperties.reduce((sum, p) => sum + (p.lastAssessmentScore || 0), 0) / companyProperties.length,
        totalEstimatedValue: companyProperties.reduce((sum, p) => sum + (p.estimatedValue || 0), 0)
      },
      recommendations: [
        'Schedule immediate assessments for high-risk properties',
        'Implement preventive maintenance program',
        'Review insurance coverage for affected areas'
      ]
    };

    return report;
  };

  const value = {
    // State
    properties,
    assessments,
    leads,
    estimates,
    selectedProperty,
    propertyFilters,
    
    // Computed data
    getPropertyById,
    getPropertiesByRiskLevel,
    getHighRiskProperties,
    getRecentAssessments,
    getLeadsByStatus,
    getRecentLeads,
    getPropertyStats,
    getAssessmentsByProperty,
    getLeadsByProperty,
    
    // Actions
    searchProperties,
    updateProperty,
    addAssessment,
    updateAssessment,
    addLead,
    updateLead,
    generatePortfolioReport,
    setSelectedProperty,
    setPropertyFilters,
    setProperties,
    setAssessments,
    setLeads,
    setEstimates
  };

  return (
    <PropertyContext.Provider value={value}>
      {children}
    </PropertyContext.Provider>
  );
};