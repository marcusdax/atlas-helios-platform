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
import SystemStatus from './pages/SystemStatus';
import Login from './pages/Login';

// Styles and Assets
import './App.css';
import './index.css';

// Context Providers
import { WebSocketProvider } from './contexts/WebSocketContext';
/*
  One dashboard store for the whole app.

  Mounted here rather than inside Dashboard so a second consumer - the
  sidebar's activity feed - shares the same reads instead of issuing its own.
  Two stores on one screen would double the request load and drift apart
  between polls.
*/
import { DashboardDataProvider } from './data/useDashboardData';
/*
  Storm and Property contexts, kept.

  An earlier commit on this branch deleted both: at that point they held only
  mock data and nothing consumed them. Main has since given them real API
  calls and pointed StormIntelligence and PropertyAssessment at them, so they
  are back - the deletion was right against the old tree and wrong against
  this one.
*/
import { StormProvider } from './contexts/StormContext';
import { PropertyProvider } from './contexts/PropertyContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

/**
 * The application shell.
 *
 * Restored in the merge of main. PR #3 replaced this file wholesale with a
 * static service-status page - no Router, no Routes, no Navigation, no
 * Sidebar - which made every page in the product unreachable: Dashboard,
 * Storm Intelligence, Property Assessment, Leads, Estimates, Mobile Field and
 * Settings all still existed and nothing routed to them. The same commit took
 * the Tailwind directives out of `index.css` and replaced every component rule
 * in `App.css`, so what did render had no styling.
 *
 * Nothing that PR added is lost: its status page is now a route at `/system`
 * and its stylesheet is scoped to that page. See the PR description for why
 * this is treated as an accident of an "Add files via upload" commit rather
 * than a redesign.
 */
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
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </Router>
  );
}

/**
 * Decide what a visitor sees before any data provider is mounted.
 *
 * The providers below all fetch on mount, so this has to be a *mount* gate
 * rather than a redirect: rendering the shell for a signed-out visitor and
 * then navigating away still fires every one of those requests, which is how
 * the earlier redirect loop managed to exhaust the rate limiter.
 */
function AuthGate() {
  const { status } = useAuth();

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <p className="text-sm text-neutral-400" role="status">Restoring your session…</p>
      </div>
    );
  }

  if (status !== 'authenticated') return <Login />;

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  return (
      <div className="App app-shell bg-neutral-950 text-neutral-100">
        <WebSocketProvider>
          <DashboardDataProvider>
            <StormProvider>
              <PropertyProvider>
                {/* Storm Alert Banner */}
                <StormAlert />

                {/* Main Layout */}
                {/* `app-layout` carries the offset for the fixed nav rail. */}
                <div className="app-layout overflow-hidden">
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
                        <Route path="/system" element={<SystemStatus />} />
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
              </PropertyProvider>
            </StormProvider>
          </DashboardDataProvider>
        </WebSocketProvider>
      </div>
  );
}

export default App;
