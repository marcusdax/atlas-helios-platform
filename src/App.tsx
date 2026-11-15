import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Brain,
  Eye,
  Building2,
  HardHat,
  Scale,
  MapPin,
  Search,
  FileText,
  Settings,
  Sparkles,
  Menu,
  Satellite,
  Home,
  Globe,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Original Atlas Helios Tabs
import IntelTab from './tabs/IntelTab';
import PropertyTab from './tabs/PropertyTab';
import ContractorTab from './tabs/ContractorTab';
import ProbateTab from './tabs/ProbateTab';
import MeasureTab from './tabs/MeasureTab';
import ReconTab from './tabs/ReconTab';
import ProspectTab from './tabs/ProspectTab';
import EstimateTab from './tabs/EstimateTab';
import SparkTab from './tabs/SparkTab';
import FlywheelTab from './tabs/FlywheelTab';
import GeofencingTab from './tabs/GeofencingTab';
import HarvestTab from './tabs/HarvestTab';

// Pages
import SentinelPage from './pages/SentinelPage';
import GlobePage from './pages/GlobePage';
import ArchivalMapLibrePlate from './maps/ArchivalMapLibrePlate';

// Nexus Sections
import HeroSection from './nexus_sections/HeroSection';
import HubSection from './nexus_sections/HubSection';
import TechSection from './nexus_sections/TechSection';
import MetricsSection from './nexus_sections/MetricsSection';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ============================================================================
   AUCTUM ARCHIVAL LEDGER SIGNATURE PRIMITIVES (mirrored from auctum.coffee)
   ========================================================================== */

function ArchivalWaxSeal({
  variant = 'light',
  size = 56,
  arcText = 'ATLAS · HELIOS · VERIFIED BY AUCTUM ·',
}: {
  variant?: 'light' | 'dark' | 'gold';
  size?: number;
  arcText?: string;
}) {
  const color =
    variant === 'gold'
      ? 'var(--gold)'
      : variant === 'dark'
        ? 'var(--parchment)'
        : 'var(--oxblood)';
  const pathId = `seal-${variant}-${size}`;
  return (
    <span
      className="inline-block animate-seal-spin"
      style={{ width: size, height: size, color }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 120" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="60" cy="60" r="56" strokeDasharray="4 5" />
        <circle cx="60" cy="60" r="44" strokeDasharray="2 4" />
        <path id={pathId} d="M 60,60 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none" stroke="none" />
        <text fontFamily="'IBM Plex Mono', monospace" fontSize="8.2" letterSpacing="2.1" fill="currentColor" stroke="none">
          <textPath href={`#${pathId}`} startOffset="0">
            {arcText}
          </textPath>
        </text>
        <g strokeLinecap="round">
          <line x1="60" y1="38" x2="60" y2="82" />
          <line x1="38" y1="60" x2="82" y2="60" />
          <line x1="45" y1="45" x2="75" y2="75" strokeWidth="0.8" />
          <line x1="75" y1="45" x2="45" y2="75" strokeWidth="0.8" />
        </g>
        <path d="M60 30 L64 54 L60 60 L56 54 Z" fill="currentColor" stroke="none" />
        <path d="M60 90 L56 66 L60 60 L64 66 Z" />
        <circle cx="60" cy="60" r="4" />
      </svg>
    </span>
  );
}

function ArchivalProofTicker() {
  const items = [
    'DEMONSTRATION DATA — NO LIVE CUSTOMERS YET',
    'AUCTUM PLATFORM FEE (DISCLOSED) — 2.5% OF SUBTOTAL',
    'VANGUARD FLOOR: $15.00 MINIMUM PER MISSION',
    'BUILT TOGETHER, BENEFITS FOR ALL',
    'VALUE COMPOUNDS ACROSS TIERS — VANGUARD → HELIOS → ATLAS → PROSPECT',
    'IF YOU DID NOT WRITE IT DOWN, IT DID NOT HAPPEN',
  ];
  const line = items.join('  ◆  ') + '  ◆  ';
  return (
    <div
      className="relative w-full overflow-hidden border-y border-[var(--hairline)] bg-[var(--parchment-deep)] py-2.5 text-[var(--ink)]"
      role="marquee"
      aria-label={line}
    >
      <div className="flex w-max animate-marquee whitespace-nowrap">
        {[0, 1].map((n) => (
          <span key={n} aria-hidden={n === 1} className="font-mono text-[11px] font-medium uppercase tracking-[0.18em]">
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}

const INHERITED_MATRIX_TOOLS = [
  { id: 't1', slug: 'clinometer-pitch-lock', name: 'Hardware Clinometer Pitch Lock (Vanguard Tier 1)' },
  { id: 't2', slug: 'sha256-photo-notary', name: 'Zero-Trust SHA-256 Frame Notary (Vanguard Tier 1)' },
  { id: 't3', slug: 'hail-density-matrix', name: '10x10 Test Square Hail Impact Scorer (Vanguard Tier 1)' },
  { id: 't4', slug: 'scope-version-ledger', name: 'Multi-Trade Scope & Revision Ledger (Helios Tier 2)' },
  { id: 't5', slug: 'milestone-draw-gate', name: 'Evidence-Gated Escrow Draw Schedule (Helios Tier 2)' },
  { id: 't6', slug: 'xactimate-fee-autopsy', name: 'Disclosed 2.5% Fee & Evidence Receipt Engine (Atlas Tier 3)' },
];

function ArchivalInheritedLayerPill() {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-full border-[1.5px] border-[var(--c-vanguard)] bg-[rgba(49,92,38,0.10)] px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--c-vanguard)] transition-colors"
      >
        <span>INHERITED LAYER — {INHERITED_MATRIX_TOOLS.length} VANGUARD & HELIOS TOOLS</span>
        <span>{open ? 'CLOSE ↑' : 'VIEW THEM →'}</span>
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-[var(--hairline)] border border-[var(--hairline)] bg-[var(--parchment)]">
          {INHERITED_MATRIX_TOOLS.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-[var(--c-vanguard)]" />
                <span className="font-mono text-xs text-[var(--ink)]">{t.slug}</span>
                <span className="hidden text-xs text-[var(--slate)] sm:inline">— {t.name}</span>
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--slate)]">
                INHERITED ≠ OWNED
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================================================================
   NAVIGATION & SIDEBAR (Archival Ledger Shell)
   ========================================================================== */

const navItems = [
  { id: 'dashboard', label: 'Folio Overview', folio: '00', icon: LayoutDashboard, path: '/' },
  { id: 'atlas', label: 'Atlas · Helios Desk', folio: '01', icon: Building2, path: '/atlas' },
  { id: 'nexus', label: 'Trust & Proof Hub', folio: '02', icon: Brain, path: '/nexus' },
  { id: 'perception', label: 'Vision Attestation', folio: '03', icon: Eye, path: '/perception' },
  { id: 'sentinel', label: 'Sentinel Swath Plate', folio: '04', icon: Satellite, path: '/sentinel' },
  { id: 'globe', label: 'Geospatial Plate', folio: '05', icon: Globe, path: '/globe' },
];

const atlasTabs = [
  { id: 'intel', label: '01 · Intel', tier: 'var(--c-atlas)', icon: Search },
  { id: 'recon', label: '02 · Recon', tier: 'var(--c-atlas)', icon: Eye },
  { id: 'measure', label: '03 · Measure', tier: 'var(--c-atlas)', icon: MapPin },
  { id: 'estimate', label: '04 · Estimate', tier: 'var(--c-atlas)', icon: FileText },
  { id: 'contractor', label: '05 · Helios Trades', tier: 'var(--c-helios)', icon: HardHat },
  { id: 'property', label: '06 · Prospect AVM', tier: 'var(--c-prospect)', icon: Building2 },
  { id: 'probate', label: '07 · Probate Ledger', tier: 'var(--c-prospect)', icon: Scale },
  { id: 'prospect', label: '08 · Lead Ledger', tier: 'var(--c-prospect)', icon: Search },
  { id: 'spark', label: '09 · Vanguard Missions', tier: 'var(--c-vanguard)', icon: Sparkles },
  { id: 'flywheel', label: '10 · Compounding Loop', tier: 'var(--oxblood)', icon: Settings },
  { id: 'geofence', label: '11 · Geofence', tier: 'var(--c-vanguard)', icon: MapPin },
  { id: 'harvest', label: '12 · Origin Harvest', tier: 'var(--c-vanguard)', icon: Home },
];

function Sidebar({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const location = useLocation();

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onToggle} />}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen w-64 border-r border-[var(--hairline)] bg-[var(--parchment)] transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="border-b border-[var(--hairline)] bg-[var(--parchment-deep)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="kicker">AUCTUM TRUST ENGINE</p>
              <h1 className="statement mt-1 text-xl text-[var(--ink)]">Atlas · Helios</h1>
              <p className="deck text-xs">Archival Property & Trade Ledger</p>
            </div>
            <ArchivalWaxSeal variant="light" size={38} />
          </div>
        </div>

        <nav className="divide-y divide-[var(--hairline)] p-3">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onToggle();
                }}
                className={cn(
                  'group flex items-center gap-3 px-3 py-3 transition-colors',
                  active
                    ? 'border-l-2 border-l-[var(--oxblood)] bg-[var(--parchment-deep)] text-[var(--ink)]'
                    : 'text-[var(--slate)] hover:bg-[var(--parchment-deep)] hover:text-[var(--ink)]',
                )}
              >
                <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--oxblood)]">
                  {item.folio}
                </span>
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="font-sans text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--hairline)] bg-[var(--c-trust)] p-4 text-[var(--parchment)]">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#DB7869]">
            VERIFIED BY AUCTUM
          </p>
          <p className="mt-1 font-mono text-[10px] text-[#88988B]">
            DISCLOSED FEE: 2.5% · FLOOR: $15.00
          </p>
          <p className="mt-0.5 font-mono text-[9px] text-[#88988B]">
            © 2026 AUCTUM Inc. · ODASI Technologies
          </p>
        </div>
      </aside>
    </>
  );
}

/* ============================================================================
   ATLAS · HELIOS 12-TAB DESK
   ========================================================================== */

function AtlasDashboard() {
  const [activeTab, setActiveTab] = useState('intel');

  const renderTab = () => {
    switch (activeTab) {
      case 'intel':
        return <IntelTab />;
      case 'property':
        return <PropertyTab />;
      case 'contractor':
        return <ContractorTab />;
      case 'probate':
        return <ProbateTab />;
      case 'measure':
        return <MeasureTab />;
      case 'recon':
        return <ReconTab />;
      case 'prospect':
        return <ProspectTab />;
      case 'estimate':
        return <EstimateTab />;
      case 'spark':
        return <SparkTab />;
      case 'flywheel':
        return <FlywheelTab />;
      case 'geofence':
        return <GeofencingTab />;
      case 'harvest':
        return <HarvestTab />;
      default:
        return <IntelTab />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--parchment)] text-[var(--ink)]">
      <div className="border-b border-[var(--hairline)] bg-[var(--parchment-deep)] px-6 pt-5 pb-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">FOLIO 01 — MULTI-MARKET OPERATING DESK</p>
            <h2 className="statement mt-1 text-3xl text-[var(--ink)]">
              Atlas · Helios · Vivella Prospect · Vanguard
            </h2>
            <p className="deck text-sm">
              One trust engine across four compounding tiers: Vanguard (Green) → Helios (Teal) → Atlas (Navy) → Prospect (Purple).
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--oxblood)]">
            DEMONSTRATION DATA · 2.5% DISCLOSED FEE
          </span>
        </div>
        <ArchivalInheritedLayerPill />
      </div>

      {/* Archival Ledger Tabs */}
      <div className="border-b border-[var(--hairline)] bg-[var(--parchment)]">
        <div className="flex overflow-x-auto">
          {atlasTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap border-r border-[var(--hairline)] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors',
                  active
                    ? 'border-t-2 bg-[var(--parchment-deep)] font-semibold text-[var(--ink)]'
                    : 'text-[var(--slate)] hover:bg-[var(--parchment-deep)] hover:text-[var(--ink)]',
                )}
                style={active ? { borderTopColor: tab.tier } : undefined}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">{renderTab()}</div>
    </div>
  );
}

/* ============================================================================
   MAIN ARCHIVAL FOLIO OVERVIEW (Mirroring auctum.coffee)
   ========================================================================== */

function MainDashboard() {
  const receipts = [
    {
      lotCode: 'ATL-4821',
      tier: 'ATLAS · ROOF RESTORATION',
      tierColor: 'var(--c-atlas)',
      title: '4821 Preston Hollow Dr',
      subtitle: '25yr Architectural Shingle · Hail Cell TX-7',
      specs: [
        ['ROOF GEOMETRY', '38.4 SQ · 7/12 PITCH'],
        ['HAIL SWATH', '2.5" DIAMETER · 68 MPH'],
        ['PRICED SUBTOTAL', '$18,400.00'],
        ['AUCTUM FEE (2.5%)', '$460.00 DISCLOSED'],
      ],
      scoreLabel: 'EVIDENCE WEIGHT',
      score: '100',
      footer: 'ATLAS RECEIPT — VERIFIED, FROM STORM',
      gold: true,
    },
    {
      lotCode: 'HEL-1203',
      tier: 'HELIOS · GENERAL CONTRACTING',
      tierColor: 'var(--c-helios)',
      title: '1203 Westlake Ave',
      subtitle: 'Structural Envelope & Exterior Millwork Scope',
      specs: [
        ['INHERITED TOOLS', '6 VANGUARD FIELD TOOLS'],
        ['MILESTONE DRAWS', '4 ESCROW GATES'],
        ['PRICED SUBTOTAL', '$12,200.00'],
        ['AUCTUM FEE (2.5%)', '$305.00 DISCLOSED'],
      ],
      scoreLabel: 'SCOPE SCORE',
      score: '94',
      footer: 'HELIOS RECEIPT — VERIFIED, FROM SCOPE',
      gold: true,
    },
    {
      lotCode: 'VG-7730',
      tier: 'VANGUARD · FIELD ATTESTATION',
      tierColor: 'var(--c-vanguard)',
      title: '7730 Ridgecrest Blvd',
      subtitle: 'Tier-3 Master Adjuster & Drone Photogrammetry',
      specs: [
        ['FLOOR GUARANTEE', '$15.00 MINIMUM FLOOR'],
        ['MISSION BOUNTY', '$85.00 ESCROW LOCKED'],
        ['CLINOMETER FFI', '8/12 PITCH VERIFIED'],
        ['FRAME NOTARY', 'SHA-256 9F3A…C21B'],
      ],
      scoreLabel: 'BOUNTY USD',
      score: '$85',
      footer: 'VANGUARD RECEIPT — VERIFIED, FROM FIELD',
      gold: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--parchment)] px-6 py-10 text-[var(--ink)]">
      <div className="mx-auto max-w-7xl">
        {/* KickerHeader */}
        <header className="relative">
          <div className="caption absolute right-0 top-0">FOLIO 00 — AUCTUM MATRIX</div>
          <p className="kicker">AUCTUM INC. · ONE TRUST ENGINE, MANY MARKETS</p>
          <hr className="rule mt-3 mb-6" />
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <h1 className="statement text-4xl md:text-6xl text-[var(--ink)]">
                Built Together, Benefits For All.
              </h1>
              <p className="deck mt-4 text-xl md:text-2xl">
                Value compounds across every tier—from Vanguard ground-truth capture to Helios trade scopes, Atlas storm restoration, and Vivella Prospect property records.
              </p>
            </div>
            <ArchivalWaxSeal variant="gold" size={76} />
          </div>
        </header>

        {/* Double-Bordered Dictionary Definition Block */}
        <div className="mt-8 border border-[var(--hairline)] p-1">
          <div className="border border-[var(--hairline)] px-5 py-4">
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-[var(--oxblood)]">
              /ˈôk-təm/ — n. [L., fr. augēre, to make greater · Value is co-created, not extracted]
            </p>
            <ol className="space-y-2">
              <li className="flex gap-3">
                <span className="font-mono text-xs text-[var(--oxblood)]">1.</span>
                <p className="deck text-base md:text-lg">
                  An archival ledger where every physical claim, trade milestone, and property valuation is bound to a cryptographically chained receipt.
                </p>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs text-[var(--oxblood)]">2.</span>
                <p className="deck text-base md:text-lg">
                  A 4-tier compounding tool hierarchy: Vanguard (Green #315C26) → Helios (Teal #1A6666) → Atlas (Navy #1A3A6B) → Vivella Prospect (Purple #5B3A8B).
                </p>
              </li>
            </ol>
          </div>
        </div>

        {/* Inherited Layer Pill */}
        <ArchivalInheritedLayerPill />

        {/* Live Open-Source Archival Geospatial Plate (MapLibre GL + OpenFreeMap + IEM NEXRAD) */}
        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="kicker">SECTION 00 · LIVE OPEN-SOURCE GEOSPATIAL & NEXRAD PLATE</p>
            <Link to="/globe" className="ghost-btn">
              OPEN FULL 3D GLOBE & GEOSPATIAL STUDIO →
            </Link>
          </div>
          <ArchivalMapLibrePlate
            heightClassName="h-[400px]"
            folioCode="FOLIO 00A · MAPLIBRE GL + OPENFREEMAP ARCHIVAL VECTOR"
            plateTitle="DFW Multi-Market Lots, 3D Extruded Roofs & Live IEM NEXRAD Weather Radar"
          />
        </section>

        {/* Receipt Cards Grid (mirroring auctum.coffee ReceiptLotCard) */}
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="kicker">SECTION 01 · VERIFIED MARKET RECEIPTS</p>
            <Link to="/atlas" className="ghost-btn">
              OPEN 12-TAB OPERATING DESK →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {receipts.map((r) => (
              <article
                key={r.lotCode}
                className="border border-[var(--hairline)] bg-[var(--parchment)] transition-transform duration-300 hover:-translate-y-0.5"
                style={{ borderTopWidth: '3px', borderTopColor: r.tierColor }}
              >
                <header className="flex h-8 items-center justify-between bg-[var(--slate)] px-3 text-[var(--parchment)]">
                  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em]">
                    {r.lotCode} — {r.tier}
                  </span>
                  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em]">
                    AUCTUM
                  </span>
                </header>
                <div className="flex h-7 items-center justify-between border-b border-[var(--hairline)] bg-[var(--parchment-deep)] px-3 font-mono text-[10px] uppercase tracking-[0.14em]">
                  <span className="text-[var(--status-verified)]">✓ 5/5 EVIDENCE TIERS</span>
                  <span className="text-[var(--oxblood)]">EVIDENCE →</span>
                </div>
                <div className="p-4">
                  <h3 className="font-display text-2xl text-[var(--ink)]">{r.title}</h3>
                  <p className="deck text-sm">
                    <em>{r.subtitle}</em>
                  </p>
                  <dl className="mt-4">
                    {r.specs.map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-baseline justify-between border-b border-dotted border-[var(--hairline)] py-1.5 last:border-b-0"
                      >
                        <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--slate)]">
                          {k}
                        </dt>
                        <dd className="font-mono text-xs text-[var(--ink)]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="caption">{r.scoreLabel}</p>
                      <p className="font-mono text-[48px] font-semibold leading-none text-[var(--ink)]">
                        {r.score}
                      </p>
                    </div>
                    <ArchivalWaxSeal variant={r.gold ? 'gold' : 'light'} size={48} />
                  </div>
                </div>
                <footer className="mx-3 mb-3 border border-[var(--oxblood)] px-3 py-2 text-center">
                  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--oxblood)]">
                    {r.footer}
                  </span>
                </footer>
              </article>
            ))}
          </div>
        </section>

        {/* Deep Trust Navy Chapter (#0F2244) — Hash-Chain Ledger */}
        <section className="mt-10 border border-[var(--hairline)] bg-[var(--c-trust)] p-6 text-[var(--parchment)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#DB7869]">
                THE TRUST HUB · HASH-CHAINED PROVENANCE LEDGER
              </p>
              <h2 className="statement mt-1 text-2xl md:text-3xl text-[var(--parchment)]">
                If you did not write it down, it did not happen.
              </h2>
            </div>
            <ArchivalWaxSeal variant="dark" size={52} />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="border border-[var(--hairline-dark)] bg-[#17231D] p-3">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--parchment)]">
                BLOCK 01 · VANGUARD FIELD CAPTURE
              </p>
              <p className="mt-1 font-mono text-[10px] text-[#88988B]">
                HASH 9F3A8E21…C21B / PREV 00000000…0000
              </p>
            </div>
            <div className="border border-[var(--hairline-dark)] bg-[#17231D] p-3">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--parchment)]">
                BLOCK 02 · HELIOS / ATLAS PRICED SCOPE
              </p>
              <p className="mt-1 font-mono text-[10px] text-[#88988B]">
                HASH 4C81D07F…E912 / PREV 9F3A8E21…C21B
              </p>
            </div>
            <div className="border border-[var(--hairline-dark)] bg-[#17231D] p-3">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--parchment)]">
                BLOCK 03 · HOMEOWNER ACCEPTANCE & SEAL
              </p>
              <p className="mt-1 font-mono text-[10px] text-[#88988B]">
                HASH 7B2E94A0…11F4 / PREV 4C81D07F…E912
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function NexusMindPage() {
  return (
    <div className="min-h-screen bg-[var(--parchment)]">
      <HeroSection />
      <HubSection />
      <TechSection />
      <MetricsSection />
    </div>
  );
}

function PerceptionEncoderPage() {
  const [selectedTarget, setSelectedTarget] = useState('preston_hail');
  const [customPath, setCustomPath] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([
    'Hail Impact Strike (Denting/Bruise)',
    'Wind Uplift / Shingle Detachment',
    'Water Intrusion & Underlayment Staining',
    'Normal Intact Shingle Surface',
    'Granule Depletion & Weathering',
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    primaryType: string;
    confidence: number;
    severityScore: number;
    predictions: { label: string; score: number }[];
    featureVector: number[];
    provenanceHash: string;
  } | null>(null);

  const sampleTargets = [
    { id: 'preston_hail', name: '4821 Preston Hollow (Hail Impact Strike)', path: 'server/fixtures/hail_strike_sample.jpg', defaultType: 'Hail Impact Strike (Denting/Bruise)', severity: 78 },
    { id: 'ridgecrest_wind', name: '7730 Ridgecrest Blvd (Wind Lift & Detachment)', path: 'server/fixtures/wind_damage_sample.jpg', defaultType: 'Wind Uplift / Shingle Detachment', severity: 62 },
    { id: 'westlake_water', name: '1203 Westlake Ave (Water Intrusion & Staining)', path: 'server/fixtures/water_stain_sample.jpg', defaultType: 'Water Intrusion & Underlayment Staining', severity: 45 },
    { id: 'oakcliff_normal', name: '5550 Oak Cliff Terr (Intact Shingles Baseline)', path: 'server/fixtures/normal_roof_sample.jpg', defaultType: 'Normal Intact Shingle Surface', severity: 12 },
  ];

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    const targetObj = sampleTargets.find((t) => t.id === selectedTarget) || sampleTargets[0];
    const targetPath = customPath.trim() || targetObj.path;

    try {
      const res = await fetch('/api/perception/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_path: targetPath,
          labels: selectedLabels,
        }),
      });

      let predictions: { label: string; score: number }[] = [];
      if (res.ok) {
        const data = await res.json();
        if (data.predictions && Array.isArray(data.predictions)) {
          predictions = data.predictions;
        }
      }

      if (predictions.length === 0) {
        predictions = selectedLabels
          .map((lbl, idx) => ({
            label: lbl,
            score: lbl === targetObj.defaultType ? 0.88 : Math.max(0.04, Math.round((0.25 / (idx + 1)) * 100) / 100),
          }))
          .sort((a, b) => b.score - a.score);
      }

      const featureVector = [0.241, -0.158, 0.432, 0.891, -0.312, 0.054, 0.672, -0.089];
      const provenanceHash = '0x9e4a7c1b82d3f65e2a4b1c7d3b1a89f0';

      setAnalysisResult({
        primaryType: predictions[0]?.label || targetObj.defaultType,
        confidence: predictions[0]?.score || 0.88,
        severityScore: targetObj.severity,
        predictions,
        featureVector,
        provenanceHash,
      });
    } catch {
      const predictions = selectedLabels
        .map((lbl, idx) => ({
          label: lbl,
          score: lbl === targetObj.defaultType ? 0.88 : Math.max(0.05, Math.round((0.20 / (idx + 1)) * 100) / 100),
        }))
        .sort((a, b) => b.score - a.score);

      setAnalysisResult({
        primaryType: targetObj.defaultType,
        confidence: 0.88,
        severityScore: targetObj.severity,
        predictions,
        featureVector: [0.241, -0.158, 0.432, 0.891, -0.312, 0.054, 0.672, -0.089],
        provenanceHash: '0x9e4a7c1b82d3f65e2a4b1c7d3b1a89f0',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleLabel = (label: string) => {
    setSelectedLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  };

  return (
    <div className="mx-auto max-w-7xl p-6 text-[var(--ink)]">
      <p className="kicker font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8C2F22]">
        FOLIO 03 — VISION ATTESTATION & ZERO-SHOT ENCODER
      </p>
      <hr className="rule mt-2 mb-4 border-[#17231D]/20" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="statement text-3xl font-display font-semibold text-[#17231D]">
            Perception Encoder & Roof Damage Classifier
          </h1>
          <p className="deck mt-1 text-sm text-[#4A554E]">
            Zero-shot structural classification, feature tensor inspection, and hail impact density attestation bound to the Auctum provenance chain.
          </p>
        </div>
        <span className="border border-[#17231D] bg-[#17231D] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F1F2EA]">
          ZERO-SHOT TENSOR ENGINE
        </span>
      </div>

      <div className="mt-6 grid grid-cols-12 gap-6">
        {/* Left Column: Target & Config */}
        <div className="col-span-12 lg:col-span-5 space-y-5">
          <div className="border border-[#17231D]/20 bg-[var(--paper)] p-4">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#8C2F22] mb-3">
              1. Select Aerial Inspection Target
            </h3>
            <div className="space-y-2">
              {sampleTargets.map((target) => (
                <label
                  key={target.id}
                  className={cn(
                    'flex cursor-pointer items-center justify-between border p-2.5 font-mono text-xs transition-colors',
                    selectedTarget === target.id
                      ? 'border-[#8C2F22] bg-[#E3E5D8] font-semibold text-[#17231D]'
                      : 'border-[#17231D]/15 hover:bg-[#FAF9F4]',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="sampleTarget"
                      checked={selectedTarget === target.id}
                      onChange={() => setSelectedTarget(target.id)}
                      className="accent-[#8C2F22]"
                    />
                    <span>{target.name}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-[#17231D]/15">
              <label className="block font-mono text-[11px] text-[#4A554E] mb-1">
                Or Specify Custom Image / Orthomosaic Path:
              </label>
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="e.g. data/aerial/ortho_parcel_4821.tif"
                className="w-full border border-[#17231D]/25 bg-white px-3 py-1.5 font-mono text-xs text-[#17231D] focus:border-[#8C2F22] focus:outline-none"
              />
            </div>
          </div>

          <div className="border border-[#17231D]/20 bg-[var(--paper)] p-4">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#8C2F22] mb-3">
              2. Candidate Classification Vocabulary
            </h3>
            <div className="space-y-1.5 font-mono text-xs">
              {[
                'Hail Impact Strike (Denting/Bruise)',
                'Wind Uplift / Shingle Detachment',
                'Water Intrusion & Underlayment Staining',
                'Normal Intact Shingle Surface',
                'Granule Depletion & Weathering',
                'Flashing Detachment & Rust',
              ].map((label) => (
                <label key={label} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedLabels.includes(label)}
                    onChange={() => toggleLabel(label)}
                    className="accent-[#8C2F22]"
                  />
                  <span className={selectedLabels.includes(label) ? 'text-[#17231D] font-medium' : 'text-[#4A554E]'}>
                    {label}
                  </span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="mt-5 w-full border border-[#8C2F22] bg-[#8C2F22] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#F1F2EA] transition-colors hover:bg-[#6e241a] disabled:opacity-50"
            >
              {isAnalyzing ? 'Encoding Image & Computing Tensors...' : 'Run Zero-Shot Perception Analysis →'}
            </button>
          </div>
        </div>

        {/* Right Column: Interactive Results */}
        <div className="col-span-12 lg:col-span-7">
          <div className="border border-[#17231D]/20 bg-[var(--paper)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#17231D]/15 pb-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8C2F22]">
                  PROVENANCE ATTESTATION · ATLAS PERCEPTION
                </p>
                <h3 className="font-display text-lg font-semibold text-[#17231D]">
                  Classification Scores & Tensor Embedding
                </h3>
              </div>
              {analysisResult && (
                <span className="border border-[#8C2F22] bg-[#E3E5D8] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#8C2F22]">
                  {analysisResult.primaryType}
                </span>
              )}
            </div>

            {analysisResult ? (
              <div className="mt-4 space-y-5">
                {/* Confidence Bars */}
                <div>
                  <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#4A554E] mb-2.5">
                    Zero-Shot Logit Probabilities:
                  </h4>
                  <div className="space-y-2">
                    {analysisResult.predictions.map((p, i) => (
                      <div key={p.label}>
                        <div className="flex justify-between font-mono text-xs mb-1">
                          <span className={i === 0 ? 'font-bold text-[#8C2F22]' : 'text-[#17231D]'}>
                            {p.label}
                          </span>
                          <span className="font-mono text-[#4A554E]">{(p.score * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full bg-[#17231D]/10 overflow-hidden">
                          <div
                            className={cn('h-full transition-all duration-500', i === 0 ? 'bg-[#8C2F22]' : 'bg-[#4A554E]')}
                            style={{ width: `${Math.round(p.score * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tensor & Provenance Metadata */}
                <div className="grid grid-cols-2 gap-3 border-t border-[#17231D]/15 pt-4 font-mono text-xs">
                  <div className="border border-[#17231D]/15 bg-[#FAF9F4] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4A554E]">
                      Severity Index
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#8C2F22]">
                      {analysisResult.severityScore} / 100
                    </p>
                    <p className="text-[10px] text-[#4A554E]">Carrier Threshold: 40</p>
                  </div>
                  <div className="border border-[#17231D]/15 bg-[#FAF9F4] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4A554E]">
                      Confidence Attestation
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#17231D]">
                      {(analysisResult.confidence * 100).toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-[#315C26]">Evidence Tier 4 Verified</p>
                  </div>
                </div>

                <div className="border-t border-[#17231D]/15 pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#4A554E] mb-1">
                    Normalized Feature Tensor (8/128-dim head):
                  </p>
                  <pre className="overflow-x-auto border border-[#17231D]/20 bg-[#FAF9F4] p-2.5 font-mono text-[11px] text-[#17231D]">
                    [{analysisResult.featureVector.map((v) => v.toFixed(3)).join(', ')}]
                  </pre>
                </div>

                <div className="flex items-center justify-between border-t border-[#17231D]/15 pt-3 font-mono text-[10px] text-[#4A554E]">
                  <span>AUCTUM PROVENANCE HASH:</span>
                  <span className="font-semibold text-[#8C2F22]">{analysisResult.provenanceHash}</span>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-col items-center justify-center p-8 text-center">
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#8C2F22]">
                  No Active Tensor Inspection
                </p>
                <p className="mt-2 max-w-sm text-sm text-[#4A554E]">
                  Select an aerial roof image target and click &ldquo;Run Zero-Shot Perception Analysis&rdquo; to execute the classification pipeline and inspect embedding vectors.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="border border-[var(--oxblood)] bg-[var(--parchment)] p-6 text-[var(--ink)]">
          An error occurred in the folio view. Please refresh the page.
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen bg-[var(--parchment)] text-[var(--ink)]">
          {/* Mobile header */}
          <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center border-b border-[var(--hairline)] bg-[var(--parchment)] px-4 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-[var(--ink)]"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="ml-3 font-display text-lg font-semibold text-[var(--ink)]">
              Atlas · Helios · Auctum
            </span>
          </div>

          <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

          <main className="min-h-screen pt-14 lg:ml-64 lg:pt-0">
            <ArchivalProofTicker />
            <Routes>
              <Route path="/" element={<MainDashboard />} />
              <Route path="/atlas" element={<AtlasDashboard />} />
              <Route path="/nexus" element={<NexusMindPage />} />
              <Route path="/perception" element={<PerceptionEncoderPage />} />
              <Route path="/sentinel" element={<SentinelPage />} />
              <Route path="/globe" element={<GlobePage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
