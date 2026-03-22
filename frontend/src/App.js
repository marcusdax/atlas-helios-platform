import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [health, setHealth] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check backend health
    fetch('http://localhost:5001/health')
      .then(res => res.json())
      .then(data => {
        setHealth(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Health check failed:', err);
        setLoading(false);
      });

    // Check weather service
    fetch('http://localhost:5001/api/weather/status')
      .then(res => res.json())
      .then(data => setWeather(data))
      .catch(err => console.error('Weather check failed:', err));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🏛️ Atlas Helios Platform</h1>
        <p className="subtitle">Property Intelligence System - Production Mode</p>
        
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <div className="status-grid">
            {/* Backend Status */}
            <div className="status-card">
              <h2>🔧 Backend API</h2>
              <div className={`status-indicator ${health?.status === 'OK' ? 'online' : 'offline'}`}>
                {health?.status === 'OK' ? '🟢 Online' : '🔴 Offline'}
              </div>
              <p>Port: 5001</p>
              <p>Version: {health?.version}</p>
            </div>

            {/* Nexus Mind Status */}
            <div className="status-card">
              <h2>🧠 Nexus Mind AI</h2>
              <div className={`status-indicator ${health?.integrations?.nexus_mind ? 'online' : 'offline'}`}>
                {health?.integrations?.nexus_mind ? '🟢 Connected' : '⚪ Standby'}
              </div>
              <p>Cognitive Engine</p>
              <p>Bridge: localhost:5051</p>
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
            <a href="http://localhost:5001/health" target="_blank" rel="noreferrer">Health Check</a>
            <a href="http://localhost:5001/api/weather/status" target="_blank" rel="noreferrer">Weather Status</a>
            <a href="http://localhost:5001/api/nexus/status" target="_blank" rel="noreferrer">Nexus Status</a>
            <a href="http://localhost:5051/health" target="_blank" rel="noreferrer">Bridge Health</a>
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
