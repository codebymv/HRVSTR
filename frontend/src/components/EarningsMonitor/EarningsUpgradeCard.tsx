import React from 'react';
import { Crown } from 'lucide-react';

interface EarningsUpgradeCardProps {
  onShowTierLimitDialog: (
    featureName: string,
    customMessage?: string,
    customUpgradeMessage?: string,
    context?: 'reddit' | 'watchlist' | 'search' | 'general' | 'sec' | 'institutional'
  ) => void;
  isLight: boolean;
  textColor: string;
  subTextColor: string;
}

const EarningsUpgradeCard: React.FC<EarningsUpgradeCardProps> = ({
  onShowTierLimitDialog,
  isLight,
  textColor,
  subTextColor,
}) => {
  const buttonBg = isLight ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700';
  
  return (
    <div className="text-center p-8">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
        <Crown className="w-8 h-8 text-white" />
      </div>
      <h3 className={`text-xl font-bold ${textColor} mb-3`}>Upgrade to Pro</h3>
      <p className={`${subTextColor} mb-6 leading-relaxed`}>
        Earnings analysis is a Pro feature. Upgrade to access comprehensive analysis and insights.
      </p>
      
      <div className={`${isLight ? 'bg-stone-200' : 'bg-gray-800'} rounded-lg p-4 mb-6`}>
        <h4 className={`font-semibold ${textColor} mb-2`}>Pro Features Include:</h4>
        <ul className={`text-sm ${subTextColor} text-left space-y-1`}>
          <li>• Comprehensive earnings analysis</li>
          <li>• Company financial overview</li>
          <li>• Performance metrics tracking</li>
          <li>• Risk assessment insights</li>
        </ul>
      </div>
      
      <button
        onClick={() => window.location.href = '/settings/tiers'}
        className={`${buttonBg} text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center mx-auto`}
      >
        <Crown className="w-4 h-4 mr-2" />
        Upgrade to Pro
      </button>
    </div>
  );
};

export default EarningsUpgradeCard; 