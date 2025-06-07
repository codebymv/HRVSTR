import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, TrendingDown, Info, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { SentimentData } from '../../types';
import { getSentimentTextColor, getConfidenceColor, calculateSentimentQuality, getQualityGradeColor, calculateUnifiedReliability } from './sentimentUtils';

interface SentimentCardProps {
  data: SentimentData;
}

// Function to get sentiment strength description
const getSentimentDescription = (score: number): string => {
  const safeScore = isNaN(score) ? 0 : score;
  const absScore = Math.abs(safeScore);
  const isPositive = safeScore > 0;
  
  if (absScore >= 0.8) {
    return isPositive ? 'Very Bullish' : 'Very Bearish';
  } else if (absScore >= 0.5) {
    return isPositive ? 'Bullish' : 'Bearish';
  } else if (absScore >= 0.15) {
    return isPositive ? 'Slightly Bullish' : 'Slightly Bearish';
  } else {
    return 'Neutral';
  }
};

// Function to get sentiment color
const getSentimentColor = (score: number): string => {
  const safeScore = isNaN(score) ? 0 : score;
  if (safeScore > 0.15) return 'text-green-500';
  if (safeScore < -0.15) return 'text-red-500';
  return 'text-yellow-500';
};

// Function to get sentiment icon
const getSentimentIcon = (score: number) => {
  const safeScore = isNaN(score) ? 0 : score;
  if (safeScore > 0.15) return <TrendingUp size={24} className="text-green-500" />;
  if (safeScore < -0.15) return <TrendingDown size={24} className="text-red-500" />;
  return <Minus size={24} className="text-yellow-500" />;
};

// Function to get data summary text
const getDataSummary = (source: string, postCount: number, commentCount: number, newsCount: number): string => {
  if (source === 'reddit') {
    const total = postCount + commentCount;
    return `${total} discussions`;
  } else if (source === 'finviz' || source === 'yahoo') {
    return `${newsCount} news articles`;
  } else if (source === 'combined') {
    const discussions = postCount + commentCount;
    const news = newsCount;
    if (discussions > 0 && news > 0) {
      return `${discussions} discussions, ${news} articles`;
    } else if (discussions > 0) {
      return `${discussions} discussions`;
    } else if (news > 0) {
      return `${news} articles`;
    }
    return 'No data';
  }
  return 'Live data';
};

// Unified Reliability Indicator Component (replaces separate confidence and signal quality)
const UnifiedReliabilityIndicator: React.FC<{ sentimentData: SentimentData; isLight: boolean }> = ({ 
  sentimentData, 
  isLight 
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const reliability = calculateUnifiedReliability(sentimentData);
  
  const reliabilityBgColor = isLight ? 'bg-gray-50' : 'bg-gray-700';
  const textColor = isLight ? 'text-gray-700' : 'text-gray-300';
  const mutedTextColor = isLight ? 'text-gray-600' : 'text-gray-400';
  const linkColor = isLight ? 'text-blue-600 hover:text-blue-800' : 'text-blue-400 hover:text-blue-300';

  return (
    <div className={`mt-3 p-3 ${reliabilityBgColor} rounded-lg border-l-4 border-blue-400`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield size={16} className="text-blue-500" />
          <span className={`text-sm font-medium ${textColor}`}>Reliability Score</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs font-bold border ${reliability.reliabilityColor}`}>
            {reliability.reliabilityLabel} ({reliability.reliabilityScore}%)
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`${linkColor} hover:bg-opacity-10 p-1 rounded transition-colors`}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>
      
      <p className={`text-xs ${mutedTextColor} mt-2`}>
        {reliability.recommendation}
      </p>
      
      {isExpanded && (
        <div className="mt-3 space-y-2">
          <div className={`text-xs ${textColor} font-medium mb-2`}>Reliability Breakdown:</div>
          
          {/* Main Components */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="text-center">
              <div className={`h-3 bg-blue-200 rounded overflow-hidden`}>
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${reliability.breakdown.confidenceScore}%` }}
                ></div>
              </div>
              <span className={`${mutedTextColor} text-xs mt-1 block`}>
                AI Confidence: {reliability.breakdown.confidenceScore}%
              </span>
              <span className={`${mutedTextColor} text-xs opacity-75`}>
                (40% weight → {reliability.breakdown.confidenceContribution}pts)
              </span>
            </div>
            <div className="text-center">
              <div className={`h-3 bg-blue-200 rounded overflow-hidden`}>
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${reliability.breakdown.qualityScore}%` }}
                ></div>
              </div>
              <span className={`${mutedTextColor} text-xs mt-1 block`}>
                Data Quality: {reliability.breakdown.qualityScore}%
              </span>
              <span className={`${mutedTextColor} text-xs opacity-75`}>
                (60% weight → {reliability.breakdown.qualityContribution}pts)
              </span>
            </div>
          </div>
          
          {/* Detailed Quality Factors */}
          <div className="pt-2 border-t border-gray-300">
            <div className={`text-xs ${textColor} font-medium mb-2`}>Data Quality Details:</div>
            <div className="space-y-1">
              {reliability.qualityDetails.factors.map((factor, index) => (
                <div key={index} className={`text-xs ${mutedTextColor} flex items-start`}>
                  <span className="text-blue-500 mr-1">•</span>
                  <span>{factor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SentimentCard: React.FC<SentimentCardProps> = ({ data }) => {
  // Add debug log to verify component is being called
  console.log('[SENTIMENT CARD] Rendering card for:', data?.ticker, data);
  
  // Early return if data is invalid
  if (!data || !data.ticker) {
    console.log('[SENTIMENT CARD] Returning null - invalid data');
    return null;
  }

  const {
    ticker,
    score = 0,
    source,
    postCount = 0,
    commentCount = 0,
    price,
    changePercent,
    newsCount = 0,
    confidence,
    strength,
    volume = 0,
    momentum = 0,
  } = data;
  
  // Safely handle score calculation
  const safeScore = isNaN(score) ? 0 : Number(score);
  const safeStrength = strength !== undefined && !isNaN(strength) 
    ? Math.round(Math.abs(strength)) 
    : Math.round(Math.abs(safeScore * 100));
  
  // Get theme context
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const cardBgColor = isLight ? 'bg-white' : 'bg-gray-800';
  const borderColor = isLight ? 'border-gray-200' : 'border-gray-700';
  const headingTextColor = isLight ? 'text-gray-900' : 'text-white';
  const subTextColor = isLight ? 'text-gray-600' : 'text-gray-400';
  const badgeBgColor = isLight ? 'bg-gray-100' : 'bg-gray-700';
  
  const sentimentDescription = getSentimentDescription(safeScore);
  const sentimentColor = getSentimentColor(safeScore);
  const scoreValue = safeStrength > 0 ? safeStrength.toString() : '0';
  
  const hasValidConfidence = confidence !== undefined && confidence !== null && !isNaN(Number(confidence));
  const dataSummary = getDataSummary(source || 'unknown', postCount, commentCount, newsCount);
  
  return (
    <div className={`${cardBgColor} rounded-xl p-6 hover:shadow-lg transition-all duration-200 border ${borderColor} shadow-sm`}>
      {/* Header with ticker and sentiment */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <h3 className={`text-2xl font-bold ${headingTextColor}`}>{ticker}</h3>
          {getSentimentIcon(safeScore)}
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${subTextColor} mb-1`}>Market Sentiment</div>
          <div className={`text-3xl font-bold ${sentimentColor}`}>
            {scoreValue}%
          </div>
        </div>
      </div>

      {/* Sentiment description - prominent display */}
      <div className="mb-4">
        <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-semibold ${badgeBgColor}`}>
          <span className={sentimentColor}>{sentimentDescription}</span>
        </div>
      </div>

      {/* Price information if available */}
      {price !== undefined && price !== null && !isNaN(Number(price)) && (
        <div className="mb-4 p-3 rounded-lg bg-opacity-50" style={{backgroundColor: isLight ? '#f8f9fa' : '#374151'}}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${subTextColor}`}>Current Price</span>
            <div className="text-right">
              <span className={`text-lg font-semibold ${headingTextColor}`}>
                ${Number(price).toFixed(2)}
              </span>
              {changePercent !== undefined && changePercent !== null && !isNaN(Number(changePercent)) && (
                <div className="flex items-center justify-end mt-1">
                  {Number(changePercent) >= 0 ? (
                    <ArrowUpRight size={16} className="text-green-500" />
                  ) : (
                    <ArrowDownRight size={16} className="text-red-500" />
                  )}
                  <span className={`text-sm font-medium ml-1 ${Number(changePercent) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Math.abs(Number(changePercent)).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unified Reliability Indicator (replaces separate confidence and signal quality) */}
      <UnifiedReliabilityIndicator sentimentData={data} isLight={isLight} />

      {/* Data source and summary */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span className={`text-sm ${subTextColor}`}>Live • {dataSummary}</span>
        </div>
        
        {/* Info tooltip for technical users */}
        <div className="group relative">
          <Info size={16} className={`${subTextColor} hover:${headingTextColor} cursor-help`} />
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
            Score: {safeScore.toFixed(3)} • Source: {source || 'unknown'}
            {hasValidConfidence && ` • Confidence: ${Number(confidence).toFixed(0)}%`}
          </div>
        </div>
      </div>

      {/* Simplified progress indicator */}
      <div className="mt-4">
        <div className={`h-2 ${isLight ? 'bg-gray-200' : 'bg-gray-700'} rounded-full overflow-hidden`}>
          <div 
            className={`h-full transition-all duration-500 ${
              safeScore > 0.15 ? 'bg-green-500' : safeScore < -0.15 ? 'bg-red-500' : 'bg-yellow-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, parseInt(scoreValue)))}%` }}
          ></div>
        </div>
      </div>

      {/* Momentum indicator if significant */}
      {momentum !== undefined && !isNaN(momentum) && Math.abs(momentum) > 0.1 && (
        <div className="mt-3 flex items-center justify-center">
          <span className={`text-xs ${subTextColor} mr-2`}>
            Momentum: {momentum > 0 ? '+' : ''}{Number(momentum).toFixed(1)}%
          </span>
          {momentum > 0 ? (
            <TrendingUp size={14} className="text-green-500" />
          ) : (
            <TrendingDown size={14} className="text-red-500" />
          )}
        </div>
      )}
    </div>
  );
};

export default SentimentCard;