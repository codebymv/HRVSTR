import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Save, RefreshCw, AlertTriangle, HelpCircle } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';

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
  const isLight = theme === 'light';
  
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

  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | 'none', message: string }>({ 
    type: 'none', 
    message: '' 
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [serverKeyStatus, setServerKeyStatus] = useState<KeyStatus | null>(null);

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
      await fetchServerKeyStatus();
      
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
      }
      
      setSaveStatus({ 
        type: 'success', 
        message: 'API keys saved successfully!' 
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus({ type: 'none', message: '' });
      }, 3000);
    } catch (error) {
      setSaveStatus({ 
        type: 'error', 
        message: 'Failed to save API keys. Please try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`${bgColor} min-h-screen p-4 lg:p-8`}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 lg:mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold ${textColor} mb-2`}>API Keys</h1>
          <p className={secondaryTextColor}>Configure external API keys for enhanced data access</p>
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