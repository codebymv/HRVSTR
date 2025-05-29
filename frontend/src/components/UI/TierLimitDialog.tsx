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
  context?: 'reddit' | 'watchlist' | 'search' | 'general';
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
                {context === 'reddit' ? 'Free Tier Reddit Limits:' : 'Free Tier Daily Limits:'}
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
                ) : context === 'watchlist' ? (
                  <>
                    <div className="flex justify-between">
                      <span>• Stock searches:</span>
                      <span className="font-medium">25/day</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Price updates:</span>
                      <span className="font-medium">25/day</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Watchlist items:</span>
                      <span className="font-medium">5 stocks</span>
                    </div>
                  </>
                ) : context === 'search' ? (
                  <>
                    <div className="flex justify-between">
                      <span>• Stock searches:</span>
                      <span className="font-medium">25/day</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Search results:</span>
                      <span className="font-medium">Basic</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Real-time data:</span>
                      <span className="font-medium">Limited</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>• Stock searches:</span>
                      <span className="font-medium">25/day</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Price updates:</span>
                      <span className="font-medium">25/day</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Watchlist items:</span>
                      <span className="font-medium">5 stocks</span>
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
        <div className="flex space-x-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Maybe Later
          </button>
          <button
            onClick={handleUpgradeClick}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all transform hover:scale-105 flex items-center space-x-2"
          >
            <span>View Tiers</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TierLimitDialog; 