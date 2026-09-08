'use strict';

const { getIndustry } = require('./industries');
const { invalid } = require('../errors');

const MAX_DESCRIPTION = 600;

function normalizeDescription(description) {
  if (typeof description !== 'string' || description.trim().length === 0) {
    throw invalid('description is required — say what is wrong or what should change');
  }
  const trimmed = description.trim().replace(/\s+/g, ' ');
  if (trimmed.length > MAX_DESCRIPTION) {
    throw invalid(`description must be ${MAX_DESCRIPTION} characters or fewer`, {
      length: trimmed.length,
      max: MAX_DESCRIPTION
    });
  }
  return trimmed;
}

/**
 * The invariant clause appended to every transform prompt.
 *
 * A property render is only useful if the homeowner recognizes their own house
 * in it. These constraints are what separate "here is your home with a new
 * roof" from "here is a stock photo of a nice house" — and the latter is a
 * compliance problem, not just a quality one.
 */
function guardrails(preset) {
  const preserved = preset.preserve.length
    ? `Leave unchanged: ${preset.preserve.join(', ')}.`
    : '';
  return [
    'This is a photo edit of a real property, not a new scene.',
    'Keep the camera position, focal length, perspective, and framing identical.',
    'Keep the time of day, light direction, shadow geometry, and weather identical.',
    'Keep the building footprint, proportions, and all neighboring context identical.',
    `Change only ${preset.target}.`,
    preserved,
    'Do not add or remove people, vehicles, signage, watermarks, or text.',
    'The result must be photographically plausible as the same photograph, retouched.'
  ].filter(Boolean).join(' ');
}

/** Prompt for the planning model: returns the transform prompt plus sales copy. */
function buildPlanPrompt({ industryId, description, tone = 'confident, concrete, non-hyperbolic' }) {
  const preset = getIndustry(industryId);
  const clean = normalizeDescription(description);

  return [
    `You are planning a photorealistic before/after property render for the ${preset.label} trade.`,
    `The homeowner describes the current condition as: "${clean}"`,
    '',
    'Produce JSON with exactly these keys:',
    '- "imagePrompt": an image-editing instruction, 2-4 sentences, naming specific',
    `  materials, colors, and finishes for ${preset.target}. Be concrete ("matte charcoal`,
    '  full-view aluminum door with frosted glass upper panels"), never generic ("a new door").',
    `  Useful cues for this trade: ${preset.cues.join('; ')}.`,
    '- "headline": one marketing headline under 70 characters.',
    '- "body": 2-3 sentences of ad copy in a ' + tone + ' tone, naming the benefit',
    '  the homeowner actually gets. No emojis, no all-caps, no invented guarantees.',
    '- "roi": one sentence of return framing grounded in this benchmark:',
    `  ${preset.roiBasis}. Present it explicitly as an estimate and never state a`,
    '  dollar figure for this specific property.',
    '',
    'Return only the JSON object.'
  ].join('\n');
}

/** Prompt for the image model: the plan's instruction, fenced by the guardrails. */
function buildTransformPrompt({ industryId, imagePrompt }) {
  const preset = getIndustry(industryId);
  if (typeof imagePrompt !== 'string' || !imagePrompt.trim()) {
    throw invalid('imagePrompt is required to build a transform prompt');
  }
  return `${imagePrompt.trim()}\n\n${guardrails(preset)}`;
}

/**
 * Fallback plan used when the planner is unavailable or a host opts out of it.
 * Degrading to a deterministic prompt keeps the render working when only the
 * copy generation is down — a render with plain copy still converts.
 */
function fallbackPlan({ industryId, description }) {
  const preset = getIndustry(industryId);
  const clean = normalizeDescription(description);
  return {
    imagePrompt:
      `Replace ${preset.target} to resolve: ${clean}. ` +
      `Apply ${preset.cues[0] || 'a clean, current, professionally installed finish'}.`,
    headline: `See your ${preset.label.toLowerCase()} upgrade before you buy it`,
    body:
      `We rendered this improvement directly onto your property photo so you can judge the ` +
      `result on your own home, not a showroom sample. Every other detail is untouched.`,
    roi: `Estimate only: ${preset.roiBasis}.`,
    degraded: true
  };
}

module.exports = {
  buildPlanPrompt,
  buildTransformPrompt,
  guardrails,
  fallbackPlan,
  normalizeDescription,
  MAX_DESCRIPTION
};
