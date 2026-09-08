import express from 'express';
import { AlterRenderError, CODES, getIndustry, listIndustries, sha256 } from '@alter/render-core';

/**
 * Assist routes - the non-rendering AI features from the template, moved
 * server-side for the same reason the renderer was: the browser is not a place
 * to keep a vendor credential.
 */

const MAX_TEXT = 600;
const MAX_ADDRESSES = 50;

function text(value, field, { max = MAX_TEXT, required = true } = {}) {
  if (value == null || value === '') {
    if (!required) return '';
    throw new AlterRenderError(CODES.INVALID_INPUT, `${field} is required`, { status: 400 });
  }
  if (typeof value !== 'string') {
    throw new AlterRenderError(CODES.INVALID_INPUT, `${field} must be a string`, { status: 400 });
  }
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length > max) {
    throw new AlterRenderError(CODES.INVALID_INPUT, `${field} must be ${max} characters or fewer`, {
      status: 400, details: { length: trimmed.length, max }
    });
  }
  return trimmed;
}

/** Resolves and validates the trade in one step; unknown ids are a 400. */
function industryOf(value) {
  return getIndustry(text(value, 'industry', { max: 60 }));
}

export function createAssistRouter({ provider, publicBaseUrl = '' }) {
  const router = express.Router();

  const guard = (handler) => async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };

  router.get('/status', (req, res) => {
    res.json({ offline: provider.offline, industries: listIndustries() });
  });

  /** Improvement ideas for a described property, scoped to one trade. */
  router.post('/suggestions', guard(async (req, res) => {
    const preset = industryOf(req.body?.industry);
    const observation = text(req.body?.observation, 'observation');

    const suggestions = await provider.generate({
      prompt: [
        `You are advising on ${preset.label} work.`,
        `The property is described as: "${observation}"`,
        '',
        'List 3-5 specific, visually impactful improvements a contractor in this trade',
        'could actually sell and install. Each item is one short sentence naming the',
        'surface and the change. No pricing, no guarantees, no filler.',
        'Return a JSON array of strings.'
      ].join('\n'),
      schema: { type: 'ARRAY', items: { type: 'STRING' } }
    });

    res.json({ suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 8) : [] });
  }));

  /**
   * Per-address campaign one-pagers.
   *
   * The template had the model invent the one-pager URLs, which produces links
   * that look real and resolve to nothing. Here the server derives a stable
   * slug from the address itself and the model writes only the summary - so
   * every link in the output is one this app can actually serve.
   */
  router.post('/campaign', guard(async (req, res) => {
    const preset = industryOf(req.body?.industry);
    const neighborhood = text(req.body?.neighborhood, 'neighborhood', { max: 120 });
    const bounds = text(req.body?.bounds, 'bounds', { max: 300, required: false });

    const raw = Array.isArray(req.body?.addresses)
      ? req.body.addresses
      : String(req.body?.addresses || '').split('\n');
    const addresses = raw.map((a) => String(a).trim()).filter(Boolean).slice(0, MAX_ADDRESSES);

    if (addresses.length === 0) {
      throw new AlterRenderError(CODES.INVALID_INPUT, 'at least one address is required', { status: 400 });
    }

    const generated = await provider.generate({
      prompt: [
        `Campaign for ${preset.label} in "${neighborhood}"${bounds ? ` (${bounds})` : ''}.`,
        'For each address below, write a one-or-two-sentence summary of what that',
        "household's personalized one-pager would say. Ground it in the trade and the",
        'neighborhood. No invented prices, no invented URLs, no invented claims about',
        'the specific house.',
        '',
        ...addresses.map((address, i) => `${i + 1}. ${address}`),
        '',
        'Return a JSON array of objects with keys "address" and "summary".'
      ].join('\n'),
      schema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { address: { type: 'STRING' }, summary: { type: 'STRING' } },
          required: ['address', 'summary']
        }
      }
    });

    const summaries = new Map(
      (Array.isArray(generated) ? generated : []).map((item) => [String(item.address).trim(), item.summary])
    );

    res.json({
      neighborhood,
      industry: preset.id,
      onePagers: addresses.map((address) => {
        // Deterministic: the same address in the same campaign always gets the
        // same link, so a re-run does not invalidate printed collateral.
        const slug = sha256(`${preset.id}|${neighborhood}|${address}`).slice(0, 12);
        return {
          address,
          slug,
          url: `${publicBaseUrl}/c/${slug}`,
          summary: summaries.get(address) || 'Personalized one-pager for this address.'
        };
      })
    });
  }));

  /** Market framing around a rendered improvement's ROI. */
  router.post('/market', guard(async (req, res) => {
    const preset = industryOf(req.body?.industry);
    const location = text(req.body?.location, 'location', { max: 120 });
    const roi = text(req.body?.roi, 'roi', { max: MAX_TEXT, required: false });

    const analysis = await provider.generate({
      prompt: [
        `Trade: ${preset.label}. Market: ${location}.`,
        roi ? `Return framing under discussion: "${roi}"` : 'No specific return figure was provided.',
        `Published benchmark for this trade: ${preset.roiBasis}`,
        '',
        'In 3-5 sentences, explain how typical conditions in this market - demand,',
        'housing stock age, weather exposure, buyer expectations - would support or',
        'temper that framing. Be concrete about the mechanism. Do not state a dollar',
        'figure, do not cite statistics you cannot source, and say plainly that this',
        'is general market context rather than an appraisal.'
      ].join('\n')
    });

    res.json({ analysis: String(analysis).trim(), industry: preset.id, location });
  }));

  /** Sharpen the detection parameters used when screening property imagery. */
  router.post('/vision-params', guard(async (req, res) => {
    const preset = industryOf(req.body?.industry);
    const parameters = text(req.body?.parameters, 'parameters');

    const refined = await provider.generate({
      prompt: [
        `Screening parameters for a ${preset.label} imagery pass.`,
        `Current parameters: "${parameters}"`,
        `Surfaces that matter for this trade: ${preset.target}.`,
        preset.cues?.length ? `Quality signals: ${preset.cues.join('; ')}` : '',
        '',
        'Rewrite these as one dense paragraph of specific, observable detection',
        'criteria - the visible conditions an analyst or model should flag, and the',
        'look-alikes it should not. No preamble.'
      ].filter(Boolean).join('\n')
    });

    res.json({ parameters: String(refined).trim(), industry: preset.id });
  }));

  return router;
}
