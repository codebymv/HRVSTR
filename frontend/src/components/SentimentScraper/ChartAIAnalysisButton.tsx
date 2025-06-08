import React, { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, Brain } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import sentimentChartAnalysisService, { ChartAnalysisError } from '../../services/sentimentChartAnalysisService';
import { TimeRange } from '../../types';

interface ChartAIAnalysisButtonProps {
  // Chart data and analysis type
  chartData: any[];
  analysisType: 'market' | 'ticker';
  timeRange: TimeRange;
  selectedTickers?: string[];
  
  // UI configuration
  variant?: 'compact' | 'full';
  showCost?: boolean;
  disabled?: boolean;
  
  // Callbacks
  onAnalysisStart?: () => void;
  onAnalysisComplete?: (analysis: string) => void;
  onAnalysisError?: (error: ChartAnalysisError) => void;
}

const ChartAIAnalysisButton: React.FC<ChartAIAnalysisButtonProps> = ({
  chartData,
  analysisType,
  timeRange,
  selectedTickers = [],
  variant = 'full',
  showCost = true,
  disabled = false,
  onAnalysisStart,
  onAnalysisComplete,
  onAnalysisError
}) => {
  const { theme } = useTheme();
  const { addToast } = useToast();
  const isLight = theme === 'light';
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theme-specific styling - matching existing components
  const borderColor = isLight ? 'border-gray-300/50' : 'border-gray-600/50';
  const headingTextColor = isLight ? 'text-stone-800' : 'text-white';
  const textColor = isLight ? 'text-stone-700' : 'text-gray-400';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-500';
  const linkHoverColor = 'hover:text-blue-500';
  
  // AI button styling - consistent purple gradient like other components
  const aiButtonColor = 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white';
  const aiButtonBorderColor = 'border-blue-500';

  // Calculate credit cost
  const creditCost = sentimentChartAnalysisService.getEstimatedCreditCost(
    analysisType, 
    selectedTickers.length
  );

  // Get analysis description
  const getAnalysisDescription = () => {
    if (analysisType === 'market') {
      return `market sentiment trends over ${sentimentChartAnalysisService.getTimeRangeDescription(timeRange)}`;
    } else {
      const tickerText = selectedTickers.length === 1 
        ? selectedTickers[0] 
        : `${selectedTickers.length} stocks`;
      return `${tickerText} sentiment comparison over ${sentimentChartAnalysisService.getTimeRangeDescription(timeRange)}`;
    }
  };

  // Handle analysis request
  const handleAnalyze = async () => {
    if (disabled || isAnalyzing || !chartData || chartData.length === 0) {
      return;
    }

    // Validate ticker analysis requirements
    if (analysisType === 'ticker' && selectedTickers.length === 0) {
      setError('Please select at least one ticker to analyze');
      addToast('Please select stocks to analyze', 'error');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    onAnalysisStart?.();

    try {
      let response;
      
      if (analysisType === 'market') {
        response = await sentimentChartAnalysisService.analyzeMarketSentimentChart(
          chartData,
          timeRange
        );
      } else {
        response = await sentimentChartAnalysisService.analyzeTickerSentimentChart(
          chartData,
          selectedTickers,
          timeRange
        );
      }

      setAnalysis(response.data.analysis);
      setShowAnalysis(true);
      onAnalysisComplete?.(response.data.analysis);

      addToast(
        `AI analysis completed! ${creditCost} credit${creditCost === 1 ? '' : 's'} used.`,
        'success'
      );

    } catch (err: any) {
      const error = err as ChartAnalysisError;
      console.error('Chart analysis error:', error);
      
      setError(error.userMessage || error.message || 'Analysis failed');
      onAnalysisError?.(error);

      // Show appropriate toast based on error type
      if (error.error === 'INSUFFICIENT_CREDITS') {
        addToast(
          `Insufficient credits. Need ${error.creditInfo?.required || creditCost}, have ${error.creditInfo?.available || 0}.`,
          'error'
        );
      } else if (error.error === 'FEATURE_NOT_AVAILABLE') {
        addToast('AI analysis requires a Pro subscription', 'error');
      } else {
        addToast(error.userMessage || 'AI analysis failed', 'error');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Compact variant for tight spaces
  if (variant === 'compact') {
    return (
      <button
        onClick={handleAnalyze}
        disabled={disabled || isAnalyzing || !chartData || chartData.length === 0}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${aiButtonColor} ${aiButtonBorderColor} border disabled:opacity-50 disabled:cursor-not-allowed`}
        title={`Get AI insights for ${creditCost} credit${creditCost === 1 ? '' : 's'}`}
      >
        {isAnalyzing ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>Analyzing...</span>
          </>
        ) : analysis ? (
          <>
            <Brain size={14} />
            <span>Analysis Complete</span>
          </>
        ) : (
          <>
            <Brain size={14} />
            <span>
              {`Get AI insights for ${creditCost} credit${creditCost !== 1 ? 's' : ''}`}
            </span>
          </>
        )}
      </button>
    );
  }

  // Full variant with analysis display - matching the existing pattern
  return (
    <div className={`mt-3 pt-3 border-t ${borderColor}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Sparkles size={16} className="text-blue-500" />
          <span className={`text-sm font-medium ${headingTextColor}`}>
            On-Demand Analysis
          </span>
        </div>
        
        <button
          onClick={handleAnalyze}
          disabled={disabled || isAnalyzing || !!analysis || !chartData || chartData.length === 0}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${aiButtonColor} ${aiButtonBorderColor} border disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : analysis ? (
            <>
              <Brain size={14} />
              <span>Analysis Complete</span>
            </>
          ) : (
            <>
              <Brain size={14} />
              <span>
                {`Get AI insights for ${creditCost} credit${creditCost !== 1 ? 's' : ''}`}
              </span>
            </>
          )}
        </button>
      </div>
      
      {analysis && (
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs ${mutedTextColor}`}>
            Fresh analysis generated on-demand
          </span>
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className={`text-xs ${textColor} ${linkHoverColor} transition-colors`}
          >
            {showAnalysis ? 'Hide' : 'Show'} Analysis
          </button>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded text-xs text-red-700 dark:text-red-300">
          <div className="flex items-center space-x-2">
            <AlertCircle size={12} />
            <span>{error}</span>
          </div>
        </div>
      )}
      
      {/* On-Demand Analysis Display */}
      {analysis && showAnalysis && (
        <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Brain size={14} className="text-green-500" />
            <span className="text-xs font-semibold text-green-700 dark:text-green-300">Fresh AI Analysis</span>
          </div>
          <p className="text-xs text-green-800 dark:text-green-200 leading-relaxed">
            {analysis}
          </p>
          <div className="mt-2 pt-2 border-t border-green-200/50 dark:border-green-700/50 flex justify-between items-center">
            <span className="text-xs text-green-600 dark:text-green-400 opacity-75">
              Gemini 1.5 Flash
            </span>
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-600 dark:text-green-400">Just now</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartAIAnalysisButton; 