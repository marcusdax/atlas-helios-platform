import React, {
  createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore
} from 'react';
import {
  DashboardStore, createCache, describeState, isRecoverable, DATA_STATES
} from '@atlas/dashboard-data';
import { WebSocketContext } from '../contexts/WebSocketContext';
import { createDashboardGateway, browserStore } from './dashboardGateway';

/**
 * `useDashboardData` — the dashboard's one domain hook.
 *
 * Before this existed, `Dashboard.js` owned its own `useState`, its own socket
 * subscription and its own idea of what the numbers were, and the cheapest way
 * to make that render something was to type a mock dataset into
 * `fetchDashboardData()`. The replacement is deliberately a hook over a store
 * rather than more component state: the store is where REST, socket and cache
 * are reconciled, it is testable without a renderer, and a second screen that
 * wants the same figures asks for them rather than fetching them again.
 *
 * What the hook itself owns is only the browser-shaped part: the socket
 * bindings, the online/offline events, the visibility-aware poll, and a ticker
 * so the badge can cross the staleness boundary without an event.
 *
 * In Storybook and in component tests, `DashboardDataProvider` supplies a fixed
 * view and the live machinery below never starts. That is the whole mock seam -
 * there is no mock *data* anywhere in this file.
 */

/** @type {React.Context<import('@atlas/dashboard-data').DashboardView|null>} */
const DashboardDataContext = createContext(null);

/** How often to re-read when the tab is visible. */
const POLL_MS = 60_000;
/** How often to re-derive the state so freshness decays on its own. */
const TICK_MS = 15_000;

/**
 * Provide one dashboard view to everything below.
 *
 * Two modes, and the second is the point:
 *
 * - With `value`, it provides that view verbatim and starts nothing. This is
 *   the mock seam for stories and tests. It takes the view as a prop and
 *   imports no fixtures itself, so no demo dataset can reach a production
 *   bundle through this file.
 *
 * - Without `value`, it runs the live hook once and shares the result. Mounted
 *   near the root, that is what makes a second consumer - the sidebar's
 *   activity feed, say - *ask for* the figures rather than fetch them again.
 *   Two independent stores would double the request load and, worse, drift:
 *   two panels on one screen showing different counts because they polled a
 *   second apart is a bug nobody can reproduce.
 *
 * @param {object} props
 * @param {import('@atlas/dashboard-data').DashboardView} [props.value]
 *        A fixed view. Omit it for the live store.
 */
export function DashboardDataProvider({ value, children, ...options }) {
  const live = useLiveDashboardData({ ...options, enabled: value === undefined || value === null });
  const resolved = value ?? live;

  return (
    <DashboardDataContext.Provider value={resolved}>
      {children}
    </DashboardDataContext.Provider>
  );
}

/**
 * The live wiring. Exported for tests that want it without the context
 * short-circuit; components should use `useDashboardData`.
 *
 * @param {object} [options]
 * @param {boolean} [options.enabled]  False inside a provider: no store, no network.
 * @param {string} [options.area]      Two-letter state code for the alert lane.
 * @param {number} [options.pollMs]
 * @param {object} [options.gateway]   Override the REST lane entirely.
 * @returns {import('@atlas/dashboard-data').DashboardView & {refresh: Function, recoverable: boolean, description: object}}
 */
