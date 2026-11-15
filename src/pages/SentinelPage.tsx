import { useState } from 'react';
import { Satellite, MapPin, Calendar, Cloud, Search, Image as ImageIcon, Download, Eye } from 'lucide-react';
import { Card, CardHeader, Badge, Button } from '../components/ui';

interface ImageryResult {
  id: string;
  datetime: string;
  'eo:cloud_cover': number;
  assets: Record<string, any>;
}

export default function SentinelPage() {
  const [lat, setLat] = useState<string>('30.2672');
  const [lon, setLon] = useState<string>('-97.7431');
  const [startDate, setStartDate] = useState<string>('2024-01-01');
  const [endDate, setEndDate] = useState<string>('2024-12-31');
  const [maxCloudCover, setMaxCloudCover] = useState<number>(20);
  const [radius, setRadius] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImageryResult[] | null>(null);
  const [collections, setCollections] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/sentinel/collections');
      const data = await res.json();
      setCollections(data);
    } catch (e) {
      setError('Failed to fetch collections');
    }
  };

  const searchImagery = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sentinel/property-imagery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: parseFloat(lat),
          lon: parseFloat(lon),
          radius,
          startDate,
          endDate,
          maxCloudCover
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Search failed');
      }
      
      const data = await res.json();
      setResults(data.imagery.features || []);
    } catch (e: any) {
      setError(e.message || 'Failed to search imagery');
    }
    setLoading(false);
  };

  const searchAdvanced = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sentinel/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bbox: [
            parseFloat(lon) - radius/111,
            parseFloat(lat) - radius/111,
            parseFloat(lon) + radius/111,
            parseFloat(lat) + radius/111
          ],
          datetime: `${startDate}T00:00:00Z/${endDate}T23:59:59Z`,
          collections: ['sentinel-2-l2a'],
          limit: 20,
          filter: {
            op: 'lte',
            args: [
              { property: 'eo:cloud_cover' },
              maxCloudCover
            ]
          }
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Search failed');
      }
      
      const data = await res.json();
      setResults(data.features || []);
    } catch (e: any) {
      setError(e.message || 'Failed to search imagery');
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Satellite className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Sentinel Satellite</h1>
        </div>
        <p className="text-slate-400">
          Access Copernicus Sentinel-2 imagery for property intelligence and analysis
        </p>
      </div>

      {/* Search Panel */}
      <Card className="mb-8">
        <CardHeader 
          title="Search Parameters" 
          subtitle="Define your area of interest and time range"
        />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Latitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                placeholder="e.g. 30.2672"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Longitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                placeholder="e.g. -97.7431"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                <Eye className="w-4 h-4 inline mr-1" />
                Radius (km)
              </label>
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={radius}
                onChange={(e) => setRadius(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                <Cloud className="w-4 h-4 inline mr-1" />
                Max Cloud Cover (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={maxCloudCover}
                onChange={(e) => setMaxCloudCover(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={searchImagery} disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              {loading ? 'Searching...' : 'Quick Search'}
            </Button>
            <Button variant="secondary" onClick={searchAdvanced} disabled={loading}>
              <Satellite className="w-4 h-4 mr-2" />
              Advanced Search
            </Button>
            <Button variant="outline" onClick={fetchCollections}>
              <ImageIcon className="w-4 h-4 mr-2" />
              View Collections
            </Button>
          </div>
        </div>
      </Card>

      {/* Collections Preview */}
      {collections && (
        <Card className="mb-8">
          <CardHeader title="Available Collections" />
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.collections?.slice(0, 6).map((col: any) => (
                <div 
                  key={col.id}
                  className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Satellite className="w-4 h-4 text-cyan-400" />
                    <span className="font-medium text-white text-sm">{col.id}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {col.description || 'No description available'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Results */}
      {results && (
        <Card>
          <CardHeader 
            title="Search Results" 
            subtitle={`Found ${results.length} imagery tiles`}
            action={
              <Badge variant="info">
                {results.length} items
              </Badge>
            }
          />
          <div className="p-6">
            {results.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Satellite className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No imagery found for the specified criteria</p>
                <p className="text-sm mt-2">Try adjusting your search parameters</p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-start gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-cyan-500/30 transition-colors"
                  >
                    <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-cyan-400 truncate">
                          {item.id}
                        </span>
                        <Badge 
                          variant={item['eo:cloud_cover'] < 10 ? 'success' : 'warning'}
                          size="sm"
                        >
                          {item['eo:cloud_cover']}% cloud
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-400">
                        {new Date(item.datetime).toLocaleString()}
                      </p>
                      {item.assets && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Object.keys(item.assets).slice(0, 4).map((assetKey) => (
                            <span 
                              key={assetKey}
                              className="text-xs px-2 py-1 bg-slate-700/50 rounded text-slate-400"
                            >
                              {assetKey}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Info Section */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-slate-900/30 border border-slate-800 rounded-xl">
          <Satellite className="w-8 h-8 text-cyan-400 mb-3" />
          <h4 className="text-white font-semibold mb-2">Sentinel-2</h4>
          <p className="text-slate-400 text-sm">
            10m resolution multispectral imagery with 13 bands for vegetation, 
            soil, and water analysis.
          </p>
        </div>
        <div className="p-6 bg-slate-900/30 border border-slate-800 rounded-xl">
          <Cloud className="w-8 h-8 text-amber-400 mb-3" />
          <h4 className="text-white font-semibold mb-2">Cloud Filtering</h4>
          <p className="text-slate-400 text-sm">
            Filter by cloud cover percentage to ensure clear imagery 
            for property analysis.
          </p>
        </div>
        <div className="p-6 bg-slate-900/30 border border-slate-800 rounded-xl">
          <Calendar className="w-8 h-8 text-green-400 mb-3" />
          <h4 className="text-white font-semibold mb-2">Temporal Data</h4>
          <p className="text-slate-400 text-sm">
            Access historical imagery from 2015 onwards. Track changes 
            over time with 5-day revisit frequency.
          </p>
        </div>
      </div>
    </div>
  );
}
