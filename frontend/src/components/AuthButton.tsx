import { useAuth } from '../contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, User } from 'lucide-react';

export const AuthButton = () => {
  const { 
    isAuthenticated, 
    loading, 
    user, 
    signIn, 
    signOut
  } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);

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

    return (
      <div className="relative" ref={dropdownRef}>
        {/* Avatar Button */}
        <button 
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center justify-center rounded-full overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all"
          aria-label="User menu"
        >
          {user?.picture ? (
            <img 
              src={user.picture} 
              alt={user?.name || 'User'} 
              className="w-8 h-8 rounded-full" 
            />
          ) : (
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <User size={16} />
            </div>
          )}
        </button>
        
        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className={`absolute right-0 mt-2 w-64 rounded-md shadow-lg ${dropdownBgColor} border ${dropdownBorderColor} z-50`}>
            <div className="py-2">
              {/* User Info */}
              <div className={`px-4 py-2 border-b ${dropdownBorderColor}`}>
                <p className={`font-semibold ${dropdownTextColor}`}>{user?.name}</p>
                <p className={`text-xs overflow-hidden text-ellipsis whitespace-nowrap max-w-full ${dropdownTextColor}`}>{user?.email}</p>
              </div>
              {/* Theme Toggle */}
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`w-full text-left px-4 py-2 text-sm ${dropdownTextColor} ${hoverBgColor} flex items-center`}
              >
                {isLight ? (
                  <>
                    <Moon size={16} className="mr-2" /> Dark
                  </>
                ) : (
                  <>
                    <Sun size={16} className="mr-2" /> Light
                  </>
                )}
              </button>
              
              {/* Sign Out */}
              <button
                onClick={() => signOut()}
                className={`w-full text-left px-4 py-2 text-sm text-red-500 ${hoverBgColor}`}
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
      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
    >
      Log In
    </button>
  );
};
