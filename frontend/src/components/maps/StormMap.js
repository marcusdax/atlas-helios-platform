import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const StormMap = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      center: [32.7767, -96.7970], // Dallas coordinates
      zoom: 10,
      zoomControl: true
    });

    // Add dark theme tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Mock storm data
    const stormData = [
      { lat: 32.7767, lng: -96.7970, score: 98, address: "1247 Oak Ridge Dr", risk: 'high' },
      { lat: 32.7831, lng: -96.8067, score: 96, address: "3856 Maple Ave", risk: 'high' },
      { lat: 32.7906, lng: -96.7877, score: 87, address: "2109 Pine Street", risk: 'medium' },
      { lat: 32.7692, lng: -96.8103, score: 92, address: "4567 Elm Drive", risk: 'high' },
      { lat: 32.7956, lng: -96.8023, score: 78, address: "6789 Cedar Lane", risk: 'medium' },
      { lat: 32.7723, lng: -96.7945, score: 94, address: "3210 Birch Street", risk: 'high' },
      { lat: 32.7889, lng: -96.8091, score: 83, address: "8765 Oak Avenue", risk: 'medium' },
      { lat: 32.7745, lng: -96.7989, score: 91, address: "5432 Maple Drive", risk: 'high' },
      { lat: 32.7812, lng: -96.8034, score: 86, address: "9876 Pine Lane", risk: 'medium' },
      { lat: 32.7878, lng: -96.7912, score: 89, address: "1357 Cedar Street", risk: 'medium' }
    ];

    // Add markers for each property
    stormData.forEach(property => {
      const color = property.risk === 'high' ? '#dc2626' : 
                    property.risk === 'medium' ? '#d97706' : '#059669';
      
      const marker = L.circleMarker([property.lat, property.lng], {
        radius: 8,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(map);

      // Add popup with property information
      marker.bindPopup(`
        <div class="p-2 bg-neutral-900 text-neutral-100 rounded border">
          <h4 class="font-semibold text-sm">${property.address}</h4>
          <p class="text-xs text-neutral-400">Dallas, TX</p>
          <div class="mt-2">
            <span class="text-lg font-bold" style="color: ${color}">${property.score}</span>
            <span class="text-xs text-neutral-500 ml-1">Damage Score</span>
          </div>
          <button class="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors">
            View Details
          </button>
        </div>
      `);

      // Add hover effects
      marker.on('mouseover', function() {
        this.setStyle({ radius: 12, weight: 3 });
      });

      marker.on('mouseout', function() {
        this.setStyle({ radius: 8, weight: 2 });
      });
    });

    // Add storm path visualization
    const stormPath = [
      [32.7600, -96.8200],
      [32.7700, -96.8100],
      [32.7800, -96.8000],
      [32.7850, -96.7950],
      [32.7900, -96.7900]
    ];

    L.polyline(stormPath, {
      color: '#b45309',
      weight: 3,
      opacity: 0.7,
      dashArray: '5, 10'
    }).addTo(map);

    // Add storm impact zone
    // Added to the map below; the handle itself is not needed afterwards.
    L.circle([32.7767, -96.7970], {
      radius: 5000,
      color: '#dc2626',
      weight: 2,
      opacity: 0.3,
      fillColor: '#dc2626',
      fillOpacity: 0.1
    }).addTo(map);

    // Add weather radar overlay (mock)
    const radarOverlay = L.tileLayer('https://tilecache.rainviewer.com/v2/radar/nowcast_0/256/{z}/{x}/{y}/2/1_1.png', {
      opacity: 0.6
    });
    radarOverlay.addTo(map);

    // Store map instance
    mapInstanceRef.current = map;

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      <div 
        ref={mapRef} 
        className="w-full h-full"
        style={{ background: '#0a0a0a' }}
      />
      
      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-neutral-900/90 backdrop-blur-sm rounded-lg p-3 border border-neutral-700">
        <h4 className="text-sm font-medium text-neutral-100 mb-2">Risk Levels</h4>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-neutral-300">High Risk</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-neutral-300">Medium Risk</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs text-neutral-300">Low Risk</span>
          </div>
        </div>
      </div>

      {/* Real-time indicator */}
      <div className="absolute top-4 right-4 bg-neutral-900/90 backdrop-blur-sm rounded-lg p-2 border border-neutral-700">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-neutral-300">Live</span>
        </div>
      </div>
    </div>
  );
};

export default StormMap;