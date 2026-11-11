'use strict';

const { DATA_STATES, SOURCES } = require('./types');
const { deriveState, transition, STALE_AFTER_MS } = require('./states');
const { composeSnapshot, toLane, eventToActivity, mergeSummaryPatch, EMPTY_SUMMARY } = require('./normalize');

/**
 * The source multiplexer: one store, three lanes of supply.
 *
 * REST reads, WebSocket pushes and the local cache all want to write to the
 * same five numbers, and before this existed they each wrote straight into a
 * component's `useState`. That is how the dashboard ended up with a mock
 * dataset: with no seam between "where data comes from" and "what the screen
 * shows", the cheapest way to make the screen show something was to type the
 * numbers in.
 *
 * The store is deliberately framework-free. Its whole surface is
 * `subscribe`/`getView`, which is exactly what React's `useSyncExternalStore`
 * wants, and which a plain script or the mobile app can drive just as well.
 * Everything time-dependent is injected - the clock, the scheduler, the
 * gateway - so the tests can run a day of dashboard life in a millisecond
 * without a single fake timer global.
 */

const LANE_NAMES = Object.freeze([
  SOURCES.PROPERTIES, SOURCES.STORMS, SOURCES.ASSESSMENTS, SOURCES.ALERTS
]);

const idleStatus = () => ({ ok: false, at: null, code: null, message: null });

/** Pushes that should make the store re-read the authoritative counts. */
const INVALIDATING_EVENTS = Object.freeze([
  'storm_alert', 'storm_dissipated', 'property_assessment_complete', 'new_leads_generated'
]);

class DashboardStore {
  /**
   * @param {object} options
   * @param {Record<string, (signal?: AbortSignal) => Promise<any>>} options.gateway
   *        One loader per lane. A missing lane is simply never read, which is
   *        how a screen that does not care about weather alerts opts out.
   * @param {ReturnType<typeof import('./cache').createCache>} [options.cache]
   * @param {() => number} [options.now]
   * @param {number} [options.staleAfterMs]
   * @param {number} [options.activityLimit]
   * @param {number} [options.priorityLimit]
   * @param {number} [options.pushDebounceMs]  How long to coalesce pushes before re-reading.
   * @param {{setTimeout: Function, clearTimeout: Function}} [options.scheduler]
   * @param {boolean} [options.online]
   */
  constructor({
    gateway = {},
    cache = null,
    now = Date.now,
    staleAfterMs = STALE_AFTER_MS,
    activityLimit = 12,
    priorityLimit = 5,
    pushDebounceMs = 2000,
    scheduler = { setTimeout, clearTimeout },
    online = true
  } = {}) {
    this.gateway = gateway;
    this.cache = cache;
    this.now = now;
    this.staleAfterMs = staleAfterMs;
    this.activityLimit = activityLimit;
    this.priorityLimit = priorityLimit;
    this.pushDebounceMs = pushDebounceMs;
    this.scheduler = scheduler;

    /** Last good contribution per lane. A failed lane keeps the previous one. */
    this.lanes = {};
    /** @type {import('./types').SourceReport} */
    this.sources = Object.fromEntries(
      LANE_NAMES.filter((name) => typeof gateway[name] === 'function').map((name) => [name, idleStatus()])
    );
    /** Activity rows that arrived by socket and are not in a REST lane yet. */
    this.pushed = [];
    /** Server-stated totals from `dashboard_update`, overlaid on the lane counts. */
    this.summaryPatch = null;

    this.online = online;
    this.realtime = 'disconnected';
    this.fetching = false;
    this.attempted = false;
    this.fromCache = false;
    this.fetchedAt = null;
    this.disposed = false;

    /** @type {import('./types').StateTransition[]} */
    this.history = [];
    this.historyLimit = 20;

    this.listeners = new Set();
    this.inflight = null;
    this.controller = null;
    this.pushTimer = null;

    this.state = DATA_STATES.SYNCING;
    this.snapshot = composeSnapshot({}, { fetchedAt: null, activityLimit });
    this.view = this.buildView();
  }

  /* ----------------------------------------------------------- subscribe -- */

