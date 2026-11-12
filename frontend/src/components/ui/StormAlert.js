import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { ACTIVITY_TYPES, SEVERITIES } from '@atlas/dashboard-data';
import { useDashboardData, formatFreshness } from '../../data/useDashboardData';

/**
 * The severe-weather banner, across the top of every page.
 *
 * What this replaced is worth stating plainly, because it was the most
 * dangerous thing in the codebase: a `mockAlert` object - "Severe hail storm
 * detected with high damage probability", 47 properties affected, 2.5 inch
 * hail, Dallas County - shown by `Math.random() < 0.3` on a thirty-second
 * timer. A red full-width banner announcing severe weather that no instrument
 * had observed, to people whose job is to dispatch crews into it.
 *
 * It now shows the worst storm the platform is actually tracking, from the
 * same store the dashboard reads, and shows nothing when there is nothing.
 * Severity comes from the storm row; the wording is the sentence the data
 * layer already composed, so the banner and the activity feed cannot describe
 * the same storm differently.
 */
const StormAlert = () => {
  const { activity } = useDashboardData();
  const [dismissed, setDismissed] = useState(() => new Set());

  /**
   * Banner-worthy means a storm event the data layer graded `error`, which is
   * its mapping for the NWS severities `extreme` and `high`. A moderate hail
   * watch belongs in the feed, not across the top of the screen.
   */
  const alert = useMemo(
    () => activity.find(
      (event) => event.type === ACTIVITY_TYPES.STORM && event.severity === SEVERITIES.ERROR
    ) || null,
    [activity]
  );

  // Dismissal is per storm, not global: dismissing one must not silence the
  // next one, which is the whole point of the banner.
  const visible = Boolean(alert) && !dismissed.has(alert.id);

  useEffect(() => {
    // Forget dismissals for storms that are no longer active, so the set does
    // not grow for the life of the tab.
    setDismissed((previous) => {
      const live = new Set(activity.map((event) => event.id));
      const kept = new Set([...previous].filter((id) => live.has(id)));
      return kept.size === previous.size ? previous : kept;
    });
  }, [activity]);

  if (!alert) return null;

  const when = formatFreshness(alert.timestamp);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 500 }}
          /*
            In flow, not fixed over the page.

            As a fixed banner it sat on top of whatever was at the top of the
            screen - on the dashboard, the `<h1>`. That was invisible while the
            banner only appeared on a `Math.random()` roll; now that it appears
            whenever there is a real storm, it would cover the heading most of
            the time. The app shell is a flex column, so taking the banner out
            of `position: fixed` makes the layout below it shrink to fit.
          */
          className="storm-alert-banner shrink-0 bg-gradient-to-r from-red-700 to-red-600 shadow-lg"
          role="alert"
        >
          <div className="storm-alert-content flex items-center gap-4 px-6 py-3">
            <ExclamationTriangleIcon className="storm-alert-icon h-6 w-6 shrink-0 text-white" aria-hidden="true" />

            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold uppercase tracking-wide text-white">
                Severe weather
              </div>
              <div className="truncate text-sm text-white/90" title={alert.message}>
                {alert.message} <span className="text-white/70">· detected {when.relative}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                to="/storm-intelligence"
                className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/30
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                View details
              </Link>

              <button
                type="button"
                onClick={() => setDismissed((previous) => new Set(previous).add(alert.id))}
                aria-label="Dismiss this severe weather alert"
                className="rounded-lg p-2 text-white transition-colors hover:bg-white/10
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StormAlert;
