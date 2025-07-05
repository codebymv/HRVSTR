import React from 'react';
import { Crown, Zap, Building } from 'lucide-react';
import { YearlyTier } from '../../utils/pricing';

interface YearlyPricingCardsProps {
  onPurchaseClick: (tierName: string, isYearly: boolean) => void;
  theme: string;
}

const YearlyPricingCards: React.FC<YearlyPricingCardsProps> = ({ onPurchaseClick, theme }) => {
  const isLight = theme === 'light';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';

  const yearlyTiers: YearlyTier[] = [
    {
      name: 'Pro',
      monthlyPrice: 12,
      yearlyPrice: 120, // ~10/month (17% savings)
      icon: <Crown className="w-5 h-5" />,
      gradient: 'from-blue-500 to-purple-600',
      popular: true,
      savings: '17%'
    }
    // TODO: Re-enable for post-1.0 release
    // {
    //   name: 'Elite',
    //   monthlyPrice: 30,
    //   yearlyPrice: 300, // ~25/month (17% savings)
    //   icon: <Zap className="w-5 h-5" />,
    //   gradient: 'from-purple-400 to-purple-600',
    //   savings: '17%'
    // }
    // TODO: Re-enable for post-1.0 release
    // {
    //   name: 'Institutional',
    //   monthlyPrice: 199,
    //   yearlyPrice: 1990, // ~165.83/month (17% savings)
    //   icon: <Building className="w-5 h-5" />,
    //   gradient: 'from-emerald-400 to-emerald-600',
    //   savings: '17%'
    // }
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:gap-6 max-w-md mx-auto">
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
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white' 
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

export default YearlyPricingCards;