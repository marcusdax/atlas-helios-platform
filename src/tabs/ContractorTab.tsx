import { useState } from 'react';
import { Card } from '../components/ui';

interface BoqItem {
  code: string;
  category: string;
  description: string;
  unit: string;
  unit_total: number;
}

const SAMPLE_BOQ: BoqItem[] = [
  { code: 'RFG-SHNG-ARCH', category: 'Roofing Shingles', description: '30-Year Architectural Fiberglass Asphalt Shingle (Class A Fire)', unit: 'SQ', unit_total: 245.0 },
  { code: 'RFG-SHNG-CLS4', category: 'Roofing Shingles', description: 'Class 4 Impact-Resistant SBS Modified Polymer Shingle (Hail Rated)', unit: 'SQ', unit_total: 315.0 },
  { code: 'RFG-METL-SEAM', category: 'Roofing Shingles', description: '24-Gauge Standing Seam Metal Panel Roofing (Concealed Fastener)', unit: 'SQ', unit_total: 745.0 },
  { code: 'RFG-UNDL-SYN', category: 'Underlayment', description: 'High-Traction Synthetic Roof Underlayment (10 mil woven)', unit: 'SQ', unit_total: 48.0 },
  { code: 'RFG-BAR-ICE', category: 'Barriers', description: 'Self-Adhering Polymer Ice & Water Shield Barrier', unit: 'SQ', unit_total: 114.0 },
  { code: 'RFG-VENT-RDG', category: 'Ventilation', description: 'Continuous External Baffle Shingle-Over Ridge Vent', unit: 'LF', unit_total: 12.5 },
  { code: 'GUT-SEAM-5IN', category: 'Gutters', description: '5-Inch K-Style Seamless Aluminum Gutters & Downspouts', unit: 'LF', unit_total: 15.5 },
  { code: 'WOD-DECK-CDX', category: 'Carpentry', description: '1/2-inch CDX Plywood Sheathing Replacement', unit: 'SHT', unit_total: 74.0 },
];

export default function ContractorTab() {
  const [subTab, setSubTab] = useState<'takeoff' | 'boq' | 'dispatch' | 'invoices'>('takeoff');

  // AI Takeoff state
  const [sqft, setSqft] = useState(2800);
  const [pitchRise, setPitchRise] = useState(6);
  const [tier, setTier] = useState<'standard' | 'enhanced_class4' | 'archival_metal'>('enhanced_class4');

  // Calculations
  const pitchMultiplier = Math.sqrt(1 + Math.pow(pitchRise / 12, 2));
  const trueSurfaceSqft = Math.round(sqft * pitchMultiplier);
  const orderSquares = Math.ceil((trueSurfaceSqft / 100) * 1.12); // 12% waste

  const ratePerSquare = tier === 'standard' ? 245 : tier === 'enhanced_class4' ? 315 : 745;
  const directCost = orderSquares * (ratePerSquare + 48 + 25);
  const overheadProfit = directCost * 0.1;
  const pricedScope = directCost + overheadProfit;
  const disclosedAuctumFee = pricedScope * 0.025; // 2.5% disclosed Auctum fee

  return (
    <div className="space-y-6 text-[#17231D]">
      {/* Folio Kicker */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#17231D]/15 pb-4">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8C2F22]">
            FOLIO 05 · OPENCONSTRUCTION · BIDWRIGHT · OPENFIELDSERVICE · INVOICESHELF
          </p>
          <h2 className="mt-1 font-display text-3xl text-[#17231D]">
            Contractor Suite — <em>Operations, Takeoffs & Milestone Billing</em>
          </h2>
          <p className="mt-1 text-sm text-[#4A554E]">
            Master BOQ catalog, AI 3D facet assemblies, weekly crew dispatch board, and progressive draw schedules with disclosed 2.5% Auctum fee.
          </p>
        </div>
        <span className="border border-[#17231D] bg-[#17231D] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F1F2EA]">
          AUCTUM FEE (DISCLOSED): 2.5%
        </span>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex overflow-x-auto border-b border-[#17231D]/20 bg-[var(--parchment-deep)] font-mono text-xs uppercase tracking-[0.14em]">
        <button
          onClick={() => setSubTab('takeoff')}
          className={`border-r border-[#17231D]/20 px-5 py-3 transition-colors ${
            subTab === 'takeoff'
              ? 'border-t-2 border-t-[#8C2F22] bg-[var(--parchment)] font-bold text-[#8C2F22]'
              : 'text-[#4A554E] hover:bg-[var(--parchment)]'
          }`}
        >
          01 · AI Bidwright Takeoff
        </button>
        <button
          onClick={() => setSubTab('boq')}
          className={`border-r border-[#17231D]/20 px-5 py-3 transition-colors ${
            subTab === 'boq'
              ? 'border-t-2 border-t-[#8C2F22] bg-[var(--parchment)] font-bold text-[#8C2F22]'
              : 'text-[#4A554E] hover:bg-[var(--parchment)]'
          }`}
        >
          02 · Master BOQ Price Book
        </button>
        <button
          onClick={() => setSubTab('dispatch')}
          className={`border-r border-[#17231D]/20 px-5 py-3 transition-colors ${
            subTab === 'dispatch'
              ? 'border-t-2 border-t-[#8C2F22] bg-[var(--parchment)] font-bold text-[#8C2F22]'
              : 'text-[#4A554E] hover:bg-[var(--parchment)]'
          }`}
        >
          03 · Crew Dispatch Calendar
        </button>
        <button
          onClick={() => setSubTab('invoices')}
          className={`border-r border-[#17231D]/20 px-5 py-3 transition-colors ${
            subTab === 'invoices'
              ? 'border-t-2 border-t-[#8C2F22] bg-[var(--parchment)] font-bold text-[#8C2F22]'
              : 'text-[#4A554E] hover:bg-[var(--parchment)]'
          }`}
        >
          04 · Invoices & Milestone Draws
        </button>
      </div>

      {/* Tab 1: AI Bidwright Takeoff */}
      {subTab === 'takeoff' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <Card className="border-[#17231D]">
              <div className="p-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8C2F22]">
                  POINT2ROOF 3D GEOMETRY EXPANSION
                </p>
                <h3 className="font-display text-lg font-bold">Takeoff Inputs</h3>

                <div className="mt-3 space-y-3 font-mono text-xs">
                  <div>
                    <label className="block text-[#4A554E]">Footprint Area (Sq Ft)</label>
                    <input
                      type="number"
                      value={sqft}
                      onChange={(e) => setSqft(Number(e.target.value))}
                      className="mt-1 w-full border border-[#17231D] bg-[#FAF9F4] p-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#4A554E]">Pitch Rise (over 12)</label>
                    <input
                      type="range"
                      min="3"
                      max="14"
                      value={pitchRise}
                      onChange={(e) => setPitchRise(Number(e.target.value))}
                      className="mt-1 w-full accent-[#8C2F22]"
                    />
                    <div className="flex justify-between text-[11px] text-[#4A554E]">
                      <span>3/12 Flat</span>
                      <span className="font-bold text-[#8C2F22]">{pitchRise}/12 Slope ({(Math.atan(pitchRise/12)*180/Math.PI).toFixed(1)}°)</span>
                      <span>14/12 Steep</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#4A554E]">System Specification Tier</label>
                    <select
                      value={tier}
                      onChange={(e) => setTier(e.target.value as any)}
                      className="mt-1 w-full border border-[#17231D] bg-[#FAF9F4] p-2 focus:outline-none"
                    >
                      <option value="standard">Standard 30-Yr Architectural ($245/SQ)</option>
                      <option value="enhanced_class4">Class 4 Hail-Rated SBS Polymer ($315/SQ)</option>
                      <option value="archival_metal">Standing Seam Metal Roof ($745/SQ)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 border-t border-[#17231D]/15 pt-3 font-mono text-xs">
                  <div className="flex justify-between py-1">
                    <span className="text-[#4A554E]">3D Surface Expansion:</span>
                    <span className="font-bold">{trueSurfaceSqft} SF (+{((pitchMultiplier - 1) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#4A554E]">Order Squares (12% waste):</span>
                    <span className="font-bold text-[#8C2F22]">{orderSquares} SQ</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-[#17231D]">
              <div className="p-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0F2244]">
                  SERVICEQUOTE AI PROPOSAL
                </p>
                <h4 className="font-display font-bold">Interactive Client Portal</h4>
                <p className="mt-1 text-xs text-[#4A554E]">
                  Presents 3 tiers with live monthly financing slider, 2.5% disclosed Auctum fee, and 1-tap digital authorization.
                </p>
                <a
                  href="http://localhost:5180/proposal/prop-101"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block text-center border border-[#17231D] bg-[#17231D] py-2 font-mono text-xs uppercase tracking-wider text-[#F1F2EA] hover:bg-[#8C2F22]"
                >
                  Launch Client Proposal View ↗
                </a>
              </div>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-7 space-y-4">
            <Card className="border-[#17231D]">
              <div className="p-4">
                <div className="flex items-center justify-between border-b border-[#17231D]/15 pb-2">
                  <h4 className="font-display font-bold">Auto-Generated Takeoff Scope (Bidwright)</h4>
                  <span className="font-mono text-xs text-[#8C2F22]">{orderSquares} SQUARES ORDERED</span>
                </div>
                <div className="mt-3 divide-y divide-[#17231D]/10 font-mono text-xs">
                  <div className="flex justify-between py-2">
                    <div>
                      <span className="font-bold text-[#8C2F22]">LBR-TEAR-OFF</span>
                      <p className="text-[11px] text-[#4A554E]">Tear-off 1 layer existing composition shingles · {Math.round(trueSurfaceSqft/100)} SQ</p>
                    </div>
                    <span className="font-bold">${(Math.round(trueSurfaceSqft/100) * 85).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <div>
                      <span className="font-bold text-[#8C2F22]">
                        {tier === 'standard' ? 'RFG-SHNG-ARCH' : tier === 'enhanced_class4' ? 'RFG-SHNG-CLS4' : 'RFG-METL-SEAM'}
                      </span>
                      <p className="text-[11px] text-[#4A554E]">
                        {tier === 'standard' ? '30-Yr Architectural Shingle' : tier === 'enhanced_class4' ? 'Class 4 Impact-Resistant Polymer Shingle' : 'Standing Seam Metal Panel'} · {orderSquares} SQ
                      </p>
                    </div>
                    <span className="font-bold">${(orderSquares * ratePerSquare).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <div>
                      <span className="font-bold text-[#8C2F22]">RFG-UNDL-SYN</span>
                      <p className="text-[11px] text-[#4A554E]">High-traction synthetic roof underlayment · {orderSquares} SQ</p>
                    </div>
                    <span className="font-bold">${(orderSquares * 48).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <div>
                      <span className="font-bold text-[#8C2F22]">RFG-BAR-ICE</span>
                      <p className="text-[11px] text-[#4A554E]">Self-adhering polymer ice & water barrier · {Math.ceil(orderSquares * 0.25)} SQ</p>
                    </div>
                    <span className="font-bold">${(Math.ceil(orderSquares * 0.25) * 114).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
              <div className="border border-[#17231D]/20 bg-[#FAF9F4] p-3">
                <span className="text-[10px] uppercase text-[#4A554E]">DIRECT COST</span>
                <p className="mt-0.5 text-base font-bold">${directCost.toFixed(2)}</p>
              </div>
              <div className="border border-[#17231D]/20 bg-[#FAF9F4] p-3">
                <span className="text-[10px] uppercase text-[#4A554E]">O&P MARGIN (10%)</span>
                <p className="mt-0.5 text-base font-bold text-[#315C26]">${overheadProfit.toFixed(2)}</p>
              </div>
              <div className="border border-[#8C2F22] bg-[#FAF9F4] p-3">
                <span className="text-[10px] uppercase font-bold text-[#8C2F22]">DISCLOSED FEE (2.5%)</span>
                <p className="mt-0.5 text-base font-bold text-[#8C2F22]">${disclosedAuctumFee.toFixed(2)}</p>
              </div>
              <div className="border border-[#17231D] bg-[#17231D] p-3 text-[#F1F2EA]">
                <span className="text-[10px] uppercase text-[#D5DAC6]">PRICED SCOPE</span>
                <p className="mt-0.5 text-lg font-extrabold text-[#F1F2EA]">${pricedScope.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Master BOQ Catalog */}
      {subTab === 'boq' && (
        <Card className="border-[#17231D]">
          <div className="p-4">
            <h4 className="font-display text-lg font-bold">OpenConstructionERP Masterformat Price Book</h4>
            <p className="text-xs text-[#4A554E]">
              Standardized CSI MasterFormat catalog items with labor, material, and equipment unit rate breakdown.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b border-[#17231D] bg-[#0F2244] text-[#F1F2EA]">
                  <tr>
                    <th className="p-2.5">CODE</th>
                    <th className="p-2.5">CATEGORY</th>
                    <th className="p-2.5">DESCRIPTION</th>
                    <th className="p-2.5">UNIT</th>
                    <th className="p-2.5">RATE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#17231D]/15 bg-[#FAF9F4]">
                  {SAMPLE_BOQ.map((item) => (
                    <tr key={item.code} className="hover:bg-[#E3E5D8]/40">
                      <td className="p-2.5 font-bold text-[#8C2F22]">{item.code}</td>
                      <td className="p-2.5 text-[#4A554E]">{item.category}</td>
                      <td className="p-2.5 font-sans font-medium">{item.description}</td>
                      <td className="p-2.5 font-bold">{item.unit}</td>
                      <td className="p-2.5 font-extrabold text-[#315C26]">${item.unit_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 3: Dispatch Calendar */}
      {subTab === 'dispatch' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-lg font-bold">OpenFieldService Weekly Schedule</h4>
            <span className="font-mono text-xs text-[#4A554E]">3 Active Work Orders</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { id: 'WO-301', addr: '4821 Whispering Pines Dr', date: '2026-04-14', crew: 'Crew Alpha (6 Men)', status: 'In Progress', squares: 38 },
              { id: 'WO-302', addr: '1204 Crestview Terrace', date: '2026-04-15', crew: 'Drone Recon Unit 2', status: 'Scheduled', squares: 24 },
              { id: 'WO-303', addr: '7730 Meadow Lake Ave', date: '2026-04-16', crew: 'Crew Bravo (5 Men)', status: 'Scheduled', squares: 31 },
            ].map((wo) => (
              <div key={wo.id} className="border border-[#17231D] bg-[#FAF9F4] p-4 font-mono text-xs">
                <div className="flex justify-between border-b border-[#17231D]/15 pb-2">
                  <span className="font-bold text-[#8C2F22]">{wo.id}</span>
                  <span className="bg-[#17231D] px-2 py-0.5 text-[9px] uppercase text-[#F1F2EA]">{wo.status}</span>
                </div>
                <h5 className="mt-2 font-display text-sm font-bold text-[#17231D]">{wo.addr}</h5>
                <p className="mt-1 text-[#4A554E]">📅 {wo.date}</p>
                <p className="text-[#4A554E]">👷 {wo.crew}</p>
                <p className="font-bold text-[#315C26]">{wo.squares} Squares</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Invoices & Milestone Draws */}
      {subTab === 'invoices' && (
        <div className="space-y-4">
          <h4 className="font-display text-lg font-bold">InvoiceShelf Progressive Milestone Draws</h4>
          <div className="border border-[#17231D] bg-[#FAF9F4] p-5 font-mono text-xs">
            <div className="flex justify-between border-b border-[#17231D]/15 pb-3">
              <div>
                <p className="font-bold text-[#8C2F22]">INVOICE INV-501</p>
                <p className="font-display text-base font-bold text-[#17231D]">4821 Preston Hollow Dr — Dana Whitfield</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#4A554E]">TOTAL CONTRACT</span>
                <p className="text-xl font-bold text-[#315C26]">$17,021.00</p>
                <p className="text-[10px] text-[#8C2F22]">Disclosed Fee (2.5%): $425.53</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="border border-[#315C26] bg-[#315C26]/10 p-3">
                <span className="font-bold text-[#315C26]">1. Deposit (50%) — PAID</span>
                <p className="mt-1 text-base font-bold">$8,399.50</p>
              </div>
              <div className="border border-[#17231D]/20 p-3">
                <span className="font-bold text-[#17231D]">2. Material Drop (40%) — DUE</span>
                <p className="mt-1 text-base font-bold">$6,719.60</p>
              </div>
              <div className="border border-[#17231D]/20 p-3">
                <span className="font-bold text-[#17231D]">3. Walkthrough (10%) — PENDING</span>
                <p className="mt-1 text-base font-bold">$1,679.90</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
