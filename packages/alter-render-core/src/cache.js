'use strict';

/**
 * Cache contract: { get(key) -> value|undefined, set(key, value) -> void }.
 * Async implementations are fine — the engine awaits both.
 * Swap in Redis for multi-instance deployments; the engine does not care.
 */

/** LRU with TTL. Values are large (base64 images), so bound by count, not bytes. */
class MemoryCache {
  constructor({ max = 100, ttlMs = 24 * 60 * 60 * 1000, now = () => Date.now() } = {}) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.now = now;
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (this.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // Re-insert to move to the most-recently-used end of the Map's order.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.map.size > this.max) {
      this.map.delete(this.map.keys().next().value);
    }
  }

  get size() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }
}

/** Opt out of caching without special-casing the engine. */
const nullCache = { get: () => undefined, set: () => {} };

module.exports = { MemoryCache, nullCache };
