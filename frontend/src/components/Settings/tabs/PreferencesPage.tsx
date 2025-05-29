import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Save, RefreshCw, Moon, Sun, HelpCircle, Monitor, User, Settings } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';

interface Theme {
  id: string;
  name: string;
  description: string;
}

const PreferencesPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const descriptionColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

  const [selectedTheme, setSelectedTheme] = useState<string>(theme);
  const [showTickers, setShowTickers] = useState<boolean>(true);
  const [defaultTimeRange, setDefaultTimeRange] = useState<string>('1w');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Available themes
  const themes: Theme[] = [
    { id: 'dark', name: 'Dark Mode', description: 'Dark theme with blue accents' },
    { id: 'light', name: 'Light Mode', description: 'Beige/grey theme for better contrast' }
  ];

  // Available time ranges
  const timeRanges = [
    { value: '1d', label: '1 Day' },
    { value: '1w', label: '1 Week' },
    { value: '1m', label: '1 Month' },
    { value: '3m', label: '3 Months' }
  ];

  // Load settings from localStorage on component mount
  useEffect(() => {
    // Load theme preference
    const savedTheme = localStorage.getItem('swTheme');
    if (savedTheme) {
      setSelectedTheme(savedTheme);
    }

    // Load ticker display preference
    const tickerPref = localStorage.getItem('swShowTickers');
    setShowTickers(tickerPref === null ? true : tickerPref === 'true');

    // Load default time range
    const timeRange = localStorage.getItem('swDefaultTimeRange');
    if (timeRange) {
      setDefaultTimeRange(timeRange);
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = async () => {
    setIsLoading(true);
    
    try {
      // Apply theme changes immediately
      setTheme(selectedTheme as 'dark' | 'light');
      
      // Save tickers visibility setting
      localStorage.setItem('swShowTickers', showTickers.toString());
      
      // Save default time range
      localStorage.setItem('swDefaultTimeRange', defaultTimeRange);
      
      // Show success message briefly
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className={`${bgColor} min-h-screen p-4 lg:p-8`}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 lg:mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold ${textColor} mb-2 flex items-center`}>
            <Settings className="w-6 h-6 mr-3" />
            Preferences
          </h1>
          <p className={secondaryTextColor}>Customize your application preferences and behavior</p>
        </div>

        {/* Display & Interface Preferences */}
        <div className={`${cardBgColor} rounded-lg p-6 mb-8 border ${borderColor}`}>
          <div className={`p-4 border-b ${borderColor}`}>
            <h2 className={`text-lg font-semibold ${textColor} flex items-center`}>
              <Monitor className="w-5 h-5 mr-2" />
              Display & Interface
              <Link to="/help/Implementations/Settings/user-preferences" className="ml-2 text-blue-500 hover:text-blue-700">
                <HelpCircle size={18} />
              </Link>
            </h2>
            <p className={`text-sm ${secondaryTextColor} mt-1`}>
              Configure visual preferences and default behaviors
            </p>
          </div>
          <div className="p-4">
            {/* Theme Selection */}
            <div className="mb-6">
              <label className={`block ${textColor} text-sm font-medium mb-3`}>
                Theme
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {themes.map((themeOption) => (
                  <div
                    key={themeOption.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedTheme === themeOption.id 
                        ? 'border-blue-500 bg-blue-900/30 hover:bg-blue-900/20'
                        : isLight 
                          ? 'bg-stone-400 hover:bg-stone-500 border-stone-500'
                          : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                    }`}
                    onClick={() => {
                      setSelectedTheme(themeOption.id);
                      // Apply theme change immediately without waiting for save
                      setTheme(themeOption.id as 'dark' | 'light');
                    }}
                  >
                    <div className="flex items-center mb-2">
                      <div className={`w-4 h-4 rounded-full ${selectedTheme === themeOption.id ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                      {themeOption.id === 'dark' ? <Moon size={16} className="ml-2" /> : <Sun size={16} className="ml-2" />}
                      <span className={`ml-2 font-medium ${textColor}`}>{themeOption.name}</span>
                    </div>
                    <p className={`text-xs ${secondaryTextColor}`}>{themeOption.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Default Time Range */}
            <div className="mb-6">
              <label className={`block ${textColor} text-sm font-medium mb-2`}>
                Default Time Range
              </label>
              <select
                value={defaultTimeRange}
                onChange={(e) => setDefaultTimeRange(e.target.value)}
                className={`${cardBgColor} w-full px-4 py-2 rounded-lg ${textColor} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border ${borderColor}`}
              >
                {timeRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
              <p className={`${descriptionColor} text-sm mt-1`}>
                Default time period for charts and data displays
              </p>
            </div>

            {/* Show Tickers Toggle */}
            <div className="mb-6">
              <label className={`block ${textColor} text-sm font-medium mb-2`}>
                Display Ticker Labels
              </label>
              <div className="flex items-center">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTickers}
                    onChange={() => setShowTickers(!showTickers)}
                    className="sr-only peer"
                  />
                  <div className={`relative w-11 h-6 ${isLight ? 'bg-stone-400' : 'bg-gray-700'} rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600`}></div>
                  <span className={`ml-3 text-sm font-medium ${textColor}`}>
                    {showTickers ? 'Visible' : 'Hidden'}
                  </span>
                </label>
              </div>
              <p className={`${descriptionColor} text-sm mt-1`}>
                Show or hide ticker symbols in charts and lists
              </p>
            </div>
          </div>
        </div>


        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={isLoading}
            className={`${buttonBgColor} text-white font-medium py-2 px-4 rounded-lg flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="animate-spin mr-2" size={18} />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2" size={18} />
                Save Preferences
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreferencesPage; 