import React, { useState, useEffect } from 'react';
import { TimeRange } from '../../types';
import { EarningsEvent, EarningsAnalysis, fetchUpcomingEarnings, analyzeEarningsSurprise, fetchUpcomingEarningsWithProgress, ProgressUpdate } from '../../services/earningsService';
import { RefreshCw, AlertTriangle, Info, ArrowUpDown, TrendingUp, TrendingDown, BarChart2, Loader2, Crown } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import ProgressBar from '../ProgressBar';

interface EarningsMonitorProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
}

const EarningsMonitor: React.FC<EarningsMonitorProps> = ({ onLoadingProgressChange }) => {
  const { theme } = useTheme();
  const { tierInfo } = useTier();
  const { showTierLimitDialog } = useTierLimits();
  const isLight = theme === 'light';
  
  // Tier checking
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  const hasProAccess = currentTier !== 'free';
  
  // Theme specific styling
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const tableHeaderBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-300'; // Improved contrast for dark mode
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const hoverBg = isLight ? 'hover:bg-stone-200' : 'hover:bg-gray-800';
  const selectedBg = isLight ? 'bg-blue-100' : 'bg-blue-900/30'; // Background for selected items
  const analysisBg = isLight ? 'bg-stone-200' : 'bg-gray-800/90'; // Lighter background in light mode for better contrast
  
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');
  const [loading, setLoading] = useState({
    upcomingEarnings: true,
    analysis: true
  });
  
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
  
  const [upcomingEarnings, setUpcomingEarnings] = useState<EarningsEvent[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [earningsAnalysis, setEarningsAnalysis] = useState<EarningsAnalysis | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'ascending' | 'descending';
  }>({
    key: 'reportDate',
    direction: 'ascending'
  });

  const loadData = async () => {
    setLoading({
      upcomingEarnings: true,
      analysis: true
    });
    
    setErrors({
      upcomingEarnings: null,
      analysis: null
    });
    
    // Reset progress tracking
    setLoadingProgress(0);
    setLoadingStage('Starting earnings scraping...');
    if (onLoadingProgressChange) {
      onLoadingProgressChange(0, 'Starting earnings scraping...');
    }
    
    try {
      // Use the new progress tracking system
      const earnings = await fetchUpcomingEarningsWithProgress(
        timeRange,
        (progress: ProgressUpdate) => {
          // Update progress with real-time information from backend
          setLoadingProgress(progress.percent);
          setLoadingStage(progress.message);
          
          if (onLoadingProgressChange) {
            onLoadingProgressChange(progress.percent, progress.message);
          }
          
          console.log(`📊 Real-time progress: ${progress.percent}% - ${progress.message}`);
          if (progress.currentDate) {
            console.log(`📅 Currently processing: ${progress.currentDate}`);
          }
        }
      );
      
      setUpcomingEarnings(earnings);
      setLoading(prev => ({ ...prev, upcomingEarnings: false }));
      
      // Final progress update
      setLoadingProgress(100);
      setLoadingStage(`Completed! Found ${earnings.length} earnings events`);
      if (onLoadingProgressChange) {
        onLoadingProgressChange(100, `Completed! Found ${earnings.length} earnings events`);
      }
      
    } catch (error) {
      console.error('Upcoming earnings error:', error);
      setErrors(prev => ({ 
        ...prev, 
        upcomingEarnings: error instanceof Error ? error.message : 'Failed to fetch upcoming earnings data' 
      }));
      setLoading(prev => ({ ...prev, upcomingEarnings: false }));
      
      // Error progress update
      setLoadingProgress(0);
      setLoadingStage('Failed to load earnings data');
      if (onLoadingProgressChange) {
        onLoadingProgressChange(0, 'Failed to load earnings data');
      }
    }
  };

  const loadAnalysis = async (ticker: string) => {
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
      console.log(`Analysis loading progress: ${progressPercentage}%, Stage: ${stage}`);
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
    if (selectedTicker) {
      loadAnalysis(selectedTicker);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const handleSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    
    setSortConfig({ key, direction });
  };

  const sortEarnings = (earnings: EarningsEvent[]): EarningsEvent[] => {
    if (!sortConfig.key) {
      return earnings;
    }

    return [...earnings].sort((a, b) => {
      if (sortConfig.key === 'reportDate') {
        const aDate = new Date(a[sortConfig.key]).getTime();
        const bDate = new Date(b[sortConfig.key]).getTime();
        return sortConfig.direction === 'ascending' ? aDate - bDate : bDate - aDate;
      }

      const aValue = a[sortConfig.key as keyof EarningsEvent];
      const bValue = b[sortConfig.key as keyof EarningsEvent];
      
      if (aValue === undefined || bValue === undefined) {
        if (aValue === undefined && bValue === undefined) return 0;
        if (aValue === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
  };

  const sortedEarnings = React.useMemo(() => {
    return sortEarnings(upcomingEarnings);
  }, [upcomingEarnings, sortConfig]);

  // Pro Upgrade Card Component for Advanced Earnings Analysis
  const EarningsProUpgradeCard: React.FC = () => {
    const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
    const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
    const gradientFrom = isLight ? 'from-blue-500' : 'from-blue-600';
    const gradientTo = isLight ? 'to-purple-600' : 'to-purple-700';
    const buttonBg = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

    return (
      <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} text-center`}>
        <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${gradientFrom} ${gradientTo} flex items-center justify-center mx-auto mb-4`}>
          <Crown className="w-6 h-6 text-white" />
        </div>
        <h3 className={`text-lg font-semibold ${textColor} mb-2`}>Advanced Earnings Analysis</h3>
        <p className={`${subTextColor} text-sm mb-6`}>
          Unlock detailed company information, trading ranges, risk analysis, and professional-grade earnings insights.
        </p>
        
        <div className={`${isLight ? 'bg-stone-200' : 'bg-gray-700'} rounded-lg p-4 mb-6`}>
          <h4 className={`text-sm font-medium ${textColor} mb-2`}>Pro Features Include:</h4>
          <div className={`text-xs ${subTextColor} space-y-1 text-left`}>
            <div>• Sector & Industry Analysis</div>
            <div>• Daily & 52-Week Trading Ranges</div>
            <div>• Risk Level Assessment</div>
            <div>• Analysis Score & Ratings</div>
            <div>• Enhanced EPS Data</div>
          </div>
        </div>
        
        <button
          onClick={() => showTierLimitDialog(
            'Advanced Earnings Analysis',
            'Advanced earnings analysis including company information, trading ranges, and risk assessment is a Pro feature. Upgrade to access detailed financial insights.',
            'Unlock comprehensive earnings analysis, risk scoring, and professional trading insights with HRVSTR Pro.',
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
    <div className={`p-6 ${textColor}`}>
      <div className={`${cardBg} rounded-lg p-4 border ${cardBorder}`}>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold">Earnings Monitor</h1>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className={`text-sm ${subTextColor}`}>Time Range:</span>
              <select 
                className={`${isLight ? 'bg-stone-200 border-stone-400' : 'bg-gray-800 border-gray-700'} border rounded px-3 py-1.5 text-sm ${textColor}`}
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              >
                <option value="1d">Today</option>
                <option value="1w">This Week</option>
              </select>
            </div>
            <button 
              onClick={refreshData}
              className={`${isLight ? 'bg-blue-500' : 'bg-blue-600'} hover:${isLight ? 'bg-blue-600' : 'bg-blue-700'} rounded-full p-2 transition-colors`}
              title="Refresh Data"
            >
              <RefreshCw size={18} className="text-white" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      {sortedEarnings
                        .filter((earnings, index) => {
                          // Final UI-level validation - filter out any invalid tickers
                          if (!earnings.ticker || typeof earnings.ticker !== 'string' || earnings.ticker.trim() === '') {
                            console.error('🚨 UI FILTER: Removing invalid ticker from render:', {
                              index,
                              earnings,
                              ticker: earnings.ticker,
                              type: typeof earnings.ticker
                            });
                            return false;
                          }
                          return true;
                        })
                        .map((earnings, index) => {
                        // Defensive logging for any remaining edge cases
                        if (!earnings.ticker || typeof earnings.ticker !== 'string' || earnings.ticker.trim() === '') {
                          console.error('🚨 RENDERING ITEM WITH INVALID TICKER:', {
                            index,
                            earnings,
                            ticker: earnings.ticker,
                            type: typeof earnings.ticker
                          });
                          // Skip rendering this item
                          return null;
                        }
                        
                        return (
                          <tr 
                            key={`earnings-${earnings.ticker}-${index}`} 
                            className={`${hoverBg} ${selectedTicker === earnings.ticker ? selectedBg : ''} cursor-pointer transition-colors`}
                            onClick={() => {
                              // Validate ticker before processing
                              if (earnings.ticker && typeof earnings.ticker === 'string' && earnings.ticker.trim() !== '') {
                                setSelectedTicker(earnings.ticker);
                                loadAnalysis(earnings.ticker);
                              } else {
                                console.warn('Invalid ticker symbol:', earnings.ticker);
                              }
                            }}
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
                      }).filter(Boolean)} {/* Remove any null entries */}
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

          <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden`}>
            <div className={`p-4 border-b ${borderColor}`}>
              <h2 className={`text-lg font-semibold ${textColor}`}>
                {selectedTicker ? `${selectedTicker} Earnings Analysis` : 'Select a Ticker'}
              </h2>
            </div>
            <div className="p-4">
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
                        <div className="flex justify-between">
                          <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Market Cap:</span>
                          <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                            {earningsAnalysis.marketCap !== null
                              ? `$${(earningsAnalysis.marketCap / 1e9).toFixed(2)}B`
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>P/E Ratio:</span>
                          <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                            {earningsAnalysis.pe !== null
                              ? earningsAnalysis.pe.toFixed(1)
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {hasProAccess ? (
                      <div className={`${analysisBg} rounded-lg p-4`}>
                        <div className="flex items-center space-x-2 mb-2">
                          {earningsAnalysis.priceChangePercent && earningsAnalysis.priceChangePercent > 0 ? (
                            <TrendingUp size={20} className="text-green-500" />
                          ) : (
                            <TrendingDown size={20} className="text-red-500" />
                          )}
                          <span className="text-sm font-medium">Company & Trading Info</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Sector:</span>
                            <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                              {earningsAnalysis.sector || 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Day Range:</span>
                            <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                              {earningsAnalysis.dayLow !== null && earningsAnalysis.dayHigh !== null
                                ? `$${earningsAnalysis.dayLow.toFixed(2)} - $${earningsAnalysis.dayHigh.toFixed(2)}`
                                : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>52W Range:</span>
                            <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                              {earningsAnalysis.yearLow !== null && earningsAnalysis.yearHigh !== null
                                ? `$${earningsAnalysis.yearLow.toFixed(2)} - $${earningsAnalysis.yearHigh.toFixed(2)}`
                                : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>EPS:</span>
                            <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                              {earningsAnalysis.eps !== null
                                ? `$${earningsAnalysis.eps.toFixed(2)}`
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <EarningsProUpgradeCard />
                    )}
                  </div>

                  {hasProAccess && (
                    <div className={`${analysisBg} rounded-lg p-4`}>
                      <h3 className="text-sm font-medium mb-2">Analysis Summary</h3>
                      <p className={`${isLight ? 'text-stone-800' : 'text-gray-200'} text-sm`}>
                        {earningsAnalysis.companyName} ({earningsAnalysis.sector}) 
                        {earningsAnalysis.analysisScore !== undefined && earningsAnalysis.riskLevel ? (
                          <>
                            {' '}has an analysis score of <span className="text-blue-500 font-medium">{earningsAnalysis.analysisScore}</span>
                            {' '}with a <span className={
                              earningsAnalysis.riskLevel === 'High' ? 'text-red-500' :
                              earningsAnalysis.riskLevel === 'Medium' ? 'text-yellow-500' : 'text-green-500'
                            }>{earningsAnalysis.riskLevel}</span> risk level.
                          </>
                        ) : ''}
                        {earningsAnalysis.dataLimitations && earningsAnalysis.dataLimitations.length > 0 && (
                          <>
                            {' '}
                            <span className={isLight ? 'text-stone-600' : 'text-gray-400'}>
                              Note: {earningsAnalysis.dataLimitations.join(', ')}.
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                  <Info className="mb-2" size={32} />
                  <p>Select a ticker to view earnings analysis</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EarningsMonitor;
