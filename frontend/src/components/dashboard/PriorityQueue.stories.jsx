import React from 'react';
import { DATA_STATES } from '@atlas/dashboard-data';
import { dashboardFixtures } from '@atlas/dashboard-data/src/fixtures';
import PriorityQueue from './PriorityQueue';

const fixtures = dashboardFixtures();

export default {
  title: 'Dashboard/PriorityQueue',
  component: PriorityQueue,
  tags: ['autodocs']
};

export const AllStates = {
  name: 'All five states',
  render: () => (
    <div className="grid gap-8 lg:grid-cols-2">
      {Object.values(DATA_STATES).map((state) => {
        const view = fixtures[state];
        return (
          <div key={state}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">{state}</h3>
            <div className="glass-card">
              <PriorityQueue
                properties={view.priorityProperties}
                state={view.state}
                failedSources={view.failedSources}
                fetchedAt={view.fetchedAt}
                onRetry={() => {}}
              />
            </div>
          </div>
        );
      })}
    </div>
  )
};

/** A property on file that nobody has assessed yet has no instant to show. */
export const NeverAssessed = {
  render: () => (
    <div className="glass-card max-w-md">
      <PriorityQueue
        state={DATA_STATES.LIVE}
        fetchedAt={Date.now()}
        properties={[
          { id: 'p9', address: '77 Unassessed Way', score: 82, risk: 'high', timestamp: null }
        ]}
      />
    </div>
  )
};
