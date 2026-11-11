import React from 'react';
import { ChartBarIcon, InboxIcon } from '@heroicons/react/24/outline';
import { DATA_STATES } from '@atlas/dashboard-data';
import DataStateBadge, { DataStateNote, Skeleton, treatmentFor } from '../ui/DataStateBadge';
import { formatFreshness } from '../../data/useDashboardData';

/**
 * The activity feed, in five states.
 *
 * It lives in its own file for two reasons. The page was 330 lines of JSX with
 * the state handling tangled into it, and - more usefully - a panel that
 * renders five ways needs to be looked at five ways, which means it has to be
 * mountable with a view handed to it rather than fetched under it. That is what
 * the stories and the component tests do.
 *
 * The rows themselves are already-composed sentences from the data layer. A
 * panel that built its own copy from `event.type` would be a second place for
 * the wording to drift.
 */

const SEVERITY_DOT = {
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-blue-500'
};

const Rows = ({ count = 3 }) => (
  <div className="space-y-4" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="flex items-start space-x-3 rounded-lg bg-neutral-800 p-3">
        <Skeleton className="mt-2 h-2 w-2 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * @param {object} props
 * @param {import('@atlas/dashboard-data').ActivityEvent[]} props.activity
 * @param {import('@atlas/dashboard-data').DataState} props.state
 * @param {string[]} [props.failedSources]
 * @param {number|null} [props.fetchedAt]
 * @param {() => void} [props.onRetry]
 */
export function ActivityFeed({
  activity = [],
  state = DATA_STATES.LIVE,
  failedSources = [],
  fetchedAt = null,
  onRetry
}) {
  const treatment = treatmentFor(state);
  // Only the very first read shows skeletons. A refresh over data already on
  // screen must not blank it - that flicker is how a dashboard trains its
  // operator to distrust it.
  const firstRead = state === DATA_STATES.SYNCING && fetchedAt === null;

  return (
    <section aria-label="Recent activity">
      <div className="dashboard-card-header">
        <ChartBarIcon className="dashboard-card-icon" />
        <h2 className="dashboard-card-title">Recent Activity</h2>
        <DataStateBadge state={state} compact className="ml-auto" />
      </div>

      <DataStateNote
        state={state}
        failedSources={failedSources}
        fetchedAt={fetchedAt}
        onRetry={onRetry}
      />

      {firstRead ? (
        <Rows />
      ) : activity.length === 0 ? (
        <div className="py-8 text-center">
          <InboxIcon className="mx-auto mb-3 h-10 w-10 text-neutral-600" aria-hidden="true" />
          {/*
            "Nothing happened" and "we cannot see what happened" are different
            facts, and an empty panel that does not say which is the single most
            misleading thing a dashboard can show.
          */}
          <p className="text-sm text-neutral-400">
            {state === DATA_STATES.OFFLINE
              ? 'No activity was cached on this device.'
              : 'Nothing has happened in the last 24 hours.'}
          </p>
        </div>
      ) : (
        <ul className={`space-y-4 ${treatment.dim}`}>
          {activity.map((event) => {
            const when = formatFreshness(event.timestamp);
            return (
              <li
                key={event.id}
                className="flex items-start space-x-3 rounded-lg bg-neutral-800 p-3 transition-colors hover:bg-neutral-700"
              >
                <span
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[event.severity] || SEVERITY_DOT.info}`}
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <p className="text-sm text-neutral-100">{event.message}</p>
                  <p className="mt-1 text-xs text-neutral-400" title={when.absolute || undefined}>
                    {when.relative}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default ActivityFeed;
