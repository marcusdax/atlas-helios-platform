import React from 'react';
import {
  CloudIcon,
  MapIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { DATA_STATES, HIGH_RISK_THRESHOLD } from '@atlas/dashboard-data';
import { Skeleton, treatmentFor, tonesFor } from './DataStateBadge';

/**
 * The five figures across the top of the dashboard.
 *
 * Two things changed here when the mock dataset came out.
 *
 * The invented deltas went with it. Every tile used to carry a trend -
 * "+2.5%", "-12%" - that was a string literal, not a measurement. There is no
 * endpoint behind a week-over-week change yet, so the caption now says
 * something true about the figure above it instead of inventing a direction
 * for it to be moving in.
 *
 * And a tile now renders its data state rather than assuming it has data. The
 * same "47" means three different things depending on whether it arrived a
 * second ago, arrived an hour ago, or is the last value anyone saw before the
 * feed that produces it went down - so a tile whose own lane failed says so,
 * on the tile, where the number is.
 */

/** Which read lane each tile depends on, so a failure dims only what it touches. */
const TILES = [
  {
    key: 'totalProperties',
    label: 'Total Properties',
    source: 'properties',
    icon: MapIcon,
    caption: () => 'On file for this company'
  },
  {
    key: 'activeStorms',
    label: 'Active Storms',
    source: 'storms',
    icon: CloudIcon,
    caption: (value) => (value > 0 ? 'Tracking now' : 'Nothing tracking')
  },
  {
    key: 'highRiskProperties',
    label: 'High-Risk Properties',
    source: 'properties',
    icon: ExclamationTriangleIcon,
    caption: () => `At or above ${HIGH_RISK_THRESHOLD}% damage probability`
  },
  {
    key: 'recentAssessments',
    label: 'Assessments (24h)',
    source: 'assessments',
    icon: ClipboardDocumentCheckIcon,
    caption: (value) => (value > 0 ? 'Completed in the last day' : 'None in the last day')
  },
  {
    key: 'weatherAlerts',
    label: 'Weather Alerts',
    source: 'alerts',
    icon: CloudIcon,
    caption: (value) => (value > 0 ? 'Active NWS alerts' : 'No active alerts')
  }
];

/**
 * @param {object} props
 * @param {import('@atlas/dashboard-data').DashboardSummary} props.data
 * @param {import('@atlas/dashboard-data').DataState} [props.state]
 * @param {string[]} [props.failedSources]
 */
const QuickStats = ({ data, state = DATA_STATES.LIVE, failedSources = [] }) => {
  const treatment = treatmentFor(state);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {TILES.map((tile) => {
        const Icon = tile.icon;
        const value = Number(data?.[tile.key] ?? 0);
        const laneDown = failedSources.includes(tile.source);
        const tone = tonesFor(laneDown ? DATA_STATES.DEGRADED : state);

        // A tile whose own lane is down is marked individually: the dashboard
        // badge says "something", the tile says "this one".
        const borderClass = laneDown
          ? 'border-amber-500/40'
          : state === DATA_STATES.OFFLINE ? 'border-red-500/20' : 'border-neutral-800';

        return (
          <div
            key={tile.key}
            className={`glass-card relative overflow-hidden transition-colors ${borderClass}`}
          >
            {/* A hairline in the state's colour: the fastest read on the card. */}
            <span className={`absolute inset-x-0 top-0 h-0.5 ${tone.accent}`} aria-hidden="true" />

            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-sm font-medium text-neutral-400">{tile.label}</p>

                {treatment.skeleton ? (
                  <Skeleton className="my-1 h-8 w-20" />
                ) : (
                  <p className={`text-3xl font-bold text-neutral-100 ${treatment.dim}`}>
                    {value.toLocaleString()}
                  </p>
                )}

                {treatment.skeleton ? (
                  <Skeleton className="mt-2 h-3 w-28" />
                ) : laneDown ? (
                  <p className={`mt-1 text-sm ${tone.text}`}>Last known — feed unavailable</p>
                ) : state === DATA_STATES.OFFLINE ? (
                  <p className="mt-1 text-sm text-neutral-500">Cached on this device</p>
                ) : (
                  // Two lines rather than a truncation: "At or above ..." told
                  // a reader nothing, and the threshold is the point of the tile.
                  <p className="mt-1 text-sm leading-snug text-neutral-500">
                    {tile.caption(value)}
                  </p>
                )}
              </div>

              <div className={`rounded-lg border p-3 ${tone.border} ${tone.bg} ${tone.text} ${treatment.dim}`}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default QuickStats;
