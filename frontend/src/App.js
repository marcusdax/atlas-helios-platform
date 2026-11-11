import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';

// Layout Components
import Navigation from './components/layout/Navigation';
import Sidebar from './components/layout/Sidebar';
import StormAlert from './components/ui/StormAlert';

// Page Components
import Dashboard from './pages/Dashboard';
import StormIntelligence from './pages/StormIntelligence';
import PropertyAssessment from './pages/PropertyAssessment';
import LeadManagement from './pages/LeadManagement';
import EstimateGenerator from './pages/EstimateGenerator';
import Settings from './pages/Settings';
import MobileFieldTool from './pages/MobileFieldTool';

// Styles and Assets
import './App.css';
import './index.css';

// Context Providers
import { WebSocketProvider } from './contexts/WebSocketContext';
/*
  One dashboard store for the whole app.

  This replaces StormProvider and PropertyProvider, which held mock storms,
  mock assessments and mock properties, registered a second set of socket
  listeners that removed other modules' handlers on cleanup, and - by the time
  the dashboard stopped reading them - were consumed by nothing at all.

  Mounted here rather than inside Dashboard so a second consumer (the
  sidebar's activity feed) shares the same reads instead of issuing its own.
  Two stores on one screen would double the request load and drift apart
  between polls.
*/
import { DashboardDataProvider } from './data/useDashboardData';

function App() {
  useEffect(() => {
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }
  }, []);

  return (
    <Router>
      <div className="App min-h-screen bg-neutral-950 text-neutral-100">
        <WebSocketProvider>
          <DashboardDataProvider>
            {/* Storm Alert Banner */}
            <StormAlert />
            
            {/* Main Layout */}
            <div className="flex h-screen overflow-hidden">
              {/* Navigation */}
              <Navigation />
              
              {/* Sidebar */}
              <Sidebar />
              
              {/* Main Content */}
              <main className="flex-1 overflow-y-auto bg-neutral-950">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6"
                >
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/storm-intelligence" element={<StormIntelligence />} />
                    <Route path="/property-assessment" element={<PropertyAssessment />} />
                    <Route path="/lead-management" element={<LeadManagement />} />
                    <Route path="/estimate-generator" element={<EstimateGenerator />} />
                    <Route path="/mobile-field" element={<MobileFieldTool />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </motion.div>
              </main>
            </div>
            
            {/* Toast Notifications */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#1F1F1F',
                  color: '#E4E4E7',
                  border: '1px solid #374151'
                }
              }}
            />
          </DashboardDataProvider>
        </WebSocketProvider>
      </div>
    </Router>
  );
}

export default App;