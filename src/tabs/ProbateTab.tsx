import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Card, CardHeader, Button, Badge, ProgressBar, DataTable } from '../components/ui';
import { probateApi, propertiesApi, ProbateCaseView, Heir, ValuationHistoryEntry } from '../lib/api';

export default function ProbateTab() {
  const [cases, setCases] = useState<ProbateCaseView[]>([]);
  const [heirs, setHeirs] = useState<Heir[]>([]);
  const [valuationHistory, setValuationHistory] = useState<ValuationHistoryEntry[]>([]);
  const [selectedCase, setSelectedCase] = useState<ProbateCaseView | null>(null);
  const [activeView, setActiveView] = useState<"cases" | "heirs" | "assets" | "timeline">("cases");

  useEffect(() => {
    probateApi.getProbateCases().then(setCases);
    probateApi.getHeirs().then(setHeirs);
    propertiesApi.getValuationHistory().then(setValuationHistory);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-purple-400 bg-clip-text text-transparent">
            ⚖️ Probate Module — Estate Administration
          </h2>
          <p className="text-slate-400 text-sm mt-1">AI-powered heir identification · Document intelligence · Estate valuation</p>
        </div>
        <div className="flex gap-2">
          {["cases", "heirs", "assets", "timeline"].map(view => (
            <Button key={view} variant={activeView === view ? "primary" : "secondary"} size="sm" onClick={() => setActiveView(view as any)}>
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Cases</div>
          {cases.map(probateCase => (
            <div key={probateCase.id} className="cursor-pointer" onClick={() => setSelectedCase(probateCase)}>
              <Card
                className={cn(
                  "cursor-pointer transition-all",
                  selectedCase?.id === probateCase.id && "border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                )}
              >
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-slate-500">{probateCase.id}</span>
                  <Badge variant={probateCase.complexity === "Critical" ? "danger" : probateCase.complexity === "High" ? "warning" : "info"} size="sm">
                    {probateCase.complexity}
                  </Badge>
                </div>
                <div className="font-semibold text-slate-200 text-sm mb-1">{probateCase.decedent}</div>
                <div className="text-xs text-slate-500 mb-3">{probateCase.attorney}</div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <span className="text-slate-400">Heirs: <span className="text-slate-200">{probateCase.heirs}</span></span>
                  <span className="text-slate-400">Props: <span className="text-slate-200">{probateCase.properties}</span></span>
                </div>
                <ProgressBar value={probateCase.progress} color={probateCase.progress > 75 ? "green" : probateCase.progress > 40 ? "amber" : "purple"} size="sm" />
              </div>
              </Card>
            </div>
          ))}
        </div>

        <div className="col-span-9 space-y-6">
          {activeView === "cases" && selectedCase && (
            <>
              <Card glow>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-slate-100">{selectedCase.decedent}</h3>
                        <Badge variant={selectedCase.status === "Distribution" ? "success" : "primary"}>{selectedCase.status}</Badge>
                      </div>
                      <p className="text-sm text-slate-400">Case: {selectedCase.id} · DOD: {selectedCase.dateOfDeath}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-amber-400">{selectedCase.assets}</div>
                      <div className="text-xs text-slate-500">Total Estate Value</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                      { label: "Heirs Identified", value: selectedCase.heirs.toString(), icon: "👥" },
                      { label: "Properties", value: selectedCase.properties.toString(), icon: "🏠" },
                      { label: "Case Progress", value: `${selectedCase.progress}%`, icon: "📊" },
                      { label: "Days Active", value: "47", icon: "⏱️" },
                    ].map((stat, i) => (
                      <div key={i} className="bg-slate-800/50 rounded-lg p-4 text-center">
                        <div className="text-2xl mb-1">{stat.icon}</div>
                        <div className="text-xl font-bold text-slate-200">{stat.value}</div>
                        <div className="text-xs text-slate-500">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-800/30 rounded-lg p-4">
                    <div className="text-sm font-medium text-slate-300 mb-3">AI-Generated Case Summary</div>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Estate complexity assessment indicates <span className="text-amber-400 font-medium">{selectedCase.complexity}</span> difficulty 
                      due to {selectedCase.heirs > 5 ? "multiple heirs requiring genealogical research" : "straightforward heir identification"} 
                      and {selectedCase.properties > 3 ? "diverse property portfolio across multiple jurisdictions" : "consolidated property holdings"}. 
                      Estimated resolution timeline: <span className="text-cyan-400 font-medium">{selectedCase.complexity === "High" ? "12-18 months" : selectedCase.complexity === "Medium" ? "8-12 months" : "4-8 months"}</span>.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader title="Heir Identification Progress" subtitle="AI-assisted genealogy reconstruction" />
                  <div className="p-4">
                    <DataTable
                      columns={[
                        { key: "name", label: "Name", render: (row) => (
                          <div>
                            <div className="font-medium text-slate-200">{row.name}</div>
                            <div className="text-xs text-slate-500">{row.relationship}</div>
                          </div>
                        )},
                        { key: "confidence", label: "Confidence", render: (row) => (
                          <div className="flex items-center gap-2">
                            <ProgressBar value={row.confidence} max={100} color={row.confidence > 90 ? "green" : "amber"} size="sm" showValue={false} />
                            <span className="text-xs w-10 text-right">{row.confidence}%</span>
                          </div>
                        )},
                        { key: "status", label: "Status", render: (row) => (
                          <Badge variant={row.status === "Verified" ? "success" : row.status === "Pending" ? "warning" : "default"} size="sm">{row.status}</Badge>
                        )},
                        { key: "claimShare", label: "Share", render: (row) => <span className="text-slate-300">{row.claimShare}</span> },
                      ]}
                      data={heirs}
                    />
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Asset Discovery" subtitle="Cross-reference engine results" />
                  <div className="p-4 space-y-3">
                    {[
                      { type: "Real Property", count: selectedCase.properties, value: "68%", status: "Complete" },
                      { type: "Financial Accounts", count: 7, value: "22%", status: "In Progress" },
                      { type: "Personal Property", count: 45, value: "7%", status: "Pending" },
                      { type: "Digital Assets", count: 12, value: "3%", status: "Research" },
                    ].map((asset, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center text-lg">
                            {asset.type === "Real Property" ? "🏠" : asset.type === "Financial Accounts" ? "💰" : asset.type === "Personal Property" ? "🚗" : "💻"}
                          </div>
                          <div>
                            <div className="font-medium text-slate-200">{asset.type}</div>
                            <div className="text-xs text-slate-500">{asset.count} items identified</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-200">{asset.value}</div>
                          <Badge variant={asset.status === "Complete" ? "success" : asset.status === "In Progress" ? "primary" : "default"} size="sm">{asset.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}

          {activeView === "heirs" && (
            <Card>
              <CardHeader title="Genealogy Reconstruction" subtitle="Graph Neural Network-powered family relationship mapping" />
              <div className="p-8">
                <div className="flex items-center justify-center h-64 bg-slate-800/30 rounded-lg">
                  <div className="text-center">
                    <div className="text-4xl mb-3">🧬</div>
                    <div className="text-slate-400">Interactive Family Tree Visualization</div>
                    <div className="text-sm text-slate-500 mt-1">GNN confidence scores overlay</div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeView === "assets" && (
            <Card>
              <CardHeader title="Estate Valuation" subtitle="Time-series models for historical asset appreciation" />
              <div className="p-5">
                <div className="h-64">
                  <svg viewBox="0 0 600 200" className="w-full h-full">
                    <defs>
                      <linearGradient id="valGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    {[0, 50, 100, 150, 200].map(y => (
                      <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
                    ))}
                    {/* Area */}
                    <polygon
                      fill="url(#valGradient)"
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
          )}

          {activeView === "timeline" && (
            <Card>
              <CardHeader title="Probate Timeline" subtitle="Event-driven workflow orchestration" />
              <div className="p-5">
                <div className="relative">
                  {[
                    { phase: "Death Record Registration", date: "Jan 15, 2024", status: "complete", desc: "Vital records API verification" },
                    { phase: "Petition Filing", date: "Jan 22, 2024", status: "complete", desc: "Court acceptance confirmed" },
                    { phase: "Heir Identification", date: "In Progress", status: "active", desc: "GNN analysis 73% complete" },
                    { phase: "Asset Discovery", date: "Mar 1, 2024", status: "pending", desc: "Cross-reference engine running" },
                    { phase: "Creditor Notification", date: "Apr 15, 2024", status: "pending", desc: "Automated notice generation ready" },
                    { phase: "Distribution", date: "TBD", status: "pending", desc: "Pending heir verification" },
                  ].map((event, i, arr) => (
                    <div key={i} className="flex gap-4 pb-8 last:pb-0">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2",
                          event.status === "complete" ? "bg-green-500 border-green-500" :
                          event.status === "active" ? "bg-amber-500 border-amber-500 animate-pulse" :
                          "bg-slate-700 border-slate-600"
                        )} />
                        {i < arr.length - 1 && <div className="w-0.5 flex-1 bg-slate-700 mt-2" />}
                      </div>
                      <div className="flex-1 -mt-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-medium text-slate-200">{event.phase}</span>
                          <Badge variant={event.status === "complete" ? "success" : event.status === "active" ? "warning" : "default"} size="sm">
                            {event.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-slate-400">{event.date}</div>
                        <div className="text-xs text-slate-500 mt-1">{event.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
