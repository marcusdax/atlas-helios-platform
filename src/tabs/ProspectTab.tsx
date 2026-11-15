import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Card, CardHeader, Badge, Button } from '../components/ui';
import { prospectApi, Mission } from '../lib/api';

export default function ProspectTab() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionAcc, setMissionAcc] = useState<string | null>(null);

  useEffect(() => {
    prospectApi.getMissions().then(setMissions);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            🎯 NEXUS Prospect — Ground-Truth Lead Engine
          </h2>
          <p className="text-slate-400 text-sm mt-1">AI-triggered citizen missions · Verified damage intelligence · B2B enterprise reporting</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Property Reality · Verification Ecosystem" />
          <div className="p-5">
            <div className="grid grid-cols-3 gap-4">
              {[
                { title: "Citizen Verification", color: "#06b6d4", items: ["📷 Peeling Paint", "🏠 Tarped Roof", "🌿 Overgrown Lot", "🚨 Safety Hazard"] },
                { title: "Ground Truth Stream", color: "#8b5cf6", items: ["🔒 Timestamped", "🔗 Immutable Ledger", "🤖 AI Validated", "⛓️ Encrypted"] },
                { title: "Stakeholder Access", color: "#22c55e", items: ["🛡️ Insurers", "🏦 Buyers", "👥 Neighbors", "📊 Analytics"] },
              ].map(col => (
                <div key={col.title} className="bg-slate-800/30 rounded-lg p-4" style={{ border: `1px solid ${col.color}33` }}>
                  <div className="text-xs font-bold mb-3" style={{ color: col.color }}>{col.title.toUpperCase()}</div>
                  {col.items.map(it => (
                    <div key={it} className="text-sm text-slate-400 py-1 border-b border-slate-700/30 last:border-0">{it}</div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-sm text-slate-400 text-center">
              Citizens earn <span className="text-amber-400 font-medium">NEXUS Stars</span> → Data verified → Sold to B2B clients → Revenue recycled to verifiers
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader 
            title="AI-Triggered Citizen Missions" 
            action={<Badge variant="danger" size="sm">4 OPEN</Badge>}
          />
          <div className="p-5 space-y-3">
            {missions.map(m => (
              <div
                key={m.id}
                onClick={() => setMissionAcc(missionAcc === m.id ? null : m.id)}
                className={cn(
                  "border rounded-lg overflow-hidden cursor-pointer transition-all",
                  missionAcc === m.id ? "border-amber-500/50 bg-amber-500/5" : "border-slate-700/50 hover:border-slate-600"
                )}
              >
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-200">{m.id} · {m.type}</div>
                    <div className="text-xs text-slate-500">{m.addr} · {m.eta}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={m.tier === "T3" ? "warning" : m.tier === "T2" ? "primary" : "default"} size="sm">{m.tier}</Badge>
                    <span className="font-bold text-amber-400">${m.reward}</span>
                    <Badge variant={m.status === "complete" ? "success" : m.status === "active" ? "warning" : "primary"} size="sm">{m.status}</Badge>
                  </div>
                </div>
                {missionAcc === m.id && (
                  <div className="px-4 pb-4 border-t border-slate-700/30 pt-3">
                    <div className="flex gap-2 mb-3">
                      {["1. Accept", "2. Navigate", "3. Capture", "4. Submit & Earn"].map((s, i) => (
                        <div key={i} className="flex-1 p-2 bg-slate-800/50 rounded text-center text-xs text-slate-400">{s}</div>
                      ))}
                    </div>
                    {m.status === "open" && (
                      <Button className="w-full" variant="primary">⚡ ACCEPT MISSION — Earn ${m.reward}</Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-2 border-amber-500/30">
          <CardHeader title="B2B Enterprise — PropertyInsight AI · Monetization Models" />
          <div className="p-5">
            <div className="grid grid-cols-4 gap-4">
              {[
                { title: "Insurance Co.", val: "$5K–$20K/mo", desc: "Risk assessment & verified property condition API", icon: "🛡️" },
                { title: "REIT / Prop Mgmt", val: "$8K–$30K/mo", desc: "Portfolio-wide degradation monitoring & alerts", icon: "🏢" },
                { title: "Restoration Cos.", val: "$299–$999/mo", desc: "Storm intel + estimate + verified leads bundle", icon: "🔨" },
                { title: "Gov / Municipal", val: "Performance", desc: "Crisis triage, % efficiency savings, social impact ROI", icon: "🏛️" },
              ].map(c => (
                <div key={c.title} className="bg-slate-800/30 rounded-lg p-4 border border-amber-500/10">
                  <div className="text-3xl mb-2">{c.icon}</div>
                  <div className="font-bold text-slate-200 mb-1">{c.title}</div>
                  <div className="text-lg font-bold text-amber-400 mb-2">{c.val}</div>
                  <div className="text-xs text-slate-500">{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
