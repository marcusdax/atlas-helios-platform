import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useProperty } from '../contexts/PropertyContext';

const PropertyAssessment = () => {
  const { properties, assessments, loading, fetchProperties, fetchAssessments, createAssessment } = useProperty();
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [assessmentData, setAssessmentData] = useState({
    propertyId: '',
    type: 'damage',
    priority: 'medium',
    notes: ''
  });

  useEffect(() => {
    fetchProperties();
    fetchAssessments();
  }, []);

  const handleCreateAssessment = async (e) => {
    e.preventDefault();
    try {
      await createAssessment(assessmentData);
      setShowCreateModal(false);
      setAssessmentData({ propertyId: '', type: 'damage', priority: 'medium', notes: '' });
      toast.success('Assessment created successfully');
      fetchAssessments();
    } catch (error) {
      toast.error('Failed to create assessment');
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'low': 'text-green-400 bg-green-900/20 border-green-800',
      'medium': 'text-yellow-400 bg-yellow-900/20 border-yellow-800',
      'high': 'text-orange-400 bg-orange-900/20 border-orange-800',
      'critical': 'text-red-400 bg-red-900/20 border-red-800'
    };
    return colors[priority] || 'text-gray-400 bg-gray-900/20 border-gray-800';
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'text-yellow-400 bg-yellow-900/20 border-yellow-800',
      'in-progress': 'text-blue-400 bg-blue-900/20 border-blue-800',
      'completed': 'text-green-400 bg-green-900/20 border-green-800',
      'cancelled': 'text-red-400 bg-red-900/20 border-red-800'
    };
    return colors[status] || 'text-gray-400 bg-gray-900/20 border-gray-800';
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
          <h1 className="text-3xl font-bold text-white mb-2">Property Assessment</h1>
          <p className="text-neutral-400">Comprehensive property damage assessment and analysis</p>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          New Assessment
        </motion.button>
      </motion.div>

      {/* Statistics */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="text-2xl font-bold text-blue-400">{properties.length}</div>
          <div className="text-sm text-neutral-400">Total Properties</div>
        </div>
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="text-2xl font-bold text-green-400">
            {assessments.filter(a => a.status === 'completed').length}
          </div>
          <div className="text-sm text-neutral-400">Completed</div>
        </div>
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="text-2xl font-bold text-yellow-400">
            {assessments.filter(a => a.status === 'in-progress').length}
          </div>
          <div className="text-sm text-neutral-400">In Progress</div>
        </div>
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="text-2xl font-bold text-red-400">
            {assessments.filter(a => a.priority === 'critical').length}
          </div>
          <div className="text-sm text-neutral-400">Critical Priority</div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Property List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1"
        >
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 h-[600px] overflow-hidden">
            <div className="p-4 border-b border-neutral-800">
              <h2 className="text-xl font-semibold text-white">Properties</h2>
              <p className="text-sm text-neutral-400">
                {loading ? 'Loading...' : `${properties.length} properties`}
              </p>
            </div>
            
            <div className="overflow-y-auto h-[520px]">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : properties.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-neutral-500">
                  No properties found
                </div>
              ) : (
                properties.map((property) => (
                  <motion.div
                    key={property.id}
                    whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                    onClick={() => setSelectedProperty(property)}
                    className={`p-4 border-b border-neutral-800 cursor-pointer transition-colors ${
                      selectedProperty?.id === property.id ? 'bg-blue-900/30' : ''
                    }`}
                  >
                    <div>
                      <h3 className="font-semibold text-white">{property.address}</h3>
                      <p className="text-sm text-neutral-400">{property.city}, {property.state}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {property.type} • {property.squareFeet} sq ft
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>

        {/* Assessments */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 h-[600px] overflow-hidden">
            <div className="p-4 border-b border-neutral-800">
              <h2 className="text-xl font-semibold text-white">Recent Assessments</h2>
              <p className="text-sm text-neutral-400">
                {assessments.length} assessments
              </p>
            </div>
            
            <div className="overflow-y-auto h-[520px]">
              {assessments.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-neutral-500">
                  No assessments found
                </div>
              ) : (
                assessments.map((assessment) => (
                  <motion.div
                    key={assessment.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                    className="p-4 border-b border-neutral-800 cursor-pointer transition-colors"
                    onClick={() => setSelectedAssessment(assessment)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-white">
                            {assessment.property?.address || 'Unknown Property'}
                          </h3>
                          <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(assessment.status)}`}>
                            {assessment.status.replace('-', ' ')}
                          </span>
                        </div>
                        
                        <p className="text-sm text-neutral-400 mb-2">{assessment.type} assessment</p>
                        
                        <div className="flex items-center gap-4 text-xs text-neutral-500">
                          <span>Created: {new Date(assessment.createdAt).toLocaleDateString()}</span>
                          <span className={`px-2 py-1 rounded-full border ${getPriorityColor(assessment.priority)}`}>
                            {assessment.priority}
                          </span>
                        </div>
                        
                        {assessment.notes && (
                          <p className="text-sm text-neutral-300 mt-2 line-clamp-2">
                            {assessment.notes}
                          </p>
                        )}
                      </div>
                      
                      <div className="ml-4 text-right">
                        <div className="text-lg font-semibold text-white">
                          {assessment.damageScore || 0}%
                        </div>
                        <div className="text-xs text-neutral-400">Damage Score</div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Selected Assessment Details */}
      {selectedAssessment && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-neutral-900 rounded-lg border border-neutral-800 p-6"
        >
          <h3 className="text-xl font-semibold text-white mb-4">Assessment Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-lg font-medium text-white mb-3">Property Information</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Address:</span>
                  <span className="text-white">{selectedAssessment.property?.address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Type:</span>
                  <span className="text-white">{selectedAssessment.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Priority:</span>
                  <span className={`px-2 py-1 text-xs rounded-full border ${getPriorityColor(selectedAssessment.priority)}`}>
                    {selectedAssessment.priority}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-medium text-white mb-3">Assessment Results</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Damage Score:</span>
                  <span className="text-white">{selectedAssessment.damageScore || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Status:</span>
                  <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(selectedAssessment.status)}`}>
                    {selectedAssessment.status.replace('-', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Created:</span>
                  <span className="text-white">{new Date(selectedAssessment.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          {selectedAssessment.notes && (
            <div className="mt-6">
              <h4 className="text-lg font-medium text-white mb-3">Notes</h4>
              <p className="text-neutral-300 bg-neutral-800 rounded-lg p-4">
                {selectedAssessment.notes}
              </p>
            </div>
          )}
          
          <div className="mt-6 flex gap-4">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
              View Full Report
            </button>
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
              Generate Estimate
            </button>
            <button className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded-lg transition-colors">
              Edit Assessment
            </button>
          </div>
        </motion.div>
      )}

      {/* Create Assessment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 rounded-lg border border-neutral-800 p-6 w-full max-w-md"
          >
            <h3 className="text-xl font-semibold text-white mb-4">Create New Assessment</h3>
            
            <form onSubmit={handleCreateAssessment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Property
                </label>
                <select
                  value={assessmentData.propertyId}
                  onChange={(e) => setAssessmentData({ ...assessmentData, propertyId: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a property</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.address}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Assessment Type
                </label>
                <select
                  value={assessmentData.type}
                  onChange={(e) => setAssessmentData({ ...assessmentData, type: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="damage">Damage Assessment</option>
                  <option value="preventive">Preventive Assessment</option>
                  <option value="routine">Routine Inspection</option>
                  <option value="insurance">Insurance Claim</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Priority
                </label>
                <select
                  value={assessmentData.priority}
                  onChange={(e) => setAssessmentData({ ...assessmentData, priority: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Notes
                </label>
                <textarea
                  value={assessmentData.notes}
                  onChange={(e) => setAssessmentData({ ...assessmentData, notes: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Additional notes about this assessment..."
                />
              </div>
              
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Create Assessment
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PropertyAssessment;