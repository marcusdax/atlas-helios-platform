'use strict';

/**
 * Concurrency gate.
 *
 * Image generation is the most expensive call in the product and the slowest to
 * fail. Without a ceiling, one burst of traffic converts directly into an
 * upstream 429 storm and a surprise invoice. The gate makes the spend rate a
 * configured number rather than an emergent one.
 */
function createSemaphore(limit) {
  if (!Number.isInteger(limit) || limit < 1) return { acquire: async () => () => {}, get pending() { return 0; } };

  let active = 0;
  const queue = [];

  const release = () => {
    active -= 1;
    const next = queue.shift();
    if (next) {
      active += 1;
      next();
    }
  };

  return {
    async acquire() {
      if (active < limit) {
        active += 1;
      } else {
        await new Promise((resolve) => queue.push(resolve));
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        release();
      };
    },
    get pending() {
      return queue.length;
    },
    get active() {
      return active;
    }
  };
}

module.exports = { createSemaphore };
