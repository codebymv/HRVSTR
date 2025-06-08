import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { ChartData } from '../../types';
import { BarChart2, Loader2, MessageSquare, TrendingUp, Globe, Activity, Shield, AlertTriangle, TrendingDown, CheckCircle2, Database, Zap, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import ProgressBar from '../ProgressBar';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions,
} from 'chart.js';
import type { TooltipItem } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, TimeScale);

interface SentimentChartProps {
  data: ChartData[];
  isLoading?: boolean;
  loadingProgress?: number;
  loadingStage?: string;
  hasRedditAccess?: boolean;
}

const SentimentChart: React.FC<SentimentChartProps> = ({ 
  data, 
  isLoading = false, 
  loadingProgress = 0,
  loadingStage = 'Generating chart...',
  hasRedditAccess = true
}) => {
  // Get theme context
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Enhanced market insights calculation
  const marketInsights = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        overallSentiment: 'neutral',
        sentimentScore: 0,
        confidence: 0,
        momentum: 'stable',
        riskLevel: 'moderate',
        dataQuality: 'low',
        totalDataPoints: 0,
        trend: 'neutral',
        extremeReadings: false
      };
    }

    // Calculate overall market sentiment score
    const avgBullish = data.reduce((sum, item) => sum + item.bullish, 0) / data.length;
    const avgBearish = data.reduce((sum, item) => sum + item.bearish, 0) / data.length;
    const avgNeutral = data.reduce((sum, item) => sum + item.neutral, 0) / data.length;
    
    // Market sentiment score (-100 to +100)
    const sentimentScore = avgBullish - avgBearish;
    
    // Determine overall sentiment
    let overallSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (sentimentScore > 15) overallSentiment = 'bullish';
    else if (sentimentScore < -15) overallSentiment = 'bearish';
    
    // Calculate momentum (recent vs earlier periods)
    const recentPeriod = data.slice(-Math.ceil(data.length / 3));
    const earlierPeriod = data.slice(0, Math.floor(data.length / 3));
    
    const recentAvg = recentPeriod.reduce((sum, item) => sum + (item.bullish - item.bearish), 0) / recentPeriod.length;
    const earlierAvg = earlierPeriod.reduce((sum, item) => sum + (item.bullish - item.bearish), 0) / earlierPeriod.length;
    
    let momentum: 'accelerating_bullish' | 'accelerating_bearish' | 'stable' | 'improving' | 'declining' = 'stable';
    const momentumChange = recentAvg - earlierAvg;
    
    if (Math.abs(momentumChange) > 10) {
      if (momentumChange > 0) {
        momentum = sentimentScore > 0 ? 'accelerating_bullish' : 'improving';
      } else {
        momentum = sentimentScore < 0 ? 'accelerating_bearish' : 'declining';
      }
    }
    
    // Calculate data quality/confidence
    const totalDataPoints = data.reduce((sum, item) => {
      return sum + Object.values(item.sources || {}).reduce((s, count) => s + count, 0);
    }, 0);
    
    let dataQuality: 'excellent' | 'good' | 'moderate' | 'low' = 'low';
    const avgDataPoints = totalDataPoints / data.length;
    
    if (avgDataPoints > 100) dataQuality = 'excellent';
    else if (avgDataPoints > 50) dataQuality = 'good';
    else if (avgDataPoints > 20) dataQuality = 'moderate';
    
    // Risk level calculation
    const volatility = data.reduce((sum, item, index) => {
      if (index === 0) return 0;
      const currentSentiment = item.bullish - item.bearish;
      const prevSentiment = data[index - 1].bullish - data[index - 1].bearish;
      return sum + Math.abs(currentSentiment - prevSentiment);
    }, 0) / Math.max(1, data.length - 1);
    
    let riskLevel: 'low' | 'moderate' | 'elevated' | 'high' = 'moderate';
    if (volatility > 30) riskLevel = 'high';
    else if (volatility > 20) riskLevel = 'elevated';
    else if (volatility < 10) riskLevel = 'low';
    
    // Detect extreme readings
    const extremeReadings = avgBullish > 80 || avgBearish > 80 || Math.abs(sentimentScore) > 60;
    
    // Trend analysis
    let trend: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish' = 'neutral';
    if (sentimentScore > 30) trend = 'strong_bullish';
    else if (sentimentScore > 10) trend = 'bullish';
    else if (sentimentScore < -30) trend = 'strong_bearish';
    else if (sentimentScore < -10) trend = 'bearish';
    
    return {
      overallSentiment,
      sentimentScore: Math.round(sentimentScore),
      confidence: Math.min(100, Math.round((avgDataPoints / 100) * 100)),
      momentum,
      riskLevel,
      dataQuality,
      totalDataPoints,
      trend,
      extremeReadings,
      avgBullish: Math.round(avgBullish),
      avgBearish: Math.round(avgBearish),
      avgNeutral: Math.round(avgNeutral),
      volatility: Math.round(volatility)
    };
  }, [data]);

  // Calculate source distribution percentages
  const calculateSourcePercentages = (data: ChartData[]) => {
    if (!data || data.length === 0) {
      return { reddit: 0, finviz: 0, yahoo: 0 };
    }
    
    // Initialize source counts
    const sourceCounts = {
      reddit: 0,
      finviz: 0,
      yahoo: 0,
      other: 0
    };

    // Sum up source counts from all data points
    data.forEach(item => {
      const sources = item.sources || {};
      
      Object.entries(sources).forEach(([source, count]) => {
        const lowerSource = source.toLowerCase();
        if (lowerSource.includes('reddit')) {
          sourceCounts.reddit += count;
        } else if (lowerSource.includes('finviz')) {
          sourceCounts.finviz += count;
        } else if (lowerSource.includes('yahoo')) {
          sourceCounts.yahoo += count;
        } else {
          sourceCounts.other += count;
        }
      });
    });

    const total = Object.values(sourceCounts).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      return { reddit: 0, finviz: 0, yahoo: 0 };
    }

    // Calculate percentages
    let percentages;
    
    if (!hasRedditAccess) {
      // For free users, completely exclude Reddit from calculation
      const freeUserTotal = sourceCounts.finviz + sourceCounts.yahoo;
      
      if (freeUserTotal === 0) {
        percentages = { reddit: 0, finviz: 50, yahoo: 50 };
      } else {
        percentages = {
          reddit: 0,
          finviz: Math.round((sourceCounts.finviz / freeUserTotal) * 100),
          yahoo: Math.round((sourceCounts.yahoo / freeUserTotal) * 100)
        };
      }
    } else {
      // For Pro users, include all sources
      percentages = {
        reddit: Math.round((sourceCounts.reddit / total) * 100),
        finviz: Math.round((sourceCounts.finviz / total) * 100),
        yahoo: Math.round((sourceCounts.yahoo / total) * 100)
      };
    }

    return percentages;
  };

  const sourcePercentages = calculateSourcePercentages(data);
  
  // Helper to detect hourly data (1-day view)
  const isHourlyData = (d: ChartData[]): boolean => {
    if (d.length < 2) return false;
    
    if (d[0]?.displayDate && d[0].displayDate.includes(':00')) {
      return true;
    }
    
    const first = new Date(d[0].date);
    const second = new Date(d[1].date);
    const diff = Math.abs(first.getTime() - second.getTime());
    return diff <= 60 * 60 * 1000 + 60 * 1000;
  };

  const hourly = isHourlyData(data);

  const formatLabel = (item: ChartData): string => {
    if (item.displayDate) {
      if (hourly) {
        try {
          const [hour] = item.displayDate.split(':');
          const hourNum = parseInt(hour, 10);
          return `${hourNum % 12 || 12}${hourNum >= 12 ? 'PM' : 'AM'}`;
        } catch (err) {
          return item.displayDate;
        }
      } else {
        return item.displayDate;
      }
    }
    
    try {
      const date = new Date(item.date);
      if (hourly) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (err) {
      return item.date;
    }
  };

  const labels = data.map((d) => formatLabel(d));

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Bullish',
        data: data.map((d) => d.bullish),
        backgroundColor: 'rgba(34,197,94,0.8)',
        borderColor: 'rgba(34,197,94,1)',
        borderWidth: 1,
        borderRadius: 4,
        stack: 'Stack 0',
      },
      {
        label: 'Neutral',
        data: data.map((d) => d.neutral),
        backgroundColor: 'rgba(234,179,8,0.8)',
        borderColor: 'rgba(234,179,8,1)',
        borderWidth: 1,
        borderRadius: 4,
        stack: 'Stack 0',
      },
      {
        label: 'Bearish',
        data: data.map((d) => d.bearish),
        backgroundColor: 'rgba(239,68,68,0.8)',
        borderColor: 'rgba(239,68,68,1)',
        borderWidth: 1,
        borderRadius: 4,
        stack: 'Stack 0',
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isLight ? '#57534e' : '#9ca3af',
          boxWidth: 12,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (items: TooltipItem<'bar'>[]) => {
            if (items.length > 0) {
              const dataIndex = items[0].dataIndex;
              const dataPoint = data[dataIndex];
              const totalSources = Object.values(dataPoint.sources || {}).reduce((sum, count) => sum + count, 0);
              return `${items[0].label} • ${totalSources} data points`;
            }
            return '';
          },
          label: (ctx: TooltipItem<'bar'>) => `${ctx.dataset.label}: ${ctx.parsed.y}%`,
          afterBody: (items: TooltipItem<'bar'>[]) => {
            if (items.length > 0) {
              const dataIndex = items[0].dataIndex;
              const dataPoint = data[dataIndex];
              const sources = dataPoint.sources || {};
              
              const lines = ['', 'Data Sources:'];
              Object.entries(sources).forEach(([source, count]) => {
                const emoji = source.toLowerCase().includes('reddit') ? '💬' : 
                             source.toLowerCase().includes('yahoo') ? '🌐' : 
                             source.toLowerCase().includes('finviz') ? '📈' : '📊';
                lines.push(`${emoji} ${source}: ${count} items`);
              });
              
              // Add sentiment strength indicator
              const sentiment = dataPoint.bullish - dataPoint.bearish;
              if (Math.abs(sentiment) > 30) {
                lines.push('', sentiment > 0 ? '🚀 Strong Bullish Signal' : '📉 Strong Bearish Signal');
              } else if (Math.abs(sentiment) > 15) {
                lines.push('', sentiment > 0 ? '📈 Moderate Bullish' : '📉 Moderate Bearish');
              }
              
              return lines;
            }
            return [];
          }
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        border: {
          color: isLight ? '#a8a29e' : '#374151',
        },
        grid: {
          color: isLight ? '#d6d3d1' : '#27272a',
        },
        ticks: {
          color: isLight ? '#78716c' : '#6b7280',
          maxRotation: hourly && data.length > 16 ? 45 : 0,
          minRotation: hourly && data.length > 16 ? 45 : 0,
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        max: 100,
        border: {
          color: isLight ? '#a8a29e' : '#374151',
        },
        grid: {
          color: isLight ? '#d6d3d1' : '#27272a',
        },
        ticks: {
          callback: (value: string | number) => `${value}%`,
          color: isLight ? '#78716c' : '#6b7280',
        },
      },
    },
  };

  // Helper functions for sentiment indicators
  const getSentimentIcon = () => {
    switch (marketInsights.trend) {
      case 'strong_bullish': return <TrendingUp className="text-green-500" size={16} />;
      case 'bullish': return <TrendingUp className="text-green-400" size={16} />;
      case 'strong_bearish': return <TrendingDown className="text-red-500" size={16} />;
      case 'bearish': return <TrendingDown className="text-red-400" size={16} />;
      default: return <Activity className="text-amber-500" size={16} />;
    }
  };

  const getRiskIcon = () => {
    switch (marketInsights.riskLevel) {
      case 'low': return <Shield className="text-green-500" size={14} />;
      case 'moderate': return <Shield className="text-amber-500" size={14} />;
      case 'elevated': return <AlertTriangle className="text-orange-500" size={14} />;
      case 'high': return <AlertTriangle className="text-red-500" size={14} />;
      default: return <Shield className="text-gray-500" size={14} />;
    }
  };

  const getDataQualityIcon = () => {
    switch (marketInsights.dataQuality) {
      case 'excellent': return <CheckCircle2 className="text-green-500" size={14} />;
      case 'good': return <CheckCircle2 className="text-green-400" size={14} />;
      case 'moderate': return <Database className="text-amber-500" size={14} />;
      default: return <Database className="text-red-500" size={14} />;
    }
  };

  const getMomentumIcon = () => {
    switch (marketInsights.momentum) {
      case 'accelerating_bullish': return <ArrowUp className="text-green-500" size={14} />;
      case 'accelerating_bearish': return <ArrowDown className="text-red-500" size={14} />;
      case 'improving': return <ArrowUp className="text-green-400" size={14} />;
      case 'declining': return <ArrowDown className="text-red-400" size={14} />;
      default: return <Minus className="text-amber-500" size={14} />;
    }
  };

  const getMomentumText = () => {
    switch (marketInsights.momentum) {
      case 'accelerating_bullish': return 'Accelerating';
      case 'accelerating_bearish': return 'Declining Fast';
      case 'improving': return 'Improving';
      case 'declining': return 'Weakening';
      default: return 'Stable';
    }
  };

  const getMomentumColor = () => {
    switch (marketInsights.momentum) {
      case 'accelerating_bullish': return 'text-green-500';
      case 'accelerating_bearish': return 'text-red-500';
      case 'improving': return 'text-green-400';
      case 'declining': return 'text-red-400';
      default: return 'text-amber-500';
    }
  };

  // Helper function to explain data quality factors
  const getDataQualityExplanation = () => {
    const avgDataPoints = marketInsights.totalDataPoints / Math.max(1, data.length);
    const activeSourceCount = Object.values(sourcePercentages).filter(pct => pct > 0).length;
    
    const explanations: Record<'excellent' | 'good' | 'moderate' | 'low', string> = {
      excellent: `Outstanding data coverage with ${Math.round(avgDataPoints)} avg data points per period across ${activeSourceCount} sources. High confidence in sentiment accuracy.`,
      good: `Solid data coverage with ${Math.round(avgDataPoints)} avg data points per period across ${activeSourceCount} sources. Good confidence in sentiment trends.`,
      moderate: `Adequate data coverage with ${Math.round(avgDataPoints)} avg data points per period across ${activeSourceCount} sources. Moderate confidence - consider supplemental analysis.`,
      low: `Limited data coverage with ${Math.round(avgDataPoints)} avg data points per period across ${activeSourceCount} sources. Lower confidence - use with caution.`
    };
    
    return explanations[marketInsights.dataQuality as keyof typeof explanations] || explanations.low;
  };

  // Helper function to explain confidence percentage
  const getConfidenceExplanation = () => {
    const confidence = marketInsights.confidence;
    if (confidence >= 90) return "Very high confidence based on abundant data from multiple sources";
    if (confidence >= 70) return "High confidence with good data coverage";
    if (confidence >= 50) return "Moderate confidence - adequate data available";
    if (confidence >= 30) return "Lower confidence due to limited data";
    return "Low confidence - sparse data coverage";
  };

  // Helper function to get descriptive data quality text
  const getDataQualityDescriptiveText = () => {
    const confidence = marketInsights.confidence;
    const activeSourceCount = Object.values(sourcePercentages).filter(pct => pct > 0).length;
    
    if (marketInsights.dataQuality === 'excellent') {
      return `Excellent Coverage - ${activeSourceCount} Sources`;
    } else if (marketInsights.dataQuality === 'good') {
      return `High Confidence - ${activeSourceCount} Sources`;
    } else if (marketInsights.dataQuality === 'moderate') {
      return `Moderate Coverage - ${activeSourceCount} Sources`;
    } else {
      return `Limited Data - ${activeSourceCount} Source${activeSourceCount !== 1 ? 's' : ''}`;
    }
  };

  // Helper function to get market sentiment context
  const getSentimentContext = () => {
    const score = marketInsights.sentimentScore;
    const absScore = Math.abs(score);
    
    if (absScore >= 60) {
      return 'Extreme Reading';
    } else if (absScore >= 35) {
      return 'Unusual Spike';
    } else if (absScore >= 20) {
      return 'Strong Signal';
    } else if (absScore >= 10) {
      return 'Moderate Trend';
    } else {
      return 'Normal Fluctuation';
    }
  };

  // Only show the no data message if we're not loading and the data is empty
  const showNoDataMessage = !isLoading && (!data || data.length === 0);

  return (
    <div className="w-full">
      {/* Enhanced Market Insights Panel */}
      {!showNoDataMessage && !isLoading && (
        <div className={`mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs`}>
          {/* Overall Sentiment */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${isLight ? 'bg-stone-100' : 'bg-gray-800'} border ${isLight ? 'border-stone-200' : 'border-gray-700'}`}>
            <div>
              <div className={`font-medium ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>Market Sentiment</div>
              <div className={`font-bold text-sm ${
                marketInsights.sentimentScore > 15 ? 'text-green-600' :
                marketInsights.sentimentScore < -15 ? 'text-red-600' : 'text-amber-600'
              }`}>
                {marketInsights.sentimentScore > 0 ? '+' : ''}{marketInsights.sentimentScore}, {getSentimentContext()}
              </div>
            </div>
            {getSentimentIcon()}
          </div>

          {/* Data Quality */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${isLight ? 'bg-stone-100' : 'bg-gray-800'} border ${isLight ? 'border-stone-200' : 'border-gray-700'}`}>
            <div>
              <div className={`font-medium ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>Data Quality</div>
              <div className={`font-bold text-sm ${
                marketInsights.dataQuality === 'excellent' ? 'text-green-600' :
                marketInsights.dataQuality === 'good' ? 'text-green-500' :
                marketInsights.dataQuality === 'moderate' ? 'text-amber-600' : 'text-red-600'
              }`}>
                {getDataQualityDescriptiveText()}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {getDataQualityIcon()}
              <div className={`text-xs ${isLight ? 'text-stone-500' : 'text-gray-500'}`}>
                {marketInsights.confidence}%
              </div>
            </div>
          </div>

          {/* Momentum */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${isLight ? 'bg-stone-100' : 'bg-gray-800'} border ${isLight ? 'border-stone-200' : 'border-gray-700'}`}>
            <div>
              <div className={`font-medium ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>Momentum</div>
              <div className={`font-bold text-sm ${getMomentumColor()}`}>
                {getMomentumText()}
              </div>
            </div>
            {getMomentumIcon()}
          </div>

          {/* Risk Level */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${isLight ? 'bg-stone-100' : 'bg-gray-800'} border ${isLight ? 'border-stone-200' : 'border-gray-700'}`}>
            <div>
              <div className={`font-medium ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>Risk Level</div>
              <div className={`font-bold text-sm ${
                marketInsights.riskLevel === 'low' ? 'text-green-600' :
                marketInsights.riskLevel === 'moderate' ? 'text-amber-600' :
                marketInsights.riskLevel === 'elevated' ? 'text-orange-600' : 'text-red-600'
              }`}>
                {marketInsights.riskLevel.charAt(0).toUpperCase() + marketInsights.riskLevel.slice(1)}
              </div>
            </div>
            {getRiskIcon()}
          </div>
        </div>
      )}

      {/* Extreme Readings Alert */}
      {!showNoDataMessage && !isLoading && marketInsights.extremeReadings && (
        <div className={`mb-4 p-3 rounded-lg border-l-4 ${isLight ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-amber-900/20 border-amber-500 text-amber-200'}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span className="font-medium">Extreme Sentiment Reading Detected</span>
          </div>
          <div className="text-xs mt-1">
            Current sentiment levels are unusually high. Consider contrarian opportunities or increased volatility.
          </div>
        </div>
      )}

      <div className="relative w-full" style={{ height: '300px' }}>
        {/* Only render chart if we have data */}
        {!showNoDataMessage && <Bar options={options} data={chartData} />}
        
        {/* No data message */}
        {showNoDataMessage && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center ${isLight ? 'bg-stone-300' : 'bg-gray-900'} rounded-lg p-6`}>
            <BarChart2 className={`${isLight ? 'text-stone-500' : 'text-gray-600'} mb-4`} size={32} />
            <p className={`text-center ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
              No chart data available for the selected time period
            </p>
          </div>
        )}
        
        {/* Loading overlay */}
        {isLoading && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center ${isLight ? 'bg-stone-300 bg-opacity-90' : 'bg-gray-900 bg-opacity-90'} rounded-lg p-6 z-10`}>
            <Loader2 className="text-blue-500 mb-4 animate-spin" size={32} />
            <div className="text-center mb-4">
              <h3 className={`text-lg font-medium ${isLight ? 'text-stone-800' : 'text-white'} mb-1`}>{loadingStage}</h3>
              <p className={`text-sm ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>Please wait while we process sentiment data...</p>
            </div>
            <div className="w-full max-w-sm mb-2">
              <ProgressBar progress={loadingProgress} />
            </div>
            <div className="text-xs text-blue-400">{loadingProgress}% complete</div>
          </div>
        )}
      </div>

      {/* Enhanced Footer with Source Distribution and Key Metrics */}
      <div className="mt-4 space-y-3">
        {/* Source Distribution */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className={`flex items-center space-x-1 rounded-full px-2 py-0.5 ${
              hasRedditAccess 
                ? 'bg-stone-100 dark:bg-gray-700' 
                : 'bg-gray-200 dark:bg-gray-800 opacity-50'
            }`}>
              <MessageSquare size={12} className={hasRedditAccess ? "text-orange-500" : "text-gray-400"} />
              <span className={hasRedditAccess ? "" : "text-gray-400"}>
                {sourcePercentages.reddit}%
              </span>
              {!hasRedditAccess && (
                <span className="text-xs text-gray-400" title="Pro feature">🔒</span>
              )}
            </span>
            <span className="flex items-center space-x-1 bg-stone-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
              <TrendingUp size={12} className="text-amber-500" />
              <span>{sourcePercentages.finviz}%</span>
            </span>
            <span className="flex items-center space-x-1 bg-stone-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
              <Globe size={12} className="text-blue-500" />
              <span>{sourcePercentages.yahoo}%</span>
            </span>
          </div>
          <span className={`text-xs ${isLight ? 'text-stone-500' : 'text-gray-400'}`}>
            {marketInsights.totalDataPoints.toLocaleString()} total data points
          </span>
        </div>

        {/* Key Insights Summary */}
        {!showNoDataMessage && !isLoading && (
          <div className={`text-xs ${isLight ? 'text-stone-600' : 'text-gray-400'} bg-stone-50 dark:bg-gray-800/50 rounded-lg p-3`}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span className="font-medium">Current: </span>
                <span>{marketInsights.avgBullish}% Bullish, {marketInsights.avgBearish}% Bearish</span>
              </div>
              <div>
                <span className="font-medium">Volatility: </span>
                <span>{marketInsights.volatility}% (Last Period)</span>
              </div>
              <div>
                <span className="font-medium">Updated: </span>
                <span>{new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SentimentChart;