import React, { useState, useEffect, useRef } from 'react';
// Import all icons but comment out unused ones for future use
import { Menu, Home, BarChart2, ListChecks, TrendingUp, Settings, HelpCircle, X } from 'lucide-react';
// import { Bell, Search, User, Sun, Moon } from 'lucide-react'; // Commented out for now
import { useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { AuthButton } from './AuthButton';
import { useAuth } from '../contexts/AuthContext';

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme } = useTheme();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Handle clicks outside the menu
  useEffect(() => {
    // Generic handler that works for both mouse and touch events
    const handleClickOutside = (event: Event) => {
      // Ensure we have a valid target
      const target = event.target as Node;
      
      if (isMenuOpen && 
          menuRef.current && 
          buttonRef.current && 
          !menuRef.current.contains(target) && 
          !buttonRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };
    
    // Add both event listeners for mouse and touch devices
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    // Clean up event listeners on unmount
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMenuOpen]);
  
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
            {isAuthenticated && (
              <button
                ref={buttonRef}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`lg:hidden p-2 mr-3 rounded-full ${hoverBgColor} transition-colors`}
                aria-expanded={isMenuOpen}
                aria-label="Toggle navigation menu"
              >
                <Menu size={20} className={iconColor} />
              </button>
            )}
            
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
      {isAuthenticated && isMenuOpen && (
        <div 
          ref={menuRef}
          className={`lg:hidden ${bgColor} p-4 border-t ${borderColor} fixed w-full z-50`}
          aria-label="Mobile navigation">
          {/* Close button */}
          <div className="flex justify-end mb-2">
            <button 
              onClick={() => setIsMenuOpen(false)}
              className={`p-2 rounded-full ${hoverBgColor} transition-colors`}
              aria-label="Close menu"
            >
              <X size={20} className={iconColor} />
            </button>
          </div>
          
          {/* Mobile navigation with direct links */}
          <nav className="grid gap-2">
            <a 
              href="/"
              className={`flex items-center space-x-3 py-2 px-3 ${location.pathname === '/' ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}
              onClick={() => setIsMenuOpen(false)}
            >
              <Home size={20} />
              <span>Home</span>
            </a>
            
            <a 
              href="/sentiment"
              className={`flex items-center space-x-3 py-2 px-3 ${location.pathname === '/sentiment' ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}
              onClick={() => setIsMenuOpen(false)}
            >
              <BarChart2 size={20} />
              <span>Sentiment</span>
            </a>
            
            <a 
              href="/sec-filings"
              className={`flex items-center space-x-3 py-2 px-3 ${location.pathname === '/sec-filings' ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}
              onClick={() => setIsMenuOpen(false)}
            >
              <ListChecks size={20} />
              <span>SEC Filings</span>
            </a>
            
            <a 
              href="/earnings"
              className={`flex items-center space-x-3 py-2 px-3 ${location.pathname === '/earnings' ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}
              onClick={() => setIsMenuOpen(false)}
            >
              <TrendingUp size={20} />
              <span>Earnings</span>
            </a>
            
            <a 
              href="/settings"
              className={`flex items-center space-x-3 py-2 px-3 ${location.pathname === '/settings' ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}
              onClick={() => setIsMenuOpen(false)}
            >
              <Settings size={20} />
              <span>Settings</span>
            </a>
            
            <a 
              href="/help"
              className={`flex items-center space-x-3 py-2 px-3 ${location.pathname === '/help' ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}
              onClick={() => setIsMenuOpen(false)}
            >
              <HelpCircle size={20} />
              <span>Help</span>
            </a>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;