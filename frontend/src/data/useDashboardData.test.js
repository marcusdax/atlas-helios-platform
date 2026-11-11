import React from 'react';
import { render, renderHook, screen, waitFor, act } from '@testing-library/react';
import { DATA_STATES } from '@atlas/dashboard-data';
import { dashboardFixtures } from '@atlas/dashboard-data/src/fixtures';

import {
  useDashboardData,
  useLiveDashboardData,
  DashboardDataProvider,
  formatFreshness
} from './useDashboardData';
import { createDashboardGateway } from './dashboardGateway';

/**
 * Integration tests for the React half of the data layer.
 *
 * The lifecycle itself is proved in `@atlas/dashboard-data`'s own suite, with
 * no renderer involved. What is left to check here is the wiring that only
 * exists in React: that the hook actually drives a store, that the provider
 * short-circuits the live machinery completely, and that the gateway asks the
 * API for the right things - including the detail that broke the old
 * dashboard, reading a total from `meta.total` rather than counting a page.
 */

const payloads = {
  properties: {
    total: { data: [], meta: { total: 1284, limit: 1 } },
    highRisk: {
      meta: { total: 47 },
      data: [{ id: 'p1', address: '1247 Oak Ridge Dr', damage_probability: 94 }]
    }
  },
  storms: { meta: { total: 2 }, data: [] },
  assessments: { meta: { total: 18 }, data: [] },
  alerts: { meta: { count: 3 }, features: [] }
};

const stubGateway = (overrides = {}) => ({
  properties: async () => payloads.properties,
  storms: async () => payloads.storms,
  assessments: async () => payloads.assessments,
  alerts: async () => payloads.alerts,
  ...overrides
});

beforeEach(() => {
  window.localStorage.clear();
});

/* ------------------------------------------------------------- live hook -- */

test('the hook starts empty and fills in from the gateway', async () => {
  const { result } = renderHook(() => useLiveDashboardData({ gateway: stubGateway(), pollMs: 0 }));

  // Nothing is asserted before the first read lands.
  expect(result.current.state).toBe(DATA_STATES.SYNCING);
  expect(result.current.summary.totalProperties).toBe(0);

  await waitFor(() => expect(result.current.fetchedAt).not.toBeNull());

  expect(result.current.summary).toEqual({
    totalProperties: 1284, activeStorms: 2, highRiskProperties: 47, recentAssessments: 18, weatherAlerts: 3
  });
  expect(result.current.priorityProperties[0].address).toBe('1247 Oak Ridge Dr');
  // No socket in a test environment, so the honest answer is STALE, not LIVE.
  expect(result.current.state).toBe(DATA_STATES.STALE);
  expect(result.current.description.label).toBe('STALE');
});

test('a failed lane is DEGRADED and names itself, with the others intact', async () => {
  const { result } = renderHook(() => useLiveDashboardData({
    pollMs: 0,
    gateway: stubGateway({
      alerts: async () => { throw Object.assign(new Error('down'), { code: 'ALERTS_UNAVAILABLE' }); }
    })
  }));

  await waitFor(() => expect(result.current.state).toBe(DATA_STATES.DEGRADED));
  expect(result.current.failedSources).toEqual(['alerts']);
  expect(result.current.summary.totalProperties).toBe(1284);
  expect(result.current.recoverable).toBe(true);
});

test('every lane failing is OFFLINE', async () => {
  const boom = async () => { throw Object.assign(new Error('no'), { code: 'NETWORK' }); };
  const { result } = renderHook(() => useLiveDashboardData({
    pollMs: 0,
    gateway: { properties: boom, storms: boom, assessments: boom, alerts: boom }
  }));

  await waitFor(() => expect(result.current.state).toBe(DATA_STATES.OFFLINE));
  expect(result.current.failedSources).toHaveLength(4);
});

test('a snapshot cached by one mount paints the next one before the network answers', async () => {
  const first = renderHook(() => useLiveDashboardData({ gateway: stubGateway(), pollMs: 0 }));
  await waitFor(() => expect(first.result.current.fetchedAt).not.toBeNull());
  first.unmount();

  // A second mount with nothing reachable: the numbers are there anyway.
  const boom = async () => { throw Object.assign(new Error('no'), { code: 'NETWORK' }); };
  const second = renderHook(() => useLiveDashboardData({
    pollMs: 0,
    gateway: { properties: boom, storms: boom, assessments: boom, alerts: boom }
  }));

  expect(second.result.current.summary.totalProperties).toBe(1284);
  expect(second.result.current.fromCache).toBe(true);
  await waitFor(() => expect(second.result.current.state).toBe(DATA_STATES.OFFLINE));
  expect(second.result.current.summary.totalProperties).toBe(1284);
});

