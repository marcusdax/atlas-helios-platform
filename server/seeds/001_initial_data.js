/**
 * Initial seed data for Atlas Helios Enhanced
 * Populates all tables with TAB_DATA from index.js
 * Uses idempotent .count() checks to avoid duplicates
 */

const TAB_DATA = {
  timeline: [
    { phase: "Inspection", start: 0, duration: 3, status: "complete" },
    { phase: "Estimate Approval", start: 3, duration: 5, status: "complete" },
    { phase: "Permits", start: 8, duration: 7, status: "active" },
    { phase: "Material Delivery", start: 12, duration: 3, status: "pending" },
    { phase: "Tear-off", start: 15, duration: 2, status: "pending" },
    { phase: "Installation", start: 17, duration: 5, status: "pending" },
    { phase: "Final Inspection", start: 22, duration: 2, status: "pending" },
  ],
  lineItems: [
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
  ],
  flywheel: [
    { step: 1, icon: "🐏", title: "Capture & Ingest", desc: "NEXUS SPARK citizens capture raw geospatial data, storms trigger automated satellite re-tasking." },
    { step: 2, icon: "🌐", title: "Process & Analyze", desc: "NEXUS MIND detects anomalies, scores properties 0-100, fuses NOAA + CoreLogic + Aerial layers." },
    { step: 3, icon: "🔍", title: "Refine & Verify", desc: "NEXUS C.O.M.M.S dispatches gig workers for human ground-truth; Remote Expert tier signs off." },
    { step: 4, icon: "💰", title: "Monetize & Deliver", desc: "Verified reports sold to insurers, contractors, REITs via PropertyInsight API. Revenue recycled to verifiers." },
  ],
  intelCards: [
    { label: "Properties Analyzed", val: "124,847", delta: "+2.4%", icon: "🐠", color: "#06b6d4", trend: [65, 68, 72, 75, 78, 82, 85, 88, 91, 94] },
    { label: "AI Confidence Score", val: "96.2%", delta: "+1.1%", icon: "🎮", color: "#fbbf24", trend: [88, 89, 90, 91, 92, 93, 94, 95, 95.5, 96.2] },
    { label: "Damage Prob Score", val: "847", delta: "+38", icon: "⚡", color: "#ef4444", trend: [720, 745, 760, 778, 790, 805, 815, 825, 835, 847] },
    { label: "Revenue Pipeline", val: "$4.2M", delta: "+18%", icon: "💎", color: "#22c55e", trend: [2.8, 3.0, 3.2, 3.4, 3.6, 3.75, 3.9, 4.0, 4.1, 4.2] },
  ],
  roofPlanes: [
    { id: "A", label: "Front Slope", sqft: 1240, pitch: "5/12", color: "rgba(6,182,212,0.3)", border: "#06b6d4", damage: "Moderate" },
    { id: "B", label: "Rear Slope", sqft: 1180, pitch: "5/12", color: "rgba(251,191,36,0.3)", border: "#fbbf24", damage: "Light" },
    { id: "C", label: "Left Hip", sqft: 420, pitch: "5/12", color: "rgba(139,92,246,0.3)", border: "#8b5cf6", damage: "None" },
    { id: "D", label: "Right Hip", sqft: 420, pitch: "5/12", color: "rgba(34,197,94,0.3)", border: "#22c55e", damage: "None" },
    { id: "E", label: "Dormer Front", sqft: 240, pitch: "8/12", color: "rgba(249,115,22,0.3)", border: "#f97316", damage: "Severe" },
    { id: "F", label: "Dormer Rear", sqft: 240, pitch: "8/12", color: "rgba(236,72,153,0.3)", border: "#ec4899", damage: "Moderate" },
  ],
  heirs: [
    { id: 1, name: "James Anderson", relationship: "Son", confidence: 98, status: "Verified", location: "Dallas, TX", contact: "james.a@email.com", claimShare: "25%" },
    { id: 2, name: "Susan Anderson-Brown", relationship: "Daughter", confidence: 98, status: "Verified", location: "Houston, TX", contact: "susan.brown@email.com", claimShare: "25%" },
    { id: 3, name: "Michael Anderson", relationship: "Son", confidence: 87, status: "Pending", location: "Austin, TX", contact: "Unknown", claimShare: "25%" },
    { id: 4, name: "Patricia Anderson-Wilson", relationship: "Daughter", confidence: 94, status: "Verified", location: "San Antonio, TX", contact: "p.wilson@email.com", claimShare: "25%" },
    { id: 5, name: "Robert Anderson Jr.", relationship: "Grandson", confidence: 72, status: "Research", location: "Unknown", contact: "Unknown", claimShare: "Contingent" },
  ],
  valuationHistory: [
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
  ],
  missions: [
    { id: "M-4821", addr: "4821 Preston Hollow Dr", type: "Roof Verification", reward: 20, tier: "T2", status: "open", eta: "0.4mi", difficulty: "Medium" },
    { id: "M-1203", addr: "1203 Westlake Ave", type: "Damage Documentation", reward: 15, tier: "T1", status: "active", eta: "1.2mi", difficulty: "Easy" },
    { id: "M-7730", addr: "7730 Ridgecrest Blvd", type: "Expert Audit (Live)", reward: 85, tier: "T3", status: "open", eta: "2.1mi", difficulty: "Hard" },
    { id: "M-5550", addr: "5550 Oak Cliff Terr", type: "Roof Verification", reward: 20, tier: "T2", status: "complete", eta: "3.0mi", difficulty: "Medium" },
    { id: "M-3400", addr: "3400 Highland Park Dr", type: "3D Scan Capture", reward: 45, tier: "T2", status: "open", eta: "1.8mi", difficulty: "Medium" },
    { id: "M-9020", addr: "902 Mockingbird Ln", type: "Rapid Assessment", reward: 12, tier: "T1", status: "open", eta: "0.9mi", difficulty: "Easy" },
  ],
  storms: [
    { id: 1, name: "Hail Cell TX-7", severity: "critical", hail: "2.5\"", wind: "68mph", lat: 32.7, lng: -97.3, leads: 47, score: 96, time: "2h ago", affectedArea: 1240, properties: 2847 },
    { id: 2, name: "Wind Event OK-3", severity: "high", hail: "1.2\"", wind: "55mph", lat: 35.4, lng: -97.5, leads: 23, score: 78, time: "5h ago", affectedArea: 890, properties: 1523 },
    { id: 3, name: "Storm Front AR-1", severity: "medium", hail: "0.9\"", wind: "42mph", lat: 34.7, lng: -92.3, leads: 11, score: 62, time: "9h ago", affectedArea: 560, properties: 987 },
    { id: 4, name: "Tornado Watch KS-2", severity: "critical", hail: "3.0\"", wind: "85mph", lat: 37.7, lng: -97.3, leads: 89, score: 98, time: "45m ago", affectedArea: 2100, properties: 4521 },
  ],
  properties: [
    { id: 1, address: "123 Main St", city: "Austin", state: "TX", zip_code: "78701", year_built: 1995, square_feet: 2400, roof_type: "asphalt", property_type: "residential", metadata: {"bedrooms": 3, "bathrooms": 2} },
    { id: 2, address: "456 Oak Ave", city: "Houston", state: "TX", zip_code: "77001", year_built: 1987, square_feet: 3200, roof_type: "metal", property_type: "commercial", metadata: {"floor_count": 10, "unit_count": 5} },
  ],
  contractors: [
    { id: 1, name: "Atlas Roofing Inc.", specialty: "Roof Installation", rating: 4.5, projects: 12, location: "Austin, TX", availability: "Available", insurance: "Liability 5M", bond: "Yes", score: 95, bio: "Specializing in residential and commercial roofing", contact_email: "contact@atlasroofing.com", phone: "+1-512-555-0123", verified: true },
    { id: 2, name: "Texas Storm Pros", specialty: "Storm Damage Repair", rating: 4.8, projects: 8, location: "Houston, TX", availability: "Limited", insurance: "Workers Comp + Liab", bond: "Yes", score: 88, bio: "Certified storm damage specialists", contact_email: "info@txstormpros.com", phone: "+1-713-555-0456", verified: true },
    { id: 3, name: "Lone Star Roofing", specialty: "New Construction", rating: 4.3, projects: 16, location: "San Antonio, TX", availability: "Available", insurance: "General Liability", bond: "No", score: 82, bio: "Full-service roofing for new builds", contact_email: "sales@lonestarroofing.com", phone: "+1-210-555-0789", verified: true },
    { id: 4, name: "Capitol City Roofing", specialty: "Commercial Roof Maintenance", rating: 4.2, projects: 10, location: "Austin, TX", availability: "Available", insurance: "Liability 2M", bond: "Yes", score: 78, bio: "Specialized in commercial flat roof maintenance", contact_email: "jobs@ccroofing.com", phone: "+1-512-555-9012", verified: true },
    { id: 5, name: "Western Hills Contractors", specialty: "Historic Home Restoration", rating: 4.9, projects: 6, location: "Dallas, TX", availability: "Seasonal", insurance: "Full Coverage", bond: "Yes", score: 73, bio: "Expertise in older home roofing systems", contact_email: "admin@whcontractors.com", phone: "+1-214-555-0345", verified: true },
  ],
  probate_cases: [
    { id: 1, case_number: "PB-2023-0142", decedent: "Margaret Thompson", status: "Open", progress: 45, notes: "Estate includes residential property in Austin, TX" },
    { id: 2, case_number: "PB-2023-0087", decedent: "James Anderson", status: "Closed", progress: 100, notes: "Estate finalized 2023, assets include commercial building" },
    { id: 3, case_number: "PB-2023-1291", decedent: "Mary Rodriguez", status: "In Progress", progress: 60, notes: "Complex inheritance with multiple heirs" },
    { id: 4, case_number: "PB-2023-0915", decedent: "Robert Chen", status: "Open", progress: 30, notes: "Estate includes multiple residential properties" },
    { id: 5, case_number: "PB-2023-0423", decedent: "Susan Martinez", status: "Pending", progress: 15, notes: "Waiting on appraisal of estate assets" },
  ],
  leads: [
    { id: 1, addr: "4821 Preston Hollow Dr", score: 97, roof: "25yr Arch Shingle", sqft: 3840, status: "Uncontacted", val: "$18,400", lat: 32.7767, lng: -96.7970, damageType: "Hail Impact", lastContact: null },
    { id: 2, addr: "1203 Westlake Ave", score: 94, roof: "22yr 3-Tab", sqft: 2940, status: "Contacted", val: "$12,200", lat: 32.7901, lng: -96.8023, damageType: "Wind Lift", lastContact: "2d ago" },
    { id: 3, addr: "7730 Ridgecrest Blvd", score: 91, roof: "18yr Arch Shingle", sqft: 3120, status: "Inspecting", val: "$14,800", lat: 32.7654, lng: -96.7856, damageType: "Hail + Wind", lastContact: "5h ago" },
    { id: 4, addr: "902 Mockingbird Ln", score: 88, roof: "15yr Metal", sqft: 2200, status: "Uncontacted", val: "$9,600", lat: 32.7823, lng: -96.8123, damageType: "Denting", lastContact: null },
    { id: 5, addr: "5550 Oak Cliff Terr", score: 85, roof: "28yr 3-Tab", sqft: 1980, status: "Won", val: "$11,300", lat: 32.7432, lng: -96.8234, damageType: "Age + Storm", lastContact: "1w ago" },
    { id: 6, addr: "3400 Highland Park Dr", score: 93, roof: "20yr Clay Tile", sqft: 4560, status: "Contacted", val: "$22,100", lat: 32.7987, lng: -96.7890, damageType: "Cracked Tiles", lastContact: "1d ago" },
  ],
};

