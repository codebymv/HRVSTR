import { useAuth } from '../contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; // Added useLocation
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, User, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AuthButton = () => {
  const { 
    isAuthenticated, 
    loading, 
    user, 
    signIn, 
    signOut
  } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { theme, setTheme } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation(); // Added location hook

  // Reset image error when user changes
  useEffect(() => {
    setImageError(false);
  }, [user?.picture]);

  // Handle clicks outside of dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  // Get user's initials for fallback
  const getUserInitials = (name?: string, email?: string): string => {
    if (name) {
      const names = name.split(' ');
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  };

  // Handle loading state
  if (loading) {
    return (
      <button 
        disabled 
        className="flex items-center gap-2 px-3 py-1 rounded bg-gray-300 text-gray-600"
      >
        <div className="w-4 h-4 border-2 border-t-transparent border-gray-600 rounded-full animate-spin"></div>
        Loading...
      </button>
    );
  }

  // Authenticated user with avatar dropdown
  if (isAuthenticated && user) {
    const isLight = theme === 'light';
    const dropdownBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
    const dropdownBorderColor = isLight ? 'border-stone-400' : 'border-gray-800';
    const dropdownTextColor = isLight ? 'text-stone-800' : 'text-gray-300';
    const hoverBgColor = isLight ? 'hover:bg-stone-400' : 'hover:bg-gray-800';
    
    const userInitials = getUserInitials(user?.name, user?.email);
    const showImage = false; // Always show gradient instead of Google avatar

    return (
      <div className="relative" ref={dropdownRef}>
        {/* Avatar Button */}
        <button 
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center justify-center rounded-full overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all"
          aria-label="User menu"
        >
          {showImage ? (
            <img 
              src={user.picture} 
              alt={user?.name || 'User'} 
              className="w-8 h-8 rounded-full object-cover" 
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {userInitials}
            </div>
          )}
        </button>
        
        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className={`absolute right-0 mt-2 w-64 rounded-md shadow-lg ${dropdownBgColor} border ${dropdownBorderColor} z-50`}>
            <div className="py-2">
              {/* User Info */}
              <div className={`px-4 py-2 border-b ${dropdownBorderColor}`}>
                <div className="flex items-center gap-3">
                  {/* Larger avatar in dropdown */}
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {userInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold ${dropdownTextColor} truncate`}>{user?.name || 'User'}</p>
                    <p className={`text-xs ${dropdownTextColor} opacity-70 truncate`}>{user?.email}</p>
                  </div>
                </div>
              </div>
              
              {/* Theme Toggle */}
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`w-full text-left px-4 py-2 text-sm ${dropdownTextColor} ${hoverBgColor} flex items-center transition-colors`}
              >
                {isLight ? (
                  <>
                    <Moon size={16} className="mr-2" /> Dark Mode
                  </>
                ) : (
                  <>
                    <Sun size={16} className="mr-2" /> Light Mode
                  </>
                )}
              </button>
              
              {/* Help Link */}
              <Link
                to="/help"
                className={`w-full text-left px-4 py-2 text-sm ${dropdownTextColor} ${hoverBgColor} flex items-center transition-colors`}
              >
                <BookOpen size={16} className="mr-2" /> Help
              </Link>
              
              {/* Sign Out */}
              <button
                onClick={() => signOut()}
                className={`w-full text-left px-4 py-2 text-sm text-red-500 ${hoverBgColor} transition-colors`}
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not authenticated - show login button that directly triggers OAuth
  return (
    <button 
      onClick={signIn}
      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-3 py-1 rounded text-sm transition-all"
    >
      Log In
    </button>
  );
};
