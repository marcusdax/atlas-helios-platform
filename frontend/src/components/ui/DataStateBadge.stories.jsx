import React from 'react';
import { DATA_STATES } from '@atlas/dashboard-data';
import { dashboardFixtures } from '@atlas/dashboard-data/src/fixtures';
import DataStateBadge, { DataStateNote } from './DataStateBadge';

/**
 * The five data states, side by side.
 *
 * The gallery is the point: the states have to be distinguishable from each
 * other at a glance, and the only way to know that is to see them together.
 * Every view comes from the shared fixtures, which the data layer's own tests
 * feed back through `deriveState` - so a badge labelled DEGRADED here is
 * showing a view the real state machine would also call DEGRADED.
 */
const fixtures = dashboardFixtures();

export default {
  title: 'Data layer/DataStateBadge',
  component: DataStateBadge,
  tags: ['autodocs'],
  argTypes: {
    state: { control: 'select', options: Object.values(DATA_STATES) }
  }
};

const Row = ({ state }) => {
  const view = fixtures[state];
  return (
    <div className="flex flex-col gap-2 border-b border-neutral-800 py-4 last:border-0">
      <DataStateBadge
        state={view.state}
        fetchedAt={view.fetchedAt}
        failedSources={view.failedSources}
        fetching={view.fetching}
        onRetry={() => {}}
      />
      <p className="text-xs text-neutral-500">{view.description}</p>
    </div>
  );
};

export const AllStates = {
  name: 'All five states',
  render: () => (
    <div className="max-w-xl">
      {Object.values(DATA_STATES).map((state) => <Row key={state} state={state} />)}
    </div>
  )
};

export const Compact = {
  name: 'Compact (panel headers)',
  render: () => (
    <div className="flex flex-wrap gap-3">
      {Object.values(DATA_STATES).map((state) => (
        <DataStateBadge key={state} state={state} compact />
      ))}
    </div>
  )
};

export const Notes = {
  name: 'Panel notes',
  render: () => (
    <div className="max-w-xl space-y-1">
      {Object.values(DATA_STATES).map((state) => (
        <DataStateNote
          key={state}
          state={state}
          failedSources={fixtures[state].failedSources}
          fetchedAt={fixtures[state].fetchedAt}
          onRetry={() => {}}
        />
      ))}
      <p className="pt-2 text-xs text-neutral-500">
        LIVE and SYNCING render nothing here on purpose: a note that appears in
        every state is a note nobody reads.
      </p>
    </div>
  )
};

export const Playground = {
  args: { state: DATA_STATES.DEGRADED, fetchedAt: Date.now() - 45_000, failedSources: ['alerts'] }
};
