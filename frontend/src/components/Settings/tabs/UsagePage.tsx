import React from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import TierManagement from '../TierManagement';

const UsagePage: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';

  return (
    <div className={`${bgColor} min-h-screen p-4 lg:p-8`}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 lg:mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold ${textColor} mb-2`}>Usage</h1>
          <p className={secondaryTextColor}>Monitor your credit usage and subscription details</p>
        </div>

        <TierManagement />
      </div>
    </div>
  );
};

export default UsagePage; 