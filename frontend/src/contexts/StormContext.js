import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './WebSocketContext';
import { atlasAPI } from '../services/api';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // WebSocket event handlers
  useEffect(() => {
    if (socket && isConnected) {
      socket.emit('subscribe_storms');
      
      socket.on('storm_alert', (alert) => {
        console.log('Storm alert received:', alert);
        setStormAlerts(prev => [alert, ...prev.slice(0, 9)]);
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

      socket.on('weather_update', (data) => {
        setWeatherConditions(data);
      });

      socket.on('property_assessment_complete', (data) => {
        setRecentAssessments(prev => [data, ...prev.slice(0, 19)]);
      });

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

  // ==================== API FUNCTIONS ====================

  const initializeStormData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load storms and alerts in parallel
      const [stormsRes, alertsRes] = await Promise.allSettled([
        atlasAPI.storms.getAll({ limit: 50 }),
        atlasAPI.storms.getUserAlerts(),
      ]);

      if (stormsRes.status === 'fulfilled') {
        setActiveStorms(stormsRes.value.data.data || []);
      }
      if (alertsRes.status === 'fulfilled') {
        setStormAlerts(alertsRes.value.data.data || []);
      }

      // Check weather service status
      try {
        const weatherRes = await atlasAPI.weather.getStatus();
        setWeatherConditions(weatherRes.data);
      } catch (e) {
        console.warn('Weather service not available:', e.message);
      }
    } catch (err) {
      console.error('Failed to initialize storm data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Storms API
  const fetchStorms = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await atlasAPI.storms.getAll(params);
      setActiveStorms(res.data.data || []);
      return res.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStormById = useCallback(async (id) => {
    try {
      const res = await atlasAPI.storms.getById(id);
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const fetchStormTrack = useCallback(async (id) => {
    try {
      const res = await atlasAPI.storms.getTrack(id);
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const fetchPropertiesAtRisk = useCallback(async (id, radius = 50) => {
    try {
      const res = await atlasAPI.storms.getPropertiesAtRisk(id, { radius });
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const fetchStormPredictions = useCallback(async (id, timeHorizon = 72) => {
    try {
      const res = await atlasAPI.storms.getPredictions(id, { timeHorizon });
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const fetchHistoricalStorms = useCallback(async (region, params = {}) => {
    try {
      const res = await atlasAPI.storms.getHistory(region, params);
      setStormHistory(res.data.data || []);
      return res.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const subscribeToAlerts = useCallback(async (data) => {
    try {
      const res = await atlasAPI.storms.subscribe(data);
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteSubscription = useCallback(async (id) => {
    try {
      await atlasAPI.storms.deleteSubscription(id);
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const generateImpactReport = useCallback(async (id, format = 'json') => {
    try {
      const res = await atlasAPI.storms.getImpactReport(id, { format });
      return res.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Weather API
  const fetchWeatherForecast = useCallback(async (lat, lng) => {
    try {
      const res = await atlasAPI.weather.getForecast(lat, lng);
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const fetchHourlyForecast = useCallback(async (lat, lng) => {
    try {
      const res = await atlasAPI.weather.getHourlyForecast(lat, lng);
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const fetchWeatherAlerts = useCallback(async () => {
    try {
      const res = await atlasAPI.weather.getAlerts();
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const fetchAlertsByArea = useCallback(async (lat, lng, radius = 25) => {
    try {
      const res = await atlasAPI.weather.getAlertsByArea(lat, lng, radius);
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const checkSevereWeather = useCallback(async (lat, lng) => {
    try {
      const res = await atlasAPI.weather.checkSevere(lat, lng);
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const fetchRadarStations = useCallback(async () => {
    try {
      const res = await atlasAPI.weather.getRadarStations();
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const fetchStormReports = useCallback(async (params = {}) => {
    try {
      const res = await atlasAPI.weather.getStormReports(params);
      return res.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const batchCheckSevere = useCallback(async (locations) => {
    try {
      const res = await atlasAPI.weather.batchSevere({ locations });
      return res.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // ==================== HELPER FUNCTIONS ====================

  const getStormById = (id) => {
    return activeStorms.find(storm => storm.id === id);
  };

  const getStormsByRegion = (region) => {
    return activeStorms.filter(storm => 
      storm.region?.toLowerCase().includes(region.toLowerCase())
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
    const forecast = [];
    const now = new Date();
    
    for (let i = 0; i < hours; i += 3) {
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
    loading,
    error,
    
    // Computed data
    getStormById,
    getStormsByRegion,
    getStormAlerts,
    getRecentAssessments,
    getHighRiskProperties,
    getStormStats,
    
    // API Actions - Storms
    fetchStorms,
    fetchStormById,
    fetchStormTrack,
    fetchPropertiesAtRisk,
    fetchStormPredictions,
    fetchHistoricalStorms,
    subscribeToAlerts,
    deleteSubscription,
    generateImpactReport,
    
    // API Actions - Weather
    fetchWeatherForecast,
    fetchHourlyForecast,
    fetchWeatherAlerts,
    fetchAlertsByArea,
    checkSevereWeather,
    fetchRadarStations,
    fetchStormReports,
    batchCheckSevere,
    
    // Other Actions
    acknowledgeAlert,
    clearAlert,
    getWeatherForecast,
    initializeStormData,
    
    // Direct setters
    setActiveStorms,
    setStormAlerts,
    setRecentAssessments,
    setWeatherConditions,
    setStormHistory,
  };

  return (
    <StormContext.Provider value={value}>
      {children}
    </StormContext.Provider>
  );
};
