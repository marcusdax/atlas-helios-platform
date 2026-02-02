import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';

const StormContext = createContext();

export const useStorm = () => {
  const context = useContext(StormContext);
  if (!context) {
    throw new Error('useStorm must be used within a StormProvider');
  }
  return context;
};

export const StormProvider = ({ children }) => {
  const { socket, isConnected } = useWebSocket();
  const [activeStorms, setActiveStorms] = useState([]);
  const [stormAlerts, setStormAlerts] = useState([]);
  const [recentAssessments, setRecentAssessments] = useState([]);
  const [weatherConditions, setWeatherConditions] = useState(null);
  const [stormHistory, setStormHistory] = useState([]);

  useEffect(() => {
    if (socket && isConnected) {
      // Subscribe to storm updates
      socket.emit('subscribe_storms');
      
      // Storm event handlers
      socket.on('storm_alert', (alert) => {
        console.log('Storm alert received:', alert);
        setStormAlerts(prev => [alert, ...prev.slice(0, 9)]);
        
        // Add to active storms if not already present
        setActiveStorms(prev => {
          const exists = prev.find(storm => storm.id === alert.id);
          if (!exists) {
            return [...prev, alert];
          }
          return prev;
        });
      });

      socket.on('storm_update', (data) => {
        console.log('Storm update received:', data);
        setActiveStorms(prev => 
          prev.map(storm => 
            storm.id === data.id ? { ...storm, ...data } : storm
          )
        );
      });

      socket.on('storm_dissipated', (data) => {
        console.log('Storm dissipated:', data);
        setActiveStorms(prev => prev.filter(storm => storm.id !== data.id));
      });

      // Weather condition updates
      socket.on('weather_update', (data) => {
        setWeatherConditions(data);
      });

      // Property assessment events
      socket.on('property_assessment_complete', (data) => {
        setRecentAssessments(prev => [data, ...prev.slice(0, 19)]);
      });

      // Cleanup listeners
      return () => {
        socket.off('storm_alert');
        socket.off('storm_update');
        socket.off('storm_dissipated');
        socket.off('weather_update');
        socket.off('property_assessment_complete');
      };
    }
  }, [socket, isConnected]);

  // Initialize storm data on mount
  useEffect(() => {
    initializeStormData();
  }, []);

  const initializeStormData = async () => {
    try {
      // Mock data for demo - in real implementation, fetch from API
      const mockActiveStorms = [
        {
          id: 'storm_001',
          type: 'severe_thunderstorm',
          severity: 'severe',
          region: 'Dallas County, TX',
          center: { lat: 32.7767, lng: -96.7970 },
          detectedAt: new Date(Date.now() - 30 * 60 * 1000),
          affectedProperties: 47,
          alertLevel: 'warning'
        },
        {
          id: 'storm_002',
          type: 'hail',
          severity: 'moderate',
          region: 'Tarrant County, TX',
          center: { lat: 32.7555, lng: -97.3308 },
          detectedAt: new Date(Date.now() - 60 * 60 * 1000),
          affectedProperties: 23,
          alertLevel: 'watch'
        }
      ];

      setActiveStorms(mockActiveStorms);

      const mockAssessments = [
        {
          id: 'assessment_001',
          propertyAddress: '1247 Oak Ridge Dr, Dallas, TX',
          overallScore: 94,
          completedAt: new Date(Date.now() - 15 * 60 * 1000),
          riskLevel: 'high'
        },
        {
          id: 'assessment_002',
          propertyAddress: '3856 Maple Ave, Dallas, TX',
          overallScore: 87,
          completedAt: new Date(Date.now() - 32 * 60 * 1000),
          riskLevel: 'high'
        }
      ];

      setRecentAssessments(mockAssessments);

    } catch (error) {
      console.error('Failed to initialize storm data:', error);
    }
  };

  // Helper functions
  const getStormById = (id) => {
    return activeStorms.find(storm => storm.id === id);
  };

  const getStormsByRegion = (region) => {
    return activeStorms.filter(storm => 
      storm.region.toLowerCase().includes(region.toLowerCase())
    );
  };

  const getStormAlerts = (limit = 10) => {
    return stormAlerts.slice(0, limit);
  };

  const getRecentAssessments = (limit = 10) => {
    return recentAssessments.slice(0, limit);
  };

  const getHighRiskProperties = () => {
    return recentAssessments
      .filter(assessment => assessment.riskLevel === 'high')
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  };

  const getStormStats = () => {
    return {
      activeStorms: activeStorms.length,
      totalAlerts: stormAlerts.length,
      highRiskAssessments: recentAssessments.filter(a => a.riskLevel === 'high').length,
      totalAffectedProperties: activeStorms.reduce((sum, storm) => sum + (storm.affectedProperties || 0), 0)
    };
  };

  const acknowledgeAlert = (alertId) => {
    setStormAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true, acknowledgedAt: new Date() }
          : alert
      )
    );
  };

  const clearAlert = (alertId) => {
    setStormAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const getWeatherForecast = (hours = 24) => {
    // Mock weather forecast data
    const forecast = [];
    const now = new Date();
    
    for (let i = 0; i < hours; i += 3) { // Every 3 hours
      const time = new Date(now.getTime() + i * 60 * 60 * 1000);
      forecast.push({
        time: time.toISOString(),
        temperature: 70 + Math.sin(i / 8) * 15 + Math.random() * 10,
        humidity: 60 + Math.random() * 30,
        windSpeed: 10 + Math.random() * 20,
        precipitation: Math.random() > 0.7 ? Math.random() * 100 : 0,
        stormProbability: Math.max(0, Math.min(100, 30 + Math.sin(i / 4) * 40 + Math.random() * 20))
      });
    }
    
    return forecast;
  };

  const value = {
    // State
    activeStorms,
    stormAlerts,
    recentAssessments,
    weatherConditions,
    stormHistory,
    
    // Computed data
    getStormById,
    getStormsByRegion,
    getStormAlerts,
    getRecentAssessments,
    getHighRiskProperties,
    getStormStats,
    
    // Actions
    acknowledgeAlert,
    clearAlert,
    getWeatherForecast,
    
    // Direct setters (for manual updates)
    setActiveStorms,
    setStormAlerts,
    setRecentAssessments,
    setWeatherConditions
  };

  return (
    <StormContext.Provider value={value}>
      {children}
    </StormContext.Provider>
  );
};