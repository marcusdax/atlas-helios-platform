import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  MapIcon,
  UserGroupIcon,
  BellIcon
} from '@heroicons/react/outline';

const Sidebar = () => {
  const location = useLocation();

  const sidebarContent = {
    '/': {
      title: 'Dashboard',
      icon: ChartBarIcon,
      quickActions: [
        { label: 'View Active Storms', action: 'navigate', target: '/storm-intelligence' },
        { label: 'Recent Assessments', action: 'scroll', target: '#recent-assessments' },
        { label: 'Export Reports', action: 'modal', target: 'export-modal' }
      ],
      stats: [
        { label: 'Active Storms', value: '3', trend: '+2' },
        { label: 'High-Risk Properties', value: '47', trend: '-5' },
        { label: 'Pending Estimates', value: '12', trend: '+3' }
      ]
    },
    '/storm-intelligence': {
      title: 'Storm Intelligence',
      icon: ExclamationTriangleIcon,
      quickActions: [
        { label: 'Refresh Data', action: 'api-call', target: 'refresh-storms' },
        { label: 'Generate Alert', action: 'modal', target: 'alert-modal' },
        { label: 'Export Storm Data', action: 'download', target: 'storm-report' }
      ],
      stats: [
        { label: 'Storm Alerts Today', value: '5', trend: '+1' },
        { label: 'Properties Tracked', value: '1,234', trend: '+89' },
        { label: 'Risk Score Avg', value: '67%', trend: '-3%' }
      ]
    },
    '/property-assessment': {
      title: 'Property Assessment',
      icon: MapIcon,
      quickActions: [
        { label: 'Start New Assessment', action: 'navigate', target: '/property-assessment/new' },
        { label: 'Upload Photos', action: 'file-upload', target: 'photo-upload' },
        { label: 'View History', action: 'scroll', target: '#assessment-history' }
      ],
      stats: [
        { label: 'Assessments Today', value: '8', trend: '+2' },
        { label: 'Avg Score', value: '72%', trend: '+5%' },
        { label: 'Completion Rate', value: '94%', trend: '+1%' }
      ]
    },
    '/lead-management': {
      title: 'Lead Management',
      icon: UserGroupIcon,
      quickActions: [
        { label: 'Export to CRM', action: 'api-call', target: 'export-crm' },
        { label: 'Assign Teams', action: 'modal', target: 'assign-modal' },
        { label: 'Generate Campaign', action: 'navigate', target: '/marketing' }
      ],
      stats: [
        { label: 'New Leads', value: '47', trend: '+12' },
        { label: 'Converted Today', value: '3', trend: '+1' },
        { label: 'Follow-up Rate', value: '78%', trend: '-2%' }
      ]
    }
  };

  const currentContent = sidebarContent[location.pathname] || sidebarContent['/'];

  return (
    <aside className="sidebar w-80 bg-neutral-900 border-r border-neutral-800 overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <currentContent.icon className="w-6 h-6 text-primary-500 mr-3" />
          <h2 className="text-xl font-semibold text-neutral-100">
            {currentContent.title}
          </h2>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-3">
            Quick Actions
          </h3>
          <div className="space-y-2">
            {currentContent.quickActions.map((action, index) => (
              <button
                key={index}
                className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors"
                onClick={() => handleQuickAction(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-3">
            Today's Stats
          </h3>
          <div className="space-y-4">
            {currentContent.stats.map((stat, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">{stat.label}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-semibold text-neutral-100">
                    {stat.value}
                  </span>
                  <span className={`text-xs font-medium ${
                    stat.trend.startsWith('+') 
                      ? 'text-green-500' 
                      : stat.trend.startsWith('-') 
                        ? 'text-red-500' 
                        : 'text-neutral-400'
                  }`}>
                    {stat.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-3">
            Recent Activity
          </h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-neutral-300">High-risk property detected</p>
                <p className="text-xs text-neutral-500">1247 Oak Ridge Dr • 2 min ago</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-neutral-300">Storm alert generated</p>
                <p className="text-xs text-neutral-500">Dallas County • 15 min ago</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-neutral-300">Estimate completed</p>
                <p className="text-xs text-neutral-500">Property #2847 • 1 hour ago</p>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications Toggle */}
        <div className="border-t border-neutral-800 pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BellIcon className="w-5 h-5 text-neutral-400" />
              <span className="text-sm text-neutral-300">Notifications</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>
        </div>
      </div>
    </aside>
  );
};

const handleQuickAction = (action) => {
  console.log('Quick action triggered:', action);
  // Implement action handlers based on action.type
};

export default Sidebar;