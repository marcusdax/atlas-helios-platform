'use strict';

const { invalid } = require('../errors');

/**
 * Industry presets.
 *
 * The single biggest quality lever in a before/after renderer is not the model,
 * it is how tightly the prompt is constrained. An unconstrained "make it nicer"
 * prompt returns a *different house*, which reads as a lie to a homeowner and
 * kills the conversion the render exists to produce. Each preset therefore
 * carries: the surface that may change, the surfaces that must not, and the ROI
 * framing a salesperson can defend.
 *
 * `roiBasis` values are industry cost-vs-value ranges used as prompt context,
 * not quoted figures — the copy layer is told to present them as estimates.
 */
const PRESETS = [
  {
    id: 'garage-doors',
    label: 'Garage Doors',
    target: 'the garage door and its immediate trim',
    preserve: ['roofline', 'siding', 'windows', 'driveway', 'landscaping'],
    cues: [
      'modern insulated panel design',
      'clean hardware and consistent panel shadow lines',
      'accurate reflection of ambient light on the door face'
    ],
    roiBasis: 'garage door replacement typically recovers 90-190% of cost at resale and is among the highest-ROI exterior changes'
  },
  {
    id: 'roofing',
    label: 'Roofing',
    target: 'the roof surface, ridge line, and visible flashing',
    preserve: ['walls', 'windows', 'doors', 'gutters position', 'trees and sky'],
    cues: [
      'uniform architectural shingle courses following the existing roof planes',
      'straight ridge and hip lines',
      'no change to roof pitch, dormer placement, or chimney position'
    ],
    roiBasis: 'asphalt roof replacement typically recovers 55-70% of cost at resale, with insurability and leak-risk reduction as the larger driver'
  },
  {
    id: 'windows',
    label: 'Window Replacement',
    target: 'the window units, sashes, and frames',
    preserve: ['wall openings and their exact dimensions', 'siding', 'roof', 'doors'],
    cues: [
      'crisp modern frames set in the existing openings',
      'consistent glazing reflections across all units',
      'no change to the number, size, or position of openings'
    ],
    roiBasis: 'window replacement typically recovers 60-70% of cost at resale plus recurring energy savings'
  },
  {
    id: 'exterior-paint',
    label: 'Exterior Painting / Siding',
    target: 'the exterior wall surfaces, trim, and siding material',
    preserve: ['roof', 'windows', 'doors', 'hardscape', 'landscaping'],
    cues: [
      'even, freshly finished siding with a coherent trim accent',
      'no peeling, chalking, or discoloration',
      'material texture consistent across every elevation visible in frame'
    ],
    roiBasis: 'exterior paint and siding refresh typically recovers 50-80% of cost and materially shortens days-on-market'
  },
  {
    id: 'landscaping',
    label: 'Landscaping / Hardscaping',
    target: 'the lawn, planting beds, walkways, and hardscape',
    preserve: ['the house structure', 'roof', 'windows', 'doors', 'driveway location'],
    cues: [
      'healthy trimmed turf with defined bed edges',
      'mature but proportionate plantings that do not obscure the facade',
      'clean walkway lines matching the existing path geometry'
    ],
    roiBasis: 'landscape upgrades typically recover 100%+ of cost in perceived value and are the strongest curb-appeal-per-dollar change'
  },
  {
    id: 'storm-restoration',
    label: 'Storm Damage Restoration',
    target: 'the storm-damaged surfaces identified in the description',
    preserve: ['undamaged elevations', 'structure geometry', 'surrounding property'],
    cues: [
      'damaged materials restored to sound, code-current condition',
      'repairs blended so replaced sections match adjacent surfaces',
      'no cosmetic upgrades beyond restoring the damaged area'
    ],
    roiBasis: 'insurance-funded storm restoration is scoped to pre-loss condition; value is framed as claim recovery and risk removal, not resale uplift'
  },
  {
    id: 'real-estate',
    label: 'Real Estate Listing Prep',
    target: 'the highest-impact curb appeal deficiencies visible in frame',
    preserve: ['the structure itself', 'roofline', 'window and door placement'],
    cues: [
      'listing-ready presentation with clean surfaces and tidy grounds',
      'changes limited to what a pre-listing budget would actually fund',
      'photographically plausible under the original lighting'
    ],
    roiBasis: 'pre-listing cosmetic prep commonly returns 3-7x its cost in list-price support and reduced days-on-market'
  }
];

const byId = new Map(PRESETS.map((p) => [p.id, Object.freeze(p)]));

const listIndustries = () =>
  PRESETS.map(({ id, label, roiBasis }) => ({ id, label, roiBasis }));

function getIndustry(id) {
  const preset = byId.get(id);
  if (!preset) {
    throw invalid(`unknown industry "${id}"`, { available: [...byId.keys()] });
  }
  return preset;
}

/**
 * Register a vertical the presets do not cover (solar, fencing, pools, decks…).
 * This is the extension point that keeps hosts from forking the package.
 */
function defineIndustry(preset) {
  const required = ['id', 'label', 'target'];
  for (const key of required) {
    if (!preset?.[key]) throw invalid(`industry preset requires "${key}"`);
  }
  const normalized = Object.freeze({
    preserve: [],
    cues: [],
    roiBasis: 'no published cost-vs-value benchmark; present ROI qualitatively',
    ...preset
  });
  byId.set(normalized.id, normalized);
  if (!PRESETS.some((p) => p.id === normalized.id)) PRESETS.push(normalized);
  return normalized;
}

module.exports = { PRESETS, listIndustries, getIndustry, defineIndustry };
