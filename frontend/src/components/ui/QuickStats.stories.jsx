import React from 'react';
import { DATA_STATES } from '@atlas/dashboard-data';
import { dashboardFixtures } from '@atlas/dashboard-data/src/fixtures';
import QuickStats from './QuickStats';

const fixtures = dashboardFixtures();

export default {
  title: 'Dashboard/QuickStats',
  component: QuickStats,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
};

const Gallery = ({ states }) => (
  <div className="space-y-10">
    {states.map((name) => {
      const view = fixtures[name];
      return (
        <section key={name}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-400">{name}</h3>
          <p className="mb-4 text-xs text-neutral-500">{view.description}</p>
          <QuickStats data={view.summary} state={view.state} failedSources={view.failedSources} />
        </section>
      );
    })}
  </div>
);

export const AllStates = {
  name: 'All five states',
  render: () => <Gallery states={Object.values(DATA_STATES)} />
};

/**
 * The one worth staring at: the alert lane is down, so that tile alone says
 * "last known" while the other four are current. A single badge at the top of
 * the page could not have told the operator which number to doubt.
 */
export const Degraded = {
  name: 'DEGRADED — one tile marked, four current',
  render: () => <Gallery states={[DATA_STATES.DEGRADED]} />
};

export const Empty = {
  name: 'Empty tenant (everything answered, nothing on file)',
  render: () => <Gallery states={['EMPTY']} />
};
