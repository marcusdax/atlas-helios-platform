import { useState, useCallback, useRef, useEffect } from 'react';
import { MapPin, Shield, Trash2, Ruler, Search, Navigation, CloudRain } from 'lucide-react';
import { cn } from '../lib/utils';
import { Card } from '../components/ui';
import { reconApi, severityColor, scoreColor, Storm, Lead } from '../lib/api';

// Real Leaflet map
import { MapContainer, TileLayer, Polygon, Circle, Marker, Popup, Rectangle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons for Vite/React
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Types
interface GeoShape {
  id: string;
  type: 'polygon' | 'circle' | 'rectangle';
  name: string;
  color: string;
  areaSqft: number;
  propertyCount: number;
  coords?: [number, number][];
  center?: [number, number];
  radius?: number;
  bounds?: { north: number; south: number; east: number; west: number };
}

interface FetchResult {
  totalProperties: number;
  bounds: number[];
}

// ---- API helpers ----
async function fetchGeofences(lat: number, lon: number, radius: number): Promise<GeoShape[]> {
  try {
    const res = await fetch(`/api/harvest/nearby?lat=${lat}&lon=${lon}&radius=${radius}`);
    const data = await res.json();
    if (data.properties && data.properties.length > 0) {
      // Use actual property coordinates to create a bounding polygon
      const validCoords = data.properties
        .filter((p: any) => p.latitude && p.longitude)
        .slice(0, 8)
        .map((p: any) => [p.latitude, p.longitude] as [number, number]);
      
      if (validCoords.length >= 3) {
        // Close the polygon
        const closedCoords = [...validCoords, validCoords[0]];
        return [
          {
            id: `geo-api-${Date.now()}`,
            type: 'polygon',
            name: `Harvest Property Cluster (${data.properties.length} properties)`,
            color: '#8b5cf6',
            areaSqft: data.properties.reduce((sum: number, p: any) => sum + (p.lot_sqft || p.sqft || 4000), 0),
            propertyCount: data.properties.length,
            coords: closedCoords,
          },
        ];
      }
      
      // Fallback: create a circle around the center if not enough coordinate points
      return [
        {
          id: `geo-api-${Date.now()}`,
          type: 'circle',
          name: `Harvest Property Cluster (${data.properties.length} properties)`,
          color: '#8b5cf6',
          areaSqft: data.properties.reduce((sum: number, p: any) => sum + (p.lot_sqft || p.sqft || 4000), 0),
          propertyCount: data.properties.length,
          center: [lat, lon],
          radius: radius * 1609, // Convert miles to meters
        },
      ];
    }
  } catch (error) {
    console.error('Failed to fetch geofences:', error);
  }
  return [];
}

async function fetchGeofenceArea(lat: number, lon: number, radius: number): Promise<FetchResult | null> {
  try {
    const res = await fetch(`/api/harvest/search?location=${lat},${lon}&radius=${radius}&limit=1`);
    const data = await res.json();
    if (data.properties && data.properties.length > 0) {
      // Calculate actual bounds from property coordinates
      const coords = data.properties
        .filter((p: any) => p.latitude && p.longitude)
        .map((p: any) => [p.latitude, p.longitude] as [number, number]);
      
      if (coords.length > 0) {
        const lats = coords.map((c: [number, number]) => c[0]);
        const lons = coords.map((c: [number, number]) => c[1]);
        const bounds: [number, number, number, number] = [
          Math.min(...lats), Math.min(...lons),
          Math.max(...lats), Math.max(...lons)
        ];
        return { totalProperties: data.count || data.properties.length, bounds };
      }
      
      // Fallback to radius-based bounds
      const radiusDeg = radius * 0.0145; // Approximate miles to degrees
      return { totalProperties: data.count || data.properties.length, bounds: [lat - radiusDeg, lon - radiusDeg, lat + radiusDeg, lon + radiusDeg] };
    }
  } catch (error) {
    console.error('Failed to fetch geofence area:', error);
  }
  return null;
}

// ---- Drawing rectangle on map ----
function RectangleDrawer({
  onComplete,
}: {
  onComplete: (bounds: { north: number; south: number; east: number; west: number }) => void;
}) {
  const [drawing, setDrawing] = useState(false);
  const startRef = useRef<[number, number] | null>(null);
  const [current, setCurrent] = useState<[number, number] | null>(null);

  useMapEvents({
    mousedown: (e) => {
      startRef.current = [e.latlng.lat, e.latlng.lng];
      setDrawing(true);
    },
    mousemove: (e) => {
      if (drawing && startRef.current) {
        setCurrent([e.latlng.lat, e.latlng.lng]);
      }
    },
    mouseup: () => {
      if (startRef.current && current) {
        const north = Math.max(startRef.current[0], current[0]);
        const south = Math.min(startRef.current[0], current[0]);
        const east = Math.max(startRef.current[1], current[1]);
        const west = Math.min(startRef.current[1], current[1]);
        onComplete({ north, south, east, west });
        startRef.current = null;
        setCurrent(null);
        setDrawing(false);
      }
    },
  });

  return null;
}

// Track map center for search
function MapCenterTracker({ onCenterChange }: { onCenterChange: (center: [number, number]) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => {
      const center = map.getCenter();
      onCenterChange([center.lat, center.lng]);
    };
    map.on('moveend', handler);
    return () => {
      map.off('moveend', handler);
    };
  }, [map, onCenterChange]);
  return null;
}

