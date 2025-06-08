import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { Brain, Sparkles, Crown, ChevronDown, ChevronUp, Lock } from 'lucide-react';

interface AIExplanationCardProps {
  explanation?: string;
  ticker: string;
  className?: string;
}

const AIExplanationCard: React.FC<AIExplanationCardProps> = ({ 
  explanation, 
  ticker, 
  className = '' 
}) => {
  const { theme } = useTheme();
  const { tierInfo } = useTier();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isLight = theme === 'light';
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  const hasAIAccess = currentTier !== 'free';
  
  // Theme-specific styling
  const cardBgColor = isLight ? 'bg-gradient-to-br from-blue-50 to-indigo-50' : 'bg-gradient-to-br from-blue-900/20 to-indigo-900/20';
  const borderColor = isLight ? 'border-blue-200' : 'border-blue-700';
  const textColor = isLight ? 'text-blue-900' : 'text-blue-100';
  const mutedTextColor = isLight ? 'text-blue-700' : 'text-blue-300';
  const upgradeCardBg = isLight ? 'bg-gradient-to-br from-yellow-50 to-orange-50' : 'bg-gradient-to-br from-yellow-900/20 to-orange-900/20';
  const upgradeBorderColor = isLight ? 'border-yellow-300' : 'border-yellow-600';
  const upgradeTextColor = isLight ? 'text-yellow-900' : 'text-yellow-100';
  
  // If user doesn't have AI access, show upgrade prompt
  if (!hasAIAccess) {
    return (
      <div className={`${upgradeCardBg} ${upgradeBorderColor} border-2 border-dashed rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Lock size={18} className="text-yellow-600" />
            <Brain size={18} className="text-yellow-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-semibold ${upgradeTextColor}`}>
                AI Sentiment Analysis
              </span>
              <Crown size={14} className="text-yellow-500" />
            </div>
            <p className={`text-xs ${upgradeTextColor} opacity-80 mt-1`}>
              Get AI-powered explanations for {ticker} sentiment. Upgrade to Pro for instant insights!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If no explanation available (loading or error)
  if (!explanation) {
    return (
      <div className={`${cardBgColor} ${borderColor} border rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="animate-pulse">
            <Brain size={18} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-semibold ${textColor}`}>
                AI Analysis
              </span>
              <Sparkles size={14} className="text-blue-500" />
            </div>
            <p className={`text-xs ${mutedTextColor} mt-1`}>
              Generating AI explanation for {ticker}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main AI explanation display
  const shouldTruncate = explanation.length > 150;
  const displayText = !isExpanded && shouldTruncate 
    ? explanation.substring(0, 150) + '...' 
    : explanation;

  return (
    <div className={`${cardBgColor} ${borderColor} border rounded-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          <Brain size={18} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-semibold ${textColor}`}>
                AI Analysis
              </span>
              <Sparkles size={14} className="text-blue-500" />
            </div>
            {shouldTruncate && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`${mutedTextColor} hover:${textColor} transition-colors p-1 rounded`}
                aria-label={isExpanded ? 'Show less' : 'Show more'}
              >
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
          
          <p className={`text-sm ${textColor} leading-relaxed`}>
            {displayText}
          </p>
          
          {/* Powered by indicator */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-blue-200/50">
            <span className={`text-xs ${mutedTextColor} opacity-75`}>
              Gemini 1.5 Flash
            </span>
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className={`text-xs ${mutedTextColor}`}>Live</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIExplanationCard; 