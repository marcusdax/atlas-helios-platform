import { useState, useEffect } from 'react';
import { Card, CardHeader, StatCard } from '../components/ui';
import { intelApi, IntelCard } from '../lib/api';

export default function IntelTab() {
  const [cards, setCards] = useState<IntelCard[]>([]);

  useEffect(() => {
    intelApi.getIntelCards().then(setCards);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-red-400 bg-clip-text text-transparent">
            🧠 Intelligence Command — Platform Analytics
          </h2>
          <p className="text-slate-400 text-sm mt-1">Real-time KPIs · Revenue models · Security architecture · API ecosystem</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader title="🔐 Sovereignty & Security — Dual Fortress" />
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: "QRC Vault", color: "#06b6d4", icon: "🔒", items: ["512-bit QR Cryptography", "9× stronger than AES", "Future-proof quantum threat", "All transactions encrypted"] },
                { title: "Legal Fortress", color: "#fbbf24", icon: "⚖️", items: ["508(c)(1)(A) Shield", "IP immune from subpoena", "Max legal autonomy", "Hostile-state resistant"] },
              ].map(f => (
                <div key={f.title} className="bg-slate-800/30 rounded-lg p-4" style={{ border: `1px solid ${f.color}22` }}>
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <div className="font-bold text-sm mb-3" style={{ color: f.color }}>{f.title}</div>
                  {f.items.map(it => (
                    <div key={it} className="text-xs text-slate-500 py-1">{it}</div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-sm text-slate-400 text-center">
              🛡️ Protected by Sentinel Protocol · Hostile to surveillance & coercion
            </div>
          </div>
        </Card>

        <Card className="border-amber-500/30">
          <CardHeader title="💰 Financial Models — Monetization" />
          <div className="p-5">
            <div className="space-y-4">
              {[
                { model: "Data / API Licensing (B2B)", range: "$5K–$20K/mo", bar: 85, color: "#06b6d4" },
                { model: "Performance (B2G / Public)", range: "% of savings", bar: 65, color: "#8b5cf6" },
                { model: "Contractor SaaS Subscription", range: "$299–$999/mo", bar: 90, color: "#22c55e" },
                { model: "Tokenized Attribution", range: "DeFi / Revenue", bar: 55, color: "#fbbf24" },
              ].map(m => (
                <div key={m.model}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">{m.model}</span>
                    <span className="font-medium" style={{ color: m.color }}>{m.range}</span>
                  </div>
                  <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.bar}%`, background: `linear-gradient(90deg, ${m.color}88, ${m.color})` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 text-sm text-amber-400 text-center font-medium">
              Hybrid Model: CapEx Mitigation + Performance-Linked Royalty (20%→30%→45%)
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="🔌 API-First Ecosystem — Integrations" />
        <div className="p-5">
          <div className="grid grid-cols-3 gap-8 items-center">
            <div>
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">Third-Party Ecosystem</div>
              {[
                { icon: "📊", label: "JobNimbus / AccuLynx CRM" },
                { icon: "✍️", label: "Adobe Sign / DocuSign" },
                { icon: "💳", label: "QuickBooks / Stripe" },
                { icon: "☁️", label: "AWS S3 / CloudFront" },
                { icon: "🗺️", label: "Mapbox / Google Maps" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 py-2 text-sm text-slate-400">
                  <span>{item.icon}</span> {item.label}
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider">REST + Webhooks</div>
              <div className="text-2xl text-slate-400">⇄</div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-center">
                <div className="font-bold text-cyan-400">ATLAS-HELIOS</div>
                <div className="text-xs text-slate-500">API Core</div>
              </div>
              <div className="text-2xl text-slate-400">⇄</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Data Feeds</div>
            </div>
            <div>
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">Data Intelligence Feeds</div>
              {[
                { icon: "🛰️", label: "NOAA / NWS Weather" },
                { icon: "🏠", label: "CoreLogic / Black Knight" },
                { icon: "🛩️", label: "Nearmap Aerial" },
                { icon: "📡", label: "Sentinel-2 Satellite" },
                { icon: "🗂️", label: "Permit & County APIs" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 py-2 text-sm text-slate-400">
                  <span>{item.icon}</span> {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
