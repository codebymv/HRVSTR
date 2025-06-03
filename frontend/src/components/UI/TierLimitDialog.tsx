import React from 'react';
import { X, Crown, ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TierLimitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  featureName?: string;
  currentTier?: string;
  upgradeMessage?: string;
  context?: 'reddit' | 'watchlist' | 'search' | 'general' | 'sec' | 'institutional';
}

const TierLimitDialog: React.FC<TierLimitDialogProps> = ({
  isOpen,
  onClose,
  title = 'Upgrade Required',
  message,
  featureName = 'this feature',
  currentTier = 'Free',
  upgradeMessage,
  context = 'general'
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleUpgradeClick = () => {
    navigate('/settings/tiers');
    onClose();
  };

  const defaultMessage = message || `You've reached the limit for ${featureName} on the ${currentTier} tier.`;
  const defaultUpgradeMessage = upgradeMessage || 'Upgrade to unlock unlimited access and premium features!';

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-6 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            {defaultMessage}
          </p>
          
          {/* Free Tier Limits Info - only show for free tier */}
          {currentTier.toLowerCase() === 'free' && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                {context === 'reddit' ? 'Free Tier Reddit Limits:' : 
                 context === 'sec' || context === 'institutional' ? 'Free Tier SEC Limits:' : 
                 'Free Tier Daily Limits:'}
              </h4>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                {context === 'reddit' ? (
                  <>
                    <div className="flex justify-between">
                      <span>• Reddit posts per session:</span>
                      <span className="font-medium">50 posts</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Social sentiment data:</span>
                      <span className="font-medium">Limited</span>
                    </div>
                  </>
                ) : context === 'sec' || context === 'institutional' ? (
                  <>
                    <div className="flex justify-between">
                      <span>• Insider trading data:</span>
                      <span className="font-medium">Available</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Institutional holdings:</span>
                      <span className="font-medium">Not Available</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• 13F filings analysis:</span>
                      <span className="font-medium">Not Available</span>
                    </div>
                  </>
                ) : context === 'watchlist' ? (
                  <>
                    <div className="flex justify-between">
                      <span>• Max watchlist stocks:</span>
                      <span className="font-medium">5 stocks</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Real-time updates:</span>
                      <span className="font-medium">Limited</span>
                    </div>
                  </>
                ) : context === 'search' ? (
                  <>
                    <div className="flex justify-between">
                      <span>• Stock searches per day:</span>
                      <span className="font-medium">50 searches</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Advanced filters:</span>
                      <span className="font-medium">Not Available</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>• Daily API calls:</span>
                      <span className="font-medium">10 calls</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Monthly credits:</span>
                      <span className="font-medium">50 credits</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          
          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-2 mb-2">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                Pro Benefits
              </span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
              {defaultUpgradeMessage}
            </p>
            <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
              {context === 'reddit' ? (
                <>
                  <div>✓ Unlimited Reddit posts & social data</div>
                  <div>✓ Advanced sentiment analysis</div>
                  <div>✓ Real-time social media monitoring</div>
                  <div>✓ Multi-platform sentiment tracking</div>
                </>
              ) : context === 'sec' || context === 'institutional' ? (
                <>
                  <div>✓ Institutional holdings analysis</div>
                  <div>✓ 13F filing data & insights</div>
                  <div>✓ Smart money tracking</div>
                  <div>✓ Quarterly holding changes</div>
                  <div>✓ Advanced SEC filing analysis</div>
                </>
              ) : context === 'watchlist' ? (
                <>
                  <div>✓ Unlimited stock searches & price updates</div>
                  <div>✓ Unlimited watchlist items</div>
                  <div>✓ Real-time market data</div>
                  <div>✓ Advanced analytics & insights</div>
                </>
              ) : context === 'search' ? (
                <>
                  <div>✓ Unlimited stock searches</div>
                  <div>✓ Advanced search filters</div>
                  <div>✓ Real-time data & pricing</div>
                  <div>✓ Enhanced search results</div>
                </>
              ) : (
                <>
                  <div>✓ Unlimited stock searches & price updates</div>
                  <div>✓ Unlimited watchlist items</div>
                  <div>✓ Real-time market data</div>
                  <div>✓ Advanced analytics & insights</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Maybe Later
          </button>
          <a
            href="/settings/tiers"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            View Tiers
          </a>
        </div>
      </div>
    </div>
  );
};

export default TierLimitDialog; 