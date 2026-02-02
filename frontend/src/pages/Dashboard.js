import React, { useState, useEffect } from 'react';
import {
  CloudIcon,
  MapIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  UserGroupIcon
} from '@heroicons/react/outline';
import { motion } from 'framer-motion';

// Import components
import StormMap from '../components/maps/StormMap';
import PredictionChart from '../components/charts/PredictionChart';
import PropertyList from '../components/property/PropertyList';
import QuickStats from '../components/ui/QuickStats';

// Context hooks
import { useWebSocket } from '../contexts/WebSocketContext';
import { useStorm } from '../contexts/StormContext';

const Dashboard = () => {
  const { socket, isConnected } = useWebSocket();
  const { activeStorms, recentAssessments } = useStorm();

  const [dashboardData, setDashboardData] = useState({
    totalProperties: 0,
    activeStorms: 0,
    highRiskProperties: 0,
    recentAssessments: 0,
    weatherAlerts: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    // Fetch dashboard data
    fetchDashboardData();
    
    // Subscribe to real-time updates
    if (socket && isConnected) {
      socket.emit('join_room', 'dashboard');
      
      socket.on('dashboard_update', (data) => {
        setDashboardData(data);
      });

      socket.on('storm_alert', (alert) => {
        setRecentActivity(prev => [{
          id: Date.now(),
          type: 'storm',
          message: `${alert.type} detected in ${alert.region}`,
          timestamp: new Date(),
          severity: alert.severity
        }, ...prev.slice(0, 9)]);
      });

      return () => {
        socket.off('dashboard_update');
        socket.off('storm_alert');
      };
    }
  }, [socket, isConnected]);

  const fetchDashboardData = async () => {
    try {
      // In real implementation, this would be an API call
      const mockData = {
        totalProperties: 1247,
        activeStorms: activeStorms.length,
        highRiskProperties: 47,
        recentAssessments: recentAssessments.length,
        weatherAlerts: 3
      };
      
      setDashboardData(mockData);
      
      // Set recent activity
      setRecentActivity([
        {
          id: 1,
          type: 'assessment',
          message: 'Property assessment completed at 1247 Oak Ridge Dr',
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          severity: 'info'
        },
        {
          id: 2,
          type: 'storm',
          message: 'Severe thunderstorm warning issued for Dallas County',
          timestamp: new Date(Date.now() - 32 * 60 * 1000),
          severity: 'warning'
        },
        {
          id: 3,
          type: 'lead',
          message: 'New lead generated: High damage probability (94%)',
          timestamp: new Date(Date.now() - 45 * 60 * 1000),
          severity: 'info'
        }
      ]);

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const quickActions = [
    {
      title: 'View Storm Intel',
      description: 'Check active weather alerts',
      icon: CloudIcon,
      color: 'bg-blue-500',
      action: () => window.location.href = '/storm-intelligence'
    },
    {
      title: 'Property Assessment',
      description: 'Start new property analysis',
      icon: HomeIcon,
      color: 'bg-green-500',
      action: () => window.location.href = '/property-assessment'
    },
    {
      title: 'Manage Leads',
      description: 'Review and assign leads',
      icon: UserGroupIcon,
      color: 'bg-purple-500',
      action: () => window.location.href = '/lead-management'
    },
    {
      title: 'Generate Estimate',
      description: 'Create new estimate',
      icon: ChartBarIcon,
      color: 'bg-orange-500',
      action: () => window.location.href = '/estimate-generator'
    }
  ];

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-neutral-100 mb-2">
            PropertyInsight Dashboard
          </h1>
          <p className="text-neutral-400">
            Real-time storm intelligence and property assessment platform
          </p>
        </motion.div>
      </div>

      {/* Connection Status */}
      {isConnected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
        >
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-3 animate-pulse"></div>
            <span className="text-green-400 text-sm font-medium">
              Connected to real-time updates
            </span>
          </div>
        </motion.div>
      )}

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-8"
      >
        <QuickStats data={dashboardData} />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column - Storm Map & Activity */}
        <div className="xl:col-span-2 space-y-8">
          {/* Storm Map */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-card"
          >
            <div className="dashboard-card-header">
              <MapIcon className="dashboard-card-icon" />
              <h2 className="dashboard-card-title">Storm Intelligence Map</h2>
            </div>
            <div className="h-96">
              <StormMap />
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="glass-card"
          >
            <div className="dashboard-card-header">
              <ChartBarIcon className="dashboard-card-icon" />
              <h2 className="dashboard-card-title">Recent Activity</h2>
            </div>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-3 p-3 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.severity === 'warning' ? 'bg-yellow-500' :
                    activity.severity === 'error' ? 'bg-red-500' :
                    'bg-blue-500'
                  }`}></div>
                  <div className="flex-1">
                    <p className="text-neutral-100 text-sm">{activity.message}</p>
                    <p className="text-neutral-400 text-xs mt-1">
                      {activity.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Column - Quick Actions & Charts */}
        <div className="space-y-8">
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="glass-card"
          >
            <div className="dashboard-card-header">
              <ExclamationTriangleIcon className="dashboard-card-icon" />
              <h2 className="dashboard-card-title">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    key={index}
                    onClick={action.action}
                    className="p-4 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors text-left"
                  >
                    <div className={`w-8 h-8 ${action.color} rounded-lg flex items-center justify-center mb-3`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-neutral-100 font-medium text-sm mb-1">
                      {action.title}
                    </h3>
                    <p className="text-neutral-400 text-xs">
                      {action.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Weather Prediction Chart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="glass-card"
          >
            <div className="dashboard-card-header">
              <CloudIcon className="dashboard-card-icon" />
              <h2 className="dashboard-card-title">24-Hour Weather Forecast</h2>
            </div>
            <div className="h-64">
              <PredictionChart />
            </div>
          </motion.div>

          {/* High Priority Properties */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="glass-card"
          >
            <div className="dashboard-card-header">
              <ExclamationTriangleIcon className="dashboard-card-icon" />
              <h2 className="dashboard-card-title">High Priority Properties</h2>
            </div>
            <PropertyList 
              properties={[
                {
                  id: 1,
                  address: '1247 Oak Ridge Dr',
                  score: 94,
                  risk: 'high',
                  timeAgo: '15 min ago'
                },
                {
                  id: 2,
                  address: '3856 Maple Ave',
                  score: 87,
                  risk: 'high',
                  timeAgo: '32 min ago'
                },
                {
                  id: 3,
                  address: '2109 Pine Street',
                  score: 82,
                  risk: 'medium',
                  timeAgo: '1 hour ago'
                }
              ]}
              compact={true}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;