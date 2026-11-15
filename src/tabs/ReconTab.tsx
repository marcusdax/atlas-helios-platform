import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Card, CardHeader, Badge, Button, ProgressBar, DataTable } from '../components/ui';
import { reconApi, scoreColor, severityColor, Storm, Lead } from '../lib/api';

// Real Leaflet for Recon map
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

// ---- API fetch for leads ----
async function fetchNearbyLeads(lat: number, lon: number, radiusKm: number) {
  try {
    const res = await fetch(`/api/harvest/nearby?lat=${lat}&lon=${lon}&radius=${radiusKm}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.properties) {
      return data.properties.map((p: any) => ({
        id: `lead-api-${p.mls_id}`,
        addr: p.address || p.full_address || 'Unknown',
        score: Math.min(99, Math.max(60, Math.round((p.sale_price || 100000) / 20000))),
        roof: 'Unknown',
        sqft: p.sqft || 2000,
        status: 'Uncontacted',
        val: `$${((p.sale_price || 15000) / 1000).toFixed(1)}K`,
        lat: p.latitude || lat,
        lng: p.longitude || lon,
        damageType: 'Potential',
        lastContact: null,
      }));
    }
  } catch {
    /* fall through */
  }
  return null;
}

// ---- Interactive Storm Map with Leaflet ----
function LeafletStormMap({
  storms,
  leads,
  selectedStorm,
  onStormSelect,
}: {
  storms: Storm[];
  leads: Lead[];
  selectedStorm: Storm | null;
  onStormSelect: (s: Storm) => void;
}) {
  const [apiLeads, setApiLeads] = useState<Lead[] | null>(null);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    if (selectedStorm) {
      const stormLat = selectedStorm.lat != null && !isNaN(selectedStorm.lat) ? selectedStorm.lat : 32.7767;
      const stormLng = selectedStorm.lng != null && !isNaN(selectedStorm.lng) ? selectedStorm.lng : -96.7970;
      fetchNearbyLeads(stormLat, stormLng, 10).then((result) => {
        if (result) {
          setApiLeads(result);
          setMapKey((k) => k + 1);
        }
      });
    }
  }, [selectedStorm]);

  return (
    <div className="w-full h-full bg-slate-900 rounded-lg relative overflow-hidden">
      <MapContainer
        key={mapKey}
        center={[selectedStorm?.lat || 32.7767, selectedStorm?.lng || -96.797]}
        zoom={11}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Storm center marker with radius circle */}
        {selectedStorm && (
          <Circle
            center={[selectedStorm.lat || 32.7767, selectedStorm.lng || -96.7970]}
            radius={(selectedStorm.affectedArea || 500) * 8}
            pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.1, weight: 2, dashArray: '10, 10' }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold text-red-400">{selectedStorm.name}</div>
                <div className="text-xs text-slate-400">Damage Probability: {selectedStorm.score}%</div>
                <div className="text-xs text-slate-500">Affected Area: {selectedStorm.affectedArea} km²</div>
              </div>
            </Popup>
          </Circle>
        )}

        {/* Storm markers */}
        {storms.map((storm) => {
          const lat = storm.lat != null && !isNaN(storm.lat) ? storm.lat : 32.7767;
          const lng = storm.lng != null && !isNaN(storm.lng) ? storm.lng : -96.7970;
          return (
            <Marker
              key={storm.id}
              position={[lat, lng]}
              icon={DefaultIcon}
              eventHandlers={{
                click: () => onStormSelect({ ...storm, lat, lng }),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-bold text-cyan-400">{storm.name}</div>
                  <div className="text-xs text-slate-400">Severity: <span style={{ color: severityColor[storm.severity] }} className="font-semibold">{storm.severity.toUpperCase()}</span></div>
                  <div className="text-xs text-slate-500">Wind: {storm.wind} · Hail: {storm.hail}</div>
                  <div className="text-xs text-slate-500">Leads: {storm.leads} · Score: {storm.score}%</div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Lead markers — API leads take priority, fall back to LEADS */}
        {(apiLeads || leads).map((lead) => (
          <Marker
            key={lead.id}
            position={[lead.lat || 32.7767, lead.lng || -96.7970]}
            icon={L.divIcon({
              className: 'custom-lead-marker',
              html: `<div style="width:10px;height:10px;border-radius:50%;background:${scoreColor(lead.score)};box-shadow:0 0 8px ${scoreColor(lead.score)};border:2px solid white;"></div>`,
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            })}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold text-white">{lead.addr}</div>
                <div className="text-xs text-slate-400">Score: <span className="font-bold" style={{ color: scoreColor(lead.score) }}>{lead.score}</span></div>
                <div className="text-xs text-slate-500">{lead.damageType}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

// ---- Main ReconTab ----
export default function ReconTab() {
  const [storms, setStorms] = useState<Storm[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selStorm, setSelStorm] = useState<Storm | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  useEffect(() => {
    reconApi.getStorms().then(setStorms);
    reconApi.getLeads().then(setLeads);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-amber-400 bg-clip-text text-transparent">
            Recon Intelligence — Storm Command
          </h2>
          <p className="text-slate-400 text-sm mt-1">AI-powered storm detection · Damage Probability Engine · Predictive lead generation</p>
        </div>
        <div className="flex gap-2">
          <Button variant={viewMode === "map" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("map")}>Map View</Button>
          <Button variant={viewMode === "list" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("list")}>List View</Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Storm List */}
        <div className="col-span-3 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Storm Events</div>
          {storms.map(storm => (
            <div key={storm.id} className="cursor-pointer" onClick={() => setSelStorm(storm)}>
              <Card
                className={cn(
                  "cursor-pointer transition-all",
                  selStorm?.id === storm.id && "border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                )}
              >
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-200">{storm.name}</span>
                  <Badge variant={storm.severity === "critical" ? "danger" : storm.severity === "high" ? "warning" : "info"} size="sm">
                    {storm.severity.toUpperCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-3">
                  <span>🧊 Hail: <span className="text-slate-200 font-medium">{storm.hail}</span></span>
                  <span>💨 Wind: <span className="text-slate-200 font-medium">{storm.wind}</span></span>
                  <span>📍 Leads: <span className="text-cyan-400 font-medium">{storm.leads}</span></span>
                  <span>🕐 {storm.time}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Damage Probability</span>
                    <span className="font-medium" style={{ color: scoreColor(storm.score) }}>{storm.score}%</span>
                  </div>
                  <ProgressBar value={storm.score} max={100} color={storm.score >= 90 ? "red" : storm.score >= 75 ? "amber" : "green"} size="sm" showValue={false} />
                </div>
              </div>
            </Card>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="col-span-9 space-y-6">
          {selStorm && (
            <Card glow>
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-100">{selStorm.name}</h3>
                    <p className="text-sm text-slate-400">Preston Hollow, Dallas TX · Radar confirmed 02/24/2026 14:32 CST</p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black" style={{ color: scoreColor(selStorm.score) }}>{selStorm.score}</div>
                    <div className="text-xs text-slate-500">DAMAGE PROB SCORE™</div>
                  </div>
                </div>

                {viewMode === "map" ? (
                  <div className="h-72 rounded-lg overflow-hidden mb-4 border border-slate-700/50">
                    <LeafletStormMap
                      storms={storms}
                      leads={leads}
                      selectedStorm={selStorm}
                      onStormSelect={setSelStorm}
                    />
                  </div>
                ) : (
                  <div className="h-64 bg-slate-800/50 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📊</div>
                      <div className="text-slate-400">Storm Impact Visualization</div>
                      <div className="text-sm text-slate-500">{selStorm.properties} properties affected</div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4">
                  {[
                    { icon: "🧊", label: "Hail Size", value: selStorm.hail },
                    { icon: "💨", label: "Max Wind", value: selStorm.wind },
                    { icon: "📍", label: "Leads", value: selStorm.leads.toString() },
                    { icon: "⏱️", label: "Duration", value: "38 min" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl mb-1">{stat.icon}</div>
                      <div className="text-lg font-bold text-slate-200">{stat.value}</div>
                      <div className="text-xs text-slate-500">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Top Priority Leads"
              subtitle={`${selStorm?.name ?? ''} — ${leads.length} properties`}
              action={<Button variant="primary" size="sm">Export to CRM →</Button>}
            />
            <DataTable
              columns={[
                { key: "score", label: "Score", render: (row: Lead) => (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: `${scoreColor(row.score)}22`, color: scoreColor(row.score), border: `1px solid ${scoreColor(row.score)}44` }}>
                      {row.score}
                    </div>
                  </div>
                )},
                { key: "addr", label: "Address", render: (row: Lead) => (
                  <div>
                    <div className="font-medium text-slate-200">{row.addr}</div>
                    <div className="text-xs text-slate-500">{row.roof} · {row.sqft.toLocaleString()} sqft</div>
                  </div>
                )},
                { key: "damageType", label: "Damage Type" },
                { key: "status", label: "Status", render: (row: Lead) => (
                  <Badge variant={row.status === "Won" ? "success" : row.status === "Inspecting" ? "primary" : row.status === "Contacted" ? "info" : "default"} size="sm">
                    {row.status}
                  </Badge>
                )},
                { key: "val", label: "Est. Value", render: (row: Lead) => (
                  <span className="font-bold text-green-400">{row.val}</span>
                )},
              ]}
              data={leads}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
