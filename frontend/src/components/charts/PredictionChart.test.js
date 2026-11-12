import React from 'react';
import { render, screen } from '@testing-library/react';
import { DATA_STATES } from '@atlas/dashboard-data';
import { dashboardFixtures } from '@atlas/dashboard-data/src/fixtures';

import PredictionChart from './PredictionChart';

/**
 * The chart that used to be two stacked arrays of invented numbers.
 *
 * ECharts renders to a canvas/SVG that assertions cannot usefully read, so
 * these tests cover the parts around it that decide whether a reader is being
 * told the truth: the provenance label, the per-state treatments, and the two
 * stats that exist so the plot does not need a second y-axis.
 */

const fixtures = dashboardFixtures();
const live = fixtures[DATA_STATES.LIVE];

test('the peak wind and wettest hour are stated, not plotted on a second axis', () => {
  // A dual-axis chart lets a reader infer a correlation from whatever the two
  // scalings happen to make cross. A single value belongs in a number.
  render(<PredictionChart forecast={live.forecast} state={live.state} fetchedAt={live.fetchedAt} source="nws" />);

  const peakWind = Math.max(...live.forecast.map((p) => p.windSpeed));
  expect(screen.getByText(`${peakWind} mph`)).toBeInTheDocument();
  expect(screen.getByText('Peak wind', { exact: false })).toBeInTheDocument();
  expect(screen.getByText('Wettest hour', { exact: false })).toBeInTheDocument();
});

test('a demo forecast says so', () => {
  // The backend only serves its generator when WEATHER_ALLOW_MOCK is on, and
  // when it does, saying so is the whole difference between this panel and the
  // literal array it replaced.
  render(<PredictionChart forecast={live.forecast} state={live.state} fetchedAt={live.fetchedAt} source="mock" />);
  expect(screen.getByText(/Demo forecast/)).toBeInTheDocument();
});

test('a real forecast carries no such warning', () => {
  render(<PredictionChart forecast={live.forecast} state={live.state} fetchedAt={live.fetchedAt} source="nws" />);
  expect(screen.queryByText(/Demo forecast/)).not.toBeInTheDocument();
});

test('the first read shows placeholders rather than an empty plot', () => {
  const { container } = render(
    <PredictionChart forecast={[]} state={DATA_STATES.SYNCING} fetchedAt={null} />
  );
  expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
});

test('no forecast and no region reads differently from no forecast and an outage', () => {
  const { unmount } = render(
    <PredictionChart forecast={[]} state={DATA_STATES.LIVE} fetchedAt={Date.now()} />
  );
  expect(screen.getByText(/No monitored region is configured/)).toBeInTheDocument();
  unmount();

  render(
    <PredictionChart
      forecast={[]}
      state={DATA_STATES.DEGRADED}
      failedSources={['forecast']}
      fetchedAt={Date.now()}
    />
  );
  expect(screen.getByText('No forecast is available right now.')).toBeInTheDocument();
});

test('a failed forecast lane explains itself even when the page is otherwise healthy', () => {
  const retry = jest.fn();
  render(
    <PredictionChart
      forecast={live.forecast}
      state={DATA_STATES.LIVE}
      failedSources={['forecast']}
      fetchedAt={live.fetchedAt}
      onRetry={retry}
    />
  );
  expect(screen.getByText(/Some feeds are unavailable/)).toBeInTheDocument();
  screen.getByRole('button', { name: 'Retry' }).click();
  expect(retry).toHaveBeenCalled();
});

test('a healthy live chart carries no explanatory note', () => {
  render(<PredictionChart forecast={live.forecast} state={live.state} fetchedAt={live.fetchedAt} source="nws" />);
  expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
});

test('a forecast with no wind reading does not print "NaN mph"', () => {
  render(
    <PredictionChart
      state={DATA_STATES.LIVE}
      fetchedAt={Date.now()}
      forecast={[{ time: Date.now(), temperature: null, precipitationProbability: 20, windSpeed: null, humidity: null, shortForecast: 'Calm' }]}
    />
  );
  expect(screen.getByText('—')).toBeInTheDocument();
  expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
});
