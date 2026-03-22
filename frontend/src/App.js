import React, { useState, useEffect } from 'react';
import './App.css';
import { atlasAPI } from './services/api';

function App() {
  const [health, setHealth] = useState(null);
  const [weather, setWeather] = useState(null);
  const [nexus, setNexus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkServices = async () => {
      try {
        // Check backend health
        const healthRes = await atlasAPI.health.check();
        setHealth(healthRes.data);

        // Check weather service
        try {
          const weatherRes = await atlasAPI.weather.getStatus();
          setWeather(weatherRes.data);
        } catch (e) {
          console.warn('Weather service check failed:', e.message);
        }

        // Check Nexus Mind
        try {
          const nexusRes = await atlasAPI.nexus.getStatus();
          setNexus(nexusRes.data);
        } catch (e) {
          console.warn('Nexus Mind check failed:', e.message);
        }

        setLoading(false);
      } catch (err) {
        console.error('Health check failed:', err);
        setError('Failed to connect to backend. Please ensure the server is running on port 5000.');
        setLoading(false);
      }
    };

    checkServices();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🏛️ Atlas Helios Platform</h1>
        <p className="subtitle">Property Intelligence System - Connected Mode</p>
        
        {loading ? (
          <div className="loading">Connecting to services...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <div className="status-grid">
            {/* Backend Status */}
            <div className="status-card">
              <h2>🔧 Backend API</h2>
              <div className={`status-indicator ${health?.status === 'OK' ? 'online' : 'offline'}`}>
                {health?.status === 'OK' ? '🟢 Online' : '🔴 Offline'}
              </div>
              <p>Port: 5000</p>
              <p>Version: {health?.version || '1.0.0'}</p>
            </div>

            {/* Nexus Mind Status */}
            <div className="status-card">
              <h2>🧠 Nexus Mind AI</h2>
              <div className={`status-indicator ${nexus?.available ? 'online' : 'offline'}`}>
                {nexus?.available ? '🟢 Connected' : '⚪ Standby'}
              </div>
              <p>Cognitive Engine</p>
              <p>{nexus?.available ? 'Ready for analysis' : 'Not configured'}</p>
            </div>

            {/* NOAA Weather Status */}
            <div className="status-card">
              <h2>🌤️ NOAA Weather</h2>
              <div className={`status-indicator ${weather?.available ? 'online' : 'offline'}`}>
                {weather?.available ? '🟢 Connected' : '🔴 Offline'}
              </div>
              <p>Weather Intelligence</p>
              <p>API: api.weather.gov</p>
            </div>

            {/* Services Summary */}
            <div className="status-card wide">
              <h2>📊 System Overview</h2>
              <ul className="feature-list">
                <li>✅ Storm Intelligence Service</li>
                <li>✅ Property Management</li>
                <li>✅ Damage Assessment</li>
                <li>✅ Lead Generation</li>
                <li>✅ Cost Estimation</li>
                <li>✅ Nexus Mind AI Integration</li>
                <li>✅ NOAA Weather API Integration</li>
              </ul>
            </div>
          </div>
        )}

        <div className="endpoints">
          <h3>🔗 Available API Endpoints</h3>
          <div className="endpoint-grid">
            <a href="http://localhost:5000/health" target="_blank" rel="noreferrer">Health Check</a>
            <a href="http://localhost:5000/api/weather/status" target="_blank" rel="noreferrer">Weather Status</a>
            <a href="http://localhost:5000/api/nexus/status" target="_blank" rel="noreferrer">Nexus Status</a>
            <a href="http://localhost:5000/api/storms" target="_blank" rel="noreferrer">Storms API</a>
            <a href="http://localhost:5000/api/properties" target="_blank" rel="noreferrer">Properties API</a>
            <a href="http://localhost:5000/api/leads" target="_blank" rel="noreferrer">Leads API</a>
            <a href="http://localhost:5000/api/assessments" target="_blank" rel="noreferrer">Assessments API</a>
            <a href="http://localhost:5000/api/estimates" target="_blank" rel="noreferrer">Estimates API</a>
          </div>
        </div>

        <footer className="App-footer">
          <p>Atlas Helios Platform v{health?.version || '1.0.0'} | Powered by Nexus Mind AI + NOAA Weather</p>
          <p className="timestamp">Last Updated: {new Date().toLocaleString()}</p>
        </footer>
      </header>
    </div>
  );
}

export default App;
