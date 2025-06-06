import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Save, RefreshCw, AlertTriangle, HelpCircle, Eye, EyeOff, Crown, Lock } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useTier } from '../../../contexts/TierContext';
import { useTierLimits } from '../../../hooks/useTierLimits';
import TierLimitDialog from '../../UI/TierLimitDialog';

interface ApiKey {
  name: string;
  key: string;
  description: string;
  helpPath?: string;
}

interface KeyStatus {
  keys: Record<string, boolean>;
  dataSources: Record<string, boolean>;
}

const ApiKeysPage: React.FC = () => {
  const { theme } = useTheme();
  const { token } = useAuth();
  const { success, error } = useToast();
  const { tierInfo } = useTier();
  const { tierLimitDialog, showTierLimitDialog, closeTierLimitDialog } = useTierLimits();
  const isLight = theme === 'light';
  
  // Get user tier - API Keys require Pro+ tier
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  const hasApiKeyAccess = currentTier !== 'free';
  
  // Theme-specific styling
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const inputBgColor = isLight ? 'bg-white' : 'bg-gray-800';
  const inputTextColor = isLight ? 'text-stone-700' : 'text-gray-200';
  const labelColor = isLight ? 'text-stone-700' : 'text-white';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

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

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [serverKeyStatus, setServerKeyStatus] = useState<KeyStatus | null>(null);
  const [showUnmasked, setShowUnmasked] = useState<Record<string, boolean>>({});
  const [unmaskedKeys, setUnmaskedKeys] = useState<Record<string, string>>({});

  // Fetch API key status from server
  const fetchServerKeyStatus = async () => {
    if (!token) {
      console.warn('No authentication token available');
      return;
    }

    try {
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      const response = await fetch(`${proxyUrl}/api/settings/key-status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
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

  // Fetch API keys from server (masked for display)
  const fetchServerKeys = async () => {
    if (!token) {
      console.warn('No authentication token available');
      return;
    }

    try {
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      const response = await fetch(`${proxyUrl}/api/settings/keys`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        console.error('Failed to fetch API keys');
        return;
      }
      
      const data = await response.json();
      if (data.success && data.keys) {
        // Update the form fields with the masked keys from the server
        setApiKeys(prevKeys => prevKeys.map(key => ({
          ...key,
          key: data.keys[key.name] || ''
        })));
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  // Fetch unmasked API keys from server
  const fetchUnmaskedKeys = async () => {
    if (!token) {
      console.warn('No authentication token available');
      return;
    }

    try {
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      const response = await fetch(`${proxyUrl}/api/settings/keys-unmasked`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        console.error('Failed to fetch unmasked API keys');
        return;
      }
      
      const data = await response.json();
      if (data.success && data.keys) {
        setUnmaskedKeys(data.keys);
      }
    } catch (error) {
      console.error('Error fetching unmasked API keys:', error);
    }
  };

  // Load settings from localStorage on component mount
  useEffect(() => {
    const loadSettings = async () => {
      await fetchServerKeyStatus();
      await fetchServerKeys(); // Fetch actual keys to display
      
      // Note: We now prioritize server keys over localStorage
      // localStorage is kept for backup/local editing only
    };

    loadSettings();
  }, [token]);

  // Handle API key changes
  const handleApiKeyChange = (index: number, value: string) => {
    const updatedKeys = [...apiKeys];
    updatedKeys[index].key = value;
    setApiKeys(updatedKeys);
  };

  // Toggle showing unmasked values for a specific key
  const toggleKeyVisibility = async (keyName: string) => {
    const isCurrentlyVisible = showUnmasked[keyName];
    
    if (!isCurrentlyVisible) {
      // If we want to show the key but don't have unmasked data yet, fetch it
      if (Object.keys(unmaskedKeys).length === 0) {
        await fetchUnmaskedKeys();
      }
      
      // Show the unmasked value
      setShowUnmasked(prev => ({ ...prev, [keyName]: true }));
      
      // Update the display to show the actual value
      setApiKeys(prevKeys => prevKeys.map(key => 
        key.name === keyName 
          ? { ...key, key: unmaskedKeys[keyName] || key.key }
          : key
      ));
    } else {
      // Hide the key - fetch masked version
      setShowUnmasked(prev => ({ ...prev, [keyName]: false }));
      
      // Refresh to get masked values
      await fetchServerKeys();
    }
  };

  // Save settings to localStorage
  const saveSettings = async () => {
    if (!token) {
      error('Authentication required. Please log in and try again.');
      return;
    }

    setIsLoading(true);
    
    try {
      // Save the API keys
      localStorage.setItem('swApiKeys', JSON.stringify(apiKeys));
      
      // Sync API keys with server
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      
      const response = await fetch(`${proxyUrl}/api/settings/update-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
      }
      
      success('API Keys Updated!');
      
      // Refresh the server key status
      await fetchServerKeyStatus();
      // Refresh the displayed keys to show masked values
      await fetchServerKeys();
      // Reset visibility state to show masked values
      setShowUnmasked({});
      
    } catch (err) {
      error('Failed to save API keys. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // If user doesn't have API key access (free tier), show tier restriction
  if (!hasApiKeyAccess) {
    return (
      <>
        <div className={`${bgColor} min-h-screen p-4 lg:p-8`}>
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 lg:mb-8">
              <h1 className={`text-2xl lg:text-3xl font-bold ${textColor} mb-2`}>API Keys</h1>
              <p className={secondaryTextColor}>Configure external API keys for enhanced data access</p>
            </div>

            {/* Tier Restriction Card */}
            <div className={`${cardBgColor} rounded-lg p-8 border ${borderColor} text-center`}>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Lock className="w-8 h-8 text-white" />
                </div>
              </div>
              
              <h2 className={`text-2xl font-bold ${textColor} mb-4`}>API Key Management</h2>
              <p className={`text-lg ${secondaryTextColor} mb-6`}>
                External API key management is available with Pro tier or higher
              </p>
              
              <div className={`${isLight ? 'bg-blue-50' : 'bg-blue-900/20'} rounded-lg p-4 mb-6 border ${isLight ? 'border-blue-200' : 'border-blue-800'}`}>
                <h4 className={`font-semibold ${textColor} mb-2`}>What you get with Pro:</h4>
                <ul className={`text-sm ${secondaryTextColor} space-y-1 text-left max-w-xs mx-auto`}>
                  <li>• Store and manage your own Reddit API credentials</li>
                  <li>• Add Alpha Vantage API keys for enhanced market data</li>
                  <li>• Secure encrypted storage of API credentials</li>
                  <li>• Bypass rate limits with your own API keys</li>
                  <li>• Access to premium data sources and features</li>
                </ul>
              </div>
              
              <button
                onClick={() => window.location.href = '/settings/tiers'}
                className={`${buttonBgColor} text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center justify-center mx-auto`}
              >
                <Crown className="w-5 h-5 mr-2" />
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
        
        {/* Tier Limit Dialog */}
        <TierLimitDialog
          isOpen={tierLimitDialog.isOpen}
          onClose={closeTierLimitDialog}
          featureName={tierLimitDialog.featureName}
          message={tierLimitDialog.message}
          upgradeMessage={tierLimitDialog.upgradeMessage}
          context={tierLimitDialog.context}
        />
      </>
    );
  }

  return (
    <div className={`${bgColor} min-h-screen p-4 lg:p-8`}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 lg:mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold ${textColor} mb-2`}>API Keys</h1>
          <p className={secondaryTextColor}>Configure external API keys for enhanced data access</p>
        </div>

        {/* API Keys Section */}
        <div className={`${cardBgColor} rounded-lg p-6 mb-8 border ${borderColor}`}>
          <div className={`p-4 border-b ${borderColor}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-lg font-semibold ${textColor} flex items-center`}>
                  External API Keys
                  <Link to="/help/API/authentication" className="ml-2 text-blue-500 hover:text-blue-700">
                    <HelpCircle size={18} />
                  </Link>
                </h2>
                <p className={`text-sm ${secondaryTextColor} mt-1`}>
                  Add your own API keys for enhanced functionality
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
                <div className="relative">
                  <input
                    type={showUnmasked[apiKey.name] ? "text" : "password"}
                    value={apiKey.key}
                    onChange={(e) => handleApiKeyChange(index, e.target.value)}
                    className={`w-full ${inputBgColor} border ${borderColor} rounded px-4 py-2 pr-12 ${inputTextColor} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder={`Enter your ${apiKey.name.replace(/_/g, ' ')} here...`}
                  />
                  {apiKey.key && (
                    <button
                      type="button"
                      onClick={() => toggleKeyVisibility(apiKey.name)}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${isLight ? 'text-gray-500 hover:text-gray-700' : 'text-gray-400 hover:text-gray-200'} transition-colors`}
                    >
                      {showUnmasked[apiKey.name] ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  )}
                </div>
                <p className={`text-sm ${secondaryTextColor}`}>{apiKey.description}</p>
              </div>
            ))}
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
                Save API Keys
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeysPage;