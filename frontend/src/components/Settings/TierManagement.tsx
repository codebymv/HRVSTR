import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Coins, 
  Users, 
  ArrowRight, 
  HelpCircle, 
  Crown, 
  Zap, 
  Building, 
  Star, 
  Check,
  RefreshCw,
  Plus 
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { formatTierName } from '../../utils/activityFormatter';

const TierManagement: React.FC = () => {
  const { theme } = useTheme();
  const { tierInfo, loading, error, addCredits } = useTier();
  const navigate = useNavigate();
  const [addingCredits, setAddingCredits] = useState(false);

  const isLight = theme === 'light';
  
  // Theme-specific styling
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

  const handleAddCredits = async (amount: number) => {
    setAddingCredits(true);
    try {
      // Use environment variable for credit bundle price ID
      const priceId = import.meta.env.VITE_STRIPE_PRICE_CREDITS_250 || 'price_1RUNOmRxBJaRlFvtFDsOkRGL';
      
      // Create Stripe checkout session for credit purchase
      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          priceId: priceId,
          mode: 'payment', // One-time payment, not subscription
          quantity: 1,
          successUrl: `${window.location.origin}/settings/usage?credits_purchased=true`,
          cancelUrl: `${window.location.origin}/settings/usage?purchase_cancelled=true`
        })
      });

      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        console.error('Failed to create checkout session:', data.error);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setAddingCredits(false);
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'free': return <Star className="w-5 h-5" />;
      case 'pro': return <Crown className="w-5 h-5" />;
      case 'elite': return <Zap className="w-5 h-5" />;
      case 'institutional': return <Building className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'text-gray-500';
      case 'pro': return 'text-blue-500';
      case 'elite': return 'text-purple-500';
      case 'institutional': return 'text-emerald-500';
      default: return 'text-gray-500';
    }
  };

  const getProgressColor = (remaining: number, total: number) => {
    const percentage = total > 0 ? (remaining / total) * 100 : 0;
    if (percentage < 10) return 'bg-red-500';
    if (percentage < 25) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTierDisplayName = (tier: string) => {
    return formatTierName(tier);
  };

  if (loading) {
    return (
      <div className={`${cardBgColor} rounded-lg p-6 mb-8 border ${borderColor}`}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
          <span className={textColor}>Loading tier information...</span>
        </div>
      </div>
    );
  }

  if (error || !tierInfo) {
    return (
      <div className={`${cardBgColor} rounded-lg p-6 mb-8 border ${borderColor}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
              <Coins className="w-6 h-6 mr-2 text-yellow-500" />
              Tier & Usage
            </h2>
            <Link to="/help/getting-started" className="ml-2 text-blue-500 hover:text-blue-700">
              <HelpCircle size={18} />
            </Link>
          </div>
        </div>
        <div className="text-center py-4">
          <p className={`${secondaryTextColor} mb-4`}>
            {error || 'Unable to load tier information. Please sign in to view your subscription details.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className={`${buttonBgColor} text-white px-4 py-2 rounded-lg font-medium transition-colors`}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Calculate properly with purchased credits included
  const creditsUsed = tierInfo.credits.used;
  const totalCredits = tierInfo.credits.total;
  const monthlyCredits = tierInfo.credits.monthly;
  const purchasedCredits = tierInfo.credits.purchased;
  const remainingCredits = tierInfo.credits.remaining;
  
  // Calculate usage percentage based on total available credits
  const usagePercentage = totalCredits > 0 ? (creditsUsed / totalCredits) * 100 : 0;
  const resetDate = new Date(tierInfo.credits.resetDate).toLocaleDateString();

  return (
    <div className={`${cardBgColor} rounded-lg p-6 mb-8 border ${borderColor}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
            <Coins className="w-6 h-6 mr-2 text-yellow-500" />
            Tier & Usage
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

      {/* Current Tier Info */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className={`${getTierColor(tierInfo.tier)} mr-3`}>
              {getTierIcon(tierInfo.tier)}
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${textColor} capitalize`}>
                {getTierDisplayName(tierInfo.tier)}
              </h3>
              <p className={`text-sm ${secondaryTextColor}`}>
                {tierInfo.credits.daysUntilReset} days until reset ({resetDate})
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Credits Usage */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className={`font-medium ${textColor}`}>Monthly Credits</h4>
            <span className={`text-2xl font-bold ${textColor}`}>
              {tierInfo.credits.remaining.toLocaleString()} <span className="text-sm font-normal">left</span>
            </span>
          </div>
          <div className="flex items-center text-sm mb-2">
            <span className={secondaryTextColor}>
              {tierInfo.tier === 'free' 
                ? `${creditsUsed.toLocaleString()} / ${monthlyCredits.toLocaleString()}`
                : `${creditsUsed.toLocaleString()} / ${monthlyCredits.toLocaleString()} Used${purchasedCredits > 0 ? ` (+ ${purchasedCredits.toLocaleString()} additional)` : ''}`
              }
            </span>
            <span className={`ml-auto ${secondaryTextColor}`}>
              Resets in {tierInfo.credits.daysUntilReset} days
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-1">
            <div 
              className={`h-2 rounded-full ${getProgressColor(tierInfo.credits.remaining, tierInfo.credits.monthly)}`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Watchlist Usage */}
        {tierInfo.usage?.watchlist && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className={`font-medium ${textColor}`}>Watchlist</h4>
              <span className={`text-lg font-bold ${textColor}`}>
                {tierInfo.usage.watchlist.current} / {tierInfo.usage.watchlist.limit === -1 ? '∞' : tierInfo.usage.watchlist.limit}
              </span>
            </div>
            {tierInfo.usage.watchlist.limit !== -1 && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-1">
                <div 
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${(tierInfo.usage.watchlist.current / tierInfo.usage.watchlist.limit) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Feature Access */}
        <div>
          <h4 className={`font-medium ${textColor} mb-3`}>Available Features</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {tierInfo.features.map((feature) => (
              <div key={feature} className="flex items-center text-sm">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                <span className={textColor}>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        {tierInfo.tier !== 'free' && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className={`font-medium ${textColor} mb-3`}>Purchase Additional Credits</h4>
            <div className="flex justify-center mb-4">
              <button 
                onClick={() => handleAddCredits(250)}
                disabled={addingCredits}
                className={`${buttonBgColor} text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center disabled:opacity-50 text-base shadow-lg hover:shadow-xl`}
              >
                <Plus className="w-5 h-5 mr-3" />
                {addingCredits ? 'Processing...' : '250 Credits for $10.00'}
              </button>
            </div>
            
            <div className="flex items-center justify-between flex-wrap gap-3">
              <button
                onClick={() => navigate('/')}
                className={`text-sm ${secondaryTextColor} hover:${textColor} flex items-center transition-colors`}
              >
                <Users className="w-4 h-4 mr-2" />
                View Pricing Plans
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* Free tier upgrade prompt */}
        {tierInfo.tier === 'free' && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <p className={`text-sm ${secondaryTextColor} mb-3`}>
                Need more credits? Upgrade to a paid plan for higher credit limits, add-on packs, and additional features.
              </p>
              <button
                onClick={() => navigate('/')}
                className={`${buttonBgColor} text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center mx-auto`}
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade Plan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TierManagement; 