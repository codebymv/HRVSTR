import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart2, ListChecks, TrendingUp, ArrowRight, Eye, Star, Map, Crown, Zap, Building } from 'lucide-react';
import { 
  SentimentPreview, 
  EarningsPreview, 
  SECFilingsPreview, 
  WatchlistPreview, 
  ActivityPreview 
} from './PreviewComponents';
import PricingSection from '../Pricing/PricingSection';

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

const Home: React.FC = () => {
  const { theme } = useTheme();
  const { isAuthenticated, signIn, token } = useAuth();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  
  // Theme-specific styling
  const isLight = theme === 'light';
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';
  
  // Add logo filter for theme switching (same as in Navbar)
  const logoFilter = isLight ? 'invert(1) brightness(0)' : 'none';
  
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
    if (!isAuthenticated) {
      signIn();
      return;
    }

    setSelectedTier(tierName);
    setUpgrading(true);

    try {
      if (tierName === 'Free') {
        // Handle free tier "Get Started" - could trigger welcome flow
        return;
      }

      // For paid tiers, create Stripe Checkout Session
      const priceId = getPriceIdForTier(tierName, isYearly);

      if (!priceId) {
        console.error('Pricing configuration error. Please contact support.');
        return;
      }

      // Get auth token
      if (!token) {
        console.error('Authentication error. Please sign in again.');
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
          cancelUrl: `${window.location.origin}/?cancelled=true`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(data.error || 'Failed to create checkout session. Please try again.');
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No checkout URL received from server.');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setUpgrading(false);
    }
  };
  
  const features = [
    {
      icon: <BarChart2 className="w-6 h-6" />,
      title: 'Sentiment Analysis',
      description: 'Track market sentiment from Reddit, FinViz, and Yahoo Finance'
    },
    {
      icon: <ListChecks className="w-6 h-6" />,
      title: 'SEC Filings',
      description: 'Monitor insider trading and institutional holdings'
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Earnings Monitor',
      description: 'Stay updated with upcoming earnings and market reactions'
    },
    {
      icon: <Star className="w-6 h-6" />,
      title: 'Watchlist',
      description: 'Track your favorite stocks with real-time prices and sentiment indicators'
    }
  ];

  return (
    <div className={`min-h-screen ${bgColor}`}>
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            {/* Show full logo on sm screens and up */}
            <img 
              src="/hrvstr_logo.png" 
              alt="HRVSTR Logo"
              className="hidden sm:block h-16 md:h-24 w-auto object-contain"
              style={{ filter: logoFilter }}
            />
            {/* Show icon on screens smaller than sm */}
            <img 
              src="/hrvstr_icon.png" 
              alt="HRVSTR Icon"
              className="block sm:hidden h-16 w-auto object-contain"
              style={{ filter: logoFilter }}
            />
          </div>
          <h1 className={`text-4xl md:text-6xl font-bold mb-6 ${textColor}`}>
            Strategic Web Scraping,{" "}
            <span className="bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
                Simplified.
            </span>
            </h1>

          <p className={`text-xl md:text-2xl mb-8 ${secondaryTextColor} max-w-3xl mx-auto`}>
            A comprehensive solution for market sentiment analysis and financial monitoring.
          </p>
          {!isAuthenticated && (
            <button
              onClick={signIn}
              className={`${buttonBgColor} text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors flex items-center mx-auto`}
            >
              Get Started
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto mb-20">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`${cardBgColor} p-6 rounded-lg border ${borderColor} transition-transform hover:scale-105`}
            >
              <div className={`text-blue-500 mb-4`}>
                {feature.icon}
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${textColor}`}>
                {feature.title}
              </h3>
              <p className={secondaryTextColor}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Live Preview Section */}
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <Eye className="w-6 h-6 text-blue-500 mr-2" />
              <h2 className={`text-3xl md:text-4xl font-bold ${textColor}`}>
                Seeing is believing.
              </h2>
            </div>
            <p className={`text-lg ${secondaryTextColor} max-w-2xl mx-auto`}>
              Powerful analytics dashboards driven by real-time market data and insights.
            </p>
          </div>

          {/* Preview Components Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
            <SentimentPreview />
            <EarningsPreview />
            <SECFilingsPreview />
            <WatchlistPreview />
            <ActivityPreview />
            
            {/* Call to Action Card */}
            <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} h-64 flex flex-col items-center justify-center text-center`}>
              <div className="mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-teal-400 to-blue-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <ArrowRight className="w-8 h-8 text-white" />
                </div>
                <h3 className={`text-xl font-semibold mb-2 ${textColor}`}>
                  Ready to Get Started?
                </h3>
                <p className={`${secondaryTextColor} mb-4 text-sm`}>
                  Access the full dashboard with live data and advanced analytics.
                </p>
              </div>
              {!isAuthenticated && (
                <button
                  onClick={signIn}
                  className={`${buttonBgColor} text-white px-6 py-2 rounded-lg font-medium transition-colors`}
                >
                  Log In Now
                </button>
              )}
            </div>
          </div>


        </div>

        {/* Pricing Section */}
        <div className="mt-20">
          <PricingSection onPurchaseClick={handlePurchaseClick} />
        </div>

        {/* Yearly Pricing Section */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h2 className={`text-3xl md:text-4xl font-bold ${textColor} mb-4`}>
              Save More with Yearly Plans
            </h2>
            <p className={`text-lg ${secondaryTextColor} max-w-2xl mx-auto`}>
              Get the same great features at a discounted rate when you commit to a full year.
            </p>
          </div>
          <div className="max-w-6xl mx-auto">
            <YearlyPricingCards 
              onPurchaseClick={handlePurchaseClick}
              theme={theme}
            />
          </div>
        </div>

        {/* Loading State */}
        {upgrading && selectedTier && (
          <div className="mt-12 max-w-lg mx-auto">
            <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} text-center`}>
              <div className="flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
              <p className={textColor}>
                Processing your {selectedTier} plan upgrade...
              </p>
              <p className={`text-sm ${secondaryTextColor} mt-2`}>
                Redirecting to secure checkout...
              </p>
            </div>
          </div>
        )}

        {/* Progress Section */}
        <div className="max-w-7xl mx-auto mt-20">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <Map className="w-6 h-6 text-blue-500 mr-2" />
              <h2 className={`text-3xl md:text-4xl font-bold ${textColor}`}>
                Roadmap to 1.0!
              </h2>
            </div>
            <p className={`text-lg ${secondaryTextColor} max-w-2xl mx-auto mb-6`}>
              Tracking the progress of work to be done until 1.0 Release.
            </p>
            
            {/* Version Notes Link */}
            <div className="mb-8">
              <a 
                href="/help/Version/0.7.5-overview"
                className="text-sm text-blue-500 hover:text-blue-600 flex items-center justify-center"
              >
                📋 Version 0.7.5 Notes
                <ArrowRight className="w-4 h-4 ml-1" />
              </a>
            </div>
          </div>

          {/* Progress Bar */}
          <div className={`${cardBgColor} rounded-lg p-8 border ${borderColor} max-w-4xl mx-auto mb-12`}>
            <div className="space-y-6">
              {/* Overall Progress */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-lg font-medium ${textColor}`}>v 0.7.5</span>
                  <span className={`text-lg font-bold ${textColor}`}>1.0 Stable Release</span>
                </div>
                <div className={`w-full bg-gray-300 rounded-full h-3 ${isLight ? 'bg-stone-400' : 'bg-gray-700'}`}>
                  <div className="bg-gradient-to-r from-teal-400 to-blue-500 h-3 rounded-full transition-all duration-500" style={{ width: '77%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Home; 