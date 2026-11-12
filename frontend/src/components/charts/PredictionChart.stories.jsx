import React from 'react';
import { DATA_STATES } from '@atlas/dashboard-data';
import { dashboardFixtures } from '@atlas/dashboard-data/src/fixtures';
import PredictionChart from './PredictionChart';

/**
 * The precipitation outlook, in every state it can be in.
 *
 * Worth looking at as a set, because the states this panel can reach are the
 * reason it was rewritten: it used to be two stacked arrays of literals that
 * could only ever render one way.
 */
const fixtures = dashboardFixtures();

export default {
  title: 'Dashboard/PredictionChart',
  component: PredictionChart,
  tags: ['autodocs']
};

const Panel = ({ title, ...props }) => (
  <div>
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">{title}</h3>
    <div className="glass-card h-72 max-w-xl">
      <PredictionChart onRetry={() => {}} {...props} />
    </div>
  </div>
);

export const AllStates = {
  name: 'All five states',
  render: () => (
    <div className="space-y-8">
      {Object.values(DATA_STATES).map((state) => {
        const view = fixtures[state];
        return (
          <Panel
            key={state}
            title={state}
            forecast={view.forecast}
            source={view.forecastSource}
            state={view.state}
            failedSources={view.failedSources}
            fetchedAt={view.fetchedAt}
          />
        );
      })}
    </div>
  )
};

/** The one that matters most: a demo feed has to announce itself. */
export const DemoFeed = {
  name: 'Demo feed, labelled',
  render: () => (
    <Panel
      title="source = mock"
      forecast={fixtures[DATA_STATES.LIVE].forecast}
      source="mock"
      state={DATA_STATES.LIVE}
      fetchedAt={fixtures[DATA_STATES.LIVE].fetchedAt}
    />
  )
};

export const ForecastLaneDown = {
  name: 'Forecast lane down, rest of the page healthy',
  render: () => (
    <Panel
      title="DEGRADED — forecast only"
      forecast={fixtures[DATA_STATES.LIVE].forecast}
      source="nws"
      state={DATA_STATES.LIVE}
      failedSources={['forecast']}
      fetchedAt={fixtures[DATA_STATES.LIVE].fetchedAt}
    />
  )
};

export const NoRegionConfigured = {
  name: 'No monitored region',
  render: () => (
    <Panel title="Nothing to forecast for" forecast={[]} state={DATA_STATES.LIVE} fetchedAt={Date.now()} />
  )
};
