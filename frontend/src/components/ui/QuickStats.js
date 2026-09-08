import React from 'react';
import {
  CloudIcon,
  MapIcon,
  ChartBarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const QuickStats = ({ data }) => {
  const stats = [
    {
      label: 'Total Properties',
      value: data.totalProperties?.toLocaleString() || '0',
      change: '+2.5%',
      changeType: 'positive',
      icon: MapIcon,
      color: 'blue'
    },
    {
      label: 'Active Storms',
      value: data.activeStorms || '0',
      change: data.activeStorms > 0 ? 'Active' : 'Clear',
      changeType: data.activeStorms > 0 ? 'warning' : 'positive',
      icon: CloudIcon,
      color: 'red'
    },
    {
      label: 'High-Risk Properties',
      value: data.highRiskProperties || '0',
      change: '-12%',
      changeType: 'positive',
      icon: ExclamationTriangleIcon,
      color: 'yellow'
    },
    {
      label: 'Weather Alerts',
      value: data.weatherAlerts || '0',
      change: data.weatherAlerts > 0 ? 'Active' : 'None',
      changeType: data.weatherAlerts > 0 ? 'warning' : 'positive',
      icon: ChartBarIcon,
      color: data.weatherAlerts > 0 ? 'orange' : 'green'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      red: 'bg-red-500/10 text-red-400 border-red-500/20',
      yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      green: 'bg-green-500/10 text-green-400 border-green-500/20',
      orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    };
    return colors[color] || colors.blue;
  };

  const getChangeColor = (type) => {
    return type === 'positive' ? 'text-green-400' : 
           type === 'warning' ? 'text-yellow-400' : 'text-red-400';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="glass-card hover:border-gray-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-400 mb-1">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold text-neutral-100">
                  {stat.value}
                </p>
                <p className={`text-sm mt-1 ${getChangeColor(stat.changeType)}`}>
                  {stat.change}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${getColorClasses(stat.color)}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default QuickStats;