/**
 * Test Fixtures for Atlas & Helios E2E Test Suite
 * Canonical coordinates, storm scenarios, roof facet geometries, and takeoff constants.
 */

export const FIXTURES = {
  // Standard Geographic Coordinates (Severe weather corridor & key metros)
  coordinates: {
    dallas: {
      name: 'Dallas, TX',
      lat: 32.7767,
      lng: -96.7970,
      state: 'TX',
      zone: 'TXZ119'
    },
    oklahomaCity: {
      name: 'Oklahoma City, OK',
      lat: 35.4676,
      lng: -97.5164,
      state: 'OK',
      zone: 'OKZ025'
    },
    denver: {
      name: 'Denver, CO',
      lat: 39.7392,
      lng: -104.9903,
      state: 'CO',
      zone: 'COZ039'
    },
    miami: {
      name: 'Miami, FL',
      lat: 25.7617,
      lng: -80.1918,
      state: 'FL',
      zone: 'FLZ073'
    }
  },

  // Mock Storm Events for Recon Intelligence
  storms: [
    {
      id: 'storm-2026-hail-dallas',
      name: 'Supercell Hailstorm Dallas Metro',
      severity: 'severe',
      hail: '2.50"',
      wind: '72 mph',
      lat: 32.7767,
      lng: -96.7970,
      score: 94,
      leads: 185,
      affectedArea: '45.2 sq mi',
      properties: 2450
    },
    {
      id: 'storm-2026-wind-okc',
      name: 'Derecho Wind Event OKC',
      severity: 'high',
      hail: '1.25"',
      wind: '85 mph',
      lat: 35.4676,
      lng: -97.5164,
      score: 88,
      leads: 142,
      affectedArea: '78.6 sq mi',
      properties: 3120
    }
  ],

  // AI Bidwright Roof Parameters & Formulas
  roof: {
    standardFacet: {
      id: 'facet-01',
      label: 'Main South Gable',
      flatAreaSqft: 1850,
      pitchRise: 6,
      pitchRun: 12, // 6/12 pitch
      facetSchedule: '2D/3D',
      wasteFactor: 0.12 // 12% industry waste
    },
    steepFacet: {
      id: 'facet-02',
      label: 'Dormer West Hip',
      flatAreaSqft: 650,
      pitchRise: 9,
      pitchRun: 12, // 9/12 steep pitch
      facetSchedule: '3D',
      wasteFactor: 0.15 // 15% complex roof waste
    },
    // Multipliers derived from mathematical formula: sqrt(1 + (rise/run)^2)
    multipliers: {
      '4/12': 1.05409,
      '6/12': 1.11803,
      '8/12': 1.20185,
      '9/12': 1.25000,
      '12/12': 1.41421
    }
  },

  // Carrier-Compliant Estimating Ledger Constants
  estimating: {
    overheadRate: 0.10, // 10% O&P Overhead
    profitRate: 0.10,   // 10% O&P Profit
    auctumFeeRate: 0.025, // 2.5% Auctum platform transaction fee
    masterFormatDivision: '07 - Thermal and Moisture Protection',
    standardLineItems: [
      { code: 'RFG-SHG-ARCH', desc: 'Architectural Laminated Shingles - 30yr', unit: 'SQ', unitPrice: 195.00, category: 'Roofing' },
      { code: 'RFG-UND-SYN', desc: 'Synthetic Roof Underlayment (1000 sqft/roll)', unit: 'SQ', unitPrice: 32.50, category: 'Underlayment' },
      { code: 'RFG-ICE-WTR', desc: 'Self-Adhering Ice & Water Barrier Shield', unit: 'SQ', unitPrice: 68.00, category: 'Protection' },
      { code: 'RFG-DRP-EDG', desc: 'Aluminum Drip Edge 1.5" x 1.5"', unit: 'LF', unitPrice: 2.85, category: 'Flashing' },
      { code: 'RFG-DSP-TEAR', desc: 'Tear Off Shingle Roof & Haul Disposal', unit: 'SQ', unitPrice: 48.00, category: 'Labor & Disposal' }
    ]
  },

  // HomeHarvest MLS Search Queries
  mlsSearch: {
    validLocation: {
      location: 'Dallas, TX',
      radius: 5,
      limit: 10,
      listing_type: 'for_sale'
    },
    validCoords: {
      lat: 32.7767,
      lon: -96.7970,
      radius: 3,
      limit: 5,
      listing_type: 'for_sale'
    },
    mockMlsId: 'MLS-DAL-7892104'
  },

  // Computer Vision & Perception Models
  perception: {
    damageLabels: [
      'severe_hail_impact',
      'wind_uplift_creased_shingles',
      'missing_shingles_exposed_felt',
      'granule_loss_accelerated',
      'normal_weathering_undamaged'
    ],
    sampleVisionConfigs: [
      'PE-Core-G14-448',
      'PE-Core-L14-336',
      'PE-Core-B16-224',
      'PE-Core-S16-384',
      'PE-Core-T16-384'
    ],
    sampleSpatialConfigs: [
      'PE-Spatial-G14-448',
      'PE-Spatial-L14-448',
      'PE-Spatial-B16-512',
      'PE-Spatial-S16-512',
      'PE-Spatial-T16-512'
    ]
  },

  // Sentinel-2 STAC Query Parameters
  sentinel: {
    bboxDallas: [-96.90, 32.70, -96.70, 32.85],
    datetimeRange: '2026-01-01T00:00:00Z/2026-04-01T23:59:59Z',
    collection: 'sentinel-2-l2a',
    maxCloudCover: 20
  },

  // Radar Tile Layer Configuration
  radar: {
    iemTileUrlTemplate: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',
    validTileCoordinates: { z: 6, x: 15, y: 25 }
  }
};

/**
 * Mathematical domain helper functions for takeoff and estimate assertions
 */
export function calculatePitchMultiplier(rise, run = 12) {
  return Math.sqrt(1 + Math.pow(rise / run, 2));
}

export function calculateTrueSurfaceArea(flatArea, rise, run = 12) {
  const multiplier = calculatePitchMultiplier(rise, run);
  return flatArea * multiplier;
}

export function calculateRoofSquares(surfaceArea, wasteFactor = 0.12) {
  const totalWithWaste = surfaceArea * (1 + wasteFactor);
  return Math.ceil(totalWithWaste / 100);
}

export function calculateEstimateSummary(baseTotal, overheadRate = 0.10, profitRate = 0.10, auctumFeeRate = 0.025) {
  const overheadAmount = baseTotal * overheadRate;
  const profitAmount = baseTotal * profitRate;
  const subtotalWithOP = baseTotal + overheadAmount + profitAmount;
  const auctumFee = subtotalWithOP * auctumFeeRate;
  const grandTotal = subtotalWithOP + auctumFee;

  return {
    baseTotal: Math.round(baseTotal * 100) / 100,
    overheadAmount: Math.round(overheadAmount * 100) / 100,
    profitAmount: Math.round(profitAmount * 100) / 100,
    subtotalWithOP: Math.round(subtotalWithOP * 100) / 100,
    auctumFee: Math.round(auctumFee * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100
  };
}
