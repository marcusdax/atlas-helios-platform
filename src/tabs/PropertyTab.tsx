import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Card, CardHeader, Badge, Button, ProgressBar, DataTable, StatCard } from '../components/ui';
import { intelApi, propertiesApi, IntelCard, Property } from '../lib/api';

export default function PropertyTab() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [cards, setCards] = useState<IntelCard[]>([]);
  const [valuationHistory, setValuationHistory] = useState<{ month: string; value: number; low: number; high: number }[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newType, setNewType] = useState('Residential');
  const [newValue, setNewValue] = useState(1250000);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    intelApi.getIntelCards().then(setCards);
    propertiesApi.getValuationHistory().then(setValuationHistory);
    propertiesApi.getProperties().then((data) => {
      if (data && data.length > 0) {
        setProperties(data);
      }
    });
  }, []);

  const handleAddProperty = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newAddress.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: newAddress.trim(),
          type: newType,
          value: Number(newValue) || 1250000,
          city: 'Dallas',
          state: 'TX',
        }),
      });
      const created = await res.json();
      setProperties((prev) => [created, ...prev]);
      setNewAddress('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add property:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            🏢 Property Intelligence — AVM & Analytics
          </h2>
          <p className="text-slate-400 text-sm mt-1">Automated valuation models · Risk assessment · Portfolio analytics</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAddModal(!showAddModal)}>
          {showAddModal ? 'Cancel' : '+ Add Property'}
        </Button>
      </div>

      {showAddModal && (
        <Card className="border-cyan-500/40 bg-slate-900/90 p-4">
          <form onSubmit={handleAddProperty} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-mono text-cyan-400 mb-1">Property Address</label>
              <input
                type="text"
                required
                placeholder="e.g. 5204 Swiss Ave, Dallas TX"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div className="w-40">
              <label className="block text-xs font-mono text-cyan-400 mb-1">Property Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              >
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Multi-Family">Multi-Family</option>
                <option value="Industrial">Industrial</option>
              </select>
            </div>
            <div className="w-36">
              <label className="block text-xs font-mono text-cyan-400 mb-1">AVM Value ($)</label>
              <input
                type="number"
                value={newValue}
                onChange={(e) => setNewValue(Number(e.target.value))}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <Button variant="primary" size="sm" onClick={handleAddProperty} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Record'}
            </Button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          <Card>
            <CardHeader title="Portfolio Overview" subtitle="Real-time valuation with confidence intervals" />
            <div className="p-5">
              <div className="h-72">
                <svg viewBox="0 0 600 200" className="w-full h-full">
                  <defs>
                    <linearGradient id="propGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  {[0, 50, 100, 150, 200].map(y => (
                    <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
                  ))}
                  {/* High/Low bands */}
                  <polygon
                    fill="rgba(34,197,94,0.1)"
                    points={`0,200 ${valuationHistory.map((d, i) => `${i * (600 / (valuationHistory.length - 1))},${200 - (d.high - 1.1) * 400}`).join(' ')} 600,200`}
                  />
                  <polygon
                    fill="rgba(239,68,68,0.1)"
                    points={`0,200 ${valuationHistory.map((d, i) => `${i * (600 / (valuationHistory.length - 1))},${200 - (d.low - 1.1) * 400}`).join(' ')} 600,200`}
                  />
                  {/* Area */}
                  <polygon
                    fill="url(#propGradient)"
                    points={`0,200 ${valuationHistory.map((d, i) => `${i * (600 / (valuationHistory.length - 1))},${200 - (d.value - 1.1) * 400}`).join(' ')} 600,200`}
                  />
                  {/* Line */}
                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="3"
                    points={valuationHistory.map((d, i) => `${i * (600 / (valuationHistory.length - 1))},${200 - (d.value - 1.1) * 400}`).join(' ')}
                  />
                  {/* Data points */}
                  {valuationHistory.map((d, i) => (
                    <circle
                      key={i}
                      cx={i * (600 / (valuationHistory.length - 1))}
                      cy={200 - (d.value - 1.1) * 400}
                      r="4"
                      fill="#06b6d4"
                    />
                  ))}
                </svg>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>Jan</span>
                <span>Jun</span>
                <span>Dec</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Property List" subtitle="AI-enriched property intelligence" />
            <DataTable
              columns={[
                { key: "id", label: "ID", render: (row) => <span className="font-mono text-xs text-slate-500">{row.id}</span> },
                { key: "address", label: "Address", render: (row) => (
                  <div>
                    <div className="font-medium text-slate-200">{row.address}</div>
                    <div className="text-xs text-slate-500">{row.type}</div>
                  </div>
                )},
                { key: "value", label: "AVM Value", render: (row) => <span className="font-bold text-slate-200">{typeof row.value === 'number' ? `$${row.value.toLocaleString()}` : row.value}</span> },
                { key: "avmConfidence", label: "Confidence", render: (row) => (
                  <div className="flex items-center gap-2">
                    <ProgressBar value={row.avmConfidence ?? 94} color={(row.avmConfidence ?? 94) > 90 ? "green" : "amber"} size="sm" showValue={false} />
                    <span className="text-xs">{row.avmConfidence ?? 94}%</span>
                  </div>
                )},
                { key: "condition", label: "Condition", render: (row) => (
                  <Badge variant={row.condition === "Excellent" ? "success" : row.condition === "Good" ? "primary" : "warning"} size="sm">{row.condition || 'Good'}</Badge>
                )},
                { key: "riskScore", label: "Risk Score", render: (row) => (
                  <span className={cn("font-medium", (row.riskScore ?? 25) < 30 ? "text-green-400" : (row.riskScore ?? 25) < 50 ? "text-amber-400" : "text-red-400")}>
                    {row.riskScore ?? 25}
                  </span>
                )},
              ]}
              data={properties}
            />
          </Card>
        </div>

        <div className="col-span-4 space-y-4">
          <Card>
            <div className="p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Risk Distribution</div>
              <div className="h-48 flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  {/* Pie chart */}
                  <circle cx="100" cy="100" r="60" fill="none" stroke="#22c55e" strokeWidth="40" strokeDasharray="113 377" />
                  <circle cx="100" cy="100" r="60" fill="none" stroke="#f59e0b" strokeWidth="40" strokeDasharray="88 377" strokeDashoffset="-113" />
                  <circle cx="100" cy="100" r="60" fill="none" stroke="#ef4444" strokeWidth="40" strokeDasharray="50 377" strokeDashoffset="-201" />
                  <circle cx="100" cy="100" r="35" fill="#0f172a" />
                  <text x="100" y="95" textAnchor="middle" fontSize="12" fill="#94a3b8">Total</text>
                  <text x="100" y="115" textAnchor="middle" fontSize="16" fill="#e2e8f0" fontWeight="bold">100</text>
                </svg>
              </div>
              <div className="flex justify-center gap-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Low</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Med</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> High</span>
              </div>
            </div>
          </Card>

          <Card className="border-cyan-500/30">
            <div className="p-4">
              <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-3">AI Insights</div>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400">💡</span>
                  <span className="text-slate-300">3 properties show <span className="text-amber-400">elevated maintenance risk</span> within 12 months</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400">📈</span>
                  <span className="text-slate-300">Portfolio value up <span className="text-green-400">4.2%</span> vs. market average of 2.8%</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400">⚠️</span>
                  <span className="text-slate-300">Hail damage detected on 2 properties — inspection recommended</span>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Catastrophe Risk</div>
              <div className="space-y-3">
                {[
                  { peril: "Flood", score: 23, level: "Low" },
                  { peril: "Wind/Hail", score: 67, level: "Moderate" },
                  { peril: "Fire", score: 15, level: "Low" },
                  { peril: "Earthquake", score: 8, level: "Minimal" },
                ].map((risk, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">{risk.peril}</span>
                    <div className="flex items-center gap-3">
                      <ProgressBar value={risk.score} color={risk.score < 30 ? "green" : risk.score < 60 ? "amber" : "red"} size="sm" className="w-24" showValue={false} />
                      <Badge variant={risk.score < 30 ? "success" : risk.score < 60 ? "warning" : "danger"} size="sm">{risk.level}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
