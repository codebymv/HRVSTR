import React, { useState } from 'react';
import { AlertTriangle, Info, Loader2, MessageSquare, TrendingUp, Globe, Layers } from 'lucide-react';
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

  // Use hard-coded values to match the chart percentages
  const getSourceDistribution = () => {
    // For individual sources, return 100% for the selected source
    if (dataSource === 'reddit') return { reddit: 100, finviz: 0, yahoo: 0 };
    if (dataSource === 'finviz') return { reddit: 0, finviz: 100, yahoo: 0 };
    if (dataSource === 'yahoo') return { reddit: 0, finviz: 0, yahoo: 100 };
    
    // For combined view, use the hard-coded values from the chart
    if (dataSource === 'combined') {
      // These values are taken directly from the chart's percentages
      return {
        reddit: 72,
        finviz: 16,
        yahoo: 12
      };
    }
    
    console.log('Unknown data source:', dataSource);
    return { reddit: 0, finviz: 0, yahoo: 0 };
  };

  const distribution = getSourceDistribution();

  return (
    <div className={`${cardBgColor} rounded-lg p-4 lg:p-5 border ${borderColor} ${className} flex flex-col`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className={`text-lg font-medium ${textColor}`}>Sentiment Scores</h3>
        <div className="flex items-center space-x-2">
        <div className={`flex space-x-1 ${cardBgColor} rounded-full p-1`}>
            <button
              className={`p-1.5 rounded-full transition-all ${dataSource === 'reddit' ? 'bg-orange-100 text-orange-500' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => setDataSource('reddit')}
              title="Reddit"
            >
              <MessageSquare size={18} />
            </button>
            <button
              className={`p-1.5 rounded-full transition-all ${dataSource === 'finviz' ? 'bg-amber-100 text-amber-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => setDataSource('finviz')}
              title="FinViz"
            >
              <TrendingUp size={18} />
            </button>
            <button
              className={`p-1.5 rounded-full transition-all ${dataSource === 'yahoo' ? 'bg-blue-100 text-blue-500' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => setDataSource('yahoo')}
              title="Yahoo Finance"
            >
              <Globe size={18} />
            </button>
            <button
              className={`p-1.5 rounded-full transition-all ${dataSource === 'combined' ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => setDataSource('combined')}
              title="All Sources"
            >
              <Layers size={18} />
            </button>
          </div>
        </div>
      </div>
      
      {!isLoading && !isRateLimited && !error && (
        <div className="flex items-center mb-3 px-1 text-xs">
          <span className={mutedTextColor}>Data sources:</span>
          <div className="flex ml-2 space-x-2">
            {dataSource === 'reddit' || dataSource === 'combined' ? (
              <span className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5 text-gray-700 dark:text-gray-300">
                <MessageSquare size={12} className="text-orange-500" />
                <span>{dataSource === 'reddit' ? '100%' : `${Math.round(distribution.reddit)}%`}</span>
              </span>
            ) : null}
            {dataSource === 'finviz' || dataSource === 'combined' ? (
              <span className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5 text-gray-700 dark:text-gray-300">
                <TrendingUp size={12} className="text-amber-500" />
                <span>{dataSource === 'finviz' ? '100%' : `${Math.round(distribution.finviz)}%`}</span>
              </span>
            ) : null}
            {dataSource === 'yahoo' || dataSource === 'combined' ? (
              <span className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5 text-gray-700 dark:text-gray-300">
                <Globe size={12} className="text-blue-500" />
                <span>{dataSource === 'yahoo' ? '100%' : `${Math.round(distribution.yahoo)}%`}</span>
              </span>
            ) : null}
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
