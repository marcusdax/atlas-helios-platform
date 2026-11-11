import React from 'react';
import {
  CloudIcon,
  MapIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

// Import components
import StormMap from '../components/maps/StormMap';
import PredictionChart from '../components/charts/PredictionChart';
import QuickStats from '../components/ui/QuickStats';
import DataStateBadge from '../components/ui/DataStateBadge';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import PriorityQueue from '../components/dashboard/PriorityQueue';

// The domain hook. Everything the dashboard shows comes from here.
import { useDashboardData } from '../data/useDashboardData';

/**
 * The dashboard.
 *
 * This page used to own its data: a `fetchDashboardData` callback that built a
 * mock dataset in place - 1,247 properties, 47 high-risk, three hand-written
 * activity rows - plus a hardcoded priority list in the JSX and a socket
 * subscription that wrote straight into component state. All of that is gone.
 * The page now reads one hook and lays out panels, and the panels render the
 * honest answer when what they are given is incomplete.
 *
 * Which is the part worth keeping in mind while editing it: there is no state
 * in which this screen shows a confident number it cannot stand behind. The
 * dull states - SYNCING with nothing yet, OFFLINE off the cache - are the ones
 * that used to be impossible to reach, and they are the ones an operator in a
 * truck actually sees.
 */

const QUICK_ACTIONS = [
  {
    title: 'View Storm Intel',
    description: 'Check active weather alerts',
    icon: CloudIcon,
    color: 'bg-blue-500',
    href: '/storm-intelligence'
  },
  {
    title: 'Property Assessment',
    description: 'Start new property analysis',
    icon: HomeIcon,
    color: 'bg-green-500',
    href: '/property-assessment'
  },
  {
    title: 'Manage Leads',
    description: 'Review and assign leads',
    icon: UserGroupIcon,
    color: 'bg-purple-500',
    href: '/lead-management'
  },
  {
    title: 'Generate Estimate',
    description: 'Create new estimate',
    icon: ChartBarIcon,
    color: 'bg-orange-500',
    href: '/estimate-generator'
  }
];

const Dashboard = () => {
  const {
    state,
    summary,
    activity,
    priorityProperties,
    fetchedAt,
    failedSources,
    fetching,
    refresh
  } = useDashboardData();

  // Every state-aware panel needs the same four facts about the read.
  const lane = { state, failedSources, fetchedAt, onRetry: refresh };

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-start justify-between gap-4"
        >
          <div>
            <h1 className="mb-2 text-4xl font-bold text-neutral-100">
              PropertyInsight Dashboard
            </h1>
            <p className="text-neutral-400">
              Real-time storm intelligence and property assessment platform
            </p>
          </div>

          {/*
            This badge replaces the old connection banner, which only rendered
            when the socket was connected - so the one state that needed no
            warning was the only state the operator was ever told about.
          */}
          <DataStateBadge
            state={state}
            fetchedAt={fetchedAt}
            failedSources={failedSources}
            fetching={fetching}
            onRetry={refresh}
          />
        </motion.div>
      </div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-8"
      >
        <QuickStats data={summary} state={state} failedSources={failedSources} />
      </motion.div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        {/* Left Column - Storm Map & Activity */}
        <div className="space-y-8 xl:col-span-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-card"
          >
            <div className="dashboard-card-header">
              <MapIcon className="dashboard-card-icon" />
              <h2 className="dashboard-card-title">Storm Intelligence Map</h2>
            </div>
            <div className="h-96">
              {/* The map owns its own radar/alert reads; see the migration
                  note in DESIGN/dashboard-data-layer.md. */}
              <StormMap />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="glass-card"
          >
            <ActivityFeed activity={activity} {...lane} />
          </motion.div>
        </div>

        {/* Right Column - Quick Actions & Charts */}
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="glass-card"
          >
            <div className="dashboard-card-header">
              <ExclamationTriangleIcon className="dashboard-card-icon" />
              <h2 className="dashboard-card-title">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  /*
                    A router Link rather than the old `window.location.href`
                    button. That assignment reloaded the whole app - dropping
                    the socket and every cached read - to move between two
                    routes of the same SPA. A Link still renders an anchor, so
                    middle-click and "open in new tab" work and a keyboard
                    reaches it without a tabindex hack.
                  */
                  <Link
                    key={action.href}
                    to={action.href}
                    className="rounded-lg bg-neutral-800 p-4 text-left transition-colors hover:bg-neutral-700
                      focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                  >
                    <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${action.color}`}>
                      <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                    </div>
                    <h3 className="mb-1 text-sm font-medium text-neutral-100">{action.title}</h3>
                    <p className="text-xs text-neutral-400">{action.description}</p>
                  </Link>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="glass-card"
          >
            <div className="dashboard-card-header">
              <CloudIcon className="dashboard-card-icon" />
              <h2 className="dashboard-card-title">24-Hour Weather Forecast</h2>
            </div>
            <div className="h-64">
              <PredictionChart />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="glass-card"
          >
            <PriorityQueue properties={priorityProperties} {...lane} />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
