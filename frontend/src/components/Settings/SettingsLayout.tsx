import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  User, 
  Bell, 
  Cog, 
  CreditCard, 
  BarChart3, 
  Key, 
  Database,
  Monitor,
  DollarSign
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const SettingsLayout: React.FC = () => {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const sidebarBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const hoverBgColor = isLight ? 'hover:bg-stone-400' : 'hover:bg-gray-800';
  const activeBgColor = isLight ? 'bg-blue-500' : 'bg-blue-600';

  const tabs = [
    {
      id: 'account',
      label: 'ACCOUNT',
      items: [
        { path: '/settings/profile', label: 'Profile', icon: User },
        // { path: '/settings/notifications', label: 'Notifications', icon: Bell },
        { path: '/settings/preferences', label: 'Preferences', icon: Cog },
      ]
    },
    {
      id: 'subscription',
      label: 'SUBSCRIPTION',
      items: [
        { path: '/settings/usage', label: 'Usage', icon: BarChart3 },
        { path: '/settings/tiers', label: 'Tiers', icon: CreditCard },
        { path: '/settings/billing', label: 'Billing', icon: DollarSign },
      ]
    },
    {
      id: 'features',
      label: 'FEATURES',
      items: [
        { path: '/settings/api-keys', label: 'API Keys', icon: Key },
        { path: '/settings/data-sources', label: 'Data Sources', icon: Database },
      ]
    }
  ];

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  const handleTabClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className={`min-h-screen ${bgColor}`}>
      <div className="flex">
        {/* Desktop Sidebar */}
        <div className={`hidden lg:block w-64 ${sidebarBgColor} border-r ${borderColor} min-h-screen p-6`}>
          <h1 className={`text-2xl font-bold ${textColor} mb-8`}>Settings</h1>
          
          <nav className="space-y-6">
            {tabs.map((section) => (
              <div key={section.id}>
                <h3 className={`text-xs font-semibold ${secondaryTextColor} uppercase tracking-wider mb-3`}>
                  {section.label}
                </h3>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActivePath(item.path);
                    
                    return (
                      <li key={item.path}>
                        <button
                          onClick={() => handleTabClick(item.path)}
                          className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                            isActive
                              ? `${activeBgColor} text-white`
                              : `${textColor} ${hoverBgColor}`
                          }`}
                        >
                          <Icon className="w-4 h-4 mr-3" />
                          {item.label}
                          {item.label === 'Notifications' && (
                            <span className="ml-auto bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              1
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default SettingsLayout; 