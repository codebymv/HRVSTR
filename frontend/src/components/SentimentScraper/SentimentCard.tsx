import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { ArrowUpRight, ArrowDownRight, Minus, BarChart2, Percent } from 'lucide-react';
import { SentimentData } from '../../types';
import { getSentimentTextColor, getConfidenceColor } from './sentimentUtils';

interface SentimentCardProps {
  data: SentimentData;
}

const SentimentCard: React.FC<SentimentCardProps> = ({ data }) => {
  const {
    ticker,
    score,
    source,
    postCount = 0,
    commentCount = 0,
    price,
    changePercent,
    newsCount = 0,
    // Remove unused analystRating variable
    confidence, // No default - will calculate if not provided
    strength = Math.round(Math.abs(score * 100)), // Calculate strength as percentage of score
    volume = 0, // Discussion volume
    momentum = 0, // Sentiment momentum (change)
  } = data;
  
  // No fallback logic - only use the confidence provided by the backend
  // If confidence is not provided, we'll show it as "N/A" in the UI
  
  // Get theme context
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const headingTextColor = isLight ? 'text-stone-800' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  
  const scoreTextColor = getSentimentTextColor(score);
  // Use strength value if available, otherwise calculate from score
  const scoreValue = strength ? strength.toString() : (Math.abs(score * 100) * 10).toFixed(0);
  
  // Add detailed debug log to see what data is received by the component
  console.log(`🔍 CARD (${ticker}):`, { 
    confidence: confidence, 
    confidenceType: typeof confidence, 
    score: score,
    hasConfidence: confidence !== undefined,
    entireData: JSON.stringify(data)
  });
  
  // Only use confidence directly from the backend - no fallbacks
  // Explicitly check for null, undefined, and NaN cases
  const hasValidConfidence = confidence !== undefined && confidence !== null && !isNaN(Number(confidence));
  const confidenceColor = hasValidConfidence ? getConfidenceColor(confidence) : 'text-gray-400';
  
  return (
    <div className={`${cardBgColor} rounded-lg p-5 hover:shadow-lg transition-shadow border ${borderColor}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className={`text-xl font-bold ${headingTextColor}`}>{ticker}</h3>
          <div className="flex items-center mt-1">
            {score > 0.2 ? (
              <ArrowUpRight size={20} className="text-green-500" />
            ) : score < -0.2 ? (
              <ArrowDownRight size={20} className="text-red-500" />
            ) : (
              <Minus size={20} className="text-yellow-500" />
            )}
            <span className={`ml-1 text-sm font-medium capitalize ${scoreTextColor}`}>
              {score > 0.2 ? 'bullish' : score < -0.2 ? 'bearish' : 'neutral'}
            </span>
            
            {/* Confidence indicator - only show if provided by backend */}
            {hasValidConfidence ? (
              <div className="ml-2 flex items-center" title={`Confidence: ${confidence}%`}>
                <Percent size={14} className={confidenceColor} />
                <span className={`ml-1 text-xs ${confidenceColor}`}>{confidence}%</span>
              </div>
            ) : (
              <div className="ml-2 flex items-center" title="No confidence data available">
                <Percent size={14} className="text-gray-400" />
                <span className="ml-1 text-xs text-gray-400">N/A</span>
              </div>
            )}
          </div>
        </div>
        <div className={`text-2xl font-bold ${scoreTextColor}`}>
          {scoreValue}%
        </div>
      </div>
      
      {/* Details section varies by data source */}
      <div className="mt-4 flex justify-between text-sm">
        <div className={subTextColor}>
          {source === 'reddit' && (
            <>
              <span className="block">{postCount} posts</span>
              <span className="block">{commentCount} comments</span>
              
              {/* Volume indicator if available */}
              {volume > 0 && (
                <div className="flex items-center mt-1" title="Discussion volume">
                  <BarChart2 size={14} className={subTextColor} />
                  <span className="ml-1">
                    Volume: {volume}/10
                  </span>
                </div>
              )}
            </>
          )}
          {source === 'finviz' && (
            <>
              {/* Only show price if it's a valid number */}
              {price !== undefined && price !== null && !isNaN(Number(price)) ? (
                <span className="block">
                  ${Number(price).toFixed(2)}
                  {changePercent !== undefined && changePercent !== null && !isNaN(Number(changePercent)) && (
                    <span className="inline-flex items-center ml-1">
                      {Number(changePercent) >= 0 ? (
                        <ArrowUpRight size={14} className="text-green-500" />
                      ) : (
                        <ArrowDownRight size={14} className="text-red-500" />
                      )}
                      {Math.abs(Number(changePercent)).toFixed(2)}%
                    </span>
                  )}
                </span>
              ) : null}
              {newsCount !== undefined && <span className="block">{newsCount} news articles</span>}
              
              {/* Volume indicator if available */}
              {volume > 0 && (
                <div className="flex items-center mt-1" title="News volume">
                  <BarChart2 size={14} className={subTextColor} />
                  <span className="ml-1">
                    Volume: {volume}/10
                  </span>
                </div>
              )}
            </>
          )}
          {source === 'yahoo' && (
            <>
              {/* Only show price if it's a valid number */}
              {price !== undefined && price !== null && !isNaN(Number(price)) ? (
                <span className="block">
                  ${Number(price).toFixed(2)}
                  {changePercent !== undefined && changePercent !== null && !isNaN(Number(changePercent)) && (
                    <span className="inline-flex items-center ml-1">
                      {Number(changePercent) >= 0 ? (
                        <ArrowUpRight size={14} className="text-green-500" />
                      ) : (
                        <ArrowDownRight size={14} className="text-red-500" />
                      )}
                      {Math.abs(Number(changePercent)).toFixed(2)}%
                    </span>
                  )}
                </span>
              ) : null}
              {newsCount !== undefined && <span className="block">{newsCount} news articles</span>}
              
              {/* Volume indicator if available */}
              {volume > 0 && (
                <div className="flex items-center mt-1" title="News volume">
                  <BarChart2 size={14} className={subTextColor} />
                  <span className="ml-1">
                    Volume: {volume}/10
                  </span>
                </div>
              )}
            </>
          )}
          {source === 'combined' && (
            <>
              <span className="block">{postCount} posts</span>
              <span className="block">{commentCount} comments</span>
              {newsCount > 0 && <span className="block">{newsCount} news articles</span>}
              
              {/* Price information if available */}
              {price != null && !isNaN(price as unknown as number) && (
                <span className="block">
                  ${(price as number).toFixed(2)}
                  {changePercent != null && !isNaN(changePercent as unknown as number) && (
                    <span className="inline-flex items-center ml-1">
                      {changePercent >= 0 ? (
                        <ArrowUpRight size={14} className="text-green-500" />
                      ) : (
                        <ArrowDownRight size={14} className="text-red-500" />
                      )}
                      {Math.abs(changePercent as number).toFixed(2)}%
                    </span>
                  )}
                </span>
              )}
              
              {/* Volume indicator if available */}
              {volume > 0 && (
                <div className="flex items-center mt-1" title="Discussion volume">
                  <BarChart2 size={14} className={subTextColor} />
                  <span className="ml-1">
                    Volume: {volume}/10
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span className={`${subTextColor} text-xs`}>Live</span>
        </div>
      </div>
      
      {/* Progress bar with confidence indicator */}
      <div className="mt-5">
        <div className={`h-2 ${isLight ? 'bg-stone-400' : 'bg-gray-700'} rounded-full overflow-hidden relative`}>
          <div 
            className={`h-full ${
              score > 0.2 ? 'bg-green-500' : score < -0.2 ? 'bg-red-500' : 'bg-yellow-500'
            }`}
            style={{ width: `${Math.min(100, parseInt(scoreValue))}%` }}
          ></div>
          
          {/* Confidence overlay - semi-transparent overlay showing confidence level */}
          {confidence ? (
            <div 
              className="absolute top-0 left-0 h-full bg-white opacity-30"
              style={{ width: `${100 - confidence}%` }}
            ></div>
          ) : (
            <div 
              className="absolute top-0 left-0 h-full bg-white opacity-30"
              style={{ width: '50%' }} // Default 50% overlay when no confidence available
            ></div>
          )}
        </div>
        
        {/* Momentum indicator if available */}
        {momentum !== 0 && (
          <div className="flex justify-end mt-1">
            <div className="flex items-center">
              {momentum > 0 ? (
                <ArrowUpRight size={14} className="text-green-500" />
              ) : (
                <ArrowDownRight size={14} className="text-red-500" />
              )}
              <span className={`text-xs ${momentum > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {Math.abs(momentum).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SentimentCard;