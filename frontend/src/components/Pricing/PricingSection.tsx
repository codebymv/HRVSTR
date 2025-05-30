import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Building, Zap, Star, Check, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

interface PricingSectionProps {
  showHeader?: boolean;
  onPurchaseClick?: (tierName: string) => void;
  className?: string;
}

const PricingSection: React.FC<PricingSectionProps> = ({ 
  showHeader = true, 
  onPurchaseClick,
  className = "max-w-7xl mx-auto"
}) => {
  const { theme } = useTheme();
  const { isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();

  // Theme-specific styling
  const isLight = theme === 'light';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';

  const tiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for getting started',
      icon: <Star className="w-5 h-5" />,
      gradient: 'from-gray-400 to-gray-600',
      features: [
        '3 watchlist stocks',
        '50 scrape credits/month',
        'Basic sentiment (FinViz)',
        'SEC insider trades',
        'Basic earnings calendar',
        '1-day historical data',
        'Basic stock search'
      ],
      limitations: [
        'No Reddit sentiment access',
        'Limited historical data',
        'Limited watchlist capacity',
        'No SEC institutional holdings',
        'Basic search functionality',
        'No advanced analytics'
      ]
    },
    {
      name: 'Pro',
      price: '$19',
      period: 'month',
      description: 'For active traders',
      icon: <Crown className="w-5 h-5" />,
      gradient: 'from-blue-400 to-blue-600',
      popular: true,
      features: [
        '15 watchlist stocks',
        '500 scrape credits/month',
        'Reddit sentiment access',
        'All sentiment sources',
        'Reddit sentiment',
        'Full SEC filings access',
        'Complete earnings analysis',
        'Up to 1-month historical data',
        'Advanced stock search',
        'Real-time data refresh'
      ]
    },
    {
      name: 'Elite',
      price: '$49',
      period: 'month',
      description: 'For serious analysts',
      icon: <Zap className="w-5 h-5" />,
      gradient: 'from-purple-400 to-purple-600',
      features: [
        '50 watchlist stocks',
        '2000 scrape credits/month',
        'All data sources',
        'Reddit + Alpha Vantage integration',
        '3+ month historical data',
        'Advanced time range options',
        'Enhanced data refresh rates',
        'Advanced stock search & filters',
        'Usage analytics dashboard',
        'Priority data processing'
      ]
    },
    // TODO: Re-enable for post-1.0 release
    // {
    //   name: 'Institutional',
    //   price: '$199',
    //   period: 'month',
    //   description: 'For teams & businesses',
    //   icon: <Building className="w-5 h-5" />,
    //   gradient: 'from-emerald-400 to-emerald-600',
    //   features: [
    //     'Unlimited watchlist',
    //     '10,000 scrape credits/month',
    //     'All premium data sources',
    //     'Bulk data operations',
    //     'Extended historical data',
    //     'Advanced usage monitoring',
    //     'Priority data processing',
    //     'Extended data retention',
    //     'Team collaboration features',
    //     'White-label options'
    //   ]
    // }
  ];

  const handlePurchaseClick = (tierName: string) => {
    if (onPurchaseClick) {
      onPurchaseClick(tierName);
      return;
    }

    // Default behavior: redirect to tiers page if not authenticated, or handle purchase
    if (!isAuthenticated) {
      signIn();
      // After sign in, they'll be redirected to the user home, but we can store intent
      localStorage.setItem('post_signin_redirect', '/settings/tiers');
      return;
    }

    // If authenticated, go to tiers page
    navigate('/settings/tiers');
  };

  return (
    <div className={className}>
      {showHeader && (
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Crown className="w-6 h-6 text-blue-500 mr-2" />
            <h2 className={`text-3xl md:text-4xl font-bold ${textColor}`}>
              Choose Your Plan
            </h2>
          </div>
          <p className={`text-lg ${secondaryTextColor} max-w-2xl mx-auto`}>
            From hobbyist to institutional - find the perfect plan for your targeted analysis.
          </p>
        </div>
      )}

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
        {tiers.map((tier, index) => (
          <div
            key={index}
            className={`${cardBgColor} rounded-lg p-4 lg:p-6 border ${tier.popular ? 'border-blue-500 ring-2 ring-blue-500/20' : borderColor} relative transition-transform hover:scale-105`}
          >
            {/* Popular Badge */}
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
            )}

            {/* Header */}
            <div className="text-center mb-4 lg:mb-6">
              <div className={`w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-r ${tier.gradient} rounded-full flex items-center justify-center mx-auto mb-3 lg:mb-4`}>
                <div className="text-white">
                  {tier.icon}
                </div>
              </div>
              <h3 className={`text-lg lg:text-xl font-bold mb-2 ${textColor}`}>
                {tier.name}
              </h3>
              <div className="mb-2">
                <span className={`text-2xl lg:text-3xl font-bold ${textColor}`}>
                  {tier.price}
                </span>
                <span className={`text-sm ${secondaryTextColor}`}>
                  /{tier.period}
                </span>
              </div>
              <p className={`text-sm ${secondaryTextColor}`}>
                {tier.description}
              </p>
            </div>

            {/* Features */}
            <div className="space-y-2 lg:space-y-3 mb-4 lg:mb-6">
              {tier.features.map((feature, featureIndex) => (
                <div key={featureIndex} className="flex items-start">
                  <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className={`text-sm ${textColor}`}>
                    {feature}
                  </span>
                </div>
              ))}
              
              {/* Limitations for free tier */}
              {tier.limitations && tier.limitations.map((limitation, limitIndex) => (
                <div key={limitIndex} className="flex items-start">
                  <X className="w-4 h-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className={`text-sm ${secondaryTextColor}`}>
                    {limitation}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <button
              onClick={() => handlePurchaseClick(tier.name)}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors text-sm lg:text-base ${
                tier.popular 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                  : tier.name === 'Free'
                    ? 'bg-gray-500 hover:bg-gray-600 text-white'
                    : `bg-gradient-to-r ${tier.gradient} text-white hover:opacity-90`
              }`}
            >
              {tier.name === 'Free' ? 'Get Started' : 'Choose Plan'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricingSection; 