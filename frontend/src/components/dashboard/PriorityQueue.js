import React from 'react';
import { ExclamationTriangleIcon, HomeIcon } from '@heroicons/react/24/outline';
import { DATA_STATES, HIGH_RISK_THRESHOLD } from '@atlas/dashboard-data';
import DataStateBadge, { DataStateNote, Skeleton, treatmentFor } from '../ui/DataStateBadge';
import PropertyList from '../property/PropertyList';

/**
 * The dispatch queue: the properties worth sending a crew to, worst first.
 *
 * The rows are ranked by the API, on the same column the high-risk count
 * filters on, so this panel and the tile above it can never disagree about who
 * the worst roof is. The panel's own job is only to say how much the ranking
 * can be trusted right now.
 */

/**
 * @param {object} props
 * @param {import('@atlas/dashboard-data').PriorityProperty[]} props.properties
 * @param {import('@atlas/dashboard-data').DataState} props.state
 * @param {string[]} [props.failedSources]
 * @param {number|null} [props.fetchedAt]
 * @param {() => void} [props.onRetry]
 */
export function PriorityQueue({
  properties = [],
  state = DATA_STATES.LIVE,
  failedSources = [],
  fetchedAt = null,
  onRetry
}) {
  const treatment = treatmentFor(state);
  const firstRead = state === DATA_STATES.SYNCING && fetchedAt === null;

  return (
    <section aria-label="High priority properties">
      <div className="dashboard-card-header">
        <ExclamationTriangleIcon className="dashboard-card-icon" />
        <h2 className="dashboard-card-title">High Priority Properties</h2>
        <DataStateBadge state={state} compact className="ml-auto" />
      </div>

      <DataStateNote
        state={state}
        failedSources={failedSources}
        fetchedAt={fetchedAt}
        onRetry={onRetry}
      />

      {firstRead ? (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : properties.length === 0 ? (
        <div className="py-8 text-center">
          <HomeIcon className="mx-auto mb-3 h-10 w-10 text-neutral-600" aria-hidden="true" />
          <p className="text-sm text-neutral-400">
            {state === DATA_STATES.OFFLINE
              ? 'No priority queue was cached on this device.'
              : `No property is above the ${HIGH_RISK_THRESHOLD}% dispatch threshold.`}
          </p>
        </div>
      ) : (
        <div className={treatment.dim}>
          <PropertyList properties={properties} compact />
        </div>
      )}
    </section>
  );
}

export default PriorityQueue;
