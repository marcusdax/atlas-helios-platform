'use strict';

/**
 * The local-cache lane.
 *
 * This exists for one scene: an adjuster opens the dashboard in a truck with
 * one bar of signal. Without a cache the screen is empty until the network
 * answers, which it may never do. With one, the last known picture paints
 * immediately under an OFFLINE badge, and the operator can at least see which
 * addresses were queued before they lost signal.
 *
 * Storage is injected rather than imported so this module stays free of
 * `window`: the browser passes a localStorage adapter, the tests pass an
 * in-memory one, and React Native could pass AsyncStorage without a change
 * here.
 *
 * @typedef {object} StorageAdapter
 * @property {(key: string) => string|null} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} removeItem
 */

/** The envelope version. A bump invalidates every cached snapshot on upgrade. */
const CACHE_VERSION = 1;

/** In-memory storage with the same contract, for tests and for SSR. */
function memoryStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    get size() { return map.size; }
  };
}

/**
 * A storage adapter that cannot throw.
 *
 * Safari in private mode throws on `setItem`, and a browser with site data
 * blocked throws on the *read*. Both are ordinary user configurations, and
 * neither should take the dashboard down - so every access is wrapped and a
 * failure degrades to "no cache" rather than an exception on mount.
 */
function safeStore(store) {
  if (!store) return memoryStore();
  return {
    getItem: (key) => { try { return store.getItem(key); } catch { return null; } },
    setItem: (key, value) => { try { store.setItem(key, value); } catch { /* no cache this session */ } },
    removeItem: (key) => { try { store.removeItem(key); } catch { /* nothing to do */ } }
  };
}

/**
 * @typedef {object} CacheRead
 * @property {import('./types').DashboardSnapshot} snapshot
 * @property {number} fetchedAt  Epoch ms the snapshot was read from the network.
 * @property {number} age        Ms since then.
 * @property {boolean} expired   Past `ttlMs`; still returned, but flagged.
 */

/**
 * @param {object} options
 * @param {StorageAdapter} [options.store]
 * @param {string} [options.key]
 * @param {number} [options.ttlMs]  How long a cached snapshot is worth painting.
 * @param {() => number} [options.now]
 */
function createCache({
  store,
  key = 'atlas.dashboard.snapshot',
  ttlMs = 15 * 60 * 1000,
  now = Date.now
} = {}) {
  const storage = safeStore(store);

  return {
    key,
    ttlMs,

    /** @returns {CacheRead|null} */
    read() {
      const raw = storage.getItem(key);
      if (!raw) return null;

      let envelope;
      try {
        envelope = JSON.parse(raw);
      } catch {
        // Half-written JSON from a tab killed mid-write. Drop it rather than
        // let every later read fail on the same bad bytes.
        storage.removeItem(key);
        return null;
      }

      if (!envelope || envelope.version !== CACHE_VERSION || !envelope.snapshot) {
        storage.removeItem(key);
        return null;
      }

      const fetchedAt = typeof envelope.fetchedAt === 'number' ? envelope.fetchedAt : 0;
      const age = Math.max(0, now() - fetchedAt);

      return {
        snapshot: envelope.snapshot,
        fetchedAt,
        age,
        expired: age > ttlMs
      };
    },

    /** Persist a snapshot. A snapshot with no `fetchedAt` never came from the network, so it is not cached. */
    write(snapshot) {
      if (!snapshot || typeof snapshot.fetchedAt !== 'number') return false;
      storage.setItem(key, JSON.stringify({
        version: CACHE_VERSION,
        fetchedAt: snapshot.fetchedAt,
        snapshot
      }));
      return true;
    },

    clear() { storage.removeItem(key); }
  };
}

module.exports = { createCache, memoryStore, safeStore, CACHE_VERSION };
