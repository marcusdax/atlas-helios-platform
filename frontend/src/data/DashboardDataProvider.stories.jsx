import React from 'react';
import { DATA_STATES } from '@atlas/dashboard-data';
import { dashboardFixtures } from '@atlas/dashboard-data/src/fixtures';
import { DashboardDataProvider, useDashboardData } from './useDashboardData';

/**
 * The mock provider itself.
 *
 * `useDashboardData` normally builds a store, opens a socket and starts
 * polling. Wrapped in `DashboardDataProvider` it returns the view it is given
 * and the live machinery never starts - which is what makes a component that
 * reads the hook directly renderable in a story, in a test, or in a visual
 * regression run, with no network, no socket and no clock.
 *
 * Note what is NOT here: any data. The provider takes a view as a prop and
 * imports no fixtures, so nothing in this seam can leak demo numbers into a
 * production bundle.
 */
const fixtures = dashboardFixtures();

export default {
  title: 'Data layer/DashboardDataProvider',
  tags: ['autodocs']
};

/** A consumer that reads the hook rather than props, to prove the seam works. */
function SummaryConsumer() {
  const { state, summary, description, fetchedAt, failedSources, recoverable } = useDashboardData();

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
      <dt className="text-neutral-400">state</dt>
      <dd className="font-mono text-neutral-100">{state}</dd>
      <dt className="text-neutral-400">label</dt>
      <dd className="text-neutral-100">{description.label} — {description.hint}</dd>
      <dt className="text-neutral-400">properties</dt>
      <dd className="font-mono text-neutral-100">{summary.totalProperties.toLocaleString()}</dd>
      <dt className="text-neutral-400">alerts</dt>
      <dd className="font-mono text-neutral-100">{summary.weatherAlerts}</dd>
      <dt className="text-neutral-400">failed feeds</dt>
      <dd className="font-mono text-neutral-100">{failedSources.length ? failedSources.join(', ') : 'none'}</dd>
      <dt className="text-neutral-400">retry offered</dt>
      <dd className="font-mono text-neutral-100">{String(recoverable)}</dd>
      <dt className="text-neutral-400">fetchedAt</dt>
      <dd className="font-mono text-neutral-100">{fetchedAt ?? 'null'}</dd>
    </dl>
  );
}

export const EveryState = {
  name: 'The hook under the provider',
  render: () => (
    <div className="space-y-6">
      {Object.keys(fixtures).map((name) => (
        <div key={name} className="glass-card max-w-xl">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">{name}</h3>
          <DashboardDataProvider value={fixtures[name]}>
            <SummaryConsumer />
          </DashboardDataProvider>
        </div>
      ))}
    </div>
  )
};

export const Degraded = {
  name: 'DEGRADED',
  render: () => (
    <div className="glass-card max-w-xl">
      <DashboardDataProvider value={fixtures[DATA_STATES.DEGRADED]}>
        <SummaryConsumer />
      </DashboardDataProvider>
    </div>
  )
};
