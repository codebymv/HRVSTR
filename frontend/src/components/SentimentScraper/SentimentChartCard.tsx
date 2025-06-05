import React from 'react';
import { ChartData, TimeRange } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { Info } from 'lucide-react';
import SentimentChart from './SentimentChart';
import LoadingCard from '../UI/LoadingCard';
import ErrorCard from '../UI/ErrorCard';

interface SentimentChartCardProps {
  chartData: ChartData[];
  loading: boolean;
  isTransitioning: boolean;
  loadingProgress: number;
  loadingStage: string;
  isDataLoading: boolean;
  errors: {
    chart: string | null;
    rateLimited: boolean;
  };
  onRefresh: () => void;
  hasRedditAccess?: boolean;
}

const SentimentChartCard: React.FC<SentimentChartCardProps> = ({
  chartData,
  loading,
  isTransitioning,
  loadingProgress,
  loadingStage,
  isDataLoading,
  errors,
  onRefresh,
  hasRedditAccess = true
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';

  const renderContent = () => {
    // Show loading state during chart loading or time range transitions
    if ((loading || isTransitioning) && !errors.rateLimited && !errors.chart) {
      return (
        <LoadingCard
          stage={loadingStage}
          subtitle="Processing sentiment data across multiple sources"
          progress={loadingProgress}
          showProgress={true}
          size="md"
        />
      );
    }

    // Show rate limit error
    if (errors.rateLimited) {
      return (
        <ErrorCard
          type="rateLimited"
          message="The Reddit API is currently rate limiting requests. Please wait a moment and try again later."
          onRetry={onRefresh}
          isRetrying={isDataLoading}
          size="md"
        />
      );
    }

    // Show chart error
    if (errors.chart) {
      return (
        <ErrorCard
          type="warning"
          message={errors.chart}
          onRetry={onRefresh}
          isRetrying={isDataLoading}
          showRetry={false}
          size="md"
        />
      );
    }

    // Show chart data
    if (chartData.length > 0) {
      return (
        <>
          <SentimentChart 
            data={chartData} 
            isLoading={loading}
            loadingProgress={loadingProgress}
            loadingStage={loadingStage}
            hasRedditAccess={hasRedditAccess}
          />
        </>
      );
    }

    // Show no data message
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <Info className={`mb-2 ${mutedTextColor}`} size={32} />
        <p className={mutedTextColor}>No chart data available for the selected time period</p>
      </div>
    );
  };

  return (
    <div className={`${cardBgColor} rounded-lg p-4 lg:p-5 border ${borderColor}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h2 className={`text-lg font-semibold ${textColor}`}>Sentiment Overview</h2>
      </div>
      {renderContent()}
    </div>
  );
};

export default SentimentChartCard; 