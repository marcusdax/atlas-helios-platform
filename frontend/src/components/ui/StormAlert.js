import React, { useState, useEffect } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/outline';
import { motion, AnimatePresence } from 'framer-motion';

const StormAlert = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [alertData, setAlertData] = useState(null);

  useEffect(() => {
    // Simulate checking for storm alerts
    const checkForAlerts = () => {
      // Mock alert data - in real app, this would come from WebSocket/API
      const mockAlert = {
        id: 'storm-001',
        type: 'hail',
        severity: 'high',
        location: 'Dallas County, TX',
        affected_properties: 47,
        hail_size: '2.5 inches',
        timestamp: new Date().toISOString(),
        message: 'Severe hail storm detected with high damage probability'
      };

      // Randomly show alerts for demo
      if (Math.random() < 0.3) {
        setAlertData(mockAlert);
        setIsVisible(true);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
          setIsVisible(false);
        }, 10000);
      }
    };

    // Check for alerts every 30 seconds
    const interval = setInterval(checkForAlerts, 30000);
    
    // Check immediately on mount
    checkForAlerts();

    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleViewDetails = () => {
    // Navigate to storm intelligence page
    window.location.href = '/storm-intelligence';
  };

  if (!alertData) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 500 }}
          className="storm-alert-banner fixed top-0 left-0 right-0 z-[1000] h-16 bg-gradient-to-r from-red-600 to-red-500 shadow-lg"
        >
          <div className="storm-alert-content h-full px-6 flex items-center">
            <ExclamationTriangleIcon className="storm-alert-icon w-6 h-6 text-white animate-pulse" />
            
            <div className="flex-1">
              <div className="text-white font-semibold text-lg">
                SEVERE WEATHER ALERT
              </div>
              <div className="text-white/90 text-sm">
                {alertData.message} • {alertData.affected_properties} properties affected in {alertData.location}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={handleViewDetails}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                View Details
              </button>
              
              <button
                onClick={handleDismiss}
                className="text-white hover:text-gray-200 p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Animated pulse effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/50 to-red-500/50 animate-pulse"></div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StormAlert;