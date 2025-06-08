import React from 'react';
import { Key, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface LockedOverlayProps {
  title: string;
  description: string;
  cost: number;
  onUnlock: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  isUnlocking?: boolean;
}

const LockedOverlay: React.FC<LockedOverlayProps> = ({
  title,
  description,
  cost,
  onUnlock,
  icon,
  disabled = false,
  isUnlocking = false
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-based styling
  const containerBg = isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700';
  const textColor = isLight ? 'text-gray-900' : 'text-white';
  const subTextColor = isLight ? 'text-gray-600' : 'text-gray-400';
  const accentBg = isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/20 border-blue-800';
  
  return (
    <div className={`${containerBg} rounded-lg border p-8 text-center relative overflow-hidden`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600" />
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
        
        <h3 className={`text-xl font-bold ${textColor} mb-2`}>
          {title}
        </h3>
        
        <p className={`${subTextColor} mb-6 max-w-sm mx-auto`}>
          {description}
        </p>
        
        <div className={`${accentBg} rounded-lg p-4 border mb-6`}>
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <Zap className="w-4 h-4 text-blue-500" />
            <span className={textColor}>{cost} credits</span>
          </div>
        </div>
        
        <button
          onClick={onUnlock}
          disabled={disabled || isUnlocking}
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center mx-auto gap-2"
        >
          {isUnlocking ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Unlocking...
            </>
          ) : (
            <>
              <Key className="w-4 h-4" />
              Unlock for {cost} Credits
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default LockedOverlay; 