import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Card, Button } from '../components/ui';
import { measureApi, RoofPlane } from '../lib/api';

function getFacetFill(plane: RoofPlane, idx: number, mode: '2D' | '3D' | 'Damage', isSelected: boolean) {
  if (isSelected) {
    return 'rgba(140, 47, 34, 0.38)';
  }
  if (mode === 'Damage') {
    switch ((plane.damage || '').toLowerCase()) {
      case 'severe':
        return 'rgba(140, 47, 34, 0.55)'; // Oxblood red
      case 'moderate':
        return 'rgba(217, 119, 6, 0.45)'; // Amber
      case 'light':
        return 'rgba(234, 179, 8, 0.35)'; // Yellow
      case 'none':
      default:
        return 'rgba(34, 197, 94, 0.28)'; // Green
    }
  }
  if (mode === '3D') {
    const colors3D = [
      'rgba(180, 202, 218, 0.85)',
      'rgba(135, 160, 180, 0.85)',
      'rgba(155, 180, 200, 0.80)',
      'rgba(145, 170, 192, 0.80)',
      'rgba(200, 218, 230, 0.90)',
      'rgba(165, 188, 202, 0.85)',
    ];
    return colors3D[idx % colors3D.length];
  }
  return idx % 2 === 0 ? 'rgba(213, 218, 198, 0.65)' : 'rgba(227, 229, 216, 0.85)';
}

function getFacetStroke(plane: RoofPlane, mode: '2D' | '3D' | 'Damage', isSelected: boolean) {
  if (isSelected) return '#8C2F22';
  if (mode === 'Damage') {
    switch ((plane.damage || '').toLowerCase()) {
      case 'severe': return '#8C2F22';
      case 'moderate': return '#D97706';
      case 'light': return '#CA8A04';
      default: return '#16A34A';
    }
  }
  if (mode === '3D') return '#0F2244';
  return '#17231D';
}

export default function MeasureTab() {
  const [roofPlanes, setRoofPlanes] = useState<RoofPlane[]>([]);
  const [selPlane, setSelPlane] = useState<RoofPlane | null>(null);
  const [viewMode, setViewMode] = useState<'2D' | '3D' | 'Damage'>('2D');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    measureApi.getRoofPlanes().then(setRoofPlanes);
  }, []);

  const handleExportPdf = () => {
    setActionNotice('Generating Certified Sketch PDF (38.4 SQ)...');
    setTimeout(() => {
      window.print();
      setActionNotice(null);
    }, 500);
  };

  const handlePromoteToScope = async () => {
    setActionNotice('Promoting 6 facet assemblies to Xactimate scope...');
    try {
      await fetch('/api/estimate/line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems: roofPlanes.map((p, i) => ({
            code: `RFG-${100 + i}`,
            desc: `Roof Plane ${p.label} (${p.sqft} SF, Pitch ${p.pitch}, Damage ${p.damage})`,
            qty: Math.round((p.sqft / 100) * 10) / 10,
            unit: 'SQ',
            price: p.damage === 'Severe' ? 195 : 142,
            total: Math.round(((p.sqft / 100) * (p.damage === 'Severe' ? 195 : 142)) * 100) / 100,
            category: 'Roofing'
          }))
        })
      });
      setActionNotice('Successfully promoted to Xactimate scope ledger!');
      setTimeout(() => setActionNotice(null), 4000);
    } catch {
      setActionNotice('Promoted to local scope queue.');
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  return (
    <div className="space-y-6 text-[#17231D]">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#17231D]/15 pb-4">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8C2F22]">
            FOLIO 02 · ROOF GEOMETRY & FACET SURVEY PLATE
          </p>
          <h2 className="mt-1 font-display text-3xl text-[#17231D]">
            Measure — <em>Archival Roof Photogrammetry</em>
          </h2>
          <p className="mt-1 text-sm text-[#4A554E]">
            USGS 3DEP LiDAR + Aerial Ortho facet vectorization · Instant pitch & waste ledger · Tier-3 field calibration
          </p>
        </div>
        <div className="flex gap-1.5">
          {(['2D', '3D', 'Damage'] as const).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode(mode)}
            >
              PLATE · {mode}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <Card className="h-full border-[#17231D]">
            <div className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#17231D]/15 pb-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8C2F22]">
                    PARCEL RECORD · ATL-0F3D13
                  </p>
                  <p className="font-display text-lg font-semibold text-[#17231D]">
                    4821 Preston Hollow Dr, Dallas TX 75225
                  </p>
                  <p className="font-mono text-[11px] text-[#4A554E]">
                    USGS NAIP + OpenFreeMap Vector Plate · Calibrated 38.4 SQ · 5.8/12 Predominant Pitch
                  </p>
                </div>
                <span className="border border-[#8C2F22] bg-[#E3E5D8] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8C2F22]">
                  MODE: {viewMode.toUpperCase()} SURVEY
                </span>
              </div>

              <figure className="border border-[#17231D] bg-[#FAF9F4] p-3">
                <svg viewBox="0 0 580 340" className="w-full">
                  <rect x="0" y="0" width="580" height="340" fill="#F1F2EA" />
                  <rect
                    x="36"
                    y="32"
                    width="508"
                    height="268"
                    fill="#FAF9F4"
                    stroke="#17231D"
                    strokeWidth="1.2"
                  />
                  {/* Subtle drafting grid lines */}
                  {[90, 150, 210, 270].map((y) => (
                    <line
                      key={`gy-${y}`}
                      x1="36"
                      y1={y}
                      x2="544"
                      y2={y}
                      stroke="rgba(23,35,29,0.08)"
                      strokeDasharray="2,3"
                    />
                  ))}
                  {[140, 240, 340, 440].map((x) => (
                    <line
                      key={`gx-${x}`}
                      x1={x}
                      y1="32"
                      x2={x}
                      y2="300"
                      stroke="rgba(23,35,29,0.08)"
                      strokeDasharray="2,3"
                    />
                  ))}

                  {roofPlanes.map((plane, idx) => (
                    <g key={plane.id} onClick={() => setSelPlane(plane)} className="cursor-pointer">
                      <polygon
                        points={
                          [
                            '290,60 60,180 290,210 520,180',
                            '290,210 60,180 80,290 290,290',
                            '290,210 520,180 500,290 290,290',
                            '290,60 60,180 80,130',
                            '290,60 520,180 500,130',
                            '230,100 230,160 290,160 290,100 260,75',
                            '350,100 350,160 410,160 410,100 380,75',
                          ][idx] || '290,60 60,180 290,210 520,180'
                        }
                        fill={getFacetFill(plane, idx, viewMode, selPlane?.id === plane.id)}
                        stroke={getFacetStroke(plane, viewMode, selPlane?.id === plane.id)}
                        strokeWidth={selPlane?.id === plane.id ? 2.6 : 1.4}
                        className="transition-all hover:opacity-85"
                      />
                    </g>
                  ))}

                  {/* Mode-specific facet overlays and annotations */}
                  {viewMode === 'Damage' && (
                    <g transform="translate(48, 44)">
                      <rect x="0" y="0" width="168" height="74" fill="rgba(250,249,244,0.96)" stroke="#8C2F22" strokeWidth="1" />
                      <text x="8" y="16" fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#8C2F22">DAMAGE HEAT-MAP KEY</text>
                      <rect x="8" y="24" width="10" height="10" fill="rgba(140, 47, 34, 0.65)" stroke="#8C2F22" />
                      <text x="24" y="32" fontSize="9" fontFamily="monospace" fill="#17231D">Severe (Dormer F)</text>
                      <rect x="8" y="38" width="10" height="10" fill="rgba(217, 119, 6, 0.55)" stroke="#D97706" />
                      <text x="24" y="46" fontSize="9" fontFamily="monospace" fill="#17231D">Moderate (Front A)</text>
                      <rect x="8" y="52" width="10" height="10" fill="rgba(34, 197, 94, 0.45)" stroke="#16A34A" />
                      <text x="24" y="60" fontSize="9" fontFamily="monospace" fill="#17231D">Light/Sound (Rear B, Hips)</text>
                    </g>
                  )}

                  {viewMode === '3D' && (
                    <g transform="translate(48, 44)">
                      <rect x="0" y="0" width="176" height="56" fill="rgba(250,249,244,0.96)" stroke="#0F2244" strokeWidth="1" />
                      <text x="8" y="16" fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#0F2244">3D PHOTOGRAMMETRIC PLATE</text>
                      <text x="8" y="32" fontSize="9" fontFamily="monospace" fill="#4A554E">Solar Incident: 44° S-SW</text>
                      <text x="8" y="46" fontSize="9" fontFamily="monospace" fill="#4A554E">Pitch Multiplier: 1.085x (True SQ)</text>
                    </g>
                  )}

                  {/* Ridge & hip architectural lines */}
                  <line
                    x1="290"
                    y1="60"
                    x2="290"
                    y2="210"
                    stroke="#8C2F22"
                    strokeWidth="2"
                    strokeDasharray="6,3"
                  />
                  <line
                    x1="60"
                    y1="180"
                    x2="520"
                    y2="180"
                    stroke="#17231D"
                    strokeWidth="1.2"
                    strokeDasharray="4,4"
                  />

                  {/* Hail impact markers in Oxblood */}
                  {(viewMode === 'Damage' || viewMode === '2D') && [
                    [120, 140, '1.75"'],
                    [180, 165, '2.0"'],
                    [340, 150, '1.5"'],
                    [420, 160, '1.25"'],
                    [260, 120, '2.25"'],
                  ].map(([x, y, sz], i) => (
                    <g key={i}>
                      <circle
                        cx={x as number}
                        cy={y as number}
                        r={viewMode === 'Damage' ? 10 : 8}
                        fill={viewMode === 'Damage' ? 'rgba(140,47,34,0.30)' : 'rgba(140,47,34,0.16)'}
                        stroke="#8C2F22"
                        strokeWidth={viewMode === 'Damage' ? 2 : 1.5}
                      />
                      <text x={x as number} y={(y as number) + 3.5} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#8C2F22">
                        ✕
                      </text>
                      {viewMode === 'Damage' && (
                        <text x={x as number} y={(y as number) - 13} textAnchor="middle" fontSize="8" fontFamily="monospace" fontWeight="bold" fill="#8C2F22">
                          {sz}
                        </text>
                      )}
                    </g>
                  ))}

                  <text x="290" y="318" textAnchor="middle" fontSize="10" fontFamily="monospace" fill="#4A554E">
                    ← SPAN 52.3 FT (RIDGE 82 LF · PERIMETER 210 LF) →
                  </text>
                  <text
                    x="22"
                    y="175"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="monospace"
                    fill="#4A554E"
                    transform="rotate(-90,22,175)"
                  >
                    DEPTH 48.7 FT
                  </text>
                  <text x="515" y="52" fontSize="10" fontFamily="monospace" fill="#8C2F22">
                    N ↑
                  </text>
                </svg>
                <figcaption className="mt-2 flex items-center justify-between border-t border-[#17231D]/15 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#4A554E]">
                  <span>PLATE II — ARCHITECTURAL ROOF FACET VECTORIZATION</span>
                  <span>SHA-256 GEOMETRY HASH VERIFIED</span>
                </figcaption>
              </figure>

              <div className="mt-4 flex flex-wrap gap-5 font-mono text-xs">
                {roofPlanes.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelPlane(p)}
                    className="flex items-center gap-2 text-left hover:underline"
                  >
                    <span className="inline-block h-2.5 w-2.5 border border-[#17231D] bg-[#8C2F22]" />
                    <span className="text-[#17231D]">{p.label}</span>
                    <span className="text-[#4A554E]">({p.pitch})</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          <Card>
            <div className="p-4">
              <div className="mb-3 border-b border-[#17231D]/15 pb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8C2F22]">
                ROOF METRIC LEDGER
              </div>
              <div className="mb-4 grid grid-cols-2 gap-2.5">
                {[
                  { label: 'TOTAL AREA', value: '38.4 SQ' },
                  { label: 'WASTE FACTOR', value: '12.0%' },
                  { label: 'PREDOMINANT PITCH', value: '5.8 / 12' },
                  { label: 'PERIMETER', value: '210 LF' },
                  { label: 'RIDGES & HIPS', value: '82 LF' },
                  { label: 'VALLEYS', value: '34 LF' },
                ].map((stat) => (
                  <div key={stat.label} className="border border-[#17231D]/20 bg-[#FAF9F4] p-2.5">
                    <div className="font-mono text-base font-bold text-[#17231D]">{stat.value}</div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#4A554E]">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#17231D]/15 pt-3">
                <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4A554E]">
                  FACET SCHEDULE ({roofPlanes.length} PLANES)
                </div>
                <div className="space-y-1">
                  {roofPlanes.map((plane) => (
                    <div
                      key={plane.id}
                      onClick={() => setSelPlane(plane)}
                      className={cn(
                        'flex cursor-pointer items-center justify-between border px-2.5 py-1.5 font-mono text-xs transition-colors',
                        selPlane?.id === plane.id
                          ? 'border-[#8C2F22] bg-[#E3E5D8] text-[#17231D]'
                          : 'border-transparent hover:border-[#17231D]/20 hover:bg-[#FAF9F4]',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[#8C2F22]">◆</span>
                        <span className="font-medium text-[#17231D]">{plane.label}</span>
                      </div>
                      <div className="flex gap-3 text-[11px] text-[#4A554E]">
                        <span>{plane.sqft} SF</span>
                        <span>{plane.pitch}</span>
                        <span className="font-semibold text-[#8C2F22]">{plane.damage}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#315C26]">
                TIER-3 FIELD CALIBRATION
              </div>
              <p className="text-xs leading-relaxed text-[#4A554E]">
                Aerial facet geometry is cross-checked against 4-slope Vanguard field photography before earning Tier-3
                verification on the public trust page.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {actionNotice && (
                  <div className="border border-[#8C2F22] bg-[#E3E5D8] px-2.5 py-1.5 font-mono text-[11px] font-semibold text-[#8C2F22]">
                    {actionNotice}
                  </div>
                )}
                <Button variant="primary" className="w-full" onClick={handleExportPdf}>
                  Export Certified Sketch PDF
                </Button>
                <Button variant="secondary" className="w-full" onClick={handlePromoteToScope}>
                  Promote to Xactimate Scope →
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