test('refresh re-reads on demand', async () => {
  let calls = 0;
  const { result } = renderHook(() => useLiveDashboardData({
    pollMs: 0,
    gateway: stubGateway({ storms: async () => { calls += 1; return payloads.storms; } })
  }));

  // Wait for the first read to *settle*, not merely to have been issued: an
  // overlapping refresh deliberately joins the one in flight rather than
  // doubling the load, so asserting on the call count mid-flight would be
  // asserting on the dedupe instead of on refresh.
  await waitFor(() => expect(result.current.fetchedAt).not.toBeNull());
  expect(calls).toBe(1);

  await act(async () => { await result.current.refresh(); });
  expect(calls).toBe(2);
});

test('the browser going offline is reflected without a fetch', async () => {
  const { result } = renderHook(() => useLiveDashboardData({ gateway: stubGateway(), pollMs: 0 }));
  await waitFor(() => expect(result.current.fetchedAt).not.toBeNull());

  await act(async () => { window.dispatchEvent(new Event('offline')); });
  expect(result.current.state).toBe(DATA_STATES.OFFLINE);

  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(result.current.state).not.toBe(DATA_STATES.OFFLINE);
});

/* --------------------------------------------------------- mock provider -- */

test('the provider supplies a view and the live machinery never starts', async () => {
  const fixtures = dashboardFixtures();
  let gatewayCalled = false;
  const spy = { properties: async () => { gatewayCalled = true; return payloads.properties; } };

  const Consumer = () => {
    const { state, summary, description, failedSources } = useDashboardData({ gateway: spy });
    return (
      <div>
        <span data-testid="state">{state}</span>
        <span data-testid="label">{description.label}</span>
        <span data-testid="alerts">{summary.weatherAlerts}</span>
        <span data-testid="failed">{failedSources.join(',')}</span>
      </div>
    );
  };

  render(
    <DashboardDataProvider value={fixtures[DATA_STATES.DEGRADED]}>
      <Consumer />
    </DashboardDataProvider>
  );

  expect(screen.getByTestId('state')).toHaveTextContent(DATA_STATES.DEGRADED);
  expect(screen.getByTestId('label')).toHaveTextContent('DEGRADED');
  expect(screen.getByTestId('alerts')).toHaveTextContent('3');
  expect(screen.getByTestId('failed')).toHaveTextContent('alerts');

  // The important half: no store, no fetch, no socket.
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(gatewayCalled).toBe(false);
});

test('without a provider the hook falls through to the live store', async () => {
  const Consumer = () => {
    const { summary } = useDashboardData({ gateway: stubGateway(), pollMs: 0 });
    return <span data-testid="total">{summary.totalProperties}</span>;
  };

  render(<Consumer />);
  await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('1284'));
});

/* --------------------------------------------------------------- gateway -- */

test('the gateway asks for a total rather than a page of rows', async () => {
  const seen = [];
  const client = {
    properties: { list: async (params) => { seen.push(params); return { data: [], meta: { total: 1284 } }; } },
    storms: { list: async (params) => { seen.push(params); return payloads.storms; } },
    assessments: { history: async (params) => { seen.push(params); return payloads.assessments; } },
    radar: { alerts: async (params) => { seen.push(params); return payloads.alerts; } }
  };

  const gateway = createDashboardGateway({ client, area: 'TX', priorityLimit: 5 });

  const properties = await gateway.properties();
  expect(properties.total.meta.total).toBe(1284);
  expect(seen[0]).toEqual({ limit: 1 });
  expect(seen[1]).toEqual({ min_risk: 70, sort: 'damage_probability', order: 'desc', limit: 5 });

  await gateway.storms();
  expect(seen[2]).toEqual({ status: 'active', limit: 25 });

  await gateway.assessments();
  expect(seen[3].limit).toBe(10);
  expect(typeof seen[3].since).toBe('string');

  await gateway.alerts();
  expect(seen[4]).toEqual({ area: 'TX' });
});

test('the alert lane is national when no area is configured', async () => {
  const seen = [];
  const client = { radar: { alerts: async (params) => { seen.push(params); return payloads.alerts; } } };
  await createDashboardGateway({ client }).alerts();
  expect(seen[0]).toEqual({});
});

/* ------------------------------------------------------------- freshness -- */

test('freshness reads in the unit a human would use', () => {
  const now = 1_700_000_000_000;
  expect(formatFreshness(null).relative).toBe('never');
  expect(formatFreshness(now - 2_000, now).relative).toBe('just now');
  expect(formatFreshness(now - 45_000, now).relative).toBe('45s ago');
  expect(formatFreshness(now - 5 * 60_000, now).relative).toBe('5m ago');
  expect(formatFreshness(now - 3 * 3600_000, now).relative).toBe('3h ago');
  expect(formatFreshness(now - 2 * 86400_000, now).relative).toBe('2d ago');
  expect(formatFreshness(now, now).absolute).toBe(new Date(now).toLocaleTimeString());
});
