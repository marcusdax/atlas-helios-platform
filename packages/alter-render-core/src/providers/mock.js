'use strict';

const { encodePng } = require('../util/png');
const { sha256 } = require('../util/hash');
const { sleep } = require('../util/retry');

/**
 * Offline provider. Deterministic output for the same input, so it is safe to
 * assert on in tests, and it produces a real PNG so the comparison slider has
 * something genuinely different to reveal in demos.
 *
 * Use it for: unit tests, CI, local development, sales demos on a plane, and as
 * the default so a fresh install of the host app runs before any key exists.
 */
function mockProvider(options = {}) {
  const { latencyMs = 0, failTimes = 0, width = 512, height = 384 } = options;
  let failuresLeft = failTimes;

  const maybeFail = () => {
    if (failuresLeft > 0) {
      failuresLeft -= 1;
      const error = new Error('mock provider transient failure');
      error.retryable = true;
      throw error;
    }
  };

  return {
    name: 'mock',
    capabilities: { plan: true, transform: true },

    async plan({ prompt, signal }) {
      if (latencyMs) await sleep(latencyMs, signal);
      maybeFail();
      const seed = sha256(prompt).slice(0, 8);
      return {
        imagePrompt: `[mock-${seed}] photorealistic replacement rendered onto the source photo`,
        headline: 'See the upgrade on your own home',
        body:
          'This preview was rendered onto your actual property photo, so every detail around ' +
          'the change stays exactly as it is today. Book a walkthrough to price the real thing.',
        roi: 'Estimate only: comparable exterior upgrades commonly recover a majority of their cost at resale.'
      };
    },

    async transform({ image, prompt, signal }) {
      if (latencyMs) await sleep(latencyMs, signal);
      maybeFail();

      // Derive the palette from the prompt so different requests are visibly
      // distinguishable, and identical requests are byte-identical.
      const seed = sha256(prompt + image.data.slice(0, 64));
      const hue = parseInt(seed.slice(0, 2), 16);
      const accent = parseInt(seed.slice(2, 4), 16);

      const data = encodePng(width, height, (x, y) => {
        const band = Math.floor((y / height) * 6);
        const sweep = Math.floor((x / width) * 120);
        return [
          (hue + sweep + band * 12) % 256,
          (accent + sweep / 2 + band * 20) % 256,
          (160 + band * 10) % 256
        ];
      });

      return { mimeType: 'image/png', data };
    }
  };
}

module.exports = { mockProvider };