  subscribe(listener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /**
   * The current view, with a stable identity.
   *
   * `useSyncExternalStore` compares what this returns by reference on every
   * render, so building a fresh object here would re-render the dashboard
   * forever. The view is rebuilt only in `commit`, when something actually
   * changed.
   */
  getView() { return this.view; }

  /** @returns {import('./types').DashboardView} */
  buildView() {
    const fetchedAt = this.snapshot.fetchedAt;
    return Object.freeze({
      state: this.state,
      summary: this.summaryPatch
        ? mergeSummaryPatch(this.snapshot.summary, this.summaryPatch)
        : this.snapshot.summary,
      activity: this.snapshot.activity,
      priorityProperties: this.snapshot.priorityProperties,
      fetchedAt,
      age: fetchedAt === null ? null : Math.max(0, this.now() - fetchedAt),
      fetching: this.fetching,
      fromCache: this.fromCache,
      online: this.online,
      realtime: this.realtime,
      sources: { ...this.sources },
      failedSources: Object.entries(this.sources)
        .filter(([, s]) => s.at !== null && !s.ok)
        .map(([name]) => name),
      history: [...this.history]
    });
  }

  /**
   * Re-derive the state, rebuild the view, and notify - but only tell anyone
   * if something they can see has changed.
   *
   * The `changed` flag is not an optimisation. A 30-second poll on a quiet
   * dashboard would otherwise push a new object to every subscriber twice a
   * minute, re-rendering a map and two charts to display identical numbers.
   */
  commit(reason = '') {
    if (this.disposed) return this.view;

    const next = deriveState({
      online: this.online,
      realtime: this.realtime,
      fetching: this.fetching,
      hasData: this.snapshot.fetchedAt !== null,
      attempted: this.attempted,
      sources: this.sources,
      fetchedAt: this.snapshot.fetchedAt,
      now: this.now(),
      staleAfterMs: this.staleAfterMs
    });

    const moved = transition(this.state, next, { at: this.now(), reason });
    if (moved) {
      this.state = next;
      this.history = [...this.history, moved].slice(-this.historyLimit);
    }

    const previous = this.view;
    this.view = this.buildView();

    if (!moved && !this.viewChanged(previous, this.view)) {
      this.view = previous;
      return previous;
    }

    for (const listener of [...this.listeners]) listener(this.view);
    return this.view;
  }

  /**
   * Has anything a component renders actually moved?
   *
   * `age` is excluded on purpose: it changes on every call by definition, and
   * including it would make every tick a change. A view that wants a live
   * "updated 14s ago" label reads `age` on render and is re-rendered by the
   * hook's own ticker.
   */
  viewChanged(a, b) {
    if (!a) return true;
    if (a.state !== b.state || a.fetching !== b.fetching || a.fromCache !== b.fromCache) return true;
    if (a.fetchedAt !== b.fetchedAt || a.online !== b.online || a.realtime !== b.realtime) return true;
    if (a.activity !== b.activity || a.priorityProperties !== b.priorityProperties) return true;
    if (a.failedSources.join() !== b.failedSources.join()) return true;
    return Object.keys(EMPTY_SUMMARY).some((key) => a.summary[key] !== b.summary[key]);
  }

  /* ------------------------------------------------------------- signals -- */

  setOnline(online) {
    const next = Boolean(online);
    if (next === this.online) return this.view;
    this.online = next;
    // Coming back from offline, the data on screen is by definition suspect:
    // read again rather than wait for the next poll tick.
    if (next) this.scheduleRefresh(0, 'back online');
    return this.commit(next ? 'browser online' : 'browser offline');
  }

  setRealtime(status) {
    if (status === this.realtime) return this.view;
    this.realtime = status;
    return this.commit(`realtime ${status}`);
  }

  /** Re-derive the state against the current clock, for the staleness boundary. */
  tick() { return this.commit('tick'); }

  /* ---------------------------------------------------------- cache lane -- */

  /**
   * Paint the last known picture before the network is asked anything.
   *
   * Called once on mount. The snapshot keeps its original `fetchedAt`, which
   * is what makes the state come out STALE or OFFLINE rather than LIVE - the
   * cache supplies data, never freshness.
   */
  hydrate() {
    if (!this.cache || this.snapshot.fetchedAt !== null) return false;

    const cached = this.cache.read();
    if (!cached?.snapshot) return false;

    this.snapshot = {
      ...composeSnapshot({}, { activityLimit: this.activityLimit }),
      ...cached.snapshot,
      fetchedAt: cached.fetchedAt
    };
    this.fromCache = true;
    this.commit('hydrated from cache');
    return true;
  }

  /* ----------------------------------------------------------- rest lane -- */

  /**
   * Read every lane, keep what answers, and remember what did not.
   *
   * `allSettled` rather than `all` is the single most important line in the
   * file: with `all`, one 503 from the NWS alert proxy would reject the whole
   * refresh and the operator would lose the property counts too - a total
   * outage drawn from a partial one.
   *
   * @param {{sources?: string[]}} [options]
   */
  async refresh({ sources } = {}) {
    if (this.disposed) return this.view;
    // A poll tick and a push-triggered re-read can land together; the second
    // caller joins the first rather than doubling the load on the API.
    if (this.inflight) return this.inflight;

    const names = (sources || LANE_NAMES).filter((name) => typeof this.gateway[name] === 'function');
    if (names.length === 0) return this.view;

    this.controller = typeof AbortController === 'function' ? new AbortController() : null;
    const signal = this.controller ? this.controller.signal : undefined;

    this.fetching = true;
    this.commit('refresh started');

    const run = (async () => {
      const settled = await Promise.allSettled(names.map((name) => this.gateway[name](signal)));
      if (this.disposed) return this.view;

      const at = this.now();
      let anyOk = false;

      settled.forEach((result, index) => {
        const name = names[index];
        if (result.status === 'fulfilled') {
          try {
            this.lanes[name] = toLane(name, result.value, {
              activityLimit: this.activityLimit,
              priorityLimit: this.priorityLimit
            });
            this.sources[name] = { ok: true, at, code: null, message: null };
            anyOk = true;
          } catch (error) {
            // A lane that answers with something the normaliser cannot read is
            // a failed lane, not a crashed dashboard.
            this.sources[name] = {
              ok: false, at, code: 'MALFORMED_RESPONSE', message: error?.message || String(error)
            };
          }
          return;
        }

        const error = result.reason;
        if (error?.code === 'ABORTED' || error?.name === 'AbortError') {
          // Unmounted or superseded: not a failure, and not evidence about the
          // health of the lane either, so the previous status stands.
          return;
        }
        this.sources[name] = {
          ok: false,
          at,
          code: error?.code || 'NETWORK',
          message: error?.message || String(error)
        };
      });

      this.attempted = true;
      this.fetching = false;

      if (anyOk) {
        this.snapshot = composeSnapshot(this.lanes, {
          fetchedAt: at,
          activityLimit: this.activityLimit,
          pushed: this.pushed
        });
        this.fromCache = false;
        // A `dashboard_update` push is a point-in-time statement, not a
        // standing override. Keeping the patch after an authoritative read
        // would pin a tile to a number the API has since moved past - and
        // nothing would ever correct it, because every later read would be
        // overlaid by the same stale patch.
        this.summaryPatch = null;
        if (this.cache) this.cache.write(this.snapshot);
      }

      return this.commit(anyOk ? 'refresh landed' : 'refresh failed');
    })();

    // `finally` returns a NEW promise, so the guard has to compare against the
    // wrapper that was actually stored - comparing against `run` never matches,
    // `inflight` never clears, and every refresh after the first silently
    // returns the first one's result forever.
    const wrapped = run.finally(() => {
      if (this.inflight === wrapped) {
        this.inflight = null;
        this.controller = null;
      }
    });

    this.inflight = wrapped;
    return wrapped;
  }

  /* ------------------------------------------------------- realtime lane -- */

  /**
   * Apply a socket event.
   *
   * A push adds an activity row immediately - that is what makes the feed feel
   * live - and then asks for a re-read of the counts instead of adjusting them
   * itself. See the note in `normalize.eventToActivity` for why inventing a
   * count is worse than waiting two seconds for the real one.
   */
  handleRealtime(name, payload) {
    if (this.disposed) return this.view;

    if (name === 'dashboard_update') {
      const patched = mergeSummaryPatch(this.snapshot.summary, payload);
      if (patched === this.snapshot.summary) return this.view;
      this.summaryPatch = { ...(this.summaryPatch || {}), ...payload };
      return this.commit('dashboard_update');
    }

    const event = eventToActivity(name, payload, { now: this.now() });
    if (event) {
      this.pushed = [event, ...this.pushed.filter((e) => e.id !== event.id)].slice(0, this.activityLimit);
      this.snapshot = composeSnapshot(this.lanes, {
        fetchedAt: this.snapshot.fetchedAt,
        activityLimit: this.activityLimit,
        pushed: this.pushed
      });
    }

    if (INVALIDATING_EVENTS.includes(name)) this.scheduleRefresh(this.pushDebounceMs, `push:${name}`);

    return event ? this.commit(`push:${name}`) : this.view;
  }

  /**
   * Coalesce a burst of pushes into one re-read.
   *
   * A squall line crossing a metro emits storm alerts in bursts of twenty.
   * Without the debounce that is twenty full dashboard refreshes - eighty HTTP
   * requests - inside a second.
   */
  scheduleRefresh(delay = this.pushDebounceMs, reason = '') {
    if (this.disposed) return;
    if (this.pushTimer !== null) this.scheduler.clearTimeout(this.pushTimer);
    this.pushTimer = this.scheduler.setTimeout(() => {
      this.pushTimer = null;
      this.refresh().catch(() => { /* already recorded on the source report */ });
    }, delay);
    this.lastScheduleReason = reason;
  }

  /* ---------------------------------------------------------------- life -- */

  dispose() {
    this.disposed = true;
    if (this.pushTimer !== null) this.scheduler.clearTimeout(this.pushTimer);
    this.pushTimer = null;
    if (this.controller) this.controller.abort();
    this.listeners.clear();
  }
}

module.exports = { DashboardStore, LANE_NAMES, INVALIDATING_EVENTS };
