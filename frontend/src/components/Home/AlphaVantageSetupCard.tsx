import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Settings, Key, Lock, Crown } from 'lucide-react';
import { useTier } from '../../contexts/TierContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import TierLimitDialog from '../UI/TierLimitDialog';

interface AlphaVantageSetupCardProps {
  theme: 'light' | 'dark';
}

const AlphaVantageSetupCard: React.FC<AlphaVantageSetupCardProps> = ({ theme }) => {
  const navigate = useNavigate();
  const { tierInfo } = useTier();
  const { tierLimitDialog, showTierLimitDialog, closeTierLimitDialog } = useTierLimits();
  const isLight = theme === 'light';

  // Get user tier - API Keys require Pro+ tier
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  const hasApiKeyAccess = currentTier !== 'free';

  // Theme-specific styling
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const gradientFrom = isLight ? 'from-green-500' : 'from-green-600';
  const gradientTo = isLight ? 'to-blue-600' : 'to-blue-700';
  const buttonBg = isLight ? 'bg-green-500 hover:bg-green-600' : 'bg-green-600 hover:bg-green-700';
  const secondaryButtonBg = isLight ? 'bg-gray-500 hover:bg-gray-600' : 'bg-gray-600 hover:bg-gray-700';
  const upgradeButtonBg = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

  // If user doesn't have API key access (free tier), show tier restriction
  if (!hasApiKeyAccess) {
    return (
      <>
        <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} text-center`}>
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          
          <h3 className={`text-xl font-bold ${textColor} mb-2`}>
            Alpha Vantage API Keys
          </h3>
          
          <p className={`${secondaryTextColor} mb-4 max-w-md mx-auto`}>
            External API key management is available with Pro tier or higher. Upgrade to unlock enhanced market data features.
          </p>
          
          <div className={`${isLight ? 'bg-blue-50' : 'bg-blue-900/20'} rounded-lg p-4 mb-6 border ${isLight ? 'border-blue-200' : 'border-blue-800'}`}>
            <h4 className={`font-semibold ${textColor} mb-2`}>What you get with Pro:</h4>
            <ul className={`text-sm ${secondaryTextColor} space-y-1 text-left max-w-xs mx-auto`}>
              <li>• Real-time stock prices with your API key</li>
              <li>• Earnings calendar events</li>
              <li>• Company financial overviews</li>
              <li>• Advanced market analytics</li>
              <li>• Bypass rate limits with your own keys</li>
            </ul>
          </div>
          
          <button
            onClick={() => navigate('/settings/tiers')}
            className={`${upgradeButtonBg} text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center mx-auto`}
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Pro
          </button>
          
          {/* <p className={`text-xs ${secondaryTextColor} mt-3`}>
            Current tier: <span className="font-medium capitalize">{currentTier}</span>
          </p> */}
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
    <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} text-center`}>
      <div className={`w-16 h-16 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-full flex items-center justify-center mx-auto mb-4`}>
        <BarChart className="w-8 h-8 text-white" />
      </div>
      
      <h3 className={`text-xl font-bold ${textColor} mb-2`}>
        Setup Alpha Vantage API Keys
      </h3>
      
      <p className={`${secondaryTextColor} mb-4 max-w-md mx-auto`}>
        Configure your Alpha Vantage API credentials to unlock real-time financial data, earnings calendar, and advanced market analytics for your watchlist.
      </p>
      
      <div className={`${isLight ? 'bg-green-50' : 'bg-green-900/20'} rounded-lg p-4 mb-6 border ${isLight ? 'border-green-200' : 'border-green-800'}`}>
        <h4 className={`font-semibold ${textColor} mb-2`}>Features You'll Unlock:</h4>
        <ul className={`text-sm ${secondaryTextColor} space-y-1 text-left max-w-xs mx-auto`}>
          <li>• Real-time stock prices</li>
          <li>• Earnings calendar events</li>
          <li>• Company financial overviews</li>
          <li>• Advanced market analytics</li>
          <li>• Historical price data</li>
        </ul>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={() => navigate('/settings/api-keys')}
          className={`${buttonBg} text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center`}
        >
          <Settings className="w-4 h-4 mr-2" />
          Configure API Keys
        </button>
        <a
          href="https://www.alphavantage.co/support/#api-key"
          target="_blank"
          rel="noopener noreferrer"
          className={`${secondaryButtonBg} text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center`}
        >
          <Key className="w-4 h-4 mr-2" />
          Get Alpha Vantage Key
        </a>
      </div>
    </div>
  );
};

export default AlphaVantageSetupCard; 