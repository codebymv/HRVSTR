import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import FallingLeaves3D from './FallingLeaves3D';

interface HarvestLoadingCardProps {
  progress: number;
  stage: string;
  operation: 'insider-trading' | 'institutional-holdings' | 'earnings-calendar' | 'earnings-analysis' | 'sentiment-chart' | 'sentiment-scores' | 'sentiment-reddit';
  className?: string;
}

const HarvestLoadingCard: React.FC<HarvestLoadingCardProps> = ({
  progress,
  stage,
  operation,
  className = ''
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const progressTextColor = isLight ? 'text-blue-600' : 'text-blue-400';
  const warningBgColor = isLight ? 'bg-amber-50' : 'bg-amber-900/20';
  const warningTextColor = isLight ? 'text-amber-700' : 'text-amber-400';
  const logoFilter = isLight ? 'invert(1) brightness(0)' : 'none';
  
  // Operation-specific configuration
  const operationConfig = {
    'insider-trading': {
      title: "🌾 Harvesting Insider Data",
      subtitle: "Gathering fresh insider trading transactions and executive filings...",
      animation: "🚜",
      creditCost: "10 credits"
    },
    'institutional-holdings': {
      title: "📊 Cultivating Holdings Intelligence", 
      subtitle: "Processing 13F filings and institutional investment data...",
      animation: "🌱",
      creditCost: "15 credits"
    },
    'earnings-calendar': {
      title: "📅 Harvesting Earnings Calendar",
      subtitle: "Gathering upcoming earnings dates and company announcements...",
      animation: "📈",
      creditCost: "12 credits"
    },
    'earnings-analysis': {
      title: "🔬 Cultivating Earnings Intelligence",
      subtitle: "Processing earnings history, surprises, and financial metrics...",
      animation: "📊", 
      creditCost: "8 credits"
    },
    'sentiment-chart': {
      title: "📈 Harvesting Sentiment Trends",
      subtitle: "Analyzing market sentiment patterns and temporal data...",
      animation: "📊",
      creditCost: "12 credits"
    },
    'sentiment-scores': {
      title: "🎯 Cultivating Sentiment Scores", 
      subtitle: "Processing ticker sentiment data from multiple sources...",
      animation: "⚖️",
      creditCost: "8 credits"
    },
    'sentiment-reddit': {
      title: "🔥 Harvesting Reddit Intelligence",
      subtitle: "Gathering social sentiment from Reddit discussions and posts...",
      animation: "💬",
      creditCost: "10 credits"
    }
  };

  const config = operationConfig[operation];

  // Get themed stage message based on progress - more granular for better feedback
  const getHarvestStage = (progress: number, originalStage: string) => {
    // More granular stages that reflect actual work distribution
    if (progress < 5) return "🌱 Planting data requests...";
    if (progress < 15) return "📋 Preparing filing systems...";
    if (progress < 25) return "🔍 Scanning regulatory databases...";
    if (progress < 35) return "📊 Processing form data...";
    if (progress < 45) return "🔄 Analyzing transaction records...";
    if (progress < 55) return "📈 Calculating position changes...";
    if (progress < 65) return "🔍 Cross-referencing filings...";
    if (progress < 75) return "📋 Validating data integrity...";
    if (progress < 85) return "📦 Organizing insights...";
    if (progress < 95) return "✨ Finalizing your harvest...";
    if (progress < 100) return "🎯 Almost ready...";
    return "🎉 Fresh data ready!";
  };

  const themedStage = getHarvestStage(progress, stage);

  // Add visual feedback for heavy processing phase
  const isSlowProgress = progress > 15 && progress < 70; // Heavy processing phase

  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center ${className}`}>
      {/* Three.js falling leaves animation */}
      <div className="mb-6 relative">
        <FallingLeaves3D width={64} height={64} leafCount={8} />
      </div>

      {/* Theme-aware HRVSTR Logo */}
      <div className="mb-4">
        <img 
          src="/hrvstr_logo.png" 
          alt="HRVSTR" 
          className="h-full w-auto max-h-10" 
          style={{ filter: logoFilter }}
        />
      </div>
      
      {/* <h3 className={`text-xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-2`}>
        {config.title}
      </h3> */}
      
      <p className={`text-sm ${mutedTextColor} mb-6 max-w-md`}>
        {config.subtitle}
      </p>
      
      {/* Enhanced Progress Bar */}
      <div className="w-full max-w-md mb-4">
        <div className={`flex justify-between text-xs ${mutedTextColor} mb-2`}>
          <span>{themedStage}</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 relative overflow-hidden">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500 relative overflow-hidden"
            style={{ width: `${progress}%` }}
          >
            {/* Enhanced shimmer effect - faster during heavy processing */}
            <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent ${isSlowProgress ? 'animate-ping' : 'animate-pulse'}`}></div>
          </div>
        </div>
      </div>
      
      {/* Enhanced timing info with processing context */}
      <div className="space-y-2">
        <div className={`text-xs ${warningTextColor} ${warningBgColor} px-3 py-1 rounded-full inline-flex items-center`}>
          {isSlowProgress ? (
            <>⚡ Processing intensive data...</>
          ) : (
            <>⏱️ This might take a while...</>
          )}
        </div>
      </div>
    </div>
  );
};

export default HarvestLoadingCard;