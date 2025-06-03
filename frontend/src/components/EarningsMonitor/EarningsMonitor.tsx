import React, { useState, useEffect } from 'react';
import { TimeRange } from '../../types';
import { EarningsEvent, EarningsAnalysis, analyzeEarningsSurprise, fetchUpcomingEarningsWithProgress, ProgressUpdate } from '../../services/earningsService';
import { RefreshCw, AlertTriangle, Info, TrendingUp, TrendingDown, BarChart2, Loader2, Crown, Lock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import ProgressBar from '../ProgressBar';
import TierLimitDialog from '../UI/TierLimitDialog';

interface EarningsMonitorProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
}

const EarningsMonitor: React.FC<EarningsMonitorProps> = ({ onLoadingProgressChange }) => {
  const { theme } = useTheme();
  const { tierInfo } = useTier();
  const { showTierLimitDialog, tierLimitDialog, closeTierLimitDialog } = useTierLimits();
  const isLight = theme === 'light';
  
  // Tier access logic - PURE TIER-BASED: Free users get earnings table, Pro+ get analysis
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  const hasAnalysisAccess = currentTier !== 'free'; // Pro+ feature
  
  // Theme specific styling
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const tableHeaderBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-300';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const hoverBg = isLight ? 'hover:bg-stone-200' : 'hover:bg-gray-800';
  const selectedBg = isLight ? 'bg-blue-100' : 'bg-blue-900/30';
  const analysisBg = isLight ? 'bg-stone-200' : 'bg-gray-800/90';
  
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');
  const [loading, setLoading] = useState({
    upcomingEarnings: false,
    analysis: false
  });
  
  // Helper function to check if data is stale (older than 30 minutes)
  const isDataStale = (timestamp: number | null): boolean => {
    if (!timestamp) return true;
    const thirtyMinutesInMs = 30 * 60 * 1000;
    return Date.now() - timestamp > thirtyMinutesInMs;
  };

  // Cached data state with localStorage persistence
  const [upcomingEarnings, setUpcomingEarnings] = useState<EarningsEvent[]>(() => {
    try {
      const cached = localStorage.getItem('earnings_upcomingEarnings');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.error('Error loading cached earnings:', e);
      return [];
    }
  });
  
  // Track the last fetch time
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(() => {
    try {
      const cached = localStorage.getItem('earnings_lastFetchTime');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.error('Error loading cached fetch time:', e);
      return null;
    }
  });
  
  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (upcomingEarnings.length > 0) {
      localStorage.setItem('earnings_upcomingEarnings', JSON.stringify(upcomingEarnings));
    }
  }, [upcomingEarnings]);
  
  // Save last fetch time to localStorage
  useEffect(() => {
    if (lastFetchTime) {
      localStorage.setItem('earnings_lastFetchTime', JSON.stringify(lastFetchTime));
    }
  }, [lastFetchTime]);
  
  // Calculate initial loading state based on cache freshness
  useEffect(() => {
    const hasData = upcomingEarnings.length > 0;
    const dataIsStale = isDataStale(lastFetchTime);
    const needsRefresh = !hasData || dataIsStale;
    
    // Set initial loading state based on cache freshness - earnings table is always available
    if (needsRefresh) {
      setLoading(prev => ({ ...prev, upcomingEarnings: true }));
    } else if (!needsRefresh) {
      setLoading(prev => ({ ...prev, upcomingEarnings: false }));
    }
  }, []); // Only run on mount
  
  // Progress tracking states for better UX
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...');
  const [errors, setErrors] = useState<{
    upcomingEarnings: string | null;
    analysis: string | null;
  }>({
    upcomingEarnings: null,
    analysis: null,
  });
  
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [earningsAnalysis, setEarningsAnalysis] = useState<EarningsAnalysis | null>(null);

  // Debug function to clear all earnings cache - available in browser console
  useEffect(() => {
    (window as any).clearEarningsCache = () => {
      localStorage.removeItem('earnings_upcomingEarnings');
      localStorage.removeItem('earnings_lastFetchTime');
      
      setUpcomingEarnings([]);
      setLastFetchTime(null);
      setErrors({ upcomingEarnings: null, analysis: null });
      setLoading({ upcomingEarnings: false, analysis: false });
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const sortEarnings = (earnings: EarningsEvent[]): EarningsEvent[] => {
    return [...earnings].sort((a, b) => {
      const dateA = a.reportDate ? new Date(a.reportDate).getTime() : 0;
      const dateB = b.reportDate ? new Date(b.reportDate).getTime() : 0;
      return dateA - dateB; // Sort by report date ascending
    });
  };

  const sortedEarnings = sortEarnings(upcomingEarnings);

  const loadData = async () => {
    // Earnings table is always available for all users
    setLoading(prev => ({ ...prev, upcomingEarnings: true }));
    setErrors(prev => ({ ...prev, upcomingEarnings: null }));
    
    try {
      const result = await fetchUpcomingEarningsWithProgress(timeRange, (update: ProgressUpdate) => {
        setLoadingProgress(update.percent);
        setLoadingStage(update.message);
        
        // Propagate to parent component if callback exists
        if (onLoadingProgressChange) {
          onLoadingProgressChange(update.percent, update.message);
        }
      });
      
      setUpcomingEarnings(result);
      setLastFetchTime(Date.now());
      setLoading(prev => ({ ...prev, upcomingEarnings: false }));
    } catch (error) {
      console.error('Earnings data loading error:', error);
      setErrors(prev => ({ 
        ...prev, 
        upcomingEarnings: error instanceof Error ? error.message : 'Failed to load earnings data' 
      }));
      setLoading(prev => ({ ...prev, upcomingEarnings: false }));
    }
  };

  const loadAnalysis = async (ticker: string) => {
    // Only load if earnings analysis is unlocked
    if (!hasAnalysisAccess) {
      return;
    }

    setLoading(prev => ({ ...prev, analysis: true }));
    setErrors(prev => ({ ...prev, analysis: null }));
    
    // Reset progress tracking for analysis
    setLoadingProgress?.(0);
    setLoadingStage?.(`Analyzing ${ticker} earnings...`);
    if (onLoadingProgressChange) {
      onLoadingProgressChange(0, `Analyzing ${ticker} earnings...`);
    }
    
    // Total steps in analysis loading process
    const totalSteps = 3;
    
    // Helper function to update progress
    const updateProgress = (step: number, stage: string) => {
      const progressPercentage = Math.round((step / totalSteps) * 100);
      setLoadingProgress?.(progressPercentage);
      setLoadingStage?.(stage);
      
      // Propagate to parent component if callback exists
      if (onLoadingProgressChange) {
        onLoadingProgressChange(progressPercentage, stage);
      }
    };
    
    try {
      // Step 1: Initialize analysis
      updateProgress(1, `Fetching historical data for ${ticker}...`);
      
      // Step 2: Perform analysis
      updateProgress(2, `Analyzing earnings surprises for ${ticker}...`);
      const analysis = await analyzeEarningsSurprise(ticker);
      
      // Step 3: Complete analysis
      updateProgress(3, `Finalizing ${ticker} earnings analysis...`);
      setEarningsAnalysis(analysis);
      setLoading(prev => ({ ...prev, analysis: false }));
    } catch (error) {
      console.error('Earnings analysis error:', error);
      setErrors(prev => ({ 
        ...prev, 
        analysis: error instanceof Error ? error.message : 'Failed to analyze earnings data' 
      }));
      setLoading(prev => ({ ...prev, analysis: false }));
    }
  };

  const refreshData = () => {
    loadData();
    
    if (selectedTicker && hasAnalysisAccess) {
      loadAnalysis(selectedTicker);
    }
  };

  const handleTimeRangeChange = (range: TimeRange) => {
    // Clear cached data when time range changes
    localStorage.removeItem('earnings_upcomingEarnings');
    localStorage.removeItem('earnings_lastFetchTime');
    
    // Reset state
    setUpcomingEarnings([]);
    setLastFetchTime(null);
    setEarningsAnalysis(null);
    setSelectedTicker(null);
    setErrors({ upcomingEarnings: null, analysis: null });
    
    // Update time range
    setTimeRange(range);
    
    // Trigger fresh data loading - earnings table is always available
    loadData();
  };

  // Handle ticker selection with tier restrictions
  const handleTickerClick = (ticker: string) => {
    setSelectedTicker(ticker);
    
    if (!hasAnalysisAccess) {
      // Show tier limit dialog for analysis
      showTierLimitDialog(
        'Earnings Analysis',
        'Detailed earnings analysis is a Pro feature. Upgrade to access comprehensive company analysis, financial metrics, and professional insights.',
        'Unlock advanced earnings analysis, sector information, trading ranges, and detailed financial insights with HRVSTR Pro.',
        'general'
      );
      return;
    }
    
    // Load analysis for Pro+ users
    loadAnalysis(ticker);
  };

  // Earnings Analysis Upgrade Card Component for free users
  const EarningsAnalysisUpgradeCard: React.FC = () => {
    const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
    const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
    const gradientFrom = isLight ? 'from-blue-500' : 'from-blue-600';
    const gradientTo = isLight ? 'to-purple-600' : 'to-purple-700';
    const buttonBg = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';
    
    return (
      <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} text-center h-full flex flex-col justify-center`}>
        <div className={`w-16 h-16 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Lock className="w-8 h-8 text-white" />
        </div>
        
        <h3 className={`text-xl font-bold ${textColor} mb-2`}>
          Earnings Analysis
        </h3>
        
        <p className={`${subTextColor} mb-4 max-w-md mx-auto`}>
          Access detailed company analysis including financial metrics, trading ranges, sector information, and professional earnings insights.
        </p>
        
        <div className={`${isLight ? 'bg-stone-200' : 'bg-gray-900'} rounded-lg p-4 mb-6`}>
          <h4 className={`font-semibold ${textColor} mb-2`}>Pro Features Include:</h4>
          <ul className={`text-sm ${subTextColor} space-y-1 text-left max-w-xs mx-auto`}>
            <li>• Detailed financial metrics</li>
            <li>• Company sector analysis</li>
            <li>• Trading range insights</li>
            <li>• Earnings surprise tracking</li>
            <li>• Professional analysis reports</li>
          </ul>
        </div>
        
        <button
          onClick={() => showTierLimitDialog(
            'Earnings Analysis',
            'Detailed earnings analysis is a Pro feature. Upgrade to access comprehensive company analysis, financial metrics, and professional insights.',
            'Unlock advanced earnings analysis, sector information, trading ranges, and detailed financial insights with HRVSTR Pro.',
            'general'
          )}
          className={`${buttonBg} text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center mx-auto`}
        >
          <Crown className="w-4 h-4 mr-2" />
          Upgrade to Pro
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className={`flex flex-row justify-between items-center gap-4 mb-4 ${cardBg} rounded-lg p-4 border ${cardBorder}`}>
          <div className="flex-1">
            <h1 className={`text-xl font-bold ${textColor}`}>Earnings Monitor</h1>
            <p className={`text-sm ${subTextColor}`}>Track upcoming earnings events and analysis</p>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Time range selector */}
            <select 
              value={timeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value as TimeRange)}
              className={`py-1 px-2 rounded text-sm ${cardBg} ${textColor} border ${cardBorder}`}
            >
              <option value="1d">Today</option>
              <option value="1w">This Week</option>
            </select>
            
            {/* Refresh button */}
            <button 
              onClick={refreshData}
              disabled={loading.upcomingEarnings || loading.analysis}
              className={`p-2 rounded-full transition-colors bg-blue-600 hover:bg-blue-700 text-white ${(loading.upcomingEarnings || loading.analysis) ? 'opacity-50' : ''}`}
              title="Refresh earnings data"
            >
              {(loading.upcomingEarnings || loading.analysis) ? (
                <Loader2 size={18} className="text-white animate-spin" />
              ) : (
                <RefreshCw size={18} className="text-white" />
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Earnings Table Column - Always available */}
          <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden`}>
            <div className={`p-4 border-b ${borderColor}`}>
              <h2 className={`text-lg font-semibold ${textColor}`}>Upcoming Earnings</h2>
            </div>
            <div className="p-4">
              {loading.upcomingEarnings ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Loader2 className="mb-3 text-blue-500 animate-spin" size={32} />
                  <p className={`text-lg font-semibold ${textColor} mb-2`}>{loadingStage}</p>
                  <div className="w-full max-w-sm mt-4 mb-2">
                    <ProgressBar progress={loadingProgress} />
                  </div>
                  <div className="text-xs text-blue-400">{loadingProgress}% complete</div>
                </div>
              ) : errors.upcomingEarnings ? (
                <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                  <AlertTriangle className="mb-2 text-yellow-500" size={32} />
                  <p>{errors.upcomingEarnings}</p>
                </div>
              ) : upcomingEarnings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className={`min-w-full ${textColor}`}>
                    <thead className={`${tableHeaderBg} ${borderColor}`}>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Ticker</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Company</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {sortedEarnings.filter((earnings) => {
                        // Final UI-level validation - filter out any invalid tickers
                        if (!earnings.ticker || typeof earnings.ticker !== 'string' || earnings.ticker.trim() === '') {
                          return false;
                        }
                        return true;
                      }).map((earnings, index) => {
                        // Defensive check for any remaining edge cases
                        if (!earnings.ticker || typeof earnings.ticker !== 'string' || earnings.ticker.trim() === '') {
                          // Skip rendering this item
                          return null;
                        }
                        
                        return (
                          <tr 
                            key={`earnings-${earnings.ticker}-${index}`} 
                            className={`${hoverBg} ${selectedTicker === earnings.ticker ? selectedBg : ''} cursor-pointer transition-colors`}
                            onClick={() => handleTickerClick(earnings.ticker)}
                          >
                            <td className="px-4 py-3 font-medium">{earnings.ticker}</td>
                            <td className="px-4 py-3">
                              {earnings.companyName || 'Unknown Company'}
                            </td>
                            <td className="px-4 py-3">
                              {earnings.reportDate ? 
                                new Date(earnings.reportDate).toLocaleDateString() : 
                                'TBA'}
                            </td>
                          </tr>
                        );
                      }).filter(Boolean)}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                  <Info className="mb-2" size={32} />
                  <p>No upcoming earnings found in the selected time range</p>
                </div>
              )}
            </div>
          </div>

          {/* Earnings Analysis Column - Pro+ only */}
          <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden`}>
            <div className={`p-4 border-b ${borderColor}`}>
              <h2 className={`text-lg font-semibold ${textColor}`}>
                {selectedTicker ? `${selectedTicker} Earnings Analysis` : 'Earnings Analysis'}
              </h2>
            </div>
            <div className="p-4">
              {hasAnalysisAccess ? (
                <>
                  {!selectedTicker ? (
                    <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                      <Info className="mb-2" size={32} />
                      <p>Select a ticker from the table to view earnings analysis</p>
                    </div>
                  ) : loading.analysis ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Loader2 className="mb-3 text-blue-500 animate-spin" size={32} />
                      <p className={`text-lg font-semibold ${textColor} mb-2`}>{loadingStage}</p>
                      <div className="w-full max-w-sm mt-4 mb-2">
                        <ProgressBar progress={loadingProgress} />
                      </div>
                      <div className="text-xs text-blue-400">{loadingProgress}% complete</div>
                    </div>
                  ) : errors.analysis ? (
                    <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                      <AlertTriangle className="mb-2 text-yellow-500" size={32} />
                      <p>{errors.analysis}</p>
                    </div>
                  ) : earningsAnalysis ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`${analysisBg} rounded-lg p-4`}>
                          <div className="flex items-center space-x-2 mb-2">
                            <BarChart2 size={20} className="text-blue-400" />
                            <span className="text-sm font-medium">Financial Metrics</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Current Price:</span>
                              <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                                {earningsAnalysis.currentPrice !== null 
                                  ? `$${earningsAnalysis.currentPrice.toFixed(2)}`
                                  : 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Price Change:</span>
                              <span className={
                                earningsAnalysis.priceChangePercent === null
                                  ? isLight ? 'text-stone-600' : 'text-gray-400'
                                  : earningsAnalysis.priceChangePercent > 0 
                                    ? 'text-green-500' 
                                    : 'text-red-500'
                              }>
                                {earningsAnalysis.priceChangePercent !== null
                                  ? `${earningsAnalysis.priceChangePercent > 0 ? '+' : ''}${earningsAnalysis.priceChangePercent.toFixed(2)}%`
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                      <Info className="mb-2" size={32} />
                      <p>Select a ticker to view earnings analysis</p>
                    </div>
                  )}
                </>
              ) : (
                <EarningsAnalysisUpgradeCard />
              )}
            </div>
          </div>
        </div>
      </div>

      <TierLimitDialog
        isOpen={tierLimitDialog.isOpen}
        onClose={closeTierLimitDialog}
        featureName={tierLimitDialog.featureName}
        message={tierLimitDialog.message}
        upgradeMessage={tierLimitDialog.upgradeMessage}
        currentTier={tierInfo?.tier || 'Free'}
        context={tierLimitDialog.context}
      />
    </>
  );
};

export default EarningsMonitor;