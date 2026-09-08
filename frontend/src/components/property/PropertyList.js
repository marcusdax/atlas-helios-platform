import React from 'react';
import { ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';

const PropertyList = ({ properties, compact = false }) => {
  const getRiskColor = (risk) => {
    switch (risk) {
      case 'high':
        return 'text-red-400 bg-red-500/10';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/10';
      case 'low':
        return 'text-green-400 bg-green-500/10';
      default:
        return 'text-blue-400 bg-blue-500/10';
    }
  };

  const getRiskBorder = (risk) => {
    switch (risk) {
      case 'high':
        return 'border-l-red-500';
      case 'medium':
        return 'border-l-yellow-500';
      case 'low':
        return 'border-l-green-500';
      default:
        return 'border-l-blue-500';
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (typeof timestamp === 'string') {
      timestamp = new Date(timestamp);
    }
    
    const now = new Date();
    const diffInMinutes = Math.floor((now - timestamp) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  if (!properties || properties.length === 0) {
    return (
      <div className="text-center py-8">
        <MapPinIcon className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
        <p className="text-neutral-400">No properties to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {properties.map((property) => (
        <div
          key={property.id}
          className={`property-card ${getRiskBorder(property.risk)} ${
            compact ? 'p-3' : 'p-4'
          } hover:border-neutral-600 transition-colors cursor-pointer`}
          onClick={() => {
            // Navigate to property details
            console.log('Navigate to property:', property.id);
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className={`font-medium text-neutral-100 ${
                compact ? 'text-sm' : 'text-base'
              } mb-1`}>
                {property.address}
              </h3>
              
              {!compact && property.city && (
                <p className="text-neutral-400 text-sm mb-2">
                  {property.city}, {property.state}
                </p>
              )}
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <ClockIcon className="w-4 h-4 text-neutral-500" />
                  <span className="text-neutral-400 text-xs">
                    {formatTimeAgo(property.timestamp || property.timeAgo || new Date())}
                  </span>
                </div>
                
                {property.assessmentType && (
                  <span className="text-neutral-500 text-xs">
                    {property.assessmentType}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end space-y-2">
              {/* Risk Score */}
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold text-neutral-100">
                  {property.score}%
                </span>
                <div className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(property.risk)}`}>
                  {property.risk?.toUpperCase()}
                </div>
              </div>
              
              {/* Additional metrics for non-compact view */}
              {!compact && property.additionalData && (
                <div className="text-right">
                  {property.additionalData.damageScore && (
                    <p className="text-xs text-neutral-400">
                      Damage: {property.additionalData.damageScore}%
                    </p>
                  )}
                  {property.additionalData.estimatedCost && (
                    <p className="text-xs text-neutral-400">
                      Est. Cost: ${property.additionalData.estimatedCost.toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Property details for compact view */}
          {compact && property.details && (
            <div className="mt-2 pt-2 border-t border-neutral-700">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>{property.details.propertyType}</span>
                <span>{property.details.squareFootage} sq ft</span>
                <span>{property.details.yearBuilt}</span>
              </div>
            </div>
          )}
        </div>
      ))}
      
      {/* Show more link */}
      {properties.length >= 3 && (
        <div className="text-center pt-4">
          <button className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
            View All Properties
          </button>
        </div>
      )}
    </div>
  );
};

export default PropertyList;