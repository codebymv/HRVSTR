import React, { useState, useEffect, useRef } from 'react';
// Import all icons but comment out unused ones for future use
import { 
  Menu, 
  Home, 
  BarChart2, 
  ListChecks, 
  TrendingUp, 
  Settings, 
  HelpCircle, 
  X, 
  ChevronDown, 
  ChevronRight,
  User,
  Bell,
  Cog,
  CreditCard,
  Key,
  Monitor,
  BarChart3,
  DollarSign,
  Star,
  Crown,
  Zap,
  Building,
  Search
} from 'lucide-react';
// import { Bell, Sun, Moon } from 'lucide-react'; // Commented out for now
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { AuthButton } from './AuthButton';
import { useAuth } from '../contexts/AuthContext';
import { useTier } from '../contexts/TierContext';
import AddTickerModal from './Watchlist/AddTickerModal';

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAddingTicker, setIsAddingTicker] = useState(false);
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { tierInfo } = useTier();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Auto-expand settings if we're on a settings page
  useEffect(() => {
    if (location.pathname.startsWith('/settings')) {
      setIsSettingsExpanded(true);
    }
  }, [location.pathname]);
  
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
  const inputBgColor = isLight ? 'bg-stone-200' : 'bg-gray-800';
  const inputTextColor = isLight ? 'text-gray-900' : 'text-gray-200';
  const iconColor = isLight ? 'text-stone-700' : 'text-gray-400'; // Darker color for better visibility
  const hoverBgColor = isLight ? 'hover:bg-stone-400' : 'hover:bg-gray-800';
  const textColor = isLight ? 'text-stone-800' : 'text-gray-300';
  const activeTextColor = isLight ? 'text-stone-900' : 'text-white';
  const activeBgColor = isLight ? 'bg-stone-400' : 'bg-gray-800';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-500';

  // Add logo filter for theme switching
  const logoFilter = isLight ? 'invert(1) brightness(0)' : 'none';

  // Handle search bar focus (desktop)
  const handleSearchClick = () => {
    if (isAuthenticated) {
      setIsSearchModalOpen(true);
    }
  };

  // Handle search icon click (mobile)
  const handleSearchIconClick = () => {
    if (isAuthenticated) {
      setIsSearchModalOpen(true);
    }
  };

  // Handle adding ticker from search modal
  const handleAddTicker = async (symbol: string) => {
    setIsAddingTicker(true);
    try {
      // Here you could add the ticker to watchlist via API call if needed
      // For now, we'll just redirect to user-home (watchlist page)
      navigate('/user-home');
      setIsSearchModalOpen(false);
    } catch (error) {
      console.error('Error adding ticker:', error);
    } finally {
      setIsAddingTicker(false);
    }
  };

  const handleMenuItemClick = () => {
    setIsMenuOpen(false);
    setIsSettingsExpanded(false);
  };

  // Handle navigation to different routes
  const handleNavigate = (path: string) => {
    navigate(path);
    handleMenuItemClick();
  };

  // Settings sub-items - organized to match SettingsLayout sidebar structure
  const settingsItems = [
    // ACCOUNT section
    { path: '/settings/profile', label: 'Profile', icon: User, category: 'ACCOUNT' },
    { path: '/settings/preferences', label: 'Preferences', icon: Cog, category: 'ACCOUNT' },
    
    // SUBSCRIPTION section  
    { path: '/settings/usage', label: 'Usage', icon: BarChart3, category: 'SUBSCRIPTION' },
    { path: '/settings/tiers', label: 'Tiers', icon: CreditCard, category: 'SUBSCRIPTION' },
    { path: '/settings/billing', label: 'Billing', icon: DollarSign, category: 'SUBSCRIPTION' },
    
    // FEATURES section
    { path: '/settings/api-keys', label: 'API Keys', icon: Key, category: 'FEATURES' },
  ];

  // Helper function to get user tier information with icon and color
  const getUserTierInfo = () => {
    // Use TierContext tierInfo instead of hardcoded user data
    const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
    
    const tierData = {
      free: {
        name: 'HRVSTR Free',
        icon: <Star className="w-4 h-4" />,
        iconColor: isLight ? 'text-gray-600' : 'text-gray-300',
        textColor: isLight ? 'text-gray-600' : 'text-gray-300',
        bgColor: isLight ? 'bg-gray-200' : 'bg-gray-800'
      },
      pro: {
        name: 'HRVSTR Pro',
        icon: <Crown className="w-4 h-4" />,
        iconColor: isLight ? 'text-blue-600' : 'text-blue-400',
        textColor: isLight ? 'text-blue-600' : 'text-blue-400',
        bgColor: isLight ? 'bg-blue-200' : 'bg-blue-900'
      },
      elite: {
        name: 'HRVSTR Elite',
        icon: <Zap className="w-4 h-4" />,
        iconColor: isLight ? 'text-purple-600' : 'text-purple-400',
        textColor: isLight ? 'text-purple-600' : 'text-purple-400',
        bgColor: isLight ? 'bg-purple-200' : 'bg-purple-900'
      },
      institutional: {
        name: 'HRVSTR Institutional',
        icon: <Building className="w-4 h-4" />,
        iconColor: isLight ? 'text-emerald-600' : 'text-emerald-400',
        textColor: isLight ? 'text-emerald-600' : 'text-emerald-400',
        bgColor: isLight ? 'bg-emerald-200' : 'bg-emerald-900'
      }
    };

    return tierData[currentTier as keyof typeof tierData] || tierData.free;
  };

  // Handle home navigation
  const handleHomeClick = () => {
    if (isAuthenticated) {
      navigate('/user-home');
    } else {
      navigate('/');
    }
    setIsMenuOpen(false);
  };

  return (
    <header className={`${bgColor} border-b ${borderColor} sticky top-0 z-50 relative`}>
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
              <button onClick={handleHomeClick} className="cursor-pointer">
                <img 
                  src="/hrvstr_logo.png" 
                  alt="HRVSTR" 
                  className="h-full w-auto max-h-10" 
                  style={{ filter: logoFilter }}
                />
              </button>
            </div>
          </div>
          
          {/* Search Bar - Interactive for authenticated users */}
          {isAuthenticated && (
            <div className="hidden md:flex relative flex-1 max-w-xl mx-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className={iconColor} />
              </div>
              <input
                type="text"
                placeholder="Search for a stock symbol (e.g., AAPL, MSFT)..."
                className={`${inputBgColor} w-full pl-10 pr-4 py-2 rounded-lg ${inputTextColor} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer`}
                onClick={handleSearchClick}
                readOnly
              />
            </div>
          )}
          
          {/* User Controls */}
          <div className="flex items-center gap-3 ml-4">

            {/* Mobile Search Icon - only show when authenticated */}
            {isAuthenticated && (
              <button 
                onClick={handleSearchIconClick}
                className={`md:hidden p-2 rounded-full ${hoverBgColor} transition-colors`}
                aria-label="Search stocks"
              >
                <Search size={20} className={iconColor} />
              </button>
            )}

            {/* User Tier Icon - only show when authenticated and not on free tier */}
            {isAuthenticated && tierInfo?.tier?.toLowerCase() !== 'free' && (
              <div className={`w-6 h-6 sm:w-5 sm:h-5 flex items-center justify-center ${getUserTierInfo().iconColor}`}>
                {getUserTierInfo().icon}
              </div>
            )}
            
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
          className={`lg:hidden ${bgColor} p-4 border-t ${borderColor} absolute top-full left-0 right-0 z-50 max-h-[calc(100vh-3.5rem)] overflow-y-auto`}
          aria-label="Mobile navigation">
          
          {/* Mobile navigation with direct links - close button integrated into first item */}
          <nav className="grid gap-2">
            {/* Home with close button */}
            <div className="flex items-center justify-between">
              <button 
                onClick={handleHomeClick}
                className={`flex items-center space-x-3 py-2 px-3 flex-1 ${location.pathname === '/' || location.pathname === '/user-home' ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}
              >
                <Home size={20} />
                <span>Home</span>
              </button>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className={`p-2 ml-2 rounded-full ${hoverBgColor} transition-colors`}
                aria-label="Close menu"
              >
                <X size={20} className={iconColor} />
              </button>
            </div>
            
            <button 
              onClick={() => handleNavigate('/sentiment')}
              className={`flex items-center space-x-3 py-2 px-3 ${location.pathname === '/sentiment' ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}
            >
              <BarChart2 size={20} />
              <span>Sentiment</span>
            </button>
            
            <button 
              onClick={() => handleNavigate('/sec-filings')}
              className={`flex items-center space-x-3 py-2 px-3 w-full text-left ${location.pathname === '/sec-filings' ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}
            >
              <ListChecks size={20} />
              <span>SEC Filings</span>
            </button>
            
            <button 
              onClick={() => handleNavigate('/earnings')}
              className={`flex items-center space-x-3 py-2 px-3 w-full text-left ${location.pathname === '/earnings' ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}
            >
              <TrendingUp size={20} />
              <span>Earnings</span>
            </button>
            
            {/* Settings with expandable dropdown */}
            <div>
              <button
                onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                className={`w-full flex items-center justify-between space-x-3 py-2 px-3 ${location.pathname.startsWith('/settings') ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}
              >
                <div className="flex items-center space-x-3">
                  <Settings size={20} />
                  <span>Settings</span>
                </div>
                {isSettingsExpanded ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>
              
              {/* Settings submenu */}
              {isSettingsExpanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {/* ACCOUNT section */}
                  <div className="mb-3">
                    <h4 className={`text-xs font-semibold ${secondaryTextColor} uppercase tracking-wider mb-2 px-3`}>
                      ACCOUNT
                    </h4>
                    {settingsItems
                      .filter(item => item.category === 'ACCOUNT')
                      .map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        
                        return (
                          <button
                            key={item.path}
                            onClick={() => handleNavigate(item.path)}
                            className={`flex items-center space-x-3 py-2 px-3 text-sm w-full text-left ${
                              isActive 
                                ? `${activeBgColor} ${activeTextColor}` 
                                : `${secondaryTextColor} ${hoverBgColor}`
                            } rounded-lg transition-colors`}
                          >
                            <Icon size={16} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                  </div>

                  {/* SUBSCRIPTION section */}
                  <div className="mb-3">
                    <h4 className={`text-xs font-semibold ${secondaryTextColor} uppercase tracking-wider mb-2 px-3`}>
                      SUBSCRIPTION
                    </h4>
                    {settingsItems
                      .filter(item => item.category === 'SUBSCRIPTION')
                      .map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        
                        return (
                          <button
                            key={item.path}
                            onClick={() => handleNavigate(item.path)}
                            className={`flex items-center space-x-3 py-2 px-3 text-sm w-full text-left ${
                              isActive 
                                ? `${activeBgColor} ${activeTextColor}` 
                                : `${secondaryTextColor} ${hoverBgColor}`
                            } rounded-lg transition-colors`}
                          >
                            <Icon size={16} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                  </div>

                  {/* FEATURES section */}
                  <div className="mb-3">
                    <h4 className={`text-xs font-semibold ${secondaryTextColor} uppercase tracking-wider mb-2 px-3`}>
                      FEATURES
                    </h4>
                    {settingsItems
                      .filter(item => item.category === 'FEATURES')
                      .map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        
                        return (
                          <button
                            key={item.path}
                            onClick={() => handleNavigate(item.path)}
                            className={`flex items-center space-x-3 py-2 px-3 text-sm w-full text-left ${
                              isActive 
                                ? `${activeBgColor} ${activeTextColor}` 
                                : `${secondaryTextColor} ${hoverBgColor}`
                            } rounded-lg transition-colors`}
                          >
                            <Icon size={16} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => handleNavigate('/help')}
              className={`flex items-center space-x-3 py-2 px-3 w-full text-left ${location.pathname === '/help' ? `${activeBgColor} ${activeTextColor}` : `${textColor} ${hoverBgColor}`} rounded-lg transition-colors`}
            >
              <HelpCircle size={20} />
              <span>Help</span>
            </button>
          </nav>
        </div>
      )}

      {/* Global Search Modal */}
      <AddTickerModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onAdd={handleAddTicker}
        isAdding={isAddingTicker}
      />
    </header>
  );
};

export default Navbar;