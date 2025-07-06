import React from 'react';
import { Crown } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTierLimits } from '../../hooks/useTierLimits';

interface TierUpgradeCardProps {
  title: string;
  description: string;
  features: string[];
  featureName: string;
  context?: 'reddit' | 'watchlist' | 'search' | 'general' | 'sec' | 'institutional';
  requiredTier?: string;
  customAction?: () => void;
}

const TierUpgradeCard: React.FC<TierUpgradeCardProps> = ({
  title,
  description,
  features,
  featureName,
  context = 'general',
  requiredTier = 'Pro',
  customAction
}) => {
  const { theme } = useTheme();
  const { showTierLimitDialog } = useTierLimits();
  const isLight = theme === 'light';
  
  // Theme-based styling
  const cardBg = isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700';
  const textColor = isLight ? 'text-gray-900' : 'text-white';
  const subTextColor = isLight ? 'text-gray-600' : 'text-gray-400';
  const featuresBg = isLight ? 'bg-gray-50' : 'bg-gray-700';
  const buttonBg = isLight ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700';
  
  const handleUpgradeClick = () => {
    if (customAction) {
      customAction();
    } else {
      showTierLimitDialog(
        featureName,
        description,
        `Unlock ${features.join(', ')} with HRVSTR ${requiredTier}.`,
        context
      );
    }
  };
  
  return (
    <div className={`${cardBg} rounded-lg border p-8 text-center`}>
      <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <Crown className="w-8 h-8 text-white" />
      </div>
      
      <h3 className={`text-xl font-bold ${textColor} mb-3`}>
        {title}
      </h3>
      
      <p className={`${subTextColor} mb-6 leading-relaxed`}>
        {description}
      </p>
      
      <div className={`${featuresBg} rounded-lg p-4 mb-6`}>
        <h4 className={`font-semibold ${textColor} mb-2`}>
          {requiredTier} Features Include:
        </h4>
        <ul className={`text-sm ${subTextColor} text-left space-y-1`}>
          {features.map((feature, index) => (
            <li key={index}>• {feature}</li>
          ))}
        </ul>
      </div>
      
      <button
        onClick={handleUpgradeClick}
        className={`${buttonBg} text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center mx-auto`}
      >
        <div className="w-4 h-4 lg:w-5 lg:h-5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-2">
          <Crown className="w-2 h-2 lg:w-2.5 lg:h-2.5 text-white" />
        </div>
        Upgrade to {requiredTier}
      </button>
    </div>
  );
};

export default TierUpgradeCard; 