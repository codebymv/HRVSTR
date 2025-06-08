import React from 'react';
import { Star, Crown, Zap, Building } from 'lucide-react';

interface WelcomeSectionProps {
  userName?: string;
  userTier?: string;
  theme: 'light' | 'dark';
  cardBgColor: string;
  borderColor: string;
  welcomeTextColor: string;
  iconFilter: string;
}

interface TierInfo {
  name: string;
  icon: JSX.Element;
  iconColor: string;
  textColor: string;
  bgColor: string;
}

const WelcomeSection: React.FC<WelcomeSectionProps> = ({
  userName,
  userTier,
  theme,
  cardBgColor,
  borderColor,
  welcomeTextColor,
  iconFilter
}) => {
  const isLight = theme === 'light';

  const getUserTierInfo = (): TierInfo => {
    const currentTier = userTier?.toLowerCase() || 'free';
    
    const tierData = {
      free: {
        name: 'HRVSTR Free',
        icon: <Star className="w-5 h-5" />,
        iconColor: isLight ? 'text-gray-600' : 'text-gray-300',
        textColor: isLight ? 'text-gray-600' : 'text-gray-300',
        bgColor: isLight ? 'bg-gray-200' : 'bg-gray-800'
      },
      pro: {
        name: 'HRVSTR Pro',
        icon: <Crown className="w-5 h-5" />,
        iconColor: isLight ? 'text-blue-600' : 'text-blue-400',
        textColor: isLight ? 'text-blue-600' : 'text-blue-400',
        bgColor: isLight ? 'bg-blue-200' : 'bg-blue-900'
      },
      elite: {
        name: 'HRVSTR Elite',
        icon: <Zap className="w-5 h-5" />,
        iconColor: isLight ? 'text-purple-600' : 'text-purple-400',
        textColor: isLight ? 'text-purple-600' : 'text-purple-400',
        bgColor: isLight ? 'bg-purple-200' : 'bg-purple-900'
      },
      institutional: {
        name: 'HRVSTR Institutional',
        icon: <Building className="w-5 h-5" />,
        iconColor: isLight ? 'text-emerald-600' : 'text-emerald-400',
        textColor: isLight ? 'text-emerald-600' : 'text-emerald-400',
        bgColor: isLight ? 'bg-emerald-200' : 'bg-emerald-900'
      }
    };

    return tierData[currentTier as keyof typeof tierData] || tierData.free;
  };

  const tierInfo = getUserTierInfo();

  return (
    <div className={`${cardBgColor} rounded-lg p-6 mb-6 border ${borderColor} relative`}>
      {/* HRVSTR Icon with Tier Badge - Responsive sizing and positioning */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
        <div className="relative">
          {/* HRVSTR Icon - Larger on mobile for better visibility */}
          <img 
            src="/hrvstr_icon.png" 
            alt="HRVSTR" 
            className="w-16 h-16 sm:w-12 sm:h-12 object-contain"
            style={{ filter: iconFilter }}
          />
          {/* Tier Badge - Scaled proportionally */}
          {/* Commented out for now - can be enabled if needed
          <div className="absolute -top-1 -right-1 sm:-top-1 sm:-right-1">
            <div className={`w-6 h-6 sm:w-5 sm:h-5 flex items-center justify-center ${tierInfo.iconColor}`}>
              {tierInfo.icon}
            </div>
          </div> */}
        </div>
      </div>
      
      <h1 className={`text-2xl font-bold ${welcomeTextColor} pr-20 sm:pr-16`}>
        Welcome back, <br className="block sm:hidden" />
        <span className="block sm:inline bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent ml-4">
          {userName}!
        </span>
      </h1>
      <div className="mt-3 flex items-center">
        {/* Tier Badge */}
        {userTier && (
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${tierInfo.bgColor}`}>
            <span className={tierInfo.iconColor}>
              {tierInfo.icon}
            </span>
            <span className={`text-sm font-medium ${tierInfo.iconColor}`}>
              {tierInfo.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomeSection; 