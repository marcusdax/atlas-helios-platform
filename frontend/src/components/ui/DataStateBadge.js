import React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { DATA_STATES, describeState } from '@atlas/dashboard-data';
import { formatFreshness, useFreshnessLabel } from '../../data/useDashboardData';

/**
 * The HUD status chip, and the shared palette behind every data state.
 *
 * Five states rendered by five components is five chances to invent a sixth
 * vocabulary. The copy comes from `describeState` in the data layer; the only
 * thing this file adds is how a `tone` looks in Tailwind - which means a theme
 * change is one edit here and the mobile app can reuse the same state names
 * with its own palette.
 *
 * The states are deliberately distinguishable by more than colour: each has its
 * own label, its own dot treatment (pulsing, solid, hollow, barred) and its own
 * hint, so the badge still reads for an operator with a colour vision
 * deficiency or a sunlit tablet.
 */

/** tone -> the classes that express it. Imported by the cards and panels. */
export const TONES = {
  positive: {
    text: 'text-emerald-300', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10',
    dot: 'bg-emerald-400', accent: 'bg-emerald-400'
  },
  info: {
    text: 'text-sky-300', border: 'border-sky-500/30', bg: 'bg-sky-500/10',
    dot: 'bg-sky-400', accent: 'bg-sky-400'
  },
  neutral: {
    text: 'text-neutral-300', border: 'border-neutral-600/60', bg: 'bg-neutral-700/20',
    dot: 'bg-neutral-400', accent: 'bg-neutral-500'
  },
  warning: {
    text: 'text-amber-300', border: 'border-amber-500/40', bg: 'bg-amber-500/10',
    dot: 'bg-amber-400', accent: 'bg-amber-400'
  },
  critical: {
    text: 'text-red-300', border: 'border-red-500/40', bg: 'bg-red-500/10',
    dot: 'bg-red-400', accent: 'bg-red-400'
  }
};

export const tonesFor = (state) => TONES[describeState(state).tone] || TONES.neutral;

/**
 * How each state marks the data it sits above.
 *
 * `dim` is what makes STALE and OFFLINE legible at a glance without reading
 * the badge: the numbers are still there, they just stop looking authoritative.
 */
export const STATE_TREATMENT = {
  [DATA_STATES.LIVE]: { dim: '', skeleton: false },
  [DATA_STATES.SYNCING]: { dim: '', skeleton: true },
  [DATA_STATES.STALE]: { dim: 'opacity-70', skeleton: false },
  [DATA_STATES.DEGRADED]: { dim: 'opacity-90', skeleton: false },
  [DATA_STATES.OFFLINE]: { dim: 'opacity-50 saturate-50', skeleton: false }
};

export const treatmentFor = (state) => STATE_TREATMENT[state] || STATE_TREATMENT[DATA_STATES.STALE];

/** The dot: four visually distinct treatments, not four shades of one. */
function StateDot({ state, tone }) {
  if (state === DATA_STATES.OFFLINE) {
    // Barred, so "no signal" does not rely on red alone.
    return (
      <span className="relative inline-flex h-2.5 w-2.5 items-center justify-center" aria-hidden="true">
        <span className={`h-2.5 w-2.5 rounded-full border ${tone.border} ${tone.bg}`} />
        <span className={`absolute h-0.5 w-3 rotate-45 rounded ${tone.dot}`} />
      </span>
    );
  }
  if (state === DATA_STATES.STALE) {
    // Hollow: present but not asserting anything.
    return <span className={`h-2.5 w-2.5 rounded-full border-2 ${tone.border}`} aria-hidden="true" />;
  }
  if (state === DATA_STATES.DEGRADED) {
    return <span className={`h-2.5 w-2.5 rotate-45 ${tone.dot}`} aria-hidden="true" />;
  }
  const described = describeState(state);
  return (
    <span className="relative inline-flex h-2.5 w-2.5" aria-hidden="true">
      {described.pulse && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${tone.dot}`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${tone.dot}`} />
    </span>
  );
}

/**
 * @param {object} props
 * @param {import('@atlas/dashboard-data').DataState} props.state
 * @param {number|null} [props.fetchedAt]
 * @param {string[]} [props.failedSources]
 * @param {boolean} [props.fetching]
 * @param {() => void} [props.onRetry]
 * @param {boolean} [props.compact]
 */
export function DataStateBadge({
  state,
  fetchedAt = null,
  failedSources = [],
  fetching = false,
  onRetry,
  compact = false,
  className = ''
}) {
  const described = describeState(state);
  const tone = tonesFor(state);
  const freshness = useFreshnessLabel(fetchedAt);

  // Naming the lane is the difference between "something is wrong" and a
  // report an operator can act on, or hand to support.
  const detail = failedSources.length > 0
    ? `${described.hint} Unavailable: ${failedSources.join(', ')}.`
    : described.hint;

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 ${tone.border} ${tone.bg} ${className}`}
      /*
        One live region per page, not per badge.
        
        The full badge announces the state; the compact echoes in the panel
        headers are a visual repetition of it. Making each of those a live
        region too meant a screen reader heard "Some feeds are unavailable"
        three times for one outage, and read the same hint again from the
        visible note beside it.
      */
      role={compact ? undefined : 'status'}
      aria-live={compact ? undefined : 'polite'}
      aria-hidden={compact || undefined}
      title={detail}
    >
      <StateDot state={state} tone={tone} />

      <span className={`text-xs font-semibold uppercase tracking-widest ${tone.text}`}>
        {described.label}
      </span>

      {!compact && fetchedAt !== null && (
        <span className="text-xs text-neutral-500" title={freshness.absolute || undefined}>
          {freshness.relative}
        </span>
      )}

      {!compact && failedSources.length > 0 && (
        <span className={`text-xs ${tone.text}`}>
          {failedSources.length} feed{failedSources.length === 1 ? '' : 's'} down
        </span>
      )}

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={fetching}
          aria-label="Refresh dashboard data"
          className="rounded-full p-0.5 text-neutral-400 transition hover:text-neutral-100 disabled:cursor-not-allowed
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${fetching ? 'animate-spin' : ''}`} />
        </button>
      )}

      {/* The hint is read out but not shown: the chip stays one line wide. */}
      {!compact && <span className="sr-only">{detail}</span>}
    </div>
  );
}

/** A shimmering placeholder, for SYNCING where there is nothing to show yet. */
export const Skeleton = ({ className = '', ...rest }) => (
  <span
    {...rest}
    className={`block animate-pulse rounded bg-neutral-700/60 ${className}`}
    aria-hidden="true"
  />
);

/**
 * The one-line explanation a panel puts above its content when the data below
 * it cannot be fully vouched for. Renders nothing when everything is fine, so
 * a caller can drop it in unconditionally.
 */
export function DataStateNote({ state, failedSources = [], fetchedAt = null, onRetry }) {
  if (state === DATA_STATES.LIVE || state === DATA_STATES.SYNCING) return null;

  const described = describeState(state);
  const tone = tonesFor(state);
  const freshness = formatFreshness(fetchedAt);

  return (
    <p className={`mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-xs ${tone.border} ${tone.bg} ${tone.text}`}>
      <span>{described.hint}</span>
      {failedSources.length > 0 && <span className="text-neutral-400">Unavailable: {failedSources.join(', ')}.</span>}
      {fetchedAt !== null && <span className="text-neutral-500">Last read {freshness.relative}.</span>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-semibold underline underline-offset-2 hover:no-underline
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          Retry
        </button>
      )}
    </p>
  );
}

export default DataStateBadge;
