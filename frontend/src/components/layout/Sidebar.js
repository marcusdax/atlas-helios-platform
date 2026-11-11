import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  CloudIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  MapIcon,
  UserGroupIcon,
  BellIcon
} from '@heroicons/react/24/outline';
import { DATA_STATES } from '@atlas/dashboard-data';
import { useDashboardData, formatFreshness } from '../../data/useDashboardData';
import DataStateBadge, { Skeleton, treatmentFor } from '../ui/DataStateBadge';

/**
 * The contextual sidebar.
 *
 * Three things were wrong with it, all the same thing.
 *
 * Its "Today's Stats" were twelve string literals - `'47'`, `'1,234'`,
 * `'67%'` - each with an invented trend beside it (`'+12'`, `'-3%'`). Its
 * "Recent Activity" was three hardcoded sentences, one of which named a real
 * address and claimed it had been flagged two minutes ago. And its quick
 * actions were buttons whose handler was a `console.log`, several pointing at
 * routes that do not exist.
 *
 * The stats and the feed now come from the same shared dashboard store the
 * main panels read - one set of requests for the whole screen, so the sidebar
 * and the tiles beside it cannot show different numbers - and they carry the
 * same data state, because a figure in a sidebar is no more trustworthy than
 * the read that produced it. The quick actions are router links to routes that
 * exist, and nothing else.
 */

/** Route → what the sidebar says about it. Only real routes, only real links. */
const ROUTES = {
  '/': {
    title: 'Dashboard',
    icon: ChartBarIcon,
    links: [
      { label: 'View active storms', to: '/storm-intelligence' },
      { label: 'Start an assessment', to: '/property-assessment' },
      { label: 'Generate an estimate', to: '/estimate-generator' }
    ]
  },
  '/storm-intelligence': {
    title: 'Storm Intelligence',
    icon: ExclamationTriangleIcon,
    links: [
      { label: 'Assess an exposed property', to: '/property-assessment' },
      { label: 'Review leads', to: '/lead-management' },
      { label: 'Back to dashboard', to: '/' }
    ]
  },
  '/property-assessment': {
    title: 'Property Assessment',
    icon: MapIcon,
    links: [
      { label: 'Generate an estimate', to: '/estimate-generator' },
      { label: 'Open the field tool', to: '/mobile-field' },
      { label: 'Check storm intelligence', to: '/storm-intelligence' }
    ]
  },
  '/lead-management': {
    title: 'Lead Management',
    icon: UserGroupIcon,
    links: [
      { label: 'Generate an estimate', to: '/estimate-generator' },
      { label: 'Assess a property', to: '/property-assessment' }
    ]
  },
  '/estimate-generator': {
    title: 'Estimate Generator',
    icon: CurrencyDollarIcon,
    links: [
      { label: 'Review leads', to: '/lead-management' },
      { label: 'Assess a property', to: '/property-assessment' }
    ]
  },
  '/mobile-field': {
    title: 'Field Tool',
    icon: DevicePhoneMobileIcon,
    links: [{ label: 'Back to dashboard', to: '/' }]
  },
  '/settings': {
    title: 'Settings',
    icon: Cog6ToothIcon,
    links: [{ label: 'Back to dashboard', to: '/' }]
  }
};

/** The three company-wide figures, named for the lane each depends on. */
const STATS = [
  { key: 'activeStorms', label: 'Active storms', source: 'storms', icon: CloudIcon },
  { key: 'highRiskProperties', label: 'High-risk properties', source: 'properties', icon: ExclamationTriangleIcon },
  { key: 'recentAssessments', label: 'Assessments (24h)', source: 'assessments', icon: ClipboardDocumentCheckIcon }
];

const SEVERITY_DOT = { warning: 'bg-yellow-500', error: 'bg-red-500', info: 'bg-blue-500' };

const Sidebar = () => {
  const location = useLocation();
  const { state, summary, activity, fetchedAt, failedSources } = useDashboardData();

  // An unknown path gets the dashboard's links but not its title - labelling
  // the Settings page "Dashboard" was the old fallback's doing.
  const route = ROUTES[location.pathname];
  const title = route?.title || 'Atlas & Helios';
  const Icon = route?.icon || ChartBarIcon;
  const links = route?.links || ROUTES['/'].links;

  const treatment = treatmentFor(state);
  const firstRead = state === DATA_STATES.SYNCING && fetchedAt === null;
  const recent = activity.slice(0, 3);

  return (
    <aside className="sidebar w-80 overflow-y-auto border-r border-neutral-800 bg-neutral-900">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center">
          <Icon className="mr-3 h-6 w-6 text-primary-500" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-neutral-100">{title}</h2>
        </div>

        {/* Navigation */}
        <nav className="mb-8" aria-label="Related pages">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Go to
          </h3>
          <div className="space-y-2">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="block rounded-lg px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800
                  hover:text-neutral-100 focus-visible:outline focus-visible:outline-2
                  focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Figures */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
              Right now
            </h3>
            <DataStateBadge state={state} compact />
          </div>

          <div className="space-y-4">
            {STATS.map((stat) => {
              const laneDown = failedSources.includes(stat.source);
              return (
                <div key={stat.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-neutral-400">{stat.label}</span>
                  {firstRead ? (
                    <Skeleton className="h-5 w-10" />
                  ) : (
                    <span className="flex items-baseline gap-2">
                      <span className={`text-lg font-semibold text-neutral-100 ${treatment.dim}`}>
                        {Number(summary[stat.key] ?? 0).toLocaleString()}
                      </span>
                      {/*
                        No trend. There is no endpoint behind a day-over-day
                        change, and the old sidebar simply made one up.
                      */}
                      {laneDown && (
                        <span className="text-xs font-medium text-amber-300" title="This feed is unavailable; showing the last known figure.">
                          last known
                        </span>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mb-8">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Recent Activity
          </h3>

          {firstRead ? (
            <div className="space-y-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-start space-x-3">
                  <Skeleton className="mt-2 h-2 w-2 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-neutral-500">
              {state === DATA_STATES.OFFLINE
                ? 'Nothing cached on this device.'
                : 'Nothing in the last 24 hours.'}
            </p>
          ) : (
            <ul className={`space-y-3 ${treatment.dim}`}>
              {recent.map((event) => {
                const when = formatFreshness(event.timestamp);
                return (
                  <li key={event.id} className="flex items-start space-x-3">
                    <span
                      className={`mt-2 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[event.severity] || SEVERITY_DOT.info}`}
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-neutral-300">{event.message}</p>
                      <p className="text-xs text-neutral-500" title={when.absolute || undefined}>
                        {when.relative}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Notifications Toggle */}
        <div className="border-t border-neutral-800 pt-6">
          <div className="flex items-center justify-between">
            <label htmlFor="sidebar-notifications" className="flex items-center space-x-3">
              <BellIcon className="h-5 w-5 text-neutral-400" aria-hidden="true" />
              <span className="text-sm text-neutral-300">Notifications</span>
            </label>
            <span className="relative inline-flex cursor-pointer items-center">
              <input id="sidebar-notifications" type="checkbox" className="peer sr-only" defaultChecked />
              <span className="peer h-6 w-11 rounded-full bg-neutral-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-500 peer-checked:after:translate-x-full peer-focus:outline-none" />
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