const seed = async (knexInstance) => {
  const { config } = require('../config/database');
  const knex = knexInstance || require('knex')(config.development);
  const isEmpty = async (table) => {
    const rows = await knex(table).count('* as count');
    return Number(rows[0].count) === 0;
  };
  
  console.log('Starting seed...');
  
  // Missions
  if (await isEmpty('missions')) {
    console.log('Seeding missions...');
    await knex('missions').insert(TAB_DATA.missions.map(m => ({
      id: m.id,
      addr: m.addr,
      type: m.type,
      reward: m.reward,
      tier: m.tier,
      status: m.status,
      eta: m.eta,
      difficulty: m.difficulty
    })));
  } else {
    console.log('Missions already seeded');
  }
  
  // Roof planes (inserted into measurements table since roof_planes doesn't exist)
  if (await isEmpty('measurements')) {
    console.log('Seeding measurements (roof planes)...');
    await knex('measurements').insert(TAB_DATA.roofPlanes.map(p => ({
      estimate_id: null,
      label: p.label,
      sqft: p.sqft,
      pitch: p.pitch,
      area: p.sqft,
      length: null,
      width: null,
      height: null,
      notes: 'Seeded roof plane',
      color: p.color,
      border: p.border,
      damage: p.damage,
      created_at: new Date().toISOString()
    })));
  } else {
    console.log('Measurements already seeded');
  }
  
  // Line items
  if (await isEmpty('estimate_line_items')) {
    console.log('Seeding line items...');
    await knex('estimate_line_items').insert(TAB_DATA.lineItems.map(li => ({
      code: li.code,
      desc: li.desc,
      qty: li.qty,
      unit: li.unit,
      price: li.price,
      total: li.total,
      category: li.category
    })));
  } else {
    console.log('Line items already seeded');
  }
  
  // Heirs
  if (await isEmpty('heirs')) {
    console.log('Seeding heirs...');
    await knex('heirs').insert(TAB_DATA.heirs.map(h => ({
      id: h.id,
      name: h.name,
      relationship: h.relationship,
      confidence: h.confidence,
      status: h.status,
      location: h.location,
      contact: h.contact,
      claimShare: parseFloat(h.claimShare) || 0
    })));
  } else {
    console.log('Heirs already seeded');
  }
  
  // Property valuation history
  if (await isEmpty('property_valuation_history')) {
    console.log('Seeding property valuation history...');
    await knex('property_valuation_history').insert(TAB_DATA.valuationHistory.map(v => ({
      month: v.month,
      value: v.value,
      low: v.low,
      high: v.high
    })));
  } else {
    console.log('Property valuation history already seeded');
  }
  
  // Intel cards
  if (await isEmpty('intel_cards')) {
    console.log('Seeding intel cards...');
    await knex('intel_cards').insert(TAB_DATA.intelCards.map(ic => ({
      label: ic.label,
      value: ic.val,
      delta: parseFloat(ic.delta) || 0,
      icon: ic.icon,
      color: ic.color,
      trend: JSON.stringify(ic.trend)
    })));
  } else {
    console.log('Intel cards already seeded');
  }
  
  // Storms
  console.log('Ensuring storms are populated with non-null coordinates and data...');
  for (const s of TAB_DATA.storms) {
    const existing = await knex('storms').where('id', s.id).first();
    if (existing) {
      await knex('storms').where('id', s.id).update({
        name: s.name,
        severity: s.severity,
        hail: s.hail,
        wind: s.wind,
        lat: s.lat,
        lng: s.lng,
        leads: s.leads,
        score: s.score,
        time: s.time,
        affected_area: s.affectedArea,
        properties: s.properties
      });
    } else {
      await knex('storms').insert({
        id: s.id,
        storm_id: `STORM-${s.id}`,
        type: 'hail',
        name: s.name,
        severity: s.severity,
        hail: s.hail,
        wind: s.wind,
        lat: s.lat,
        lng: s.lng,
        leads: s.leads,
        score: s.score,
        time: s.time,
        affected_area: s.affectedArea,
        properties: s.properties
      });
    }
  }
  
  // Leads
  if (await isEmpty('leads')) {
    console.log('Seeding leads...');
    await knex('leads').insert(TAB_DATA.leads.map(l => ({
      id: l.id,
      address: l.addr,
      score: l.score,
      roof: l.roof,
      sqft: l.sqft,
      status: l.status,
      value: l.val,
      lat: l.lat,
      lng: l.lng,
      damage_type: l.damageType,
      last_contact: l.lastContact
    })));
  } else {
    console.log('Leads already seeded');
  }
  
  // Flywheel
  if (await isEmpty('flywheel')) {
    console.log('Seeding flywheel...');
    await knex('flywheel').insert(TAB_DATA.flywheel.map(f => ({
      step_order: f.step,
      icon: f.icon,
      step_name: f.title,
      description: f.desc
    })));
  } else {
    console.log('Flywheel already seeded');
  }
  
  // Timeline
  if (await isEmpty('project_timeline')) {
    console.log('Seeding timeline...');
    await knex('project_timeline').insert(TAB_DATA.timeline.map(t => ({
      phase: t.phase,
      start: t.start,
      duration: t.duration,
      status: t.status
    })));
  } else {
    console.log('Timeline already seeded');
  }
  
  // Properties
  if (await isEmpty('properties')) {
    console.log('Seeding properties...');
    await knex('properties').insert(TAB_DATA.properties.map(p => ({
      id: p.id,
      address: p.address,
      city: p.city,
      state: p.state,
      zip_code: p.zip_code,
      year_built: p.year_built,
      square_feet: p.square_feet,
      roof_type: p.roof_type,
      property_type: p.property_type,
      metadata: p.metadata
    })));
  } else {
    console.log('Properties already seeded');
  }
  
  // Contractors
  if (await isEmpty('contractors')) {
    console.log('Seeding contractors...');
    await knex('contractors').insert(TAB_DATA.contractors.map(c => ({
      id: c.id,
      name: c.name,
      specialty: c.specialty,
      rating: c.rating,
      projects: c.projects,
      location: c.location,
      availability: c.availability,
      insurance: c.insurance,
      bond: c.bond,
      score: c.score,
      bio: c.bio,
      contact_email: c.contact_email,
      phone: c.phone,
      verified: c.verified
    })));
  } else {
    console.log('Contractors already seeded');
  }
  
  // Probate cases
  if (await isEmpty('probate_cases')) {
    console.log('Seeding probate_cases...');
    await knex('probate_cases').insert(TAB_DATA.probate_cases.map(pc => ({
      id: pc.id,
      case_number: pc.case_number,
      decedent: pc.decedent,
      status: pc.status,
      progress: pc.progress,
      notes: pc.notes
    })));
  } else {
    console.log('Probate cases already seeded');
  }
  
  console.log('Seed complete!');
};

exports.seed = seed;

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}