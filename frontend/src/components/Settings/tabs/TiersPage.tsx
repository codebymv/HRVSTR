import React, { useState } from 'react';
import { Check, AlertCircle, Star, Crown, Zap, Building } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useTier } from '../../../contexts/TierContext';
import { useAuth } from '../../../contexts/AuthContext';
import PricingSection from '../../Pricing/PricingSection';

// Yearly Pricing Cards Component
const YearlyPricingCards: React.FC<{
  onPurchaseClick: (tierName: string, isYearly: boolean) => void;
  theme: string;
}> = ({ onPurchaseClick, theme }) => {
  const isLight = theme === 'light';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';

  const yearlyTiers = [
    {
      name: 'Pro',
      monthlyPrice: 19,
      yearlyPrice: 190, // ~16.67/month (12% savings)
      icon: <Crown className="w-5 h-5" />,
      gradient: 'from-blue-400 to-blue-600',
      popular: true,
      savings: '17%'
    },
    {
      name: 'Elite',
      monthlyPrice: 49,
      yearlyPrice: 490, // ~40.83/month (17% savings)
      icon: <Zap className="w-5 h-5" />,
      gradient: 'from-purple-400 to-purple-600',
      savings: '17%'
    },
    {
      name: 'Institutional',
      monthlyPrice: 199,
      yearlyPrice: 1990, // ~165.83/month (17% savings)
      icon: <Building className="w-5 h-5" />,
      gradient: 'from-emerald-400 to-emerald-600',
      savings: '17%'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
      {yearlyTiers.map((tier, index) => (
        <div
          key={index}
          className={`${cardBgColor} rounded-lg p-4 lg:p-6 border ${tier.popular ? 'border-blue-500 ring-2 ring-blue-500/20' : borderColor} relative transition-transform hover:scale-105`}
        >
          {/* Popular Badge */}
          {tier.popular && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                Best Value
              </span>
            </div>
          )}

          {/* Savings Badge */}
          <div className="absolute -top-3 -right-3">
            <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
              Save {tier.savings}
            </span>
          </div>

          {/* Header */}
          <div className="text-center mb-4 lg:mb-6">
            <div className={`w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-r ${tier.gradient} rounded-full flex items-center justify-center mx-auto mb-3 lg:mb-4`}>
              <div className="text-white">
                {tier.icon}
              </div>
            </div>
            <h3 className={`text-lg lg:text-xl font-bold mb-2 ${textColor}`}>
              {tier.name} <span className="text-sm font-normal">Yearly</span>
            </h3>
            <div className="mb-2">
              <div className="flex items-center justify-center space-x-2">
                <span className={`text-lg line-through ${secondaryTextColor}`}>
                  ${tier.monthlyPrice * 12}
                </span>
                <span className={`text-2xl lg:text-3xl font-bold ${textColor}`}>
                  ${tier.yearlyPrice}
                </span>
              </div>
              <p className={`text-sm ${secondaryTextColor}`}>
                ${(tier.yearlyPrice / 12).toFixed(0)}/month when billed yearly
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={() => onPurchaseClick(tier.name, true)}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors text-sm lg:text-base ${
              tier.popular 
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : `bg-gradient-to-r ${tier.gradient} text-white hover:opacity-90`
            }`}
          >
            Choose Yearly Plan
          </button>
        </div>
      ))}
    </div>
  );
};

const TiersPage: React.FC = () => {
  const { theme } = useTheme();
  const { tierInfo } = useTier();
  const { token } = useAuth();
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

  // Mapping of tier names to Stripe price IDs
  const getPriceIdForTier = (tierName: string, isYearly: boolean = false): string => {
    const priceIds = {
      'pro': {
        monthly: import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY || 'price_1RU7GkRxBJaRlFvt0pcAxK8Q',
        yearly: import.meta.env.VITE_STRIPE_PRICE_PRO_YEARLY || 'price_1RU7HRRxBJaRlFvtmPFoZhmB'
      },
      'elite': {
        monthly: import.meta.env.VITE_STRIPE_PRICE_ELITE_MONTHLY || 'price_1RU7IIRxBJaRlFvtugLXLVDq',
        yearly: import.meta.env.VITE_STRIPE_PRICE_ELITE_YEARLY || 'price_1RU7IiRxBJaRlFvtvagv3s7J'
      },
      'institutional': {
        monthly: import.meta.env.VITE_STRIPE_PRICE_INSTITUTIONAL_MONTHLY || 'price_1RU7JLRxBJaRlFvtcQWSwReg',
        yearly: import.meta.env.VITE_STRIPE_PRICE_INSTITUTIONAL_YEARLY || 'price_1RU7JsRxBJaRlFvthkm01EeY'
      }
    };

    const tierKey = tierName.toLowerCase() as keyof typeof priceIds;
    return priceIds[tierKey]?.[isYearly ? 'yearly' : 'monthly'] || '';
  };

  const handlePurchaseClick = async (tierName: string, isYearly: boolean = false) => {
    setSelectedTier(tierName);
    setUpgrading(true);
    setUpgradeMessage(null);

    try {
      if (tierName === 'Free') {
        // Handle free tier "Get Started" - could trigger welcome flow
        setUpgradeMessage('Welcome to HRVSTR! You\'re all set with the free tier.');
        return;
      }

      // For paid tiers, create Stripe Checkout Session
      const priceId = getPriceIdForTier(tierName, isYearly);

      if (!priceId) {
        setUpgradeMessage('Pricing configuration error. Please contact support.');
        return;
      }

      // Get auth token
      if (!token) {
        setUpgradeMessage('Authentication error. Please sign in again.');
        return;
      }

      // Create Stripe Checkout Session
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          priceId: priceId,
          mode: 'subscription',
          successUrl: `${window.location.origin}/settings/billing?success=true`,
          cancelUrl: `${window.location.origin}/settings/tiers?cancelled=true`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setUpgradeMessage(data.error || 'Failed to create checkout session. Please try again.');
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        setUpgradeMessage('Checkout session creation failed. Please try again.');
      }
      
    } catch (error) {
      console.error('Checkout error:', error);
      setUpgradeMessage('An error occurred during checkout. Please try again.');
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-700">
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
  );
};

export default TiersPage; 