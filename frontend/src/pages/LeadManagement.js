import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const LeadManagement = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    source: 'all'
  });
  const [leadData, setLeadData] = useState({
    name: '',
    email: '',
    phone: '',
    propertyAddress: '',
    source: 'website',
    priority: 'medium',
    notes: ''
  });

  useEffect(() => {
    fetchLeads();
  }, [filters]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      // Mock data - replace with actual API call
      const mockLeads = [
        {
          id: 1,
          name: 'John Smith',
          email: 'john.smith@email.com',
          phone: '(555) 123-4567',
          propertyAddress: '123 Main St, Miami, FL',
          source: 'website',
          status: 'new',
          priority: 'high',
          score: 85,
          createdAt: '2024-01-15T10:00:00Z',
          lastActivity: '2024-01-15T14:30:00Z'
        },
        {
          id: 2,
          name: 'Sarah Johnson',
          email: 'sarah.j@email.com',
          phone: '(555) 987-6543',
          propertyAddress: '456 Ocean Ave, Key West, FL',
          source: 'referral',
          status: 'contacted',
          priority: 'medium',
          score: 72,
          createdAt: '2024-01-14T09:00:00Z',
          lastActivity: '2024-01-15T11:00:00Z'
        }
      ];
      setLeads(mockLeads);
    } catch (error) {
      toast.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    try {
      // Mock API call - replace with actual implementation
      const newLead = {
        id: leads.length + 1,
        ...leadData,
        status: 'new',
        score: Math.floor(Math.random() * 40) + 60,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };
      setLeads([newLead, ...leads]);
      setShowCreateModal(false);
      setLeadData({
        name: '',
        email: '',
        phone: '',
        propertyAddress: '',
        source: 'website',
        priority: 'medium',
        notes: ''
      });
      toast.success('Lead created successfully');
    } catch (error) {
      toast.error('Failed to create lead');
    }
  };

  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      setLeads(leads.map(lead => 
        lead.id === leadId 
          ? { ...lead, status: newStatus, lastActivity: new Date().toISOString() }
          : lead
      ));
      toast.success('Lead status updated');
    } catch (error) {
      toast.error('Failed to update lead status');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusColor = (status) => {
    const colors = {
      'new': 'text-blue-400 bg-blue-900/20 border-blue-800',
      'contacted': 'text-yellow-400 bg-yellow-900/20 border-yellow-800',
      'qualified': 'text-green-400 bg-green-900/20 border-green-800',
      'converted': 'text-purple-400 bg-purple-900/20 border-purple-800',
      'lost': 'text-red-400 bg-red-900/20 border-red-800'
    };
    return colors[status] || 'text-gray-400 bg-gray-900/20 border-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'low': 'text-green-400',
      'medium': 'text-yellow-400',
      'high': 'text-orange-400',
      'critical': 'text-red-400'
    };
    return colors[priority] || 'text-gray-400';
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
          <h1 className="text-3xl font-bold text-white mb-2">Lead Management</h1>
          <p className="text-neutral-400">Manage and track property leads throughout the sales pipeline</p>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Add New Lead
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
          <div className="text-2xl font-bold text-blue-400">{leads.length}</div>
          <div className="text-sm text-neutral-400">Total Leads</div>
        </div>
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="text-2xl font-bold text-green-400">
            {leads.filter(l => l.status === 'qualified').length}
          </div>
          <div className="text-sm text-neutral-400">Qualified</div>
        </div>
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="text-2xl font-bold text-yellow-400">
            {leads.filter(l => l.status === 'contacted').length}
          </div>
          <div className="text-sm text-neutral-400">Contacted</div>
        </div>
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="text-2xl font-bold text-purple-400">
            {leads.filter(l => l.status === 'converted').length}
          </div>
          <div className="text-sm text-neutral-400">Converted</div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-neutral-900 rounded-lg p-4 border border-neutral-800"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Source</label>
            <select
              value={filters.source}
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sources</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="social">Social Media</option>
              <option value="email">Email</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: 'all', priority: 'all', source: 'all' })}
              className="w-full bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </motion.div>

      {/* Leads List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-neutral-900 rounded-lg border border-neutral-800"
      >
        <div className="p-4 border-b border-neutral-800">
          <h2 className="text-xl font-semibold text-white">Lead Pipeline</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left p-4 text-neutral-400 font-medium">Lead</th>
                <th className="text-left p-4 text-neutral-400 font-medium">Contact</th>
                <th className="text-left p-4 text-neutral-400 font-medium">Property</th>
                <th className="text-left p-4 text-neutral-400 font-medium">Status</th>
                <th className="text-left p-4 text-neutral-400 font-medium">Score</th>
                <th className="text-left p-4 text-neutral-400 font-medium">Source</th>
                <th className="text-left p-4 text-neutral-400 font-medium">Priority</th>
                <th className="text-left p-4 text-neutral-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center p-8 text-neutral-500">
                    No leads found
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                    className="border-b border-neutral-800 cursor-pointer transition-colors"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-white">{lead.name}</div>
                        <div className="text-sm text-neutral-400">
                          Added {new Date(lead.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="text-white">{lead.email}</div>
                        <div className="text-neutral-400">{lead.phone}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-white">{lead.propertyAddress}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className={`font-bold ${getScoreColor(lead.score)}`}>
                        {lead.score}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-neutral-400">{lead.source}</div>
                    </td>
                    <td className="p-4">
                      <div className={`text-sm font-medium ${getPriorityColor(lead.priority)}`}>
                        {lead.priority}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {lead.status === 'new' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateLeadStatus(lead.id, 'contacted');
                            }}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            Contact
                          </button>
                        )}
                        {lead.status === 'contacted' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateLeadStatus(lead.id, 'qualified');
                            }}
                            className="text-green-400 hover:text-green-300 text-sm"
                          >
                            Qualify
                          </button>
                        )}
                        {lead.status === 'qualified' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateLeadStatus(lead.id, 'converted');
                            }}
                            className="text-purple-400 hover:text-purple-300 text-sm"
                          >
                            Convert
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Selected Lead Details */}
      {selectedLead && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-neutral-900 rounded-lg border border-neutral-800 p-6"
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-semibold text-white">Lead Details</h3>
            <button
              onClick={() => setSelectedLead(null)}
              className="text-neutral-400 hover:text-white"
            >
              ×
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-lg font-medium text-white mb-3">Contact Information</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Name:</span>
                  <span className="text-white">{selectedLead.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Email:</span>
                  <span className="text-white">{selectedLead.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Phone:</span>
                  <span className="text-white">{selectedLead.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Lead Score:</span>
                  <span className={`font-bold ${getScoreColor(selectedLead.score)}`}>
                    {selectedLead.score}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-medium text-white mb-3">Property Information</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Address:</span>
                  <span className="text-white">{selectedLead.propertyAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Source:</span>
                  <span className="text-white">{selectedLead.source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Priority:</span>
                  <span className={`font-medium ${getPriorityColor(selectedLead.priority)}`}>
                    {selectedLead.priority}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Status:</span>
                  <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(selectedLead.status)}`}>
                    {selectedLead.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex gap-4">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
              Create Assessment
            </button>
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
              Generate Estimate
            </button>
            <button className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded-lg transition-colors">
              Schedule Follow-up
            </button>
          </div>
        </motion.div>
      )}

      {/* Create Lead Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 rounded-lg border border-neutral-800 p-6 w-full max-w-md"
          >
            <h3 className="text-xl font-semibold text-white mb-4">Add New Lead</h3>
            
            <form onSubmit={handleCreateLead} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Name</label>
                <input
                  type="text"
                  value={leadData.name}
                  onChange={(e) => setLeadData({ ...leadData, name: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Email</label>
                <input
                  type="email"
                  value={leadData.email}
                  onChange={(e) => setLeadData({ ...leadData, email: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Phone</label>
                <input
                  type="tel"
                  value={leadData.phone}
                  onChange={(e) => setLeadData({ ...leadData, phone: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Property Address</label>
                <input
                  type="text"
                  value={leadData.propertyAddress}
                  onChange={(e) => setLeadData({ ...leadData, propertyAddress: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Source</label>
                  <select
                    value={leadData.source}
                    onChange={(e) => setLeadData({ ...leadData, source: e.target.value })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="social">Social Media</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Priority</label>
                  <select
                    value={leadData.priority}
                    onChange={(e) => setLeadData({ ...leadData, priority: e.target.value })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Notes</label>
                <textarea
                  value={leadData.notes}
                  onChange={(e) => setLeadData({ ...leadData, notes: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Additional notes about this lead..."
                />
              </div>
              
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Add Lead
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

export default LeadManagement;