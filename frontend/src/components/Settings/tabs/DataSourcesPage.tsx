import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Save, RefreshCw, HelpCircle } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';

interface DataSource {
  id: string;
  name: string;
  description: string;
  requiresApiKey: boolean;
  relatedApiKey?: string;
  helpPath?: string;
}

const DataSourcesPage: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const labelColor = isLight ? 'text-stone-700' : 'text-white';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

  const [enabledDataSources, setEnabledDataSources] = useState<Record<string, boolean>>({
    reddit: true,
    finviz: true,
    sec_insider: true,
    sec_institutional: true,
    alpha_vantage: false
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedDataSources = localStorage.getItem('swEnabledDataSources');
    if (savedDataSources) {
      try {
        const parsedSources = JSON.parse(savedDataSources);
        setEnabledDataSources(parsedSources);
      } catch (error) {
        console.error('Failed to parse saved data sources:', error);
      }
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = async () => {
    setIsLoading(true);
    
    try {
      // Save enabled data sources
      localStorage.setItem('swEnabledDataSources', JSON.stringify(enabledDataSources));
      
      // Show success message briefly
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to save data sources:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className={`${bgColor} min-h-screen p-4 lg:p-8`}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 lg:mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold ${textColor} mb-2`}>Data Sources</h1>
          <p className={secondaryTextColor}>Enable or disable specific data sources for your dashboard</p>
        </div>

        {/* Data Sources */}
        <div className={`${cardBgColor} rounded-lg p-6 mb-8 border ${borderColor}`}>
          <div className={`p-4 border-b ${borderColor}`}>
            <h2 className={`text-lg font-semibold ${textColor} flex items-center`}>
              Available Data Sources
              <Link to="/help/Implementations/APIs" className="ml-2 text-blue-500 hover:text-blue-700">
                <HelpCircle size={18} />
              </Link>
            </h2>
            <p className={`text-sm ${secondaryTextColor} mt-1`}>
              Configure which external services to use for data collection
            </p>
          </div>
          <div className="p-4">
            {dataSources.map(source => {
              const isEnabled = enabledDataSources[source.id] ?? true;
              
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
                            (Requires API Key)
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
                          className="sr-only peer"
                        />
                        <div className={`relative w-11 h-6 bg-gray-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600`}></div>
                        <span className={`ml-3 text-sm font-medium ${textColor}`}>
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
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
                Save Data Sources
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataSourcesPage; 