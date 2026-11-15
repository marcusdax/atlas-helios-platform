// ============================================================================
// DATA CONSTANTS FOR ATLAS-HELIOS PLATFORM
// ============================================================================

export const NAV = [
  { id: "recon", icon: "🛰️", label: "Recon", desc: "Storm Intelligence" },
  { id: "measure", icon: "📐", label: "Measure", desc: "Property Assessment" },
  { id: "estimate", icon: "📋", label: "Estimate", desc: "Xactimate Engine" },
  { id: "probate", icon: "⚖️", label: "Probate", desc: "Estate Administration" },
  { id: "property", icon: "🏢", label: "Property", desc: "Intelligence & AVM" },
  { id: "contractor", icon: "👷", label: "Contractor", desc: "Performance & Scheduling" },
  { id: "prospect", icon: "🎯", label: "Prospect", desc: "Lead Engine" },
  { id: "spark", icon: "⚡", label: "Spark", desc: "Gig Economy" },
  { id: "flywheel", icon: "🔄", label: "Flywheel", desc: "Data Ecosystem" },
  { id: "intel", icon: "🧠", label: "Intelligence", desc: "Command Center" },
];

export const STORMS = [
  { id: 1, name: "Hail Cell TX-7", severity: "critical", hail: "2.5\"", wind: "68mph", lat: 32.7, lng: -97.3, leads: 47, score: 96, time: "2h ago", affectedArea: 1240, properties: 2847 },
  { id: 2, name: "Wind Event OK-3", severity: "high", hail: "1.2\"", wind: "55mph", lat: 35.4, lng: -97.5, leads: 23, score: 78, time: "5h ago", affectedArea: 890, properties: 1523 },
  { id: 3, name: "Storm Front AR-1", severity: "medium", hail: "0.9\"", wind: "42mph", lat: 34.7, lng: -92.3, leads: 11, score: 62, time: "9h ago", affectedArea: 560, properties: 987 },
  { id: 4, name: "Tornado Watch KS-2", severity: "critical", hail: "3.0\"", wind: "85mph", lat: 37.7, lng: -97.3, leads: 89, score: 98, time: "45m ago", affectedArea: 2100, properties: 4521 },
];

export const LEADS = [
  { id: 1, addr: "4821 Preston Hollow Dr", score: 97, roof: "25yr Arch Shingle", sqft: 3840, status: "Uncontacted", val: "$18,400", lat: 32.7767, lng: -96.7970, damageType: "Hail Impact", lastContact: null },
  { id: 2, addr: "1203 Westlake Ave", score: 94, roof: "22yr 3-Tab", sqft: 2940, status: "Contacted", val: "$12,200", lat: 32.7901, lng: -96.8023, damageType: "Wind Lift", lastContact: "2d ago" },
  { id: 3, addr: "7730 Ridgecrest Blvd", score: 91, roof: "18yr Arch Shingle", sqft: 3120, status: "Inspecting", val: "$14,800", lat: 32.7654, lng: -96.7856, damageType: "Hail + Wind", lastContact: "5h ago" },
  { id: 4, addr: "902 Mockingbird Ln", score: 88, roof: "15yr Metal", sqft: 2200, status: "Uncontacted", val: "$9,600", lat: 32.7823, lng: -96.8123, damageType: "Denting", lastContact: null },
  { id: 5, addr: "5550 Oak Cliff Terr", score: 85, roof: "28yr 3-Tab", sqft: 1980, status: "Won", val: "$11,300", lat: 32.7432, lng: -96.8234, damageType: "Age + Storm", lastContact: "1w ago" },
  { id: 6, addr: "3400 Highland Park Dr", score: 93, roof: "20yr Clay Tile", sqft: 4560, status: "Contacted", val: "$22,100", lat: 32.7987, lng: -96.7890, damageType: "Cracked Tiles", lastContact: "1d ago" },
];

export const LINE_ITEMS = [
  { code: "RFG-240", desc: "Laminated Architectural Shingle (30yr)", qty: 38.4, unit: "SQ", price: 142, total: 5452.80, category: "Roofing" },
  { code: "RFG-102", desc: "#15 Synthetic Felt Underlayment", qty: 38.4, unit: "SQ", price: 18, total: 691.20, category: "Underlayment" },
  { code: "RFG-310", desc: "Ice & Water Shield (First 6\")", qty: 180, unit: "LF", price: 4.20, total: 756.00, category: "Waterproofing" },
  { code: "RFG-415", desc: "Ridge Cap Shingles", qty: 120, unit: "LF", price: 6.80, total: 816.00, category: "Roofing" },
  { code: "RFG-501", desc: "Drip Edge – Aluminum (2x4)", qty: 210, unit: "LF", price: 2.10, total: 441.00, category: "Flashing" },
  { code: "RFG-610", desc: "Remove & Haul – Existing Shingles", qty: 38.4, unit: "SQ", price: 55, total: 2112.00, category: "Labor" },
  { code: "GEN-101", desc: "Dumpster / Debris Removal", qty: 1, unit: "EA", price: 380, total: 380.00, category: "General" },
  { code: "GEN-205", desc: "Permits & Admin", qty: 1, unit: "EA", price: 250, total: 250.00, category: "General" },
  { code: "RFG-720", desc: "Chimney Flashing Replacement", qty: 1, unit: "EA", price: 485, total: 485.00, category: "Flashing" },
  { code: "RFG-830", desc: "Skylight Seal & Flashing", qty: 2, unit: "EA", price: 320, total: 640.00, category: "Flashing" },
];

