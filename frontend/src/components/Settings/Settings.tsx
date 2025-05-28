import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Save, RefreshCw, AlertTriangle, Moon, Sun, Coins, Users, ArrowRight, HelpCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ApiKey {
  name: string;
  key: string;
  description: string;
  helpPath?: string;
}

interface Theme {
  id: string;
  name: string;
  description: string;
}

interface DataSource {
  id: string;
  name: string;
  description: string;
  requiresApiKey: boolean;
  relatedApiKey?: string;
  helpPath?: string;
}

interface KeyStatus {
  keys: Record<string, boolean>;
  dataSources: Record<string, boolean>;
}

interface SettingsProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
}

// Mock credits data interface
interface CreditsData {
  userCredits: {
    used: number;
    total: number;
    left: number;
    usageSince: string;
  };
  addOnCredits: {
    used: number;
    total: number;
    left: number;
    usageSince: string;
  };
  nextRefresh: {
    date: string;
    daysLeft: number;
  };
}

const Settings: React.FC<SettingsProps> = ({ onLoadingProgressChange }) => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-700' : 'text-gray-300';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const inputBgColor = isLight ? 'bg-white' : 'bg-gray-800';
  const inputTextColor = isLight ? 'text-stone-800' : 'text-gray-200';
  const labelColor = isLight ? 'text-stone-900' : 'text-white';
  const descriptionColor = isLight ? 'text-stone-700' : 'text-gray-300';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

  // Mock credits data - this would come from your backend in a real app
  const [creditsData] = useState<CreditsData>({
    userCredits: {
      used: 847,
      total: 1000,
      left: 153,
      usageSince: 'Dec 13, 2024'
    },
    addOnCredits: {
      used: 234,
      total: 500,
      left: 266,
      usageSince: 'Dec 13, 2024'
    },
    nextRefresh: {
      date: 'Jan 13, 2025',
      daysLeft: 16
    }
  });

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { 
      name: 'reddit_client_id', 
      key: '', 
      description: 'Your Reddit API Client ID. Get this from https://www.reddit.com/prefs/apps by creating a new application',
      helpPath: '/help/Implementations/APIs/reddit-api'
    },
    { 
      name: 'reddit_client_secret', 
      key: '', 
      description: 'Your Reddit API Client Secret from your Reddit application settings',
      helpPath: '/help/Implementations/APIs/reddit-api'
    },
    {
      name: 'alpha_vantage_key',
      key: '',
      description: 'Your Alpha Vantage API key. Get a free key from https://www.alphavantage.co/support/#api-key',
      helpPath: '/help/Implementations/APIs/alpha-vantage-api'
    }
  ]);

  const [selectedTheme, setSelectedTheme] = useState<string>(theme);
  const [showTickers, setShowTickers] = useState<boolean>(true);
  const [defaultTimeRange, setDefaultTimeRange] = useState<string>('1w');
  const [enabledDataSources, setEnabledDataSources] = useState<Record<string, boolean>>({
    reddit: true,
    finviz: true,
    sec_insider: true,
    sec_institutional: true
  });
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | 'none', message: string }>({ 
    type: 'none', 
    message: '' 
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [serverKeyStatus, setServerKeyStatus] = useState<KeyStatus | null>(null);

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
  
  // Available data sources
  const dataSources: DataSource[] = [
    { 
      id: 'reddit', 
      name: 'Reddit Data', 
      description: 'Posts, comments, and sentiment from Reddit. Requires your own Reddit API credentials.', 
      requiresApiKey: true,
      relatedApiKey: 'reddit_client_id',
      helpPath: '/help/Implementations/APIs/reddit-api'
    },
    { 
      id: 'finviz', 
      name: 'FinViz News & Analysis', 
      description: 'Financial news and sentiment analysis from FinViz', 
      requiresApiKey: false,
      helpPath: '/help/Implementations/APIs/finviz-api'
    },
    { 
      id: 'sec_insider', 
      name: 'SEC Insider Trades', 
      description: 'Form 4 filings showing insider buying and selling activity', 
      requiresApiKey: false,
      helpPath: '/help/Implementations/APIs/sec-edgar'
    },
    { 
      id: 'sec_institutional', 
      name: 'SEC Institutional Holdings', 
      description: '13F filings showing institutional investment positions', 
      requiresApiKey: false,
      helpPath: '/help/Implementations/APIs/sec-edgar'
    },
    {
      id: 'alpha_vantage',
      name: 'Alpha Vantage Market Data',
      description: 'Real-time and historical market data from Alpha Vantage. Requires your own API key.',
      requiresApiKey: true,
      relatedApiKey: 'alpha_vantage_key',
      helpPath: '/help/Implementations/APIs/alpha-vantage-api'
    }
  ];

  // Fetch API key status from server
  const fetchServerKeyStatus = async () => {
    try {
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      const response = await fetch(`${proxyUrl}/api/settings/key-status`);
      
      if (!response.ok) {
        console.error('Failed to fetch API key status');
        return;
      }
      
      const data = await response.json();
      if (data.success && data.keys) {
        setServerKeyStatus(data);
      }
    } catch (error) {
      console.error('Error fetching API key status:', error);
    }
  };

  // Load settings from localStorage on component mount
  useEffect(() => {
    const loadSettings = async () => {
      // Fetch server key status
      if (onLoadingProgressChange) {
        onLoadingProgressChange(50, 'Checking API key status...');
      }
      await fetchServerKeyStatus();
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(100, 'Settings loaded successfully');
      }
      
      // Report progress
      if (onLoadingProgressChange) {
        onLoadingProgressChange(20, 'Retrieving saved settings...');
      }
      
      // First load settings from localStorage
      const savedSettings = localStorage.getItem('sentinel_settings');
      
      if (savedSettings) {
        try {
          const parsedKeys = JSON.parse(savedSettings);
          setApiKeys(prevKeys => prevKeys.map(key => {
            const savedKey = parsedKeys.find((k: ApiKey) => k.name === key.name);
            return savedKey ? { ...key, key: savedKey.key } : key;
          }));
        } catch (error) {
          console.error('Failed to parse saved API keys:', error);
        }
      }

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
      
      // Load enabled data sources
      const savedDataSources = localStorage.getItem('swEnabledDataSources');
      if (savedDataSources) {
        try {
          const parsedSources = JSON.parse(savedDataSources);
          setEnabledDataSources(parsedSources);
        } catch (error) {
          console.error('Failed to parse saved data sources:', error);
        }
      }
    };

    loadSettings();
  }, []);

  // Handle API key changes
  const handleApiKeyChange = (index: number, value: string) => {
    const updatedKeys = [...apiKeys];
    updatedKeys[index].key = value;
    setApiKeys(updatedKeys);
  };

  // Save settings to localStorage
  const saveSettings = async () => {
    setIsLoading(true);
    
    try {
      // Save the API keys
      localStorage.setItem('swApiKeys', JSON.stringify(apiKeys));
      
      // Apply theme changes immediately
      setTheme(selectedTheme as 'dark' | 'light');
      
      // Save tickers visibility setting
      localStorage.setItem('swShowTickers', showTickers.toString());
      
      // Save default time range
      localStorage.setItem('swDefaultTimeRange', defaultTimeRange);
      
      // Save enabled data sources
      localStorage.setItem('swEnabledDataSources', JSON.stringify(enabledDataSources));
      
      // Sync API keys with server
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      
      const response = await fetch(`${proxyUrl}/api/settings/update-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKeys: apiKeys.reduce((acc, key) => {
            if (key.key.trim()) {
              acc[key.name] = key.key.trim();
            }
            return acc;
          }, {} as Record<string, string>)
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update API keys on server');
        // We don't fail the entire save operation if server update fails
        // Local settings are still saved
      }
      
      setSaveStatus({ 
        type: 'success', 
        message: 'Settings saved successfully!' 
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus({ type: 'none', message: '' });
      }, 3000);
    } catch (error) {
      setSaveStatus({ 
        type: 'error', 
        message: 'Failed to save settings. Please try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper component for section titles with help links
  const SectionTitle: React.FC<{ title: string; helpPath?: string }> = ({ title, helpPath }) => (
    <div className="flex items-center mb-3">
      <h2 className={`text-xl font-semibold ${labelColor}`}>{title}</h2>
      {helpPath && (
        <Link to={helpPath} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-500 hover:text-blue-700">
          <HelpCircle size={18} />
        </Link>
      )}
    </div>
  );

  return (
    <div className={`${bgColor} ${textColor} min-h-screen`}>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2">Settings</h1>
          <p className={secondaryTextColor}>Configure application preferences and API keys</p>
        </div>

        {/* Credits/Usage Summary */}
        <div className={`${cardBgColor} rounded-lg p-6 mb-8 border ${borderColor}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
                <Coins className="w-6 h-6 mr-2 text-yellow-500" />
                Usage
              </h2>
              <Link to="/help/getting-started" className="ml-2 text-blue-500 hover:text-blue-700">
                <HelpCircle size={18} />
              </Link>
              <button
                onClick={() => navigate('/help')}
                className="ml-3 text-sm text-blue-500 hover:text-blue-600 flex items-center"
              >
                See Pricing & Credits help
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>

          <div className="mb-6">
            <h3 className={`text-lg font-semibold ${textColor} mb-2`}>HRVSTR Usage Summary</h3>
            <p className={`text-sm ${secondaryTextColor} mb-1`}>
              Next plan refresh is in <span className="font-medium">{creditsData.nextRefresh.daysLeft} days</span> on {creditsData.nextRefresh.date}.
            </p>
          </div>

          <div className="space-y-6">
            {/* User Scrape Credits */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`font-medium ${textColor}`}>User Scrape credits</h4>
                <span className={`text-2xl font-bold ${textColor}`}>
                  {creditsData.userCredits.left.toLocaleString()} <span className="text-sm font-normal">left</span>
                </span>
              </div>
              <div className="flex items-center text-sm mb-2">
                <span className={secondaryTextColor}>
                  {creditsData.userCredits.used.toLocaleString()} / {creditsData.userCredits.total.toLocaleString()} used
                </span>
                <span className={`ml-auto ${secondaryTextColor}`}>
                  Usage since {creditsData.userCredits.usageSince}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-1">
                <div 
                  className={`h-2 rounded-full ${
                    creditsData.userCredits.left < 100 ? 'bg-red-500' : 
                    creditsData.userCredits.left < 300 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${(creditsData.userCredits.used / creditsData.userCredits.total) * 100}%` }}
                />
              </div>
              <p className={`text-xs ${secondaryTextColor}`}>
                Using premium scraping options costs one scrape credit per use.
              </p>
            </div>

            {/* Add-on Scrape Credits */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`font-medium ${textColor}`}>Add-on scrape credits</h4>
                <span className={`text-2xl font-bold ${textColor}`}>
                  {creditsData.addOnCredits.left.toLocaleString()} <span className="text-sm font-normal">left</span>
                </span>
              </div>
              <div className="flex items-center text-sm mb-2">
                <span className={secondaryTextColor}>
                  {creditsData.addOnCredits.used.toLocaleString()} / {creditsData.addOnCredits.total.toLocaleString()} used
                </span>
                <span className={`ml-auto ${secondaryTextColor}`}>
                  Usage since {creditsData.addOnCredits.usageSince}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-1">
                <div 
                  className="bg-teal-500 h-2 rounded-full"
                  style={{ width: `${(creditsData.addOnCredits.used / creditsData.addOnCredits.total) * 100}%` }}
                />
              </div>
              <p className={`text-xs ${secondaryTextColor}`}>
                Additional scrape credits.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <p className={`text-sm ${secondaryTextColor}`}>
                  Once the usage limit is reached, HRVSTR can continue to be used with the base functionality. To 
                  continue using premium web scraping, purchase add-on scrape credits.
                </p>
                <button 
                  onClick={() => navigate('/billing')}
                  className={`ml-4 ${buttonBgColor} text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center whitespace-nowrap`}
                >
                  Purchase credits
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={() => navigate('/referrals')}
                className={`text-sm ${secondaryTextColor} hover:${textColor} flex items-center transition-colors`}
              >
                <Users className="w-4 h-4 mr-2" />
                Refer a friend to get 250 free add-on scrape credits
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>

        {/* Settings Status Message */}
        {saveStatus.type !== 'none' && (
          <div className={`mb-6 p-4 rounded-lg ${saveStatus.type === 'success' ? 'bg-green-800/30 border border-green-700' : 'bg-red-800/30 border border-red-700'}`}>
            {saveStatus.type === 'error' && <AlertTriangle className="inline mr-2 text-red-400" size={18} />}
            <span className={saveStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}>
              {saveStatus.message}
            </span>
          </div>
        )}

        {/* API Keys Section */}
        <div className={`${cardBgColor} rounded-lg p-6 mb-8 border ${borderColor}`}>
          <div className={`p-4 border-b ${borderColor}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-lg font-semibold ${textColor} flex items-center`}>
                  API Keys
                  <Link to="/help/API/authentication" className="ml-2 text-blue-500 hover:text-blue-700">
                    <HelpCircle size={18} />
                  </Link>
                </h2>
                <p className={`text-sm ${secondaryTextColor} mt-1`}>
                  Configure external API keys for enhanced data access
                </p>
              </div>
            </div>
          </div>
          <div className="p-4">
            {apiKeys.map((apiKey, index) => (
              <div key={apiKey.name} className="mb-4">
                <label className={`block ${labelColor} text-sm font-medium mb-2 flex items-center`}>
                  {apiKey.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  {apiKey.name.includes('reddit') && (
                    <Link to="/help/Implementations/APIs/reddit-api" className="ml-2 text-blue-500 hover:text-blue-700">
                      <HelpCircle size={16} />
                    </Link>
                  )}
                  {apiKey.name.includes('alpha_vantage') && (
                    <Link to="/help/Config/backend-config" className="ml-2 text-blue-500 hover:text-blue-700">
                      <HelpCircle size={16} />
                    </Link>
                  )}
                </label>
                <input
                  type="password"
                  value={apiKey.key}
                  onChange={(e) => handleApiKeyChange(index, e.target.value)}
                  className={`w-full ${inputBgColor} border ${borderColor} rounded px-4 py-2 ${inputTextColor} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder={`Enter your ${apiKey.name.replace(/_/g, ' ')} here...`}
                />
                <p className={`text-sm ${secondaryTextColor}`}>{apiKey.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Data Sources */}
        <div className={`${cardBgColor} rounded-lg p-6 mb-8 border ${borderColor}`}>
          <div className={`p-4 border-b ${borderColor}`}>
            <h2 className={`text-lg font-semibold ${textColor} flex items-center`}>
              Data Sources
              <Link to="/help/Implementations/APIs" className="ml-2 text-blue-500 hover:text-blue-700">
                <HelpCircle size={18} />
              </Link>
            </h2>
            <p className={`text-sm ${secondaryTextColor} mt-1`}>
              Enable or disable specific data sources for your dashboard
            </p>
          </div>
          <div className="p-4">
            {dataSources.map(source => {
              const isEnabled = enabledDataSources[source.id] ?? true;
              
              // Check if the source has required keys from either client or server
              const hasClientKey = !source.requiresApiKey || 
                (source.relatedApiKey && apiKeys.find(k => k.name === source.relatedApiKey)?.key);
                
              const hasServerKey = !source.requiresApiKey || 
                (serverKeyStatus && source.relatedApiKey && serverKeyStatus.keys[source.relatedApiKey]);
                
              // If either client or server has the key, consider it valid
              const hasRequiredKey = hasClientKey || hasServerKey;
              
              return (
                <div key={source.id} className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className={`block ${labelColor} text-sm font-medium mb-1 flex items-center`}>
                        {source.name}
                        {source.id === 'reddit' && (
                          <Link to="/help/Implementations/APIs/reddit-api" className="ml-2 text-blue-500 hover:text-blue-700">
                            <HelpCircle size={16} />
                          </Link>
                        )}
                        {source.id === 'finviz' && (
                          <Link to="/help/Implementations/APIs/finviz-api" className="ml-2 text-blue-500 hover:text-blue-700">
                            <HelpCircle size={16} />
                          </Link>
                        )}
                        {(source.id === 'sec_insider' || source.id === 'sec_institutional') && (
                          <Link to="/help/Implementations/APIs/sec-edgar" className="ml-2 text-blue-500 hover:text-blue-700">
                            <HelpCircle size={16} />
                          </Link>
                        )}
                        {source.id === 'alpha_vantage' && (
                          <Link to="/help/Config/backend-config" className="ml-2 text-blue-500 hover:text-blue-700">
                            <HelpCircle size={16} />
                          </Link>
                        )}
                        {source.requiresApiKey && (
                          <span className="ml-2 text-xs text-yellow-500">
                            (Requires API Key or .env)
                          </span>
                        )}
                      </label>
                      <p className={`text-sm ${secondaryTextColor}`}>{source.description}</p>
                    </div>
                    <div className="flex items-center">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => setEnabledDataSources(prev => ({
                            ...prev,
                            [source.id]: !isEnabled
                          }))}
                          disabled={source.requiresApiKey && !hasRequiredKey}
                          className="sr-only peer"
                        />
                        <div className={`relative w-11 h-6 ${source.requiresApiKey && !hasRequiredKey ? 'bg-gray-600' : 'bg-gray-700'} rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${source.requiresApiKey && !hasRequiredKey ? 'opacity-50' : ''}`}></div>
                        <span className={`ml-3 text-sm font-medium ${textColor}`}>
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                    {/* API key requirement is already indicated by the label */}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Data Settings */}
        <div className={`${cardBgColor} rounded-lg p-6 mb-8 border ${borderColor}`}>
          <div className={`p-4 border-b ${borderColor}`}>
            <h2 className={`text-lg font-semibold ${textColor}`}>Data Settings</h2>
            <p className={`text-sm ${secondaryTextColor} mt-1`}>
              Configure data preferences and caching behavior
            </p>
          </div>
          <div className="p-4">
            <div className="mb-4">
              <label className={`block ${labelColor} text-sm font-medium mb-2`}>
                Cache Duration
              </label>
              <select
                className={`${inputBgColor} w-full px-4 py-2 rounded-lg ${inputTextColor} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1`}
                defaultValue="5"
              >
                <option value="1">1 Minute</option>
                <option value="5">5 Minutes</option>
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes</option>
                <option value="60">1 Hour</option>
              </select>
              <p className={`text-sm ${secondaryTextColor}`}>
                How long to cache API responses before refreshing
              </p>
            </div>
          </div>
        </div>

        {/* Interface Settings */}
        <div className={`${cardBgColor} rounded-lg p-6 mb-8 border ${borderColor}`}>
          <div className={`p-4 border-b ${borderColor}`}>
            <h2 className={`text-lg font-semibold ${textColor} flex items-center`}>
              Interface Settings
              <Link to="/help/Implementations/Settings/user-preferences" className="ml-2 text-blue-500 hover:text-blue-700">
                <HelpCircle size={18} />
              </Link>
            </h2>
            <p className={`text-sm ${secondaryTextColor} mt-1`}>
              Customize the application appearance and behavior
            </p>
          </div>
          <div className="p-4">
            {/* Theme Selection */}
            <div className="mb-4">
              <label className={`block ${textColor} text-sm font-medium mb-2`}>
                Theme
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {themes.map((theme) => (
                  <div
                    key={theme.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedTheme === theme.id 
                        ? 'border-blue-500 bg-blue-900/30 hover:bg-blue-900/20'
                        : isLight 
                          ? 'bg-stone-400 hover:bg-stone-500 border-stone-500'
                          : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                    }`}
                    onClick={() => {
                      setSelectedTheme(theme.id);
                      // Apply theme change immediately without waiting for save
                      setTheme(theme.id as 'dark' | 'light');
                    }}
                  >
                    <div className="flex items-center mb-2">
                      <div className={`w-4 h-4 rounded-full ${selectedTheme === theme.id ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                      {theme.id === 'dark' ? <Moon size={16} className="ml-2" /> : <Sun size={16} className="ml-2" />}
                      <span className={`ml-2 font-medium ${textColor}`}>{theme.name}</span>
                    </div>
                    <p className={`text-xs ${secondaryTextColor}`}>{theme.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Default Time Range */}
            <div className="mb-4">
              <label className={`block ${textColor} text-sm font-medium mb-2`}>
                Default Time Range
              </label>
              <select
                value={defaultTimeRange}
                onChange={(e) => setDefaultTimeRange(e.target.value)}
                className={`${inputBgColor} w-full px-4 py-2 rounded-lg ${inputTextColor} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1`}
              >
                {timeRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
              <p className={`${descriptionColor} text-sm mb-4`}>
                Default time period for charts and data displays
              </p>
            </div>

            {/* Show Tickers Toggle */}
            <div className="mb-4">
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
              <p className={`${descriptionColor} text-sm mb-4`}>
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
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