export function useLiveDashboardData({
  enabled = true,
  area,
  pollMs = POLL_MS,
  gateway: injectedGateway
} = {}) {
  // Read the socket optionally: the hook renders in places that have no
  // WebSocketProvider, and `useWebSocket` would throw there.
  const ws = useContext(WebSocketContext);
  const socket = ws?.socket ?? null;
  const isConnected = Boolean(ws?.isConnected);

  /**
   * The gateway is read through a ref, not a dependency.
   *
   * A caller writing `useDashboardData({ gateway: makeGateway() })` hands over
   * a fresh object on every render. With that object in the memo deps, every
   * render built a new store, every new store fetched on mount, and every
   * fetch re-rendered - an unbounded request loop from an ordinary-looking
   * prop. The lane *set* is fixed when the store is built, because which lanes
   * exist is a different store; the implementations behind those lanes are
   * looked up per call, so swapping them in a test needs no remount.
   */
  const gatewayRef = useRef(injectedGateway);
  gatewayRef.current = injectedGateway;

  const store = useMemo(() => {
    if (!enabled) return null;

    const base = gatewayRef.current || createDashboardGateway({ area });
    const gateway = Object.fromEntries(
      Object.keys(base).map((name) => [
        name,
        (signal) => (gatewayRef.current?.[name] || base[name])(signal)
      ])
    );

    return new DashboardStore({
      gateway,
      cache: createCache({ store: browserStore() }),
      online: typeof navigator === 'undefined' ? true : navigator.onLine !== false
    });
    // A new store means a new cache read and a new fetch, so the deps are kept
    // to the two things that genuinely change what gets fetched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, area]);

  /**
   * An idle view for the disabled case.
   *
   * `useSyncExternalStore` cannot be called conditionally, so when there is no
   * store we hand it a subscriber that never fires and a snapshot that never
   * changes identity. A fresh object here would re-render forever.
   */
  const idle = useRef(null);
  if (!idle.current) {
    idle.current = Object.freeze({
      state: DATA_STATES.SYNCING,
      summary: { totalProperties: 0, activeStorms: 0, highRiskProperties: 0, recentAssessments: 0, weatherAlerts: 0 },
      activity: [], priorityProperties: [], mapProperties: [],
      forecast: [], forecastSource: null, fetchedAt: null, age: null,
      fetching: false, fromCache: false, online: true, realtime: 'disconnected',
      sources: {}, failedSources: [], history: []
    });
  }

  const subscribe = useMemo(
    () => (store ? store.subscribe.bind(store) : () => () => {}),
    [store]
  );
  const getView = useMemo(
    () => (store ? store.getView.bind(store) : () => idle.current),
    [store]
  );
  const view = useSyncExternalStore(subscribe, getView, getView);

  /* First paint from cache, then the first read. */
  useEffect(() => {
    if (!store) return undefined;
    store.hydrate();
    store.refresh();
    return () => store.dispose();
  }, [store]);

  /* The socket's health is an input to the state, not just a banner. */
  useEffect(() => {
    if (!store) return;
    store.setRealtime(isConnected ? 'connected' : socket ? 'connecting' : 'disconnected');
  }, [store, socket, isConnected]);

  /* Pushes: the store decides what each one means. */
  useEffect(() => {
    if (!store || !socket) return undefined;

    // Join the room the backend broadcasts dashboard totals to.
    socket.emit('join_room', 'dashboard');

    const names = [
      'dashboard_update', 'storm_alert', 'storm_dissipated',
      'property_assessment_complete', 'new_leads_generated', 'system_notification'
    ];
    const handlers = names.map((name) => {
      const handler = (payload) => store.handleRealtime(name, payload);
      socket.on(name, handler);
      return [name, handler];
    });

    // `socket.off(name)` with no handler would also remove the listeners
    // StormContext and WebSocketContext registered for the same events, which
    // is how a dashboard visit used to silence the global storm toasts.
    return () => handlers.forEach(([name, handler]) => socket.off(name, handler));
  }, [store, socket]);

  /* Browser connectivity. */
  useEffect(() => {
    if (!store || typeof window === 'undefined') return undefined;
    const online = () => store.setOnline(true);
    const offline = () => store.setOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [store]);

  /**
   * Poll, but only while anyone is looking.
   *
   * A dashboard left open on a wall display is the common case; a dashboard
   * left open in a background tab for a week is the expensive one. Polling on
   * visibility alone also means the data is re-read the moment the operator
   * comes back, which is exactly when a stale number does damage.
   */
  useEffect(() => {
    if (!store || pollMs <= 0) return undefined;

    let timer = null;
    const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(() => { if (!hidden()) store.refresh(); }, pollMs);
    };
    const stop = () => { if (timer !== null) { clearInterval(timer); timer = null; } };

    const onVisibility = () => {
      if (hidden()) { stop(); return; }
      store.refresh();
      start();
    };

    if (!hidden()) start();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [store, pollMs]);

  /* Let freshness decay without an event to trigger it. */
  useEffect(() => {
    if (!store) return undefined;
    const timer = setInterval(() => store.tick(), TICK_MS);
    return () => clearInterval(timer);
  }, [store]);

  const refresh = useMemo(
    () => (store ? () => store.refresh() : () => Promise.resolve()),
    [store]
  );

  return useMemo(() => ({
    ...view,
    description: describeState(view.state),
    recoverable: isRecoverable(view.state),
    refresh
  }), [view, refresh]);
}

/**
 * The hook components use.
 *
 * Both branches are hooks, so both always run - React forbids a conditional
 * hook call. `enabled` is what keeps the live branch from opening a socket or
 * a fetch when a provider has already supplied the answer.
 */
export function useDashboardData(options = {}) {
  const injected = useContext(DashboardDataContext);
  const live = useLiveDashboardData({ ...options, enabled: injected === null });

  return useMemo(() => {
    if (!injected) return live;
    return {
      ...injected,
      description: describeState(injected.state),
      recoverable: isRecoverable(injected.state),
      refresh: injected.refresh || (() => Promise.resolve())
    };
  }, [injected, live]);
}

/**
 * "Updated 14s ago", in one place.
 *
 * Views need this constantly and would each round it differently; a shared
 * formatter is also the only way the relative label and the absolute time in
 * the tooltip can be guaranteed to agree.
 */
export function useFreshnessLabel(fetchedAt, { tickMs = 10_000 } = {}) {
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (fetchedAt === null || fetchedAt === undefined) return undefined;
    const timer = setInterval(() => setNonce((n) => n + 1), tickMs);
    return () => clearInterval(timer);
  }, [fetchedAt, tickMs]);

  // `nonce` is in the deps on purpose: without it the ticker re-renders the
  // component and the label recomputes to the same memoised string, so
  // "just now" would still be on screen an hour later.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => formatFreshness(fetchedAt), [fetchedAt, nonce]);
}

/** @param {number|null|undefined} fetchedAt */
export function formatFreshness(fetchedAt, now = Date.now()) {
  if (fetchedAt === null || fetchedAt === undefined) {
    return { relative: 'never', absolute: null, seconds: null };
  }
  const seconds = Math.max(0, Math.round((now - fetchedAt) / 1000));
  const absolute = new Date(fetchedAt).toLocaleTimeString();

  if (seconds < 10) return { relative: 'just now', absolute, seconds };
  if (seconds < 60) return { relative: `${seconds}s ago`, absolute, seconds };
  if (seconds < 3600) return { relative: `${Math.floor(seconds / 60)}m ago`, absolute, seconds };
  if (seconds < 86400) return { relative: `${Math.floor(seconds / 3600)}h ago`, absolute, seconds };
  return { relative: `${Math.floor(seconds / 86400)}d ago`, absolute, seconds };
}

export { DashboardDataContext };
export default useDashboardData;
