import React from 'react';
import { DATA_STATES } from '@atlas/dashboard-data';
import { dashboardFixtures } from '@atlas/dashboard-data/src/fixtures';
import ActivityFeed from './ActivityFeed';

const fixtures = dashboardFixtures();

export default {
  title: 'Dashboard/ActivityFeed',
  component: ActivityFeed,
  tags: ['autodocs']
};

const Panel = ({ name }) => {
  const view = fixtures[name];
  return (
    <div className="glass-card max-w-2xl">
      <ActivityFeed
        activity={view.activity}
        state={view.state}
        failedSources={view.failedSources}
        fetchedAt={view.fetchedAt}
        onRetry={() => {}}
      />
    </div>
  );
};

export const AllStates = {
  name: 'All five states',
  render: () => (
    <div className="space-y-8">
      {Object.values(DATA_STATES).map((state) => (
        <div key={state}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">{state}</h3>
          <Panel name={state} />
        </div>
      ))}
    </div>
  )
};

/** Nothing has happened, versus not being able to see what happened. */
export const EmptyVersusOffline = {
  name: 'Empty vs OFFLINE-with-nothing-cached',
  render: () => (
    <div className="space-y-8">
      <Panel name="EMPTY" />
      <div className="glass-card max-w-2xl">
        <ActivityFeed activity={[]} state={DATA_STATES.OFFLINE} fetchedAt={null} onRetry={() => {}} />
      </div>
    </div>
  )
};
