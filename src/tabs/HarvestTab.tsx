import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Home, MapPin, Search, Building2, DollarSign, Bed, Bath, Maximize, Calendar, ArrowRight, Loader2, Layers, Radio, TrendingUp, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import { Card, CardHeader, Button } from '../components/ui';

// Types
interface HarvestProperty {
  mls_id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  sale_price: number;
  list_price: number;
  beds: number;
  baths: number;
  sqft: number;
  lot_sqft: number;
  year_built: number;
  property_type: string;
  roof_type: string;
  image_url: string;
  listing_date: string;
  source: string;
}

interface HarvestResult {
  properties: HarvestProperty[];
  count: number;
  error?: string;
}

// ---- API helpers ----
async function fetchProperties(location: string, radius: number, limit: number): Promise<HarvestResult | null> {
  try {
    const res = await fetch(`/api/harvest/search?location=${encodeURIComponent(location)}&radius=${radius}&limit=${limit}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchPropertyDetails(mlsId: string): Promise<any | null> {
  try {
    const res = await fetch(`/api/harvest/details/${encodeURIComponent(mlsId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchMethods(): Promise<any | null> {
  try {
    const res = await fetch('/api/harvest/methods');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---- Value estimation heuristic ----
function estimateValue(prop: HarvestProperty) {
  const sqftVal = (prop.sqft || 2000) * 150;
  const lotVal = (prop.lot_sqft || 8000) * 5;
  const bedsBonus = (prop.beds || 3) * 8000;
  const agePenalty = Math.max(0, (2026 - (prop.year_built || 2000)) * 500);
  return Math.max(50000, sqftVal + lotVal + bedsBonus - agePenalty);
}

// ---- HarvestTab Component ----
export default function HarvestTab() {
  const [location, setLocation] = useState<string>('Dallas, TX');
  const [radius, setRadius] = useState<number>(5);
  const [limit, setLimit] = useState<number>(20);
  const [properties, setProperties] = useState<HarvestProperty[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<HarvestProperty | null>(null);
  const [propertyDetails, setPropertyDetails] = useState<any | null>(null);
  const [methods, setMethods] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showMethods, setShowMethods] = useState(false);

  useEffect(() => {
    fetchMethods().then(setMethods);
  }, []);

  const handleSearch = useCallback(async () => {
    if (!location.trim()) {
      setError('Please enter a location');
      return;
    }
    setLoading(true);
    setError(null);
    setSelectedProperty(null);
    setPropertyDetails(null);
    try {
      const result = await fetchProperties(location, radius, limit);
      if (result && !result.error) {
        setProperties(result.properties);
      } else {
        setError(result?.error || 'Failed to fetch properties');
        setProperties(null);
      }
    } catch {
      setError('Connection failed. Is the backend running?');
      setProperties(null);
    }
    setLoading(false);
  }, [location, radius, limit]);

  const handlePropertyClick = async (prop: HarvestProperty) => {
    setSelectedProperty(prop);
    setDetailLoading(true);
    try {
      const details = await fetchPropertyDetails(prop.mls_id);
      setPropertyDetails(details);
    } catch {
      setPropertyDetails(null);
    }
    setDetailLoading(false);
  };

  // Stats
  const totalValue = properties?.reduce((sum, p) => sum + (p.sale_price || estimateValue(p)), 0) || 0;
  const avgPrice = properties ? totalValue / properties.length : 0;
  const totalSqft = properties?.reduce((sum, p) => sum + (p.sqft || 0), 0) || 0;

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Home className="w-6 h-6 text-cyan-400" />
            <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">Property Harvest</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">Live MLS data via HomeHarvest · Realtor.com integration · Real-time property intelligence</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMethods(!showMethods)}
          className="flex items-center gap-1.5"
        >
          <Layers className="w-3.5 h-3.5" /> API Methods
        </Button>
      </div>

      {/* API Methods Panel */}
      {showMethods && methods && (
        <Card className="border-cyan-500/20">
          <div className="p-5">
            <h3 className="font-semibold text-white mb-3 text-sm">Available Endpoints</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {methods.methods?.map((m: any, i: number) => (
                <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <div className="font-mono text-xs text-cyan-400 mb-1">GET /api/harvest/{m.name}</div>
                  <div className="text-xs text-slate-500">{m.description}</div>
                  <div className="text-xs text-slate-600 mt-1">Params: {m.params?.join(', ')}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Search Panel */}
      <Card>
        <CardHeader
          title="Property Search"
          subtitle="Search real estate listings via HomeHarvest (Realtor.com)"
        />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" /> Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Dallas, TX or Austin, TX"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Radius (mi)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Limit</label>
              <input
                type="number"
                min="1"
                max="100"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? 'Searching...' : 'Search Properties'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      </Card>

      {/* Results */}
      {properties && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                <span className="text-xs text-slate-500">Properties Found</span>
              </div>
              <div className="text-2xl font-black text-white">{properties.length}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                <span className="text-xs text-slate-500">Total Value</span>
              </div>
              <div className="text-2xl font-black text-white">${(totalValue / 1000000).toFixed(1)}M</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <span className="text-xs text-slate-500">Avg Price</span>
              </div>
              <div className="text-2xl font-black text-white">${Math.round(avgPrice / 1000)}K</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Maximize className="w-5 h-5 text-purple-400" />
                <span className="text-xs text-slate-500">Total SqFt</span>
              </div>
              <div className="text-2xl font-black text-white">{totalSqft.toLocaleString()}</div>
            </Card>
          </div>

          {/* Property Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((prop, i) => (
              <motion.div
                key={prop.mls_id || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className={cn(
                    "cursor-pointer transition-all hover:border-cyan-500/50",
                    selectedProperty?.mls_id === prop.mls_id && "border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                  )}
                >
                  <div className="p-4" onClick={() => handlePropertyClick(prop)}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold text-white text-sm">{prop.address || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">{prop.city}, {prop.state} {prop.zip_code}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-cyan-400 text-lg">
                          ${((prop.sale_price || estimateValue(prop)) / 1000).toFixed(0)}K
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-slate-800/50 rounded p-2 text-center">
                        <Bed className="w-3.5 h-3.5 mx-auto mb-1 text-slate-400" />
                        <span className="text-white font-medium">{prop.beds || 'N/A'}</span>
                      </div>
                      <div className="bg-slate-800/50 rounded p-2 text-center">
                        <Bath className="w-3.5 h-3.5 mx-auto mb-1 text-slate-400" />
                        <span className="text-white font-medium">{prop.baths || 'N/A'}</span>
                      </div>
                      <div className="bg-slate-800/50 rounded p-2 text-center">
                        <Maximize className="w-3.5 h-3.5 mx-auto mb-1 text-slate-400" />
                        <span className="text-white font-medium">{((prop.sqft || 0) / 1000).toFixed(1)}K</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
                      <span className="text-xs text-slate-500">{prop.property_type || 'Unknown'}</span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {prop.listing_date || 'N/A'}
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Selected Property Detail */}
          {selectedProperty && (
            <Card className="border-cyan-500/20">
              <CardHeader
                title={`Property Details: ${selectedProperty.address}`}
                subtitle={`MLS ID: ${selectedProperty.mls_id}`}
                action={
                  <a
                    href={`https://www.realtor.com/realestateandhomes-detail/${selectedProperty.mls_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    View on Realtor.com <ExternalLink className="w-3 h-3" />
                  </a>
                }
              />
              <div className="p-6">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    <span className="text-slate-400 ml-2">Loading details...</span>
                  </div>
                ) : propertyDetails && propertyDetails.property ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { icon: DollarSign, label: 'Sale Price', val: `$${((propertyDetails.property.sale_price || 0) / 1000).toFixed(0)}K`, color: 'text-green-400' },
                          { icon: Building2, label: 'Type', val: propertyDetails.property.property_type, color: 'text-cyan-400' },
                          { icon: Maximize, label: 'Sq Ft', val: (propertyDetails.property.sqft || 0).toLocaleString(), color: 'text-amber-400' },
                          { icon: Bed, label: 'Beds', val: propertyDetails.property.beds, color: 'text-purple-400' },
                          { icon: Bath, label: 'Baths', val: propertyDetails.property.baths, color: 'text-pink-400' },
                          { icon: Maximize, label: 'Lot', val: ((propertyDetails.property.lot_sqft || 0) / 43560).toFixed(2) + ' ac', color: 'text-emerald-400' },
                          { icon: Calendar, label: 'Year Built', val: propertyDetails.property.year_built, color: 'text-blue-400' },
                          { icon: Radio, label: 'Roof', val: propertyDetails.property.roof_type || 'N/A', color: 'text-orange-400' },
                        ].map((stat, i) => (
                          <div key={i} className="bg-slate-800/50 rounded-lg p-3">
                            <stat.icon className={`w-4 h-4 mb-1 ${stat.color}`} />
                            <div className="text-xs text-slate-500">{stat.label}</div>
                            <div className="text-sm font-semibold text-white">{stat.val}</div>
                          </div>
                        ))}
                      </div>
                      {propertyDetails.property.description && (
                        <div className="mt-4">
                          <div className="text-xs text-slate-500 mb-1">Description</div>
                          <p className="text-sm text-slate-300">{propertyDetails.property.description}</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="text-xs text-slate-500 mb-1">Coordinates</div>
                        <div className="font-mono text-sm text-cyan-400">
                          {propertyDetails.property.latitude}, {propertyDetails.property.longitude}
                        </div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="text-xs text-slate-500 mb-1">Listing Date</div>
                        <div className="text-sm text-white">{propertyDetails.property.list_date || 'N/A'}</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="text-xs text-slate-500 mb-1">Source</div>
                        <div className="text-sm text-white">{propertyDetails.property.source || 'Realtor.com'}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-500">
                    No detailed information available. Try searching again.
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Initial prompt */}
      {!properties && !loading && !error && (
        <Card className="border-dashed border-slate-700">
          <div className="p-12 text-center">
            <Home className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-400 mb-2">Ready to Search Properties</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Enter a location above to pull live MLS data from Realtor.com via HomeHarvest.
              Results include sale prices, property features, coordinates, and direct Realtor.com links.
            </p>
            <div className="mt-4 flex justify-center gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => { setLocation('Dallas, TX'); handleSearch(); }}>
                Dallas, TX <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setLocation('Austin, TX'); handleSearch(); }}>
                Austin, TX <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setLocation('Houston, TX'); handleSearch(); }}>
                Houston, TX <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
