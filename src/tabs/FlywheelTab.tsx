import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Card } from '../components/ui';
import { flywheelApi, FlywheelStep } from '../lib/api';

export default function FlywheelTab() {
  const [flyStep, setFlyStep] = useState(0);
  const [tick, setTick] = useState(0);
  const [flywheel, setFlywheel] = useState<FlywheelStep[]>([]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setFlyStep(s => (s + 1) % 4), 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    flywheelApi.getFlywheel().then(setFlywheel);
  }, []);

  if (!flywheel.length) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400 bg-clip-text text-transparent">
            🔄 NEXUS Mind — The Data Flywheel
          </h2>
          <p className="text-slate-400 text-sm mt-1">From chaos to certainty · Self-improving AI · Continuous ground-truth refinement</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7">
          <Card className="h-full">
            <div className="p-8 flex flex-col items-center">
              <div className="relative w-72 h-72 mb-8">
                <svg viewBox="0 0 280 280" className="w-full h-full">
                  <circle cx="140" cy="140" r="120" fill="none" stroke="rgba(6,182,212,0.1)" strokeWidth="1"/>
                  <circle cx="140" cy="140" r="90" fill="none" stroke="rgba(139,92,246,0.1)" strokeWidth="1"/>
                  <circle cx="140" cy="140" r="50" fill="none" stroke="rgba(251,191,36,0.15)" strokeWidth="1.5"/>
                  <circle cx="140" cy="140" r="120" fill="none" stroke="url(#arcGrad)" strokeWidth="3" strokeDasharray={`${(tick % 60 / 60) * 754} 754`} strokeLinecap="round" transform="rotate(-90 140 140)"/>
                  <defs>
                    <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#06b6d4"/>
                      <stop offset="100%" stopColor="#8b5cf6"/>
                    </linearGradient>
                  </defs>
                  {flywheel.map((fw, i) => {
                    const angle = (i / 4) * 2 * Math.PI - Math.PI / 2;
                    const x = 140 + 120 * Math.cos(angle);
                    const y = 140 + 120 * Math.sin(angle);
                    const isActive = flyStep === i;
                    return (
                      <g key={i} onClick={() => setFlyStep(i)} className="cursor-pointer">
                        <circle
                          cx={x} cy={y} r={isActive ? 24 : 18}
                          fill={isActive ? "rgba(6,182,212,0.25)" : "rgba(6,18,42,0.8)"}
                          stroke={isActive ? "#06b6d4" : "rgba(6,182,212,0.3)"}
                          strokeWidth={isActive ? 2 : 1}
                          className="transition-all"
                        />
                        <text x={x} y={y + 6} textAnchor="middle" fontSize={isActive ? 16 : 12}>{fw.icon}</text>
                      </g>
                    );
                  })}
                  <circle cx="140" cy="140" r="45" fill="rgba(6,18,42,0.9)" stroke="rgba(251,191,36,0.4)" strokeWidth="1.5"/>
                  <text x="140" y="132" textAnchor="middle" fontSize="11" fill="#fbbf24" fontWeight="bold">NEXUS</text>
                  <text x="140" y="148" textAnchor="middle" fontSize="11" fill="#fbbf24" fontWeight="bold">MIND</text>
                  <text x="140" y="162" textAnchor="middle" fontSize="9" fill="#64748b">AI CORE</text>
                </svg>
              </div>

              <div className="w-full p-5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-4xl">{flywheel[flyStep].icon}</div>
                  <div>
                    <div className="font-bold text-lg text-slate-200">Step {flywheel[flyStep].step}: {flywheel[flyStep].title}</div>
                  </div>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">{flywheel[flyStep].desc}</p>
              </div>

              <div className="flex gap-3 mt-6">
                {flywheel.map((fw, i) => (
                  <button
                    key={i}
                    onClick={() => setFlyStep(i)}
                    className={cn(
                      "w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg transition-all",
                      flyStep === i ? "border-cyan-500 bg-cyan-500/20 text-cyan-400" : "border-slate-700 text-slate-500 hover:border-slate-600"
                    )}
                  >
                    {fw.icon}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="col-span-5 space-y-4">
          <Card>
            <div className="p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">The Virtuous Cycle</div>
              {[
                { step: "1. Data In", desc: "Petabytes from satellites, professionals, citizens", color: "#06b6d4" },
                { step: "2. AI Analysis", desc: "Omniscient Core finds valuable patterns", color: "#8b5cf6" },
                { step: "3. Human Verify", desc: "Gig economy confirms ground truth", color: "#fbbf24" },
                { step: "4. Monetize", desc: "Verified findings sold to B2B clients", color: "#22c55e" },
                { step: "5. Learning", desc: "Verification data trains better models", color: "#f97316" },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 py-3 border-b border-slate-800/50 last:border-0">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${item.color}22`, color: item.color, border: `1px solid ${item.color}` }}
                  >
                    {item.step[0]}
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: item.color }}>{item.step}</div>
                    <div className="text-xs text-slate-500">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-amber-500/30">
            <div className="p-4">
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4">AI Accuracy Over Time</div>
              <div className="h-24 flex items-end gap-1">
                {[35, 48, 57, 63, 72, 79, 85, 89, 93, 96].map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-amber-600 to-amber-400 rounded-t"
                    style={{ height: `${v}%`, opacity: 0.5 + i * 0.05 }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>Month 1</span>
                <span>Month 10</span>
              </div>
              <p className="text-sm text-slate-400 text-center mt-3">
                35% → <span className="text-amber-400 font-bold">96%</span> accuracy as data flywheel spins
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
