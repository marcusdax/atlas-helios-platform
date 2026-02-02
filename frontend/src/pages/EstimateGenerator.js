import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const EstimateGenerator = () => {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [lineItems, setLineItems] = useState([]);
  const [estimateData, setEstimateData] = useState({
    propertyId: '',
    clientId: '',
    title: '',
    description: '',
    laborRate: 75,
    taxRate: 8.5,
    discountRate: 0
  });

  useEffect(() => {
    fetchEstimates();
  }, []);

  const fetchEstimates = async () => {
    try {
      setLoading(true);
      // Mock data - replace with actual API call
      const mockEstimates = [
        {
          id: 1,
          title: 'Roof Repair - Hurricane Damage',
          propertyAddress: '123 Main St, Miami, FL',
          clientName: 'John Smith',
          status: 'draft',
          total: 15420.50,
          createdAt: '2024-01-15T10:00:00Z',
          expiresAt: '2024-02-15T10:00:00Z',
          lineItems: [
            { id: 1, description: 'Roof decking replacement', quantity: 1500, unitPrice: 12.50, category: 'materials' },
            { id: 2, description: 'Asphalt shingles', quantity: 1500, unitPrice: 3.75, category: 'materials' },
            { id: 3, description: 'Labor installation', quantity: 40, unitPrice: 75.00, category: 'labor' }
          ]
        },
        {
          id: 2,
          title: 'Window Replacement',
          propertyAddress: '456 Ocean Ave, Key West, FL',
          clientName: 'Sarah Johnson',
          status: 'sent',
          total: 8750.00,
          createdAt: '2024-01-14T09:00:00Z',
          expiresAt: '2024-02-14T09:00:00Z'
        }
      ];
      setEstimates(mockEstimates);
    } catch (error) {
      toast.error('Failed to fetch estimates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEstimate = async (e) => {
    e.preventDefault();
    try {
      const subtotal = calculateSubtotal();
      const taxAmount = subtotal * (estimateData.taxRate / 100);
      const discountAmount = subtotal * (estimateData.discountRate / 100);
      const total = subtotal + taxAmount - discountAmount;

      const newEstimate = {
        id: estimates.length + 1,
        ...estimateData,
        lineItems,
        status: 'draft',
        subtotal,
        taxAmount,
        discountAmount,
        total,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      setEstimates([newEstimate, ...estimates]);
      setShowCreateModal(false);
      resetEstimateForm();
      toast.success('Estimate created successfully');
    } catch (error) {
      toast.error('Failed to create estimate');
    }
  };

  const addLineItem = () => {
    const newItem = {
      id: Date.now(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      category: 'materials'
    };
    setLineItems([...lineItems, newItem]);
  };

  const updateLineItem = (id, field, value) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeLineItem = (id) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
  };

  const resetEstimateForm = () => {
    setEstimateData({
      propertyId: '',
      clientId: '',
      title: '',
      description: '',
      laborRate: 75,
      taxRate: 8.5,
      discountRate: 0
    });
    setLineItems([]);
  };

  const getStatusColor = (status) => {
    const colors = {
      'draft': 'text-gray-400 bg-gray-900/20 border-gray-800',
      'sent': 'text-blue-400 bg-blue-900/20 border-blue-800',
      'accepted': 'text-green-400 bg-green-900/20 border-green-800',
      'rejected': 'text-red-400 bg-red-900/20 border-red-800',
      'expired': 'text-yellow-400 bg-yellow-900/20 border-yellow-800'
    };
    return colors[status] || 'text-gray-400 bg-gray-900/20 border-gray-800';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const subtotal = calculateSubtotal();
  const taxAmount = subtotal * (estimateData.taxRate / 100);
  const discountAmount = subtotal * (estimateData.discountRate / 100);
  const total = subtotal + taxAmount - discountAmount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Estimate Generator</h1>
          <p className="text-neutral-400">Create and manage property repair estimates</p>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          New Estimate
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
          <div className="text-2xl font-bold text-blue-400">{estimates.length}</div>
          <div className="text-sm text-neutral-400">Total Estimates</div>
        </div>
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="text-2xl font-bold text-green-400">
            {estimates.filter(e => e.status === 'accepted').length}
          </div>
          <div className="text-sm text-neutral-400">Accepted</div>
        </div>
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="text-2xl font-bold text-yellow-400">
            {estimates.filter(e => e.status === 'sent').length}
          </div>
          <div className="text-sm text-neutral-400">Pending</div>
        </div>
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="text-2xl font-bold text-purple-400">
            {formatCurrency(estimates.reduce((sum, e) => sum + e.total, 0))}
          </div>
          <div className="text-sm text-neutral-400">Total Value</div>
        </div>
      </motion.div>

      {/* Estimates List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-neutral-900 rounded-lg border border-neutral-800"
      >
        <div className="p-4 border-b border-neutral-800">
          <h2 className="text-xl font-semibold text-white">Recent Estimates</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left p-4 text-neutral-400 font-medium">Estimate</th>
                <th className="text-left p-4 text-neutral-400 font-medium">Client</th>
                <th className="text-left p-4 text-neutral-400 font-medium">Property</th>
                <th className="text-left p-4 text-neutral-400 font-medium">Total</th>
                <th className="text-left p-4 text-neutral-400 font-medium">Status</th>
                <th className="text-left p-4 text-neutral-400 font-medium">Expires</th>
                <th className="text-left p-4 text-neutral-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  </td>
                </tr>
              ) : estimates.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center p-8 text-neutral-500">
                    No estimates found
                  </td>
                </tr>
              ) : (
                estimates.map((estimate) => (
                  <motion.tr
                    key={estimate.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                    className="border-b border-neutral-800 cursor-pointer transition-colors"
                    onClick={() => setSelectedEstimate(estimate)}
                  >
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-white">{estimate.title}</div>
                        <div className="text-sm text-neutral-400">
                          Created {new Date(estimate.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-white">{estimate.clientName}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-white max-w-xs truncate">
                        {estimate.propertyAddress}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-white">
                        {formatCurrency(estimate.total)}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(estimate.status)}`}>
                        {estimate.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-neutral-400">
                        {new Date(estimate.expiresAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button className="text-blue-400 hover:text-blue-300 text-sm">
                          Edit
                        </button>
                        <button className="text-green-400 hover:text-green-300 text-sm">
                          Send
                        </button>
                        <button className="text-purple-400 hover:text-purple-300 text-sm">
                          PDF
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Create Estimate Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 rounded-lg border border-neutral-800 p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-semibold text-white mb-4">Create New Estimate</h3>
            
            <form onSubmit={handleCreateEstimate} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Estimate Title</label>
                  <input
                    type="text"
                    value={estimateData.title}
                    onChange={(e) => setEstimateData({ ...estimateData, title: e.target.value })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Roof Repair - Hurricane Damage"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Client Name</label>
                  <input
                    type="text"
                    value={estimateData.clientId}
                    onChange={(e) => setEstimateData({ ...estimateData, clientId: e.target.value })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Client name"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Description</label>
                <textarea
                  value={estimateData.description}
                  onChange={(e) => setEstimateData({ ...estimateData, description: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Detailed description of the work to be performed..."
                />
              </div>

              {/* Line Items */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-medium text-white">Line Items</h4>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                  >
                    Add Item
                  </button>
                </div>
                
                {lineItems.length === 0 ? (
                  <div className="text-center py-8 bg-neutral-800 rounded-lg">
                    <p className="text-neutral-400 mb-4">No line items added yet</p>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Add First Item
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="bg-neutral-800 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-neutral-400 mb-1">Description</label>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                              className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Item description"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">Quantity</label>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min="0"
                              step="0.01"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">Unit Price</label>
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min="0"
                              step="0.01"
                              required
                            />
                          </div>
                          
                          <div className="flex items-end">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-white font-medium">
                                {formatCurrency(item.quantity * item.unitPrice)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeLineItem(item.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Labor Rate ($/hr)</label>
                  <input
                    type="number"
                    value={estimateData.laborRate}
                    onChange={(e) => setEstimateData({ ...estimateData, laborRate: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Tax Rate (%)</label>
                  <input
                    type="number"
                    value={estimateData.taxRate}
                    onChange={(e) => setEstimateData({ ...estimateData, taxRate: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Discount Rate (%)</label>
                  <input
                    type="number"
                    value={estimateData.discountRate}
                    onChange={(e) => setEstimateData({ ...estimateData, discountRate: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
              </div>

              {/* Total Summary */}
              <div className="bg-neutral-800 rounded-lg p-4">
                <h4 className="text-lg font-medium text-white mb-3">Estimate Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Subtotal:</span>
                    <span className="text-white">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Tax ({estimateData.taxRate}%):</span>
                    <span className="text-white">{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Discount ({estimateData.discountRate}%):</span>
                    <span className="text-white">-{formatCurrency(discountAmount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-neutral-700">
                    <span>Total:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Create Estimate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetEstimateForm();
                  }}
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

export default EstimateGenerator;