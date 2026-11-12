import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  CloudIcon,
  MapIcon,
  ClipboardDocumentListIcon,
  CalculatorIcon,
  CogIcon,
  DevicePhoneMobileIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

/** "Dev Operator" -> "DO". Falls back to the email, then to a neutral mark. */
const initialsOf = (user) => {
  const name = (user?.name || '').trim();
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }
  const email = (user?.email || '').trim();
  return email ? email[0].toUpperCase() : '—';
};

const Navigation = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/', icon: HomeIcon, label: 'Dashboard', color: 'text-blue-500' },
    { path: '/storm-intelligence', icon: CloudIcon, label: 'Storm Intel', color: 'text-red-500' },
    { path: '/property-assessment', icon: MapIcon, label: 'Properties', color: 'text-green-500' },
    { path: '/lead-management', icon: ClipboardDocumentListIcon, label: 'Leads', color: 'text-yellow-500' },
    { path: '/estimate-generator', icon: CalculatorIcon, label: 'Estimates', color: 'text-purple-500' },
    { path: '/mobile-field', icon: DevicePhoneMobileIcon, label: 'Mobile', color: 'text-orange-500' },
    { path: '/settings', icon: CogIcon, label: 'Settings', color: 'text-gray-500' },
  ];

  return (
    <nav className="nav-sidebar">
      {/* Logo */}
      <div className="nav-logo">
        <span className="text-sm font-bold">AH</span>
      </div>

      {/* Navigation Items */}
      <div className="nav-items">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item group ${isActive ? 'active' : ''}`}
              title={item.label}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'text-white' : item.color}`} />
              
              {/* Tooltip */}
              <div className="absolute left-full ml-2 px-2 py-1 bg-neutral-800 text-neutral-100 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                {item.label}
              </div>
            </Link>
          );
        })}
      </div>

      {/* User Profile */}
      <div className="mt-auto p-3 flex flex-col items-center gap-2">
        <div
          className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-semibold"
          title={user?.email || undefined}
        >
          {initialsOf(user)}
        </div>
        <button
          type="button"
          onClick={logout}
          aria-label="Sign out"
          className="group relative w-10 h-10 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          <span className="absolute left-full ml-2 px-2 py-1 bg-neutral-800 text-neutral-100 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            Sign out
          </span>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;