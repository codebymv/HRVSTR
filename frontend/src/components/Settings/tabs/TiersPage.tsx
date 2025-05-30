import React, { useState } from 'react';
import { Check, AlertCircle, Star, Crown, Zap, Building } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useTier } from '../../../contexts/TierContext';
import { useAuth } from '../../../contexts/AuthContext';
import PricingSection from '../../Pricing/PricingSection';
import YearlyPricingCards from '../../Pricing/YearlyPricingCards';
import { createCheckoutSession } from '../../../utils/pricing';

const TiersPage: React.FC = () => {
  const { theme } = useTheme();
  const { tierInfo } = useTier();
  const { token, signIn } = useAuth();
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

  const handlePurchaseClick = async (tierName: string, isYearly: boolean = false) => {
    if (!token) {
      setUpgradeMessage('Authentication error. Please sign in again.');
      return;
    }

    setSelectedTier(tierName);
    setUpgrading(true);
    setUpgradeMessage(null);

    try {
      if (tierName === 'Free') {
        // Handle free tier "Get Started" - could trigger welcome flow
        setUpgradeMessage('Welcome to HRVSTR! You\'re all set with the free tier.');
        return;
      }

      await createCheckoutSession(
        tierName,
        isYearly,
        token,
        `${window.location.origin}/settings/billing?success=true`,
        `${window.location.origin}/settings/billing?cancelled=true`
      );
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      setUpgradeMessage(error.message || 'An error occurred during checkout. Please try again.');
    } finally {
      setUpgrading(false);
      // Clear message after 5 seconds
      setTimeout(() => {
        setUpgradeMessage(null);
        setSelectedTier(null);
      }, 5000);
    }
  };

  // Helper function to get user tier information with icon and color
  const getUserTierInfo = () => {
    // Use TierContext tierInfo instead of hardcoded user data
    const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
    
    const tierData = {
      free: {
        name: 'HRVSTR Free',
        icon: <Star className="w-4 h-4" />,
        iconColor: 'text-gray-400',
        textColor: 'text-gray-400'
      },
      pro: {
        name: 'HRVSTR Pro',
        icon: <Crown className="w-4 h-4" />,
        iconColor: 'text-blue-500',
        textColor: 'text-blue-400'
      },
      elite: {
        name: 'HRVSTR Elite',
        icon: <Zap className="w-4 h-4" />,
        iconColor: 'text-purple-500',
        textColor: 'text-purple-400'
      },
      institutional: {
        name: 'HRVSTR Institutional',
        icon: <Building className="w-4 h-4" />,
        iconColor: 'text-green-500',
        textColor: 'text-green-400'
      }
    };

    return tierData[currentTier as keyof typeof tierData] || tierData.free;
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      canceled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      past_due: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClasses[status as keyof typeof statusClasses] || statusClasses.canceled}`}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    );
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
                <div className="flex items-center">
                  <p className={`text-lg font-semibold ${textColor} capitalize mr-2`}>
                    {tierInfo.tier}
                  </p>
                  {tierInfo && (
                    <div className={`w-5 h-5 flex items-center justify-center ${getUserTierInfo().iconColor}`}>
                      {getUserTierInfo().icon}
                    </div>
                  )}
                </div>
                <p className={`text-sm ${secondaryTextColor}`}>
                  {tierInfo.credits.remaining} credits remaining of {tierInfo.credits.monthly} monthly credits
                </p>
              </div>
              <div className="flex items-center">
                {getStatusBadge('active')}
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
          <div className="text-center mb-6">
            <h2 className={`text-xl lg:text-2xl font-bold ${textColor} mb-2`}>Monthly Plans</h2>
            <p className={secondaryTextColor}>Choose from our flexible monthly subscription options</p>
          </div>
          <PricingSection 
            showHeader={false}
            onPurchaseClick={handlePurchaseClick}
            className=""
          />
        </div>

        {/* Yearly Pricing Plans */}
        <div className="mb-8">
          <div className="text-center mb-6">
            <h2 className={`text-xl lg:text-2xl font-bold ${textColor} mb-2`}>Yearly Plans</h2>
            <p className={secondaryTextColor}>Save more with annual subscription options</p>
          </div>
          <YearlyPricingCards 
            onPurchaseClick={handlePurchaseClick}
            theme={theme}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h4 className={`font-medium ${textColor} mb-2`}>Credit Usage</h4>
              <ul className={`text-sm ${secondaryTextColor} space-y-1`}>
                <li>• Basic sentiment analysis: 1 credit</li>
                <li>• Reddit sentiment fetch: 3 credits</li>
                <li>• SEC filing data: 2 credits</li>
                <li>• Earnings analysis: 2 credits</li>
                <li>• Stock search query: 1 credit</li>
                <li>• Real-time data refresh: 1 credit</li>
                <li>• Historical data access: 3-5 credits</li>
                <li>• Watchlist sync: 1 credit</li>
              </ul>
            </div>
            <div>
              <h4 className={`font-medium ${textColor} mb-2`}>Tier Limitations</h4>
              <ul className={`text-sm ${secondaryTextColor} space-y-1`}>
                <li>• Free: 3 watchlist stocks maximum</li>
                <li>• Pro: 15 watchlist stocks maximum</li>
                <li>• Elite: 50 watchlist stocks maximum</li>
                <li>• Institutional: Unlimited watchlist</li>
                <li>• Upgrade prompts shown at limits</li>
                <li>• Free tier: Basic search only</li>
                <li>• Paid tiers: Advanced filtering</li>
              </ul>
            </div>
            <div>
              <h4 className={`font-medium ${textColor} mb-2`}>Billing Information</h4>
              <ul className={`text-sm ${secondaryTextColor} space-y-1`}>
                <li>• All plans include automatic renewal</li>
                <li>• Cancel anytime with immediate effect</li>
                <li>• Unused credits don't roll over monthly</li>
                <li>• Upgrades take effect immediately</li>
                <li>• Secure payment processing via Stripe</li>
                <li>• 30-day money-back guarantee on first purchase</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TiersPage; 