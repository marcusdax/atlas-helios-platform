import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const MobileFieldTool = () => {
  const [activeTab, setActiveTab] = useState('camera');
  const [photos, setPhotos] = useState([]);
  const [assessmentNotes, setAssessmentNotes] = useState('');
  const [propertyInfo, setPropertyInfo] = useState({
    address: '',
    propertyId: '',
    assessmentType: 'damage',
    severity: 'medium'
  });
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('synced');
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Unable to get location');
        }
      );
    }

    // Monitor online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handlePhotoCapture = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map((file, index) => ({
      id: Date.now() + index,
      file,
      url: URL.createObjectURL(file),
      timestamp: new Date(),
      location: location,
      synced: false,
      description: '',
      damageType: 'other'
    }));
    setPhotos([...photos, ...newPhotos]);
    setSyncStatus('pending');
    toast.success(`${files.length} photo(s) captured`);
  };

  const handleVoiceNote = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Voice recording not supported');
      return;
    }

    try {
      setRecording(!recording);
      if (!recording) {
        // Start recording
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Mock recording - in real implementation, would use MediaRecorder API
        setTimeout(() => {
          setRecording(false);
          toast.success('Voice note recorded');
          setAssessmentNotes(prev => prev + '\n[Voice note recorded]');
        }, 3000);
      }
    } catch (error) {
      toast.error('Failed to access microphone');
      setRecording(false);
    }
  };

  const handleSync = async () => {
    if (!isOnline) {
      toast.error('No internet connection');
      return;
    }

    setSyncStatus('syncing');
    try {
      // Mock sync process
      await new Promise(resolve => setTimeout(resolve, 2000));
      setPhotos(photos.map(photo => ({ ...photo, synced: true })));
      setSyncStatus('synced');
      toast.success('All data synced successfully');
    } catch (error) {
      setSyncStatus('error');
      toast.error('Sync failed');
    }
  };

  const handleSaveAssessment = async () => {
    if (!propertyInfo.address) {
      toast.error('Please enter property address');
      return;
    }

    if (photos.length === 0) {
      toast.error('Please capture at least one photo');
      return;
    }

    try {
      // Mock save process
      const assessment = {
        ...propertyInfo,
        photos,
        notes: assessmentNotes,
        location,
        createdAt: new Date().toISOString()
      };

      // In real implementation, would save to local storage and sync
      console.log('Saving assessment:', assessment);
      
      toast.success('Assessment saved successfully');
      
      // Reset form
      setPhotos([]);
      setAssessmentNotes('');
      setPropertyInfo({
        address: '',
        propertyId: '',
        assessmentType: 'damage',
        severity: 'medium'
      });
    } catch (error) {
      toast.error('Failed to save assessment');
    }
  };

  const updatePhotoDescription = (photoId, description) => {
    setPhotos(photos.map(photo => 
      photo.id === photoId ? { ...photo, description } : photo
    ));
  };

  const updatePhotoDamageType = (photoId, damageType) => {
    setPhotos(photos.map(photo => 
      photo.id === photoId ? { ...photo, damageType } : photo
    ));
  };

  const removePhoto = (photoId) => {
    setPhotos(photos.filter(photo => photo.id !== photoId));
    toast.success('Photo removed');
  };

  const getSyncStatusColor = () => {
    switch (syncStatus) {
      case 'synced': return 'text-green-400';
      case 'syncing': return 'text-yellow-400';
      case 'pending': return 'text-orange-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'synced': return '✓';
      case 'syncing': return '⟳';
      case 'pending': return '⏰';
      case 'error': return '✗';
      default: return '?';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-neutral-900 rounded-lg border border-neutral-800 p-4"
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Field Assessment Tool</h1>
            <p className="text-neutral-400 text-sm">Mobile property inspection and assessment</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-sm text-neutral-400">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            {/* Sync Status */}
            <div className="flex items-center gap-2">
              <span className={`text-sm ${getSyncStatusColor()}`}>
                {getSyncStatusIcon()}
              </span>
              <span className={`text-sm ${getSyncStatusColor()}`}>
                {syncStatus.charAt(0).toUpperCase() + syncStatus.slice(1)}
              </span>
            </div>
            
            {/* Sync Button */}
            <button
              onClick={handleSync}
              disabled={syncStatus === 'syncing' || !isOnline}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-1 rounded-lg text-sm transition-colors"
            >
              Sync Data
            </button>
          </div>
        </div>

        {/* Location Info */}
        {location && (
          <div className="text-sm text-neutral-400">
            📍 Location: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </div>
        )}
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Panel - Property Info & Controls */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {/* Property Information */}
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Property Information</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Address</label>
                <input
                  type="text"
                  value={propertyInfo.address}
                  onChange={(e) => setPropertyInfo({ ...propertyInfo, address: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter property address"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Property ID</label>
                <input
                  type="text"
                  value={propertyInfo.propertyId}
                  onChange={(e) => setPropertyInfo({ ...propertyInfo, propertyId: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Property identifier"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Assessment Type</label>
                <select
                  value={propertyInfo.assessmentType}
                  onChange={(e) => setPropertyInfo({ ...propertyInfo, assessmentType: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="damage">Damage Assessment</option>
                  <option value="preventive">Preventive Inspection</option>
                  <option value="routine">Routine Check</option>
                  <option value="insurance">Insurance Claim</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Severity</label>
                <select
                  value={propertyInfo.severity}
                  onChange={(e) => setPropertyInfo({ ...propertyInfo, severity: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            
            <div className="space-y-3">
              {/* Camera Capture */}
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handlePhotoCapture}
                  className="hidden"
                  id="camera-input"
                />
                <label
                  htmlFor="camera-input"
                  className="block w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg text-center cursor-pointer transition-colors"
                >
                  📷 Capture Photos
                </label>
              </div>
              
              {/* Voice Note */}
              <button
                onClick={handleVoiceNote}
                className={`w-full px-4 py-3 rounded-lg text-white transition-colors ${
                  recording 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {recording ? '⏹️ Stop Recording' : '🎤 Voice Note'}
              </button>
              
              {/* Save Assessment */}
              <button
                onClick={handleSaveAssessment}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg transition-colors"
              >
                💾 Save Assessment
              </button>
            </div>
          </div>
        </motion.div>

        {/* Right Panel - Photos & Notes */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* Photo Gallery */}
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">
                Photos ({photos.length})
              </h3>
              <div className="text-sm text-neutral-400">
                {photos.filter(p => !p.synced).length} pending sync
              </div>
            </div>
            
            {photos.length === 0 ? (
              <div className="text-center py-12 bg-neutral-800 rounded-lg">
                <div className="text-4xl mb-4">📸</div>
                <p className="text-neutral-400">No photos captured yet</p>
                <p className="text-sm text-neutral-500 mt-2">
                  Use the camera button to capture property photos
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {photos.map((photo) => (
                  <div key={photo.id} className="bg-neutral-800 rounded-lg overflow-hidden">
                    <div className="relative">
                      <img
                        src={photo.url}
                        alt="Property photo"
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute top-2 right-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          photo.synced 
                            ? 'bg-green-900/50 text-green-400' 
                            : 'bg-orange-900/50 text-orange-400'
                        }`}>
                          {photo.synced ? 'Synced' : 'Pending'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-3">
                      <select
                        value={photo.damageType}
                        onChange={(e) => updatePhotoDamageType(photo.id, e.target.value)}
                        className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                      >
                        <option value="other">General</option>
                        <option value="roof">Roof Damage</option>
                        <option value="window">Window Damage</option>
                        <option value="siding">Siding Damage</option>
                        <option value="foundation">Foundation</option>
                        <option value="water">Water Damage</option>
                        <option value="debris">Debris</option>
                      </select>
                      
                      <textarea
                        value={photo.description}
                        onChange={(e) => updatePhotoDescription(photo.id, e.target.value)}
                        className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                        rows={2}
                        placeholder="Add description..."
                      />
                      
                      <button
                        onClick={() => removePhoto(photo.id)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-sm transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assessment Notes */}
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Assessment Notes</h3>
            
            <textarea
              value={assessmentNotes}
              onChange={(e) => setAssessmentNotes(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={6}
              placeholder="Enter detailed assessment notes...
              
• Describe overall property condition
• Note specific areas of concern
• Document weather conditions
• Add any safety observations
• Include measurements if needed"
            />
          </div>

          {/* Quick Templates */}
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Templates</h3>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAssessmentNotes(prev => prev + '\n• Roof inspected for storm damage')}
                className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded text-sm transition-colors"
              >
                Roof Inspection
              </button>
              <button
                onClick={() => setAssessmentNotes(prev => prev + '\n• Windows checked for cracks/breakage')}
                className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded text-sm transition-colors"
              >
                Window Check
              </button>
              <button
                onClick={() => setAssessmentNotes(prev => prev + '\n• Siding examined for damage')}
                className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded text-sm transition-colors"
              >
                Siding Review
              </button>
              <button
                onClick={() => setAssessmentNotes(prev => prev + '\n• Foundation assessed for cracks')}
                className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded text-sm transition-colors"
              >
                Foundation
              </button>
              <button
                onClick={() => setAssessmentNotes(prev => prev + '\n• Debris documented and measured')}
                className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded text-sm transition-colors"
              >
                Debris Report
              </button>
              <button
                onClick={() => setAssessmentNotes(prev => prev + '\n• Water damage assessment completed')}
                className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded text-sm transition-colors"
              >
                Water Damage
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MobileFieldTool;