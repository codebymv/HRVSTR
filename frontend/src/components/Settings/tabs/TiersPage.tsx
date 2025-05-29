import React, { useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useTier } from '../../../contexts/TierContext';
import PricingSection from '../../Pricing/PricingSection';

const TiersPage: React.FC = () => {
  const { theme } = useTheme();
  const { tierInfo, simulateUpgrade } = useTier();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  const isLight = theme === 'light';
  
  // Theme-specific styling
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

  const handlePurchaseClick = async (tierName: string) => {
    setSelectedTier(tierName);
    setUpgrading(true);
    setUpgradeMessage(null);

    try {
      if (tierName === 'Free') {
        // Handle free tier "Get Started" - could trigger welcome flow
        setUpgradeMessage('Welcome to HRVSTR! You\'re all set with the free tier.');
        return;
      }

      // Simulate the upgrade process
      const success = await simulateUpgrade(tierName.toLowerCase());
      
      if (success) {
        setUpgradeMessage(`Successfully upgraded to ${tierName} plan! Your new features and credits are now available.`);
      } else {
        setUpgradeMessage('Upgrade failed. Please try again or contact support.');
      }
    } catch (error) {
      setUpgradeMessage('An error occurred during upgrade. Please try again.');
    } finally {
      setUpgrading(false);
      // Clear message after 5 seconds
      setTimeout(() => {
        setUpgradeMessage(null);
        setSelectedTier(null);
      }, 5000);
    }
  };

  return (
    <div className={`${bgColor} min-h-screen p-4 lg:p-8`}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 lg:mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold ${textColor} mb-2`}>Choose Your Plan</h1>
          <p className={secondaryTextColor}>
            Upgrade or manage your subscription to unlock more features and credits
          </p>
        </div>

        {/* Current Plan Status */}
        {tierInfo && (
          <div className={`${cardBgColor} rounded-lg p-6 mb-8 border ${borderColor}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-lg font-semibold ${textColor} capitalize`}>
                  Current Plan: {tierInfo.tier}
                </h3>
                <p className={`text-sm ${secondaryTextColor}`}>
                  {tierInfo.credits.remaining} credits remaining of {tierInfo.credits.monthly} monthly credits
                </p>
              </div>
              <div className="flex items-center text-green-500">
                <Check className="w-5 h-5 mr-2" />
                <span className="font-medium">Active</span>
              </div>
            </div>
            
            {/* Current plan features */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tierInfo.features.map((feature) => (
                <div key={feature} className="flex items-center text-sm">
                  <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                  <span className={textColor}>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upgrade Message */}
        {upgradeMessage && (
          <div className={`mb-8 p-4 rounded-lg border ${
            upgradeMessage.includes('Successfully') 
              ? 'bg-green-800/30 border-green-700 text-green-400' 
              : upgradeMessage.includes('failed') || upgradeMessage.includes('error')
                ? 'bg-red-800/30 border-red-700 text-red-400'
                : 'bg-blue-800/30 border-blue-700 text-blue-400'
          }`}>
            <div className="flex items-center">
              {upgradeMessage.includes('Successfully') ? (
                <Check className="w-5 h-5 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 mr-2" />
              )}
              <span>{upgradeMessage}</span>
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        <div className="mb-8">
          <PricingSection 
            showHeader={false}
            onPurchaseClick={handlePurchaseClick}
            className=""
          />
        </div>

        {/* Loading State */}
        {upgrading && selectedTier && (
          <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} text-center`}>
            <div className="flex items-center justify-center mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
            <p className={textColor}>
              Processing your {selectedTier} plan upgrade...
            </p>
            <p className={`text-sm ${secondaryTextColor} mt-2`}>
              This may take a few moments.
            </p>
          </div>
        )}

        {/* Additional Information */}
        <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor}`}>
          <h3 className={`text-lg font-semibold ${textColor} mb-4`}>
            Plan Benefits & Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className={`font-medium ${textColor} mb-2`}>Credit Usage</h4>
              <ul className={`text-sm ${secondaryTextColor} space-y-1`}>
                <li>• Basic sentiment analysis: 1 credit</li>
                <li>• Reddit sentiment: 3 credits</li>
                <li>• SEC filing data: 2 credits</li>
                <li>• Earnings analysis: 2 credits</li>
                <li>• Real-time refresh: 1 credit</li>
                <li>• Historical data access: 5 credits</li>
              </ul>
            </div>
            <div>
              <h4 className={`font-medium ${textColor} mb-2`}>Billing Information</h4>
              <ul className={`text-sm ${secondaryTextColor} space-y-1`}>
                <li>• All plans include automatic renewal</li>
                <li>• Cancel anytime with immediate effect</li>
                <li>• Unused credits don't roll over</li>
                <li>• Upgrades take effect immediately</li>
                <li>• Secure payment processing via Stripe</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TiersPage; 