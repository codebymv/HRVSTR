import React from 'react';
// Import all icons but comment out unused ones for future use
import { Menu, Home, BarChart2, ListChecks, TrendingUp, Settings, HelpCircle } from 'lucide-react';
// import { Bell, Search, User, Sun, Moon } from 'lucide-react'; // Commented out for now
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { AuthButton } from './AuthButton';

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme } = useTheme();
  
  // Create theme-specific styling
  const isLight = theme === 'light';
  const bgColor = isLight ? 'bg-stone-300' : 'bg-gray-900'; // Darker beige/grey for better contrast with white logo
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  // Commented out for now - will be used when search is re-enabled
  // const inputBgColor = isLight ? 'bg-stone-200' : 'bg-gray-800';
  // const inputTextColor = isLight ? 'text-gray-900' : 'text-gray-200';
  const iconColor = isLight ? 'text-stone-700' : 'text-gray-400'; // Darker color for better visibility
  const hoverBgColor = isLight ? 'hover:bg-stone-400' : 'hover:bg-gray-800';
  const textColor = isLight ? 'text-stone-800' : 'text-gray-300';
  const activeTextColor = isLight ? 'text-stone-900' : 'text-white';
  const activeBgColor = isLight ? 'bg-stone-400' : 'bg-gray-800';

  // Add logo filter for theme switching
  const logoFilter = isLight ? 'invert(1) brightness(0)' : 'none';

  return (
    <header className={`${bgColor} border-b ${borderColor} sticky top-0 z-50`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 py-2">
          {/* Logo Section - Enhanced for better display on all devices */}
          <div className="flex-shrink-0 flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`lg:hidden p-2 mr-3 rounded-full ${hoverBgColor} transition-colors`}
            >
              <Menu size={20} className={iconColor} />
            </button>
            
            {/* Centered HRVSTR Logo with improved sizing */}
            <div className="h-10 flex items-center justify-center">
              <a href="/">
            <img 
              src="/hrvstr_logo.png" 
              alt="HRVSTR" 
              className="h-full w-auto max-h-10" 
              style={{ filter: logoFilter }}
            />
            </a>
            </div>
          </div>
          
          {/* Search Bar - Kept at a reasonable width */}
          {/* Commented out for now - can be implemented later if needed
          <div className="hidden md:flex relative flex-1 max-w-xl">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className={iconColor} />
            </div>
            <input
              type="text"
              placeholder="Search for a ticker or company..."
              className={`${inputBgColor} w-full pl-10 pr-4 py-2 rounded-lg ${inputTextColor} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          */}
          
          {/* User Controls */}
          <div className="flex items-center gap-3 ml-4">             

            
            {/* Auth Button for login/logout */}
            <div className="flex items-center">
              <AuthButton />
            </div>
            
            {/* Notification bell - commented out for now
            <button className={`relative p-2 rounded-full ${hoverBgColor} transition-colors`}>
              <Bell size={20} className={iconColor} />
              <span className="absolute top-0 right-0 h-2 w-2 bg-blue-500 rounded-full"></span>
            </button>
            */}
            {/* Account button - commented out for now
            <button className={`flex items-center gap-2 py-1 px-3 rounded-full ${hoverBgColor} transition-colors`}>
              <User size={20} className={iconColor} />
              <span className={`text-sm ${textColor} hidden md:inline`}>Account</span>
            </button>
            */}
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className={`lg:hidden ${bgColor} p-4 border-t ${borderColor}`}>
          {/* Mobile search - commented out for now
          <div className="flex relative w-full mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className={iconColor} />
            </div>
            <input
              type="text"
              placeholder="Search for a ticker or company..."
              className={`${inputBgColor} w-full pl-10 pr-4 py-2 rounded-lg ${inputTextColor} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          */}
          <nav className="grid gap-2">
            <NavLink to="/" className={({isActive}) => `flex items-center space-x-3 py-2 px-3 ${isActive ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}>
              <Home size={20} />
              <span>Home</span>
            </NavLink>
            {/* <NavLink to="/watchlists" className={({isActive}) => `py-2 px-3 ${isActive ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}>Watchlists</NavLink> */}
            <NavLink to="/sentiment" className={({isActive}) => `flex items-center space-x-3 py-2 px-3 ${isActive ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}>
              <BarChart2 size={20} />
              <span>Sentiment</span>
            </NavLink>
            {/* <NavLink to="/historical" className={({isActive}) => `py-2 px-3 ${isActive ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}>Historical Data</NavLink> */}
            {/* <NavLink to="/alerts" className={({isActive}) => `py-2 px-3 ${isActive ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}>Alerts</NavLink> */}
            {/* <NavLink to="/settings" className={({isActive}) => `py-2 px-3 ${isActive ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}>Settings</NavLink> */}
            <NavLink to="/sec-filings" className={({isActive}) => `flex items-center space-x-3 py-2 px-3 ${isActive ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}>
              <ListChecks size={20} />
              <span>SEC Filings</span>
            </NavLink>
            <NavLink to="/earnings" className={({isActive}) => `flex items-center space-x-3 py-2 px-3 ${isActive ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}>
              <TrendingUp size={20} />
              <span>Earnings</span>
            </NavLink>
            <NavLink to="/settings" className={({isActive}) => `flex items-center space-x-3 py-2 px-3 ${isActive ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}>
              <Settings size={20} />
              <span>Settings</span>
            </NavLink>
            <NavLink to="/help" className={({isActive}) => `flex items-center space-x-3 py-2 px-3 ${isActive ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}>
              <HelpCircle size={20} />
              <span>Help</span>
            </NavLink>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;