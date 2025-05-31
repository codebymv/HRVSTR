import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { SentimentData } from '../../types';
import { getSentimentTextColor, getConfidenceColor } from './sentimentUtils';

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

const SentimentCard: React.FC<SentimentCardProps> = ({ data }) => {
  // Early return if data is invalid
  if (!data || !data.ticker) {
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
          {hasValidConfidence && (
            <span className={`ml-2 ${subTextColor}`}>
              • {Number(confidence).toFixed(0)}% confidence
            </span>
          )}
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

      {/* Data source and summary */}
      <div className="flex items-center justify-between">
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
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
            momentum > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {momentum > 0 ? (
              <ArrowUpRight size={12} />
            ) : (
              <ArrowDownRight size={12} />
            )}
            <span>
              {momentum > 0 ? 'Trending up' : 'Trending down'} {Math.abs(momentum).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SentimentCard;