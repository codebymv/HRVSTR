import React, { useState, useEffect } from 'react';
import { TimeRange } from '../../types';
import { EarningsEvent, EarningsAnalysis, fetchUpcomingEarnings, analyzeEarningsSurprise } from '../../services/earningsService';
import { RefreshCw, AlertTriangle, Info, ArrowUpDown, TrendingUp, TrendingDown, BarChart2, Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import ProgressBar from '../ProgressBar';

interface EarningsMonitorProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
}

const EarningsMonitor: React.FC<EarningsMonitorProps> = ({ onLoadingProgressChange }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
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
  
  const [timeRange, setTimeRange] = useState<TimeRange>('1m');
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
    setLoadingStage('Initializing earnings data...');
    if (onLoadingProgressChange) {
      onLoadingProgressChange(0, 'Initializing earnings data...');
    }
    
    // Total steps in loading process
    const totalSteps = 3;
    
    // Helper function to update progress
    const updateProgress = (step: number, stage: string) => {
      const progressPercentage = Math.round((step / totalSteps) * 100);
      console.log(`Loading progress: ${progressPercentage}%, Stage: ${stage}`);
      setLoadingProgress(progressPercentage);
      setLoadingStage(stage);
      
      // Propagate to parent component if callback exists
      if (onLoadingProgressChange) {
        onLoadingProgressChange(progressPercentage, stage);
      }
    };
    
    try {
      // Step 1: Initialize loading
      updateProgress(1, 'Fetching upcoming earnings...');
      const earnings = await fetchUpcomingEarnings(timeRange);
      
      // Step 2: Process data
      updateProgress(2, 'Processing earnings data...');
      setUpcomingEarnings(earnings);
      
      // Step 3: Complete loading
      updateProgress(3, 'Finalizing earnings display...');
      setLoading(prev => ({ ...prev, upcomingEarnings: false }));
    } catch (error) {
      console.error('Upcoming earnings error:', error);
      setErrors(prev => ({ 
        ...prev, 
        upcomingEarnings: error instanceof Error ? error.message : 'Failed to fetch upcoming earnings data' 
      }));
      setLoading(prev => ({ ...prev, upcomingEarnings: false }));
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
                <option value="1d">1 Day</option>
                <option value="1w">1 Week</option>
                <option value="1m">1 Month</option>
                <option value="3m">3 Months</option>
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
                  <table className={`w-full text-sm text-left ${textColor}`}>
                    <thead className={`text-xs ${subTextColor} uppercase ${tableHeaderBg}`}>
                      <tr>
                        <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('ticker')}>
                          <div className="flex items-center">
                            Ticker
                            {sortConfig.key === 'ticker' && (
                              <ArrowUpDown size={14} className="ml-1" />
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('reportDate')}>
                          <div className="flex items-center">
                            Report Date
                            {sortConfig.key === 'reportDate' && (
                              <ArrowUpDown size={14} className="ml-1" />
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('estEPS')}>
                          <div className="flex items-center">
                            Est. EPS
                            {sortConfig.key === 'estEPS' && (
                              <ArrowUpDown size={14} className="ml-1" />
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {sortedEarnings.map((earnings, index) => (
                        <tr 
                          key={`earnings-${earnings.ticker}-${index}`} 
                          className={`${hoverBg} ${selectedTicker === earnings.ticker ? selectedBg : ''} cursor-pointer transition-colors`}
                          onClick={() => {
                            setSelectedTicker(earnings.ticker);
                            loadAnalysis(earnings.ticker);
                          }}
                        >
                          <td className="px-4 py-3 font-medium">{earnings.ticker}</td>
                          <td className="px-4 py-3">
                            {earnings.reportDate ? 
                              new Date(earnings.reportDate).toLocaleDateString() : 
                              'TBA'}
                          </td>
                          <td className="px-4 py-3">
                            {typeof earnings.estEPS === 'number' 
                              ? `$${earnings.estEPS.toFixed(2)}` 
                              : typeof earnings.estimatedEPS === 'number' 
                                ? `$${earnings.estimatedEPS.toFixed(2)}` 
                                : `${earnings.estEPS || earnings.estimatedEPS || 'N/A'}`
                            }
                          </td>
                        </tr>
                      ))}
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
                        <span className="text-sm font-medium">Historical Pattern</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Beat Frequency:</span>
                          <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                            {earningsAnalysis.historicalPattern.beatFrequency.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Avg. Surprise:</span>
                          <span className={earningsAnalysis.historicalPattern.averageSurprise > 0 ? 'text-green-500' : 'text-red-500'}>
                            {earningsAnalysis.historicalPattern.averageSurprise > 0 ? '+' : ''}
                            {earningsAnalysis.historicalPattern.averageSurprise.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Consistency:</span>
                          <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                            {earningsAnalysis.historicalPattern.consistency.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Post-Earnings Drift:</span>
                          <span className={earningsAnalysis.historicalPattern.postEarningsDrift > 0 ? 'text-green-500' : 'text-red-500'}>
                            {earningsAnalysis.historicalPattern.postEarningsDrift > 0 ? '+' : ''}
                            {earningsAnalysis.historicalPattern.postEarningsDrift.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={`${analysisBg} rounded-lg p-4`}>
                      <div className="flex items-center space-x-2 mb-2">
                        {earningsAnalysis.direction === 'positive' ? (
                          <TrendingUp size={20} className="text-green-500" />
                        ) : (
                          <TrendingDown size={20} className="text-red-500" />
                        )}
                        <span className="text-sm font-medium">Latest Earnings</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Surprise:</span>
                          <span className={earningsAnalysis.surprisePercentage > 0 ? 'text-green-500' : 'text-red-500'}>
                            {earningsAnalysis.surprisePercentage > 0 ? '+' : ''}
                            {earningsAnalysis.surprisePercentage.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Magnitude:</span>
                          <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                            {earningsAnalysis.magnitude.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Market Reaction:</span>
                          <span className={earningsAnalysis.marketReaction.immediateReaction > 0 ? 'text-green-500' : 'text-red-500'}>
                            {earningsAnalysis.marketReaction.immediateReaction > 0 ? '+' : ''}
                            {earningsAnalysis.marketReaction.immediateReaction.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`${analysisBg} rounded-lg p-4`}>
                    <h3 className="text-sm font-medium mb-2">Post-Earnings Drift Prediction</h3>
                    <p className={`${isLight ? 'text-stone-800' : 'text-gray-200'} text-sm`}>
                      Based on historical patterns, {selectedTicker} typically experiences a{' '}
                      <span className={earningsAnalysis.historicalPattern.postEarningsDrift > 0 ? 'text-green-500' : 'text-red-500'}>
                        {earningsAnalysis.historicalPattern.postEarningsDrift > 0 ? 'positive' : 'negative'}{' '}
                        post-earnings drift of {Math.abs(earningsAnalysis.historicalPattern.postEarningsDrift).toFixed(2)}%
                      </span>
                      {' '}in the week following earnings.
                    </p>
                  </div>
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
