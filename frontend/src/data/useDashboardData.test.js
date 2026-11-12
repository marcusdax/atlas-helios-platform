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
  alerts: { meta: { count: 3 }, features: [] },
  forecast: {
    source: 'nws',
    properties: {
      periods: [
        { startTime: '2026-03-14T18:00:00Z', temperature: 71, windSpeed: '10 to 15 mph', probabilityOfPrecipitation: { value: 40 }, shortForecast: 'Showers Likely' }
      ]
    }
  }
};

const stubGateway = (overrides = {}) => ({
  properties: async () => payloads.properties,
  storms: async () => payloads.storms,
  assessments: async () => payloads.assessments,
  alerts: async () => payloads.alerts,
  forecast: async () => payloads.forecast,
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

test('the forecast lane lands with its provenance', async () => {
  const { result } = renderHook(() => useLiveDashboardData({ gateway: stubGateway(), pollMs: 0 }));
  await waitFor(() => expect(result.current.fetchedAt).not.toBeNull());

  expect(result.current.forecast).toHaveLength(1);
  expect(result.current.forecast[0].precipitationProbability).toBe(40);
  expect(result.current.forecast[0].windSpeed).toBe(15);
  expect(result.current.forecastSource).toBe('nws');
});

test('a forecast outage degrades that lane alone', async () => {
  // This is the lane most likely to fail in the field: it proxies
  // api.weather.gov, which answers 503 WEATHER_UNAVAILABLE often enough that
  // the chart has to survive it without taking the page with it.
  const { result } = renderHook(() => useLiveDashboardData({
    pollMs: 0,
    gateway: stubGateway({
      forecast: async () => { throw Object.assign(new Error('down'), { code: 'WEATHER_UNAVAILABLE' }); }
    })
  }));

  await waitFor(() => expect(result.current.state).toBe(DATA_STATES.DEGRADED));
  expect(result.current.failedSources).toEqual(['forecast']);
  expect(result.current.summary.totalProperties).toBe(1284, 'the rest of the page still works');
  expect(result.current.sources.forecast.code).toBe('WEATHER_UNAVAILABLE');
});

test('the map and the dispatch queue come from one read', async () => {
  // Two reads would let the pins and the list disagree about who the worst
  // roof is, which is the kind of discrepancy nobody can reproduce.
  const { result } = renderHook(() => useLiveDashboardData({
    pollMs: 0,
    gateway: stubGateway({
      properties: async () => ({
        total: { meta: { total: 3 } },
        highRisk: {
          meta: { total: 3 },
          data: [
            { id: 'p1', address: 'Geocoded A', damage_probability: 94, latitude: 32.7, longitude: -96.8 },
            { id: 'p2', address: 'Ungeocoded', damage_probability: 90 },
            { id: 'p3', address: 'Geocoded B', damage_probability: 71, latitude: 32.8, longitude: -96.9 }
          ]
        }
      })
    })
  }));

  await waitFor(() => expect(result.current.fetchedAt).not.toBeNull());

  expect(result.current.priorityProperties.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  // The map only pins what has coordinates - an ungeocoded row would otherwise
  // land at 0,0, in the Gulf of Guinea.
  expect(result.current.mapProperties.map((p) => p.id)).toEqual(['p1', 'p3']);
});

test('one live provider serves many consumers from a single set of reads', async () => {
  // The claim this guards: a second panel that wants the same figures asks for
  // them rather than fetching them again. Two stores on one screen would
  // double the request load and drift apart between polls - two counts on one
  // screen, differing by a poll interval, is a bug nobody can reproduce.
  const calls = { properties: 0 };
  const gateway = stubGateway({
    properties: async () => { calls.properties += 1; return payloads.properties; }
  });

  const Consumer = ({ id }) => {
    const { summary } = useDashboardData();
    return <span data-testid={id}>{summary.totalProperties}</span>;
  };

  render(
    <DashboardDataProvider gateway={gateway} pollMs={0}>
      <Consumer id="a" />
      <Consumer id="b" />
      <Consumer id="c" />
    </DashboardDataProvider>
  );

  await waitFor(() => expect(screen.getByTestId('a')).toHaveTextContent('1284'));
  expect(screen.getByTestId('b')).toHaveTextContent('1284');
  expect(screen.getByTestId('c')).toHaveTextContent('1284');
  expect(calls.properties).toBe(1);
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
  // One read serves the queue and the map, so it asks for enough rows to be
  // worth pinning - the queue then shows the worst few of the same list.
  expect(seen[1]).toEqual({ min_risk: 70, sort: 'damage_probability', order: 'desc', limit: 50 });

  await gateway.storms();
  expect(seen[2]).toEqual({ status: 'active', limit: 25 });

  await gateway.assessments();
  expect(seen[3].limit).toBe(10);
  expect(typeof seen[3].since).toBe('string');

  await gateway.alerts();
  expect(seen[4]).toEqual({ area: 'TX' });
});

test('the forecast lane asks the monitored region, not a hardcoded city', async () => {
  const seen = [];
  const client = {
    storms: {
      regions: async () => ({
        data: [
          // A region with no usable centre must not become the forecast point.
          { name: 'Unconfigured', center: null },
          { name: 'Dallas Metro Area', center: { lat: 32.7767, lng: -96.797 } },
          { name: 'Houston Metro Area', center: { lat: 29.7604, lng: -95.3698 } }
        ]
      })
    },
    weather: { hourly: async (params) => { seen.push(params); return payloads.forecast; } }
  };

  const gateway = createDashboardGateway({ client });
  await gateway.forecast();
  expect(seen[0]).toEqual({ lat: 32.7767, lng: -96.797 });

  // The region list changes when someone edits settings, not between polls.
  await gateway.forecast();
  expect(seen).toHaveLength(2);
  expect(seen[1]).toEqual(seen[0]);
});

test('a JSON centre that arrived as a string still resolves', async () => {
  // `monitoring_regions.center` is a JSON column, and some drivers hand it
  // back as text.
  const seen = [];
  const client = {
    storms: { regions: async () => ({ data: [{ name: 'Dallas', center: '{"lat":32.7767,"lng":-96.797}' }] }) },
    weather: { hourly: async (params) => { seen.push(params); return payloads.forecast; } }
  };
  await createDashboardGateway({ client }).forecast();
  expect(seen[0]).toEqual({ lat: 32.7767, lng: -96.797 });
});

test('a failed region lookup does not cascade into a failed forecast', async () => {
  const seen = [];
  const client = {
    storms: { regions: async () => { throw Object.assign(new Error('nope'), { code: 'NETWORK' }); } },
    weather: { hourly: async (params) => { seen.push(params); return payloads.forecast; } }
  };

  const gateway = createDashboardGateway({ client, location: { lat: 30.2672, lng: -97.7431 } });
  await gateway.forecast();
  expect(seen[0]).toEqual({ lat: 30.2672, lng: -97.7431 });
});

test('no region and no default means an empty forecast, not a guessed city', async () => {
  const client = {
    storms: { regions: async () => ({ data: [] }) },
    weather: { hourly: async () => { throw new Error('should not be called'); } }
  };

  const payload = await createDashboardGateway({ client }).forecast();
  expect(payload.properties.periods).toEqual([]);
  expect(payload.source).toBeNull();
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
