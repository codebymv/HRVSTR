import React from 'react';
import { ListChecks, Settings, BarChart2, TrendingUp } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const Sidebar: React.FC = () => {
  const { theme } = useTheme();
  
  // Create theme-specific styling
  const isLight = theme === 'light';
  const bgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const textColor = isLight ? 'text-stone-800' : 'text-gray-400';
  const headerColor = isLight ? 'text-stone-600' : 'text-gray-500';
  const activeItemBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  const activeItemText = isLight ? 'text-stone-900' : 'text-white';
  const hoverBg = isLight ? 'hover:bg-stone-400' : 'hover:bg-gray-800';
  const hoverText = isLight ? 'hover:text-stone-900' : 'hover:text-white';
  return (
    <aside className={`hidden lg:flex flex-col ${bgColor} border-r ${borderColor} w-64 h-screen sticky top-0`}>
      <nav className="flex-1 p-4 space-y-1">
        <p className={`text-xs font-semibold ${headerColor} uppercase tracking-wider mt-2 mb-2 px-3`}>
          Main
        </p>
        
        <NavLink to="/sentiment" className={({isActive}) => `flex items-center space-x-3 px-3 py-2 rounded-lg ${isActive ? `${activeItemBg} ${activeItemText} font-medium` : `${textColor} ${hoverBg} ${hoverText} transition-colors`}`}>
          <BarChart2 size={20} />
          <span>Sentiment Scraper</span>
        </NavLink>
        
        <NavLink to="/sec-filings" className={({isActive}) => `flex items-center space-x-3 px-3 py-2 rounded-lg ${isActive ? `${activeItemBg} ${activeItemText} font-medium` : `${textColor} ${hoverBg} ${hoverText} transition-colors`}`}>
          <ListChecks size={20} />
          <span>SEC Filings</span>
        </NavLink>

        <NavLink to="/earnings" className={({isActive}) => `flex items-center space-x-3 px-3 py-2 rounded-lg ${isActive ? `${activeItemBg} ${activeItemText} font-medium` : `${textColor} ${hoverBg} ${hoverText} transition-colors`}`}>
          <TrendingUp size={20} />
          <span>Earnings Monitor</span>
        </NavLink>
        
        {/* Future nav items can be added here */}
        
        <p className={`text-xs font-semibold ${headerColor} uppercase tracking-wider mt-6 mb-2 px-3`}>
          System
        </p>
        
        <NavLink to="/settings" className={({isActive}) => `flex items-center space-x-3 px-3 py-2 rounded-lg ${isActive ? `${activeItemBg} ${activeItemText} font-medium` : `${textColor} ${hoverBg} ${hoverText} transition-colors`}`}>
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>
        
        {/* API Status indicator below Settings button */}
        <div className={`mx-3 mt-3 p-3 ${isLight ? 'bg-stone-400' : 'bg-gray-800'} rounded-lg`}>
          <p className={`text-sm ${isLight ? 'text-stone-700' : 'text-gray-400'} mb-1`}>API Status</p>
          <div className="flex items-center space-x-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className={`text-sm font-medium ${isLight ? 'text-stone-800' : 'text-gray-300'}`}>Connected</span>
          </div>
        </div>
      </nav>
      
      {/* API Status indicator moved up in the navigation */}
    </aside>
  );
};

export default Sidebar;