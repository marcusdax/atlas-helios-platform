import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useStorm } from '../contexts/StormContext';

const StormIntelligence = () => {
  const { storms, loading, fetchStorms, subscribeToAlerts } = useStorm();
  const [selectedStorm, setSelectedStorm] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [filters, setFilters] = useState({
    severity: 'all',
    region: 'all',
    activeOnly: true
  });

  useEffect(() => {
    fetchStorms(filters);
    subscribeToAlerts();
  }, [filters]);

  const handleStormSelect = (storm) => {
    setSelectedStorm(storm);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'tropical-depression': 'text-blue-400',
      'tropical-storm': 'text-yellow-400',
      'hurricane-1': 'text-orange-400',
      'hurricane-2': 'text-orange-500',
      'hurricane-3': 'text-red-400',
      'hurricane-4': 'text-red-500',
      'hurricane-5': 'text-purple-500'
    };
    return colors[severity] || 'text-gray-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Storm Intelligence</h1>
          <p className="text-neutral-400">Real-time storm tracking and analysis</p>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => fetchStorms(filters)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Refresh Data
        </motion.button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-neutral-900 rounded-lg p-4 border border-neutral-800"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Severity
            </label>
            <select
              value={filters.severity}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="tropical-depression">Tropical Depression</option>
              <option value="tropical-storm">Tropical Storm</option>
              <option value="hurricane-1">Hurricane Cat 1</option>
              <option value="hurricane-2">Hurricane Cat 2</option>
              <option value="hurricane-3">Hurricane Cat 3</option>
              <option value="hurricane-4">Hurricane Cat 4</option>
              <option value="hurricane-5">Hurricane Cat 5</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Region
            </label>
            <select
              value={filters.region}
              onChange={(e) => handleFilterChange('region', e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Regions</option>
              <option value="atlantic">Atlantic</option>
              <option value="pacific">Pacific</option>
              <option value="gulf">Gulf of Mexico</option>
              <option value="caribbean">Caribbean</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Status
            </label>
            <select
              value={filters.activeOnly}
              onChange={(e) => handleFilterChange('activeOnly', e.target.value === 'true')}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="true">Active Only</option>
              <option value="false">All Storms</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ severity: 'all', region: 'all', activeOnly: true })}
              className="w-full bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Storm List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1"
        >
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 h-[600px] overflow-hidden">
            <div className="p-4 border-b border-neutral-800">
              <h2 className="text-xl font-semibold text-white">Active Storms</h2>
              <p className="text-sm text-neutral-400">
                {loading ? 'Loading...' : `${storms.length} storms detected`}
              </p>
            </div>
            
            <div className="overflow-y-auto h-[520px]">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : storms.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-neutral-500">
                  No storms found
                </div>
              ) : (
                storms.map((storm) => (
                  <motion.div
                    key={storm.id}
                    whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                    onClick={() => handleStormSelect(storm)}
                    className={`p-4 border-b border-neutral-800 cursor-pointer transition-colors ${
                      selectedStorm?.id === storm.id ? 'bg-blue-900/30' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-white">{storm.name}</h3>
                        <p className="text-sm text-neutral-400">{storm.location}</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          Max Wind: {storm.maxWind} mph
                        </p>
                      </div>
                      <div className={`text-sm font-medium ${getSeverityColor(storm.severity)}`}>
                        {storm.severity.replace('-', ' ').toUpperCase()}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>

        {/* Storm Details */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          {selectedStorm ? (
            <div className="space-y-4">
              {/* Storm Header */}
              <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedStorm.name}</h2>
                    <p className="text-neutral-400">{selectedStorm.location}</p>
                    <div className={`text-lg font-medium ${getSeverityColor(selectedStorm.severity)} mt-2`}>
                      {selectedStorm.severity.replace('-', ' ').toUpperCase()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">{selectedStorm.maxWind}</div>
                    <div className="text-sm text-neutral-400">mph max wind</div>
                  </div>
                </div>
              </div>

              {/* Storm Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
                  <div className="text-2xl font-bold text-blue-400">{selectedStorm.pressure}</div>
                  <div className="text-sm text-neutral-400">Pressure (mb)</div>
                </div>
                <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
                  <div className="text-2xl font-bold text-green-400">{selectedStorm.movement}</div>
                  <div className="text-sm text-neutral-400">Movement (mph)</div>
                </div>
                <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
                  <div className="text-2xl font-bold text-yellow-400">{selectedStorm.direction}</div>
                  <div className="text-sm text-neutral-400">Direction</div>
                </div>
                <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
                  <div className="text-2xl font-bold text-purple-400">{selectedStorm.propertiesAtRisk}</div>
                  <div className="text-sm text-neutral-400">Properties at Risk</div>
                </div>
              </div>

              {/* Storm Track */}
              <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Storm Track</h3>
                <div className="bg-neutral-800 rounded-lg h-64 flex items-center justify-center">
                  <p className="text-neutral-500">Interactive storm map will be displayed here</p>
                </div>
              </div>

              {/* Predictions */}
              <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">72-Hour Predictions</h3>
                <div className="space-y-3">
                  {selectedStorm.predictions?.map((prediction, index) => (
                    <div key={index} className="bg-neutral-800 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-white">
                            Hour {prediction.hour}: {prediction.location}
                          </div>
                          <div className="text-sm text-neutral-400">
                            Wind: {prediction.wind} mph | Direction: {prediction.direction}
                          </div>
                        </div>
                        <div className={`text-sm font-medium ${
                          prediction.confidence > 70 ? 'text-green-400' :
                          prediction.confidence > 40 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {prediction.confidence}% confidence
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 h-[600px] flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🌀</div>
                <h3 className="text-xl font-semibold text-white mb-2">Select a Storm</h3>
                <p className="text-neutral-400">Choose a storm from the list to view detailed information</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default StormIntelligence;