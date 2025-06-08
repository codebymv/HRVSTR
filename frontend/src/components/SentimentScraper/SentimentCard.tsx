import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, TrendingDown, Info, Shield, ChevronDown, ChevronUp, Brain, Loader2, Key, Lock, Sparkles, CreditCard } from 'lucide-react';
import { SentimentData } from '../../types';
import { getSentimentTextColor, getConfidenceColor, calculateSentimentQuality, getQualityGradeColor, calculateUnifiedReliability } from './sentimentUtils';
import { analyzeTickerSentiment } from '../../services/tickerAnalysisService';
import { getCreditBalance, getCreditCost, type CreditBalance } from '../../services/creditsApi';

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
  
  // AI analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [onDemandAnalysis, setOnDemandAnalysis] = useState<string | null>(null);
  const [showOnDemandAnalysis, setShowOnDemandAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Credit state
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [aiCreditCost, setAiCreditCost] = useState<number>(1);
  const [canAffordAI, setCanAffordAI] = useState<boolean>(false);
  const [loadingCredits, setLoadingCredits] = useState<boolean>(true);
  
  // Safely handle score calculation
  const safeScore = isNaN(score) ? 0 : Number(score);
  const safeStrength = strength !== undefined && !isNaN(strength) 
    ? Math.round(Math.abs(strength)) 
    : Math.round(Math.abs(safeScore * 100));
  
  // Get contexts
  const { theme } = useTheme();
  const { tierInfo, loading: tierLoading } = useTier();
  const isLight = theme === 'light';
  
  // Fetch credit information on component mount
  useEffect(() => {
    const fetchCreditInfo = async () => {
      try {
        setLoadingCredits(true);
        const [balanceResult, costResult] = await Promise.all([
          getCreditBalance(),
          getCreditCost('ai_ticker_analysis')
        ]);
        
        if (balanceResult.success && balanceResult.balance) {
          setCreditBalance(balanceResult.balance);
        }
        
        if (costResult.success && costResult.cost !== undefined) {
          setAiCreditCost(costResult.cost);
        }
        
        // Check if user can afford AI analysis
        if (balanceResult.success && balanceResult.balance && costResult.success && costResult.cost !== undefined) {
          setCanAffordAI(balanceResult.balance.remaining >= costResult.cost);
        }
      } catch (error) {
        console.error('Error fetching credit info:', error);
      } finally {
        setLoadingCredits(false);
      }
    };
    
    fetchCreditInfo();
  }, []);
  
  // User tier info - handle loading state properly
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  // Determine AI access based on credits instead of tier
  const hasAIAccess = !loadingCredits && canAffordAI;
  
  // Debug logging for tier state
  if (data?.ticker === 'AAPL') { // Only log for one card to avoid spam
    console.log('[SENTIMENT CARD TIER]', {
      ticker: data.ticker,
      tierLoading,
      tierInfo: tierInfo ? { tier: tierInfo.tier } : null,
      currentTier,
      hasAIAccess
    });
  }

  // AI analysis handler
  const handleAnalyzeTicker = async () => {
    console.log('🔍 [SENTIMENT CARD] AI button clicked for ticker:', ticker);
    
    if (isAnalyzing || onDemandAnalysis) {
      console.log('🔍 [SENTIMENT CARD] Skipping analysis - already analyzing or done:', { isAnalyzing, onDemandAnalysis });
      return; // Don't re-analyze if already done
    }
    
    console.log('🔍 [SENTIMENT CARD] Starting analysis for:', ticker);
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const result = await analyzeTickerSentiment(data);
      
      if (result.success && result.data) {
        setOnDemandAnalysis(result.data.analysis);
        setShowOnDemandAnalysis(true);
        
        // Update credit balance after successful analysis
        if (result.creditInfo) {
          setCreditBalance(prev => prev ? {
            ...prev,
            remaining: result.creditInfo!.remaining,
            used: prev.used + result.creditInfo!.used
          } : null);
          setCanAffordAI(result.creditInfo!.remaining >= aiCreditCost);
        }
      } else {
        setAnalysisError(result.message || 'Analysis failed');
        if (result.error === 'INSUFFICIENT_CREDITS') {
          setAnalysisError(`Insufficient credits. Need ${aiCreditCost} credits but only have ${creditBalance?.remaining || 0}.`);
        } else if (result.upgradeRequired) {
          setAnalysisError('AI analysis feature is not available in your tier');
        }
      }
    } catch (err) {
      setAnalysisError('Failed to analyze ticker');
      console.error('Ticker analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Theme-specific styling
  const cardBgColor = isLight ? 'bg-white' : 'bg-gray-800';
  const borderColor = isLight ? 'border-gray-200' : 'border-gray-700';
  const headingTextColor = isLight ? 'text-gray-900' : 'text-white';
  const subTextColor = isLight ? 'text-gray-600' : 'text-gray-400';
  const badgeBgColor = isLight ? 'bg-gray-100' : 'bg-gray-700';
  
  // AI button styling - consistent theme like other unlock buttons
  const aiButtonColor = 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white';
  const aiButtonBorderColor = 'border-blue-500';
  
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
          {/* Sentiment description badge - on same row for desktop */}
          <div className={`hidden md:inline-flex items-center px-3 py-2 rounded-full text-sm font-semibold ${badgeBgColor}`}>
            <span className={sentimentColor}>{sentimentDescription}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${subTextColor} mb-1`}>Market Sentiment</div>
          <div className={`text-3xl font-bold ${sentimentColor}`}>
            {scoreValue}%
          </div>
        </div>
      </div>

      {/* Sentiment description - mobile only (below ticker) */}
      <div className="mb-4 md:hidden">
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

      {/* On-Demand AI Analysis Section */}
      <div className="mt-3 pt-3 border-t border-gray-300/50 dark:border-gray-600/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Sparkles size={16} className="text-blue-500" />
            <span className={`text-sm font-medium ${headingTextColor}`}>
              On-Demand Analysis
            </span>
          </div>
          
          <button
            onClick={handleAnalyzeTicker}
            disabled={isAnalyzing || !!onDemandAnalysis || loadingCredits}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${aiButtonColor} ${aiButtonBorderColor} border disabled:opacity-50 disabled:cursor-not-allowed relative z-10 cursor-pointer`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : onDemandAnalysis ? (
              <>
                <Brain size={14} />
                <span>Analysis Complete</span>
              </>
            ) : (
              <>
                <Brain size={14} />
                <span>
                  {loadingCredits 
                    ? 'Loading...' 
                    : `Get AI insights for ${aiCreditCost} credit${aiCreditCost !== 1 ? 's' : ''}`
                  }
                </span>
              </>
            )}
          </button>
        </div>
        
        {onDemandAnalysis && (
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${subTextColor}`}>
              Fresh analysis generated on-demand
            </span>
            <button
              onClick={() => setShowOnDemandAnalysis(!showOnDemandAnalysis)}
              className={`text-xs ${subTextColor} hover:${headingTextColor} transition-colors`}
            >
              {showOnDemandAnalysis ? 'Hide' : 'Show'} Analysis
            </button>
          </div>
        )}
        
        {/* Error Display */}
        {analysisError && (
          <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded text-xs text-red-700 dark:text-red-300">
            <div className="flex items-center space-x-2">
              {!hasAIAccess && <Lock size={12} />}
              <span>{analysisError}</span>
            </div>
          </div>
        )}
        
        {/* On-Demand Analysis Display */}
        {onDemandAnalysis && showOnDemandAnalysis && (
          <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Brain size={14} className="text-green-500" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-300">Fresh AI Analysis</span>
            </div>
            <p className="text-xs text-green-800 dark:text-green-200 leading-relaxed">
              {onDemandAnalysis}
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
    </div>
  );
};

export default SentimentCard;