export const MISSIONS = [
  { id: "M-4821", addr: "4821 Preston Hollow Dr", type: "Roof Verification", reward: 20, tier: "T2", status: "open", eta: "0.4mi", difficulty: "Medium" },
  { id: "M-1203", addr: "1203 Westlake Ave", type: "Damage Documentation", reward: 15, tier: "T1", status: "active", eta: "1.2mi", difficulty: "Easy" },
  { id: "M-7730", addr: "7730 Ridgecrest Blvd", type: "Expert Audit (Live)", reward: 85, tier: "T3", status: "open", eta: "2.1mi", difficulty: "Hard" },
  { id: "M-5550", addr: "5550 Oak Cliff Terr", type: "Roof Verification", reward: 20, tier: "T2", status: "complete", eta: "3.0mi", difficulty: "Medium" },
  { id: "M-3400", addr: "3400 Highland Park Dr", type: "3D Scan Capture", reward: 45, tier: "T2", status: "open", eta: "1.8mi", difficulty: "Medium" },
  { id: "M-9020", addr: "902 Mockingbird Ln", type: "Rapid Assessment", reward: 12, tier: "T1", status: "open", eta: "0.9mi", difficulty: "Easy" },
];

export const FLYWHEEL = [
  { step: 1, icon: "🛰️", title: "Capture & Ingest", desc: "NEXUS SPARK citizens capture raw geospatial data, storms trigger automated satellite re-tasking." },
  { step: 2, icon: "🧠", title: "Process & Analyze", desc: "NEXUS MIND detects anomalies, scores properties 0-100, fuses NOAA + CoreLogic + Aerial layers." },
  { step: 3, icon: "🔍", title: "Refine & Verify", desc: "NEXUS C.O.M.M.S dispatches gig workers for human ground-truth; Remote Expert tier signs off." },
  { step: 4, icon: "💰", title: "Monetize & Deliver", desc: "Verified reports sold to insurers, contractors, REITs via PropertyInsight API. Revenue recycled to verifiers." },
];

export const INTEL_CARDS = [
  { label: "Properties Analyzed", val: "124,847", delta: "+2.4%", icon: "🏠", color: "#06b6d4", trend: [65, 68, 72, 75, 78, 82, 85, 88, 91, 94] },
  { label: "AI Confidence Score", val: "96.2%", delta: "+1.1%", icon: "🎯", color: "#fbbf24", trend: [88, 89, 90, 91, 92, 93, 94, 95, 95.5, 96.2] },
  { label: "Damage Prob Score", val: "847", delta: "+38", icon: "⚡", color: "#ef4444", trend: [720, 745, 760, 778, 790, 805, 815, 825, 835, 847] },
  { label: "Revenue Pipeline", val: "$4.2M", delta: "+18%", icon: "💎", color: "#22c55e", trend: [2.8, 3.0, 3.2, 3.4, 3.6, 3.75, 3.9, 4.0, 4.1, 4.2] },
];

export const ROOF_PLANES = [
  { id: "A", label: "Front Slope", sqft: 1240, pitch: "5/12", color: "rgba(6,182,212,0.3)", border: "#06b6d4", damage: "Moderate" },
  { id: "B", label: "Rear Slope", sqft: 1180, pitch: "5/12", color: "rgba(251,191,36,0.3)", border: "#fbbf24", damage: "Light" },
  { id: "C", label: "Left Hip", sqft: 420, pitch: "5/12", color: "rgba(139,92,246,0.3)", border: "#8b5cf6", damage: "None" },
  { id: "D", label: "Right Hip", sqft: 420, pitch: "5/12", color: "rgba(34,197,94,0.3)", border: "#22c55e", damage: "None" },
  { id: "E", label: "Dormer Front", sqft: 240, pitch: "8/12", color: "rgba(249,115,22,0.3)", border: "#f97316", damage: "Severe" },
  { id: "F", label: "Dormer Rear", sqft: 240, pitch: "8/12", color: "rgba(236,72,153,0.3)", border: "#ec4899", damage: "Moderate" },
];

// Probate Module Data
export const PROBATE_CASES = [
  { id: "EST-2024-001", decedent: "Robert J. Anderson", dateOfDeath: "2024-01-15", status: "Active", complexity: "High", heirs: 7, properties: 4, assets: "$2.4M", progress: 65, attorney: "Sarah Mitchell" },
  { id: "EST-2024-002", decedent: "Margaret L. Chen", dateOfDeath: "2024-02-03", status: "Heir Search", complexity: "Medium", heirs: 3, properties: 2, assets: "$890K", progress: 35, attorney: "David Park" },
  { id: "EST-2024-003", decedent: "William T. Henderson", dateOfDeath: "2024-01-28", status: "Asset Discovery", complexity: "Critical", heirs: 12, properties: 8, assets: "$5.7M", progress: 20, attorney: "Jennifer Walsh" },
  { id: "EST-2024-004", decedent: "Dorothy K. Martinez", dateOfDeath: "2024-03-01", status: "Distribution", complexity: "Low", heirs: 2, properties: 1, assets: "$425K", progress: 85, attorney: "Michael Torres" },
];

export const HEIR_DATA = [
  { id: 1, name: "James Anderson", relationship: "Son", confidence: 98, status: "Verified", location: "Dallas, TX", contact: "james.a@email.com", claimShare: "25%" },
  { id: 2, name: "Susan Anderson-Brown", relationship: "Daughter", confidence: 98, status: "Verified", location: "Houston, TX", contact: "susan.brown@email.com", claimShare: "25%" },
  { id: 3, name: "Michael Anderson", relationship: "Son", confidence: 87, status: "Pending", location: "Austin, TX", contact: "Unknown", claimShare: "25%" },
  { id: 4, name: "Patricia Anderson-Wilson", relationship: "Daughter", confidence: 94, status: "Verified", location: "San Antonio, TX", contact: "p.wilson@email.com", claimShare: "25%" },
  { id: 5, name: "Robert Anderson Jr.", relationship: "Grandson", confidence: 72, status: "Research", location: "Unknown", contact: "Unknown", claimShare: "Contingent" },
];

// Property Intelligence Data
export const PORTFOLIO_PROPERTIES = [
  { id: "P-001", address: "4821 Preston Hollow Dr", type: "Residential", value: "$1.2M", avmConfidence: 94, lastInspection: "2024-01-15", condition: "Good", riskScore: 23, lat: 32.7767, lng: -96.7970 },
  { id: "P-002", address: "1203 Westlake Ave", type: "Residential", value: "$890K", avmConfidence: 91, lastInspection: "2024-02-01", condition: "Fair", riskScore: 45, lat: 32.7901, lng: -96.8023 },
  { id: "P-003", address: "7730 Ridgecrest Blvd", type: "Residential", value: "$1.5M", avmConfidence: 96, lastInspection: "2024-01-28", condition: "Excellent", riskScore: 15, lat: 32.7654, lng: -96.7856 },
  { id: "P-004", address: "5550 Oak Cliff Terr", type: "Multi-Family", value: "$2.1M", avmConfidence: 88, lastInspection: "2023-12-10", condition: "Fair", riskScore: 52, lat: 32.7432, lng: -96.8234 },
];

export const VALUATION_HISTORY = [
  { month: "Jan", value: 1.18, low: 1.12, high: 1.24 },
  { month: "Feb", value: 1.21, low: 1.15, high: 1.27 },
  { month: "Mar", value: 1.19, low: 1.13, high: 1.25 },
  { month: "Apr", value: 1.23, low: 1.17, high: 1.29 },
  { month: "May", value: 1.26, low: 1.20, high: 1.32 },
  { month: "Jun", value: 1.28, low: 1.22, high: 1.34 },
  { month: "Jul", value: 1.31, low: 1.25, high: 1.37 },
  { month: "Aug", value: 1.33, low: 1.27, high: 1.39 },
  { month: "Sep", value: 1.30, low: 1.24, high: 1.36 },
  { month: "Oct", value: 1.27, low: 1.21, high: 1.33 },
  { month: "Nov", value: 1.25, low: 1.19, high: 1.31 },
  { month: "Dec", value: 1.29, low: 1.23, high: 1.35 },
];

// Contractor Data
export const CONTRACTORS = [
  { id: "C-001", name: "Elite Roofing Solutions", rating: 4.8, projects: 247, specialty: "Residential Roofing", location: "Dallas, TX", availability: "2 weeks", insurance: "$2M", bond: "$500K", score: 96 },
  { id: "C-002", name: "Premier Restoration Group", rating: 4.6, projects: 189, specialty: "Storm Damage", location: "Plano, TX", availability: "1 week", insurance: "$5M", bond: "$1M", score: 92 },
  { id: "C-003", name: "Heritage Roofing & Construction", rating: 4.9, projects: 312, specialty: "Historic Preservation", location: "Fort Worth, TX", availability: "3 weeks", insurance: "$3M", bond: "$750K", score: 94 },
  { id: "C-004", name: "Atlas Commercial Roofing", rating: 4.5, projects: 156, specialty: "Commercial", location: "Dallas, TX", availability: "Immediate", insurance: "$10M", bond: "$2M", score: 89 },
];

export const PROJECT_TIMELINE = [
  { phase: "Inspection", start: 0, duration: 3, status: "complete" },
  { phase: "Estimate Approval", start: 3, duration: 5, status: "complete" },
  { phase: "Permits", start: 8, duration: 7, status: "active" },
  { phase: "Material Delivery", start: 12, duration: 3, status: "pending" },
  { phase: "Tear-off", start: 15, duration: 2, status: "pending" },
  { phase: "Installation", start: 17, duration: 5, status: "pending" },
  { phase: "Final Inspection", start: 22, duration: 2, status: "pending" },
];
