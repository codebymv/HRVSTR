import React, { useState } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import SentimentCard from './SentimentCard';
import ProgressBar from '../ProgressBar';
import { SentimentData } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

type DataSource = 'reddit' | 'finviz' | 'yahoo' | 'combined';

interface SentimentScoresSectionProps {
  redditSentiments: SentimentData[];
  finvizSentiments: SentimentData[];
  yahooSentiments?: SentimentData[];
  combinedSentiments: SentimentData[];
  isLoading: boolean;
  loadingProgress: number;
  loadingStage: string;
  error: string | null;
  isRateLimited: boolean;
  className?: string;
}

const SentimentScoresSection: React.FC<SentimentScoresSectionProps> = ({
  redditSentiments,
  finvizSentiments,
  yahooSentiments = [], // Default to empty array if not provided
  combinedSentiments,
  isLoading,
  loadingProgress,
  loadingStage,
  error,
  isRateLimited,
  className = ''
}) => {
  const [dataSource, setDataSource] = useState<DataSource>('combined');
  
  // Theme-specific styling using ThemeContext
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBgColor = isLight ? 'bg-stone-400 hover:bg-stone-500' : 'bg-gray-700 hover:bg-gray-600';
  const activeButtonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

  // Get the appropriate sentiment data based on the selected source
  const getSentimentData = () => {
    // Debug logs to see what data is passed into this component
    console.log('SCORES DEBUG - Data sources:');
    console.log('Reddit sentiments:', redditSentiments);
    console.log('FinViz sentiments:', finvizSentiments);
    console.log('Yahoo sentiments:', yahooSentiments);
    console.log('Combined sentiments:', combinedSentiments);
    
    let result;
    switch (dataSource) {
      case 'reddit':
        result = redditSentiments;
        break;
      case 'finviz':
        result = finvizSentiments;
        break;
      case 'yahoo':
        result = yahooSentiments;
        break;
      case 'combined':
      default:
        result = combinedSentiments;
        break;
    }
    
    // Debug log the result
    console.log(`SCORES DEBUG - Selected source (${dataSource}):`, result);
    if (result && result.length > 0) {
      console.log(`Sample item (${result[0].ticker}) confidence:`, 
                result[0].confidence, 
                'typeof:', typeof result[0].confidence);
    }
    
    return result;
  };

  const currentSentiments = getSentimentData();

  // Use fixed source distribution percentages to ensure consistency with chart display
  const getSourceDistribution = () => {
    // Always return fixed percentages: 30% Reddit, 40% Finviz, 30% Yahoo
    // Regardless of actual data availability - this matches the chart display
    return {
      reddit: 30, // Fixed at 30%
      finviz: 40, // Fixed at 40%
      yahoo: 30   // Fixed at 30%
    };
  };

  const distribution = getSourceDistribution();

  return (
    <div className={`${cardBgColor} rounded-lg p-4 lg:p-5 border ${borderColor} ${className} flex flex-col`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className={`text-lg font-medium ${textColor}`}>Sentiment Scores</h3>
        <div className={`flex space-x-1 ${cardBgColor} rounded-full p-1`}>
          <button
            className={`px-3 py-1 text-sm rounded-full transition-colors ${dataSource === 'reddit' ? `${activeButtonBgColor} text-white` : `${mutedTextColor} ${buttonBgColor}`}`}
            onClick={() => setDataSource('reddit')}
          >
            Reddit
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-full transition-colors ${dataSource === 'finviz' ? `${activeButtonBgColor} text-white` : `${mutedTextColor} ${buttonBgColor}`}`}
            onClick={() => setDataSource('finviz')}
          >
            FinViz
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-full transition-colors ${dataSource === 'yahoo' ? `${activeButtonBgColor} text-white` : `${mutedTextColor} ${buttonBgColor}`}`}
            onClick={() => setDataSource('yahoo')}
          >
            Yahoo
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-full transition-colors ${dataSource === 'combined' ? `${activeButtonBgColor} text-white` : `${mutedTextColor} ${buttonBgColor}`}`}
            onClick={() => setDataSource('combined')}
          >
            All
          </button>
        </div>
      </div>
      
      {!isLoading && !isRateLimited && !error && (
        <div className="flex items-center mb-3 px-1 text-xs">
          <span className={mutedTextColor}>Data sources:</span>
          <div className="flex ml-2 space-x-2">
            {distribution.reddit > 0 && (
              <span className="bg-orange-500 rounded-full px-2 py-0.5 text-white">
                Reddit ({Math.round(distribution.reddit)}%)
              </span>
            )}
            {distribution.finviz > 0 && (
              <span className="bg-amber-500 rounded-full px-2 py-0.5 text-white">
                Finviz ({Math.round(distribution.finviz)}%)
              </span>
            )}
            {distribution.yahoo > 0 && (
              <span className="bg-green-500 rounded-full px-2 py-0.5 text-white">
                Yahoo ({Math.round(distribution.yahoo)}%)
              </span>
            )}
          </div>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <Loader2 className="mb-2 text-blue-500 animate-spin" size={32} />
          <p className={`text-lg font-semibold ${textColor}`}>{loadingStage}</p>
          <div className="w-full max-w-sm mt-4 mb-2">
            <ProgressBar progress={loadingProgress} />
          </div>
          <div className={`text-xs ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>{loadingProgress}% complete</div>
        </div>
      ) : isRateLimited ? (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <AlertTriangle className="mb-2 text-red-500" size={32} />
          <p className={`text-lg font-semibold ${textColor}`}>Rate Limit Exceeded</p>
          <p className={`mt-2 ${mutedTextColor}`}>The Reddit API is currently rate limiting requests. Please wait a moment and try again later.</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <AlertTriangle className="mb-2 text-yellow-500" size={32} />
          <p className={textColor}>{error}</p>
        </div>
      ) : currentSentiments?.length > 0 ? (
        <div className="flex flex-col space-y-4 overflow-visible">
          {currentSentiments.slice(0, 4).map((data) => (
            <SentimentCard 
              key={`${dataSource}-${data.ticker}`} 
              data={data}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <Info className={`mb-2 ${mutedTextColor}`} size={32} />
          {dataSource === 'yahoo' ? (
            <>
              <p className={`${textColor} font-medium mb-2`}>Yahoo Finance data unavailable</p>
              <p className={mutedTextColor}>The Yahoo Finance API integration is not currently returning data.</p>
              <p className={mutedTextColor}>Please use the Reddit, Finviz, or All tabs for available sentiment data.</p>
            </>
          ) : (
            <p className={mutedTextColor}>No sentiment data available for {dataSource} source</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SentimentScoresSection;
