import React, { useEffect, useState } from 'react';
import { atlasAPI } from '../services/api';

/**
 * Service status: is each half of the platform actually up?
 *
 * This page is main's `App.js` from PR #3, moved rather than dropped. That PR
 * replaced the entire routed application with this content - no Router, no
 * Navigation, no Sidebar, no Dashboard - so every page in the product became
 * unreachable, and `index.css` lost its Tailwind directives while `App.css`
 * lost every component style. That looks like an accident of the "Add files
 * via upload" commit rather than a decision, so this merge restores the routed
 * shell and keeps the status page as a route of its own at `/system`.
 *
 * It genuinely earns a place: the dashboard's data layer reports which feeds
 * are degraded, and this answers the next question - whether the backend, the
 * NOAA proxy and the AI service are reachable at all.
 *
 * The three checks are deliberately independent. The backend check failing is
 * fatal to the page; the weather and AI checks failing are information, which
 * is why each sits in its own try/catch rather than one that would let a
 * standby AI service hide the state of everything else.
 */
const SystemStatus = () => {
  const [health, setHealth] = useState(null);
  const [weather, setWeather] = useState(null);
  const [nexus, setNexus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;

    const checkServices = async () => {
      try {
        const healthRes = await atlasAPI.health.check();
        if (!live) return;
        setHealth(healthRes.data);

        try {
          const weatherRes = await atlasAPI.weather.getStatus();
          if (live) setWeather(weatherRes.data);
        } catch (e) {
          console.warn('Weather service check failed:', e.message);
        }

        try {
          const nexusRes = await atlasAPI.nexus.getStatus();
          if (live) setNexus(nexusRes.data);
        } catch (e) {
          console.warn('Nexus Mind check failed:', e.message);
        }

        if (live) setLoading(false);
      } catch (err) {
        console.error('Health check failed:', err);
        if (!live) return;
        setError('Failed to connect to backend. Please ensure the server is running on port 5000.');
        setLoading(false);
      }
    };

    checkServices();
    // Navigating away mid-check must not set state on an unmounted page.
    return () => { live = false; };
  }, []);

  return (
    <div className="system-status">
      <header className="App-header">
        <h1>🏛️ Atlas Helios Platform</h1>
        <p className="subtitle">Property Intelligence System — Connected Mode</p>

        {loading ? (
          <div className="loading">Connecting to services...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <div className="status-grid">
            <div className="status-card">
              <h2>🔧 Backend API</h2>
              <div className={`status-indicator ${health?.status === 'OK' ? 'online' : 'offline'}`}>
                {health?.status === 'OK' ? '🟢 Online' : '🔴 Offline'}
              </div>
              <p>Port: 5000</p>
              <p>Version: {health?.version || '1.0.0'}</p>
            </div>

            <div className="status-card">
              <h2>🧠 Nexus Mind AI</h2>
              <div className={`status-indicator ${nexus?.available ? 'online' : 'offline'}`}>
                {nexus?.available ? '🟢 Connected' : '⚪ Standby'}
              </div>
              <p>Cognitive Engine</p>
              <p>{nexus?.available ? 'Ready for analysis' : 'Not configured'}</p>
            </div>

            <div className="status-card">
              <h2>🌤️ NOAA Weather</h2>
              <div className={`status-indicator ${weather?.available ? 'online' : 'offline'}`}>
                {weather?.available ? '🟢 Connected' : '🔴 Offline'}
              </div>
              <p>Weather Intelligence</p>
              <p>API: api.weather.gov</p>
            </div>

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
          {/*
            Relative paths, not http://localhost:5000.

            The absolute links worked only on a developer's own machine: in any
            deployment they point at the viewer's own laptop, which is the same
            bug the WebSocket URL had before it was defaulted to the page's
            origin. `/api` is what the reverse proxy already fronts.
          */}
          <div className="endpoint-grid">
            <a href="/health" target="_blank" rel="noreferrer">Health Check</a>
            <a href="/api/weather/status" target="_blank" rel="noreferrer">Weather Status</a>
            <a href="/api/nexus/status" target="_blank" rel="noreferrer">Nexus Status</a>
            <a href="/api/storms" target="_blank" rel="noreferrer">Storms API</a>
            <a href="/api/properties" target="_blank" rel="noreferrer">Properties API</a>
            <a href="/api/leads" target="_blank" rel="noreferrer">Leads API</a>
            <a href="/api/assessments" target="_blank" rel="noreferrer">Assessments API</a>
            <a href="/api/estimates" target="_blank" rel="noreferrer">Estimates API</a>
          </div>
        </div>

        <footer className="App-footer">
          <p>Atlas Helios Platform v{health?.version || '1.0.0'} | Powered by Nexus Mind AI + NOAA Weather</p>
        </footer>
      </header>
    </div>
  );
};

export default SystemStatus;
