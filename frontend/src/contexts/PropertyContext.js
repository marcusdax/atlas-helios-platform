import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './WebSocketContext';
import { atlasAPI } from '../services/api';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propertyFilters, setPropertyFilters] = useState({
    city: '',
    state: 'TX',
    riskLevel: '',
    buildingType: '',
    searchQuery: ''
  });

  // WebSocket event handlers
  useEffect(() => {
    if (socket && isConnected) {
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

  // ==================== API FUNCTIONS ====================

  const initializePropertyData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load all data in parallel
      const [propertiesRes, assessmentsRes, leadsRes, estimatesRes] = await Promise.allSettled([
        atlasAPI.properties.getAll({ limit: 100 }),
        atlasAPI.assessments.getAll({ limit: 100 }),
        atlasAPI.leads.getAll({ limit: 100 }),
        atlasAPI.estimates.getAll({ limit: 100 }),
      ]);

      if (propertiesRes.status === 'fulfilled') {
        setProperties(propertiesRes.value.data.data || []);
      }
      if (assessmentsRes.status === 'fulfilled') {
        setAssessments(assessmentsRes.value.data.data || []);
      }
      if (leadsRes.status === 'fulfilled') {
        setLeads(leadsRes.value.data.data || []);
      }
      if (estimatesRes.status === 'fulfilled') {
        setEstimates(estimatesRes.value.data.data || []);
      }
    } catch (err) {
      console.error('Failed to initialize property data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Properties API
  const fetchProperties = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await atlasAPI.properties.getAll(params);
      setProperties(res.data.data || []);
      return res.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPropertyById = useCallback(async (id) => {
    try {
      const res = await atlasAPI.properties.getById(id);
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const createProperty = useCallback(async (data) => {
    try {
      const res = await atlasAPI.properties.create(data);
      setProperties(prev => [res.data.data, ...prev]);
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updatePropertyData = useCallback(async (id, data) => {
    try {
      const res = await atlasAPI.properties.update(id, data);
      setProperties(prev =>
        prev.map(property =>
          property.id === id ? { ...property, ...res.data.data } : property
        )
      );
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteProperty = useCallback(async (id) => {
    try {
      await atlasAPI.properties.delete(id);
      setProperties(prev => prev.filter(property => property.id !== id));
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Assessments API
  const fetchAssessments = useCallback(async (params = {}) => {
    try {
      const res = await atlasAPI.assessments.getAll(params);
      setAssessments(res.data.data || []);
      return res.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const createAssessment = useCallback(async (data) => {
    try {
      const res = await atlasAPI.assessments.create(data);
      setAssessments(prev => [res.data.data, ...prev]);
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateAssessmentData = useCallback(async (id, data) => {
    try {
      const res = await atlasAPI.assessments.update(id, data);
      setAssessments(prev =>
        prev.map(assessment =>
          assessment.id === id ? { ...assessment, ...res.data.data } : assessment
        )
      );
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteAssessment = useCallback(async (id) => {
    try {
      await atlasAPI.assessments.delete(id);
      setAssessments(prev => prev.filter(a => a.id !== id));
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Leads API
  const fetchLeads = useCallback(async (params = {}) => {
    try {
      const res = await atlasAPI.leads.getAll(params);
      setLeads(res.data.data || []);
      return res.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const createLead = useCallback(async (data) => {
    try {
      const res = await atlasAPI.leads.create(data);
      setLeads(prev => [res.data.data, ...prev]);
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateLeadData = useCallback(async (id, data) => {
    try {
      const res = await atlasAPI.leads.update(id, data);
      setLeads(prev =>
        prev.map(lead =>
          lead.id === id ? { ...lead, ...res.data.data } : lead
        )
      );
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteLead = useCallback(async (id) => {
    try {
      await atlasAPI.leads.delete(id);
      setLeads(prev => prev.filter(l => l.id !== id));
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateLeadStatus = useCallback(async (id, status, notes) => {
    try {
      const res = await atlasAPI.leads.updateStatus(id, { status, notes });
      setLeads(prev =>
        prev.map(lead =>
          lead.id === id ? { ...lead, ...res.data.data } : lead
        )
      );
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Estimates API
  const fetchEstimates = useCallback(async (params = {}) => {
    try {
      const res = await atlasAPI.estimates.getAll(params);
      setEstimates(res.data.data || []);
      return res.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const createEstimate = useCallback(async (data) => {
    try {
      const res = await atlasAPI.estimates.create(data);
      setEstimates(prev => [res.data.data, ...prev]);
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateEstimateData = useCallback(async (id, data) => {
    try {
      const res = await atlasAPI.estimates.update(id, data);
      setEstimates(prev =>
        prev.map(est =>
          est.id === id ? { ...est, ...res.data.data } : est
        )
      );
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteEstimate = useCallback(async (id) => {
    try {
      await atlasAPI.estimates.delete(id);
      setEstimates(prev => prev.filter(e => e.id !== id));
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // ==================== HELPER FUNCTIONS ====================

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

    if (query) {
      const searchTerm = query.toLowerCase();
      filteredProperties = filteredProperties.filter(property =>
        property.address?.toLowerCase().includes(searchTerm) ||
        property.city?.toLowerCase().includes(searchTerm) ||
        property.zipCode?.includes(searchTerm)
      );
    }

    if (filters.city) {
      filteredProperties = filteredProperties.filter(property =>
        property.city?.toLowerCase().includes(filters.city.toLowerCase())
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
    const companyProperties = properties.filter(p => !companyId || p.companyId === companyId);
    
    return {
      generatedAt: new Date(),
      companyId,
      criteria,
      summary: {
        totalProperties: companyProperties.length,
        highRiskCount: companyProperties.filter(p => p.currentRiskLevel === 'high').length,
        averageScore: companyProperties.reduce((sum, p) => sum + (p.lastAssessmentScore || 0), 0) / companyProperties.length || 0,
        totalEstimatedValue: companyProperties.reduce((sum, p) => sum + (p.estimatedValue || 0), 0)
      },
      recommendations: [
        'Schedule immediate assessments for high-risk properties',
        'Implement preventive maintenance program',
        'Review insurance coverage for affected areas'
      ]
    };
  };

  const value = {
    // State
    properties,
    assessments,
    leads,
    estimates,
    loading,
    error,
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
    
    // API Actions - Properties
    fetchProperties,
    fetchPropertyById,
    createProperty,
    updatePropertyData,
    deleteProperty,
    
    // API Actions - Assessments
    fetchAssessments,
    createAssessment,
    updateAssessmentData,
    deleteAssessment,
    
    // API Actions - Leads
    fetchLeads,
    createLead,
    updateLeadData,
    deleteLead,
    updateLeadStatus,
    
    // API Actions - Estimates
    fetchEstimates,
    createEstimate,
    updateEstimateData,
    deleteEstimate,
    
    // Other Actions
    searchProperties,
    generatePortfolioReport,
    initializePropertyData,
    setSelectedProperty,
    setPropertyFilters,
    setProperties,
    setAssessments,
    setLeads,
    setEstimates,
  };

  return (
    <PropertyContext.Provider value={value}>
      {children}
    </PropertyContext.Provider>
  );
};