// ---- Main Component ----
export default function GeofencingTab() {
  const [storms, setStorms] = useState<Storm[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [geofences, setGeofences] = useState<GeoShape[]>([
    { id: 'g1', type: 'polygon', name: 'Storm Corridor 7', color: '#ef4444', areaSqft: 124000, propertyCount: 284, coords: [[32.77, -96.80], [32.78, -96.79], [32.79, -96.81], [32.76, -96.82], [32.77, -96.80]] },
    { id: 'g2', type: 'circle', name: 'Hail Impact Zone', color: '#f97316', areaSqft: 89000, propertyCount: 156, center: [32.7767, -96.797], radius: 1200 },
    { id: 'g3', type: 'rectangle', name: 'Probate Boundary A', color: '#22c55e', areaSqft: 45600, propertyCount: 42, bounds: { north: 32.80, south: 32.74, east: -96.78, west: -96.82 } },
  ]);

  useEffect(() => {
    reconApi.getStorms().then(setStorms);
    reconApi.getLeads().then(setLeads);
  }, []);

  const [drawingMode, setDrawingMode] = useState<'none' | 'polygon' | 'rectangle'>('none');
  const [selectedFence, setSelectedFence] = useState<string | null>('g1');
  const [deleteMode, setDeleteMode] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const mapCenterRef = useRef<[number, number]>([32.7767, -96.797]);
  const setMapCenter = useCallback((center: [number, number]) => {
    mapCenterRef.current = center;
  }, []);
  const [radarOverlayEnabled, setRadarOverlayEnabled] = useState(false);

  const selected = geofences.find((f) => f.id === selectedFence);

  const handleAddShape = useCallback((shape: GeoShape) => {
    setGeofences((prev) => [...prev, shape]);
    setDrawingMode('none');
  }, []);

  const handleAddRectangle = useCallback((bounds: { north: number; south: number; east: number; west: number }) => {
    const newShape: GeoShape = {
      id: `geo-${Date.now()}`,
      type: 'rectangle',
      name: `Survey Rectangle`,
      color: '#06b6d4',
      areaSqft: Math.round(
        (bounds.north - bounds.south) * (bounds.east - bounds.west) * 85000
      ),
      propertyCount: Math.floor(Math.random() * 50) + 5,
      bounds,
    };
    handleAddShape(newShape);
  }, [handleAddShape]);

  const handleDelete = (id: string) => {
    setGeofences((prev) => prev.filter((f) => f.id !== id));
    if (selectedFence === id) setSelectedFence(null);
  };

  const handleClearAll = () => {
    setGeofences([]);
    setSelectedFence(null);
  };

  const handleSearchArea = async () => {
    const [lat, lon] = mapCenterRef.current;
    setSearchLoading(true);
    setSearchResult(null);
    try {
      const area = await fetchGeofenceArea(lat, lon, 5);
      if (area) {
        setSearchResult(`Area search found ${area.totalProperties} properties in bounds`);
        const fences = await fetchGeofences(lat, lon, 5);
        if (fences.length > 0) {
          setGeofences((prev) => [...prev, ...fences]);
        }
      }
    } catch {
      setSearchResult('Search failed — check backend connection');
    }
    setSearchLoading(false);
  };

  // ---- Map click handler for storm/lead markers ----
  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        // If in drawing mode, let RectangleDrawer handle it
        if (drawingMode === 'rectangle') return;
        // Otherwise, just log the click (can be extended for lead marking)
        console.log('Map click at:', e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-cyan-400" />
            <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">Geofencing Intelligence</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">Live boundary mapping · Storm corridors · Property geofence analysis</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setDrawingMode('rectangle'); setDeleteMode(false); }}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors", drawingMode === 'rectangle' ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}
          >
            <Ruler className="w-3.5 h-3.5" /> Draw Rectangle
          </button>
          <button
            onClick={() => { setDrawingMode('none'); setDeleteMode(false); }}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors", drawingMode === 'none' ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}
          >
            <Navigation className="w-3.5 h-3.5" /> Pan Mode
          </button>
          <button
            onClick={() => setDeleteMode((d) => !d)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors", deleteMode ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Mode
          </button>
          <button
            onClick={handleSearchArea}
            disabled={searchLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 transition-colors flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" /> Search Area
          </button>
          <button
            onClick={() => setRadarOverlayEnabled((p) => !p)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors", radarOverlayEnabled ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}
          >
            <CloudRain className="w-3.5 h-3.5" />
            {radarOverlayEnabled ? "Radar On" : "Weather Radar"}
          </button>
          <button onClick={handleClearAll} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">Clear All</button>
        </div>
      </div>

      {searchResult && (
        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-300 text-sm">
          {searchResult}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map */}
        <div className="lg:col-span-8 relative h-[420px] lg:h-[580px] rounded-2xl overflow-hidden border border-slate-700/50 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
          <MapContainer
            center={[32.7767, -96.7970]}
            zoom={12}
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* OpenRadar / NEXRAD weather radar overlay */}
            {radarOverlayEnabled && (
              <TileLayer
                url="https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png"
                attribution="IEM NEXRAD Weather Radar"
                opacity={0.6}
              />
            )}

            {/* Storm markers */}
            {storms.map((storm) => (
              <Marker key={storm.id} position={[storm.lat || 32.7767, storm.lng || -96.7970]} icon={DefaultIcon}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold text-cyan-400">{storm.name}</div>
                    <div className="text-xs text-slate-400">Severity: <span style={{ color: severityColor[storm.severity] }} className="font-semibold">{storm.severity.toUpperCase()}</span></div>
                    <div className="text-xs text-slate-500">Wind: {storm.wind} · Hail: {storm.hail}</div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Lead markers */}
            {leads.map((lead) => (
              <Marker key={lead.id} position={[lead.lat, lead.lng]} icon={L.divIcon({
                className: 'custom-lead-marker',
                html: `<div style="width:10px;height:10px;border-radius:50%;background:${scoreColor(lead.score)};box-shadow:0 0 8px ${scoreColor(lead.score)};border:2px solid white;"></div>`,
                iconSize: [10, 10],
                iconAnchor: [5, 5],
              })}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold text-white">{lead.addr}</div>
                    <div className="text-xs text-slate-400">Score: <span className="font-bold" style={{ color: scoreColor(lead.score) }}>{lead.score}</span></div>
                    <div className="text-xs text-slate-500">{lead.damageType}</div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Geofence shapes */}
            {geofences.map((g) => {
              if (g.type === 'polygon' && g.coords && g.coords.length >= 3) {
                return (
                  <Polygon
                    key={g.id}
                    positions={g.coords}
                    pathOptions={{ color: g.color, fillColor: g.color + '22', weight: 2, fillOpacity: 0.4 }}
                    eventHandlers={{
                      click: () => { if (deleteMode) handleDelete(g.id); else setSelectedFence(g.id); },
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-bold text-white">{g.name}</div>
                        <div className="text-xs text-slate-400">Area: {g.areaSqft.toLocaleString()} sqft</div>
                        <div className="text-xs text-slate-400">Properties: {g.propertyCount}</div>
                      </div>
                    </Popup>
                  </Polygon>
                );
              }
              if (g.type === 'circle' && g.center) {
                return (
                  <Circle
                    key={g.id}
                    center={g.center}
                    radius={g.radius || 800}
                    pathOptions={{ color: g.color, fillColor: g.color + '22', weight: 2, fillOpacity: 0.35 }}
                    eventHandlers={{
                      click: () => { if (deleteMode) handleDelete(g.id); else setSelectedFence(g.id); },
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-bold text-white">{g.name}</div>
                        <div className="text-xs text-slate-400">Area: {g.areaSqft.toLocaleString()} sqft</div>
                        <div className="text-xs text-slate-500">Radius: ~{g.radius}m</div>
                      </div>
                    </Popup>
                  </Circle>
                );
              }
              if (g.type === 'rectangle' && g.bounds) {
                const south = g.bounds.south;
                const west = g.bounds.west;
                const north = g.bounds.north;
                const east = g.bounds.east;
                return (
                  <Rectangle
                    key={g.id}
                    bounds={[[south, west], [north, east]]}
                    pathOptions={{ color: g.color, fillColor: g.color + '22', weight: 2, fillOpacity: 0.35 }}
                    eventHandlers={{
                      click: () => { if (deleteMode) handleDelete(g.id); else setSelectedFence(g.id); },
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-bold text-white">{g.name}</div>
                        <div className="text-xs text-slate-400">Area: {g.areaSqft.toLocaleString()} sqft</div>
                        <div className="text-xs text-slate-500">Bounds: {g.bounds.south.toFixed(4)}, {g.bounds.west.toFixed(4)} → {g.bounds.north.toFixed(4)}, {g.bounds.east.toFixed(4)}</div>
                      </div>
                    </Popup>
                  </Rectangle>
                );
              }
              return null;
            })}

            {/* Drawing overlays */}
            {drawingMode === 'rectangle' && <RectangleDrawer onComplete={handleAddRectangle} />}
            <MapCenterTracker onCenterChange={setMapCenter} />
            <MapClickHandler />
          </MapContainer>

          {/* Drawing status overlay */}
          {drawingMode === 'rectangle' && (
            <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white z-[1000] border border-cyan-500/30">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                Click & drag on map to draw rectangle
              </div>
            </div>
          )}
          {deleteMode && (
            <div className="absolute top-4 right-4 bg-red-900/60 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-red-200 z-[1000] border border-red-500/30">
              Click a shape to delete it
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Selected fence details */}
          {selected && (
            <Card className="border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-400" /> {selected.name}
                  </h3>
                  <button onClick={() => handleDelete(selected.id)} className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-0.5 rounded">Delete</button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500">Area</div>
                    <div className="text-lg font-bold text-white">{selected.areaSqft.toLocaleString()} <span className="text-xs font-normal text-slate-400">sqft</span></div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500">Properties</div>
                    <div className="text-lg font-bold text-amber-400">{selected.propertyCount}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: selected.color }} />
                  <span className="text-xs text-slate-400">{selected.type.toUpperCase()} · Active Boundary</span>
                </div>
                {selected.bounds && (
                  <div className="mt-3 text-xs text-slate-500 font-mono">
                    {selected.bounds.south.toFixed(4)}, {selected.bounds.west.toFixed(4)} → {selected.bounds.north.toFixed(4)}, {selected.bounds.east.toFixed(4)}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* All geofences */}
          <Card>
            <div className="p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Ruler className="w-4 h-4 text-cyan-400" /> Active Boundaries
              </h3>
            </div>
            <div className="divide-y divide-slate-800/60">
              {geofences.map((g) => (
                <button
                  key={g.id}
                  onClick={() => { if (deleteMode) handleDelete(g.id); else setSelectedFence(g.id); }}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-slate-800/30 transition-colors",
                    selectedFence === g.id ? "bg-cyan-500/5 border-l-2 border-cyan-400" : ""
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                      <span className="text-sm font-medium text-slate-200">{g.name}</span>
                      <span className="text-[10px] text-slate-500 uppercase">{g.type}</span>
                    </div>
                    <span className="text-xs text-slate-400">{g.propertyCount} props</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{g.areaSqft.toLocaleString()} sqft</div>
                </button>
              ))}
              {geofences.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-slate-500">No geofences defined. Use "Draw Rectangle" to create boundaries.</div>
              )}
            </div>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <div className="text-xl font-black text-cyan-400">{geofences.length}</div>
              <div className="text-[10px] text-slate-500">Boundaries</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-xl font-black text-amber-400">{geofences.reduce((s, g) => s + g.propertyCount, 0)}</div>
              <div className="text-[10px] text-slate-500">Properties</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-xl font-black text-emerald-400">{storms.length}</div>
              <div className="text-[10px] text-slate-500">Storm Events</div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
