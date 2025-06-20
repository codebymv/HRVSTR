import React, { useState, useEffect } from 'react';
import { InsiderTrade, TimeRange } from '../../types';
import { fetchInsiderTradesWithUserCache, streamInsiderTradesWithUserCache } from '../../services/api';
import { AlertTriangle, Info, ArrowUpDown } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

interface InsiderTradesTabProps {
  timeRange: TimeRange;
  isLoading: boolean;
  onLoadingChange: (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => void;
  forceReload?: boolean;
  initialData?: any[];
  error?: string | null;
}

const InsiderTradesTab: React.FC<InsiderTradesTabProps> = ({
  timeRange,
  isLoading,
  onLoadingChange,
  forceReload = false,
  initialData = [],
  error: propError = null
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme specific styling
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const headerBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const errorTextColor = isLight ? 'text-stone-600' : 'text-gray-500';
  // Define alertBg for alerts and warnings
  const alertBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  
  // Component state
  const [insiderTrades, setInsiderTrades] = useState<InsiderTrade[]>(initialData as InsiderTrade[]);
  const [error, setError] = useState<string | null>(propError);
  
  // If props change, update local state
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setInsiderTrades(initialData as InsiderTrade[]);
    }
    if (propError !== undefined) {
      setError(propError);
    }
  }, [initialData, propError]);
  
  // Load data based on timeRange, forceReload, and initialData
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'ascending' | 'descending';
  }>({
    key: 'filingDate',
    direction: 'descending'
  });
  
  // State for abnormal activity detection
  const [abnormalActivities, setAbnormalActivities] = useState<{
    clusterBuying: InsiderTrade[][];
    largeTransactions: InsiderTrade[];
    priceDipBuying: InsiderTrade[];
  }>({ 
    clusterBuying: [], 
    largeTransactions: [],
    priceDipBuying: []
  });

  // Helper function to remove any residual HTML markup from API strings
  const stripHtml = (input: string): string =>
    typeof input === 'string' ? input.replace(/<[^>]*>/g, '').trim() : input;
    
  // Helper to clean SEC filing titles by removing prefix and cleaning up
  const cleanTitle = (title: string): string => {
    if (!title) return 'Executive';
    
    // First remove HTML
    let clean = stripHtml(title);
    
    // Remove the "4-" prefix that appears in all titles
    clean = clean.replace(/^4\s*-\s*/, '');
    
    return clean;
  };
  
  // Further clean insider names that incorrectly contain filing metadata
  const sanitizeInsiderName = (raw: string): string => {
    if (!raw) return 'Unknown Executive';
    
    // First, check if the raw string is an HTML fragment with metadata
    if (raw.startsWith('</b>')) {
      // This is a case where we're getting the trailing part of an HTML fragment
      // Extract the actual name from the SEC filing data
      const secFilingMatch = raw.match(/Reporting Person:\s*([^\n(]+)/i);
      if (secFilingMatch && secFilingMatch[1]) {
        return secFilingMatch[1].trim();
      }
      
      // If we can't find a reporting person, try to extract issuer name
      const issuerMatch = raw.match(/Issuer:\s*([^\n(]+)/i);
      if (issuerMatch && issuerMatch[1]) {
        return `${issuerMatch[1].trim()} Executive`;
      }
      
      // If we still don't have a name, return a placeholder
      return 'SEC Filing Executive';
    }
    
    // Remove HTML tags first
    let clean = stripHtml(raw);
    
    // If string contains AccNo metadata, chop off at AccNo:
    if (clean.includes('AccNo:')) {
      clean = clean.split('AccNo:')[0].trim();
    }
    
    // Remove leading dates (e.g., 2025-05-05)
    clean = clean.replace(/^\d{4}-\d{2}-\d{2}\s*/, '').trim();
    
    // Remove trailing Size info if still present
    if (clean.includes('Size:')) {
      clean = clean.split('Size:')[0].trim();
    }
    
    // Extract the actual name from the filing data if possible
    // Format is often: "Reporting Person: [Name]"
    const reportingPersonMatch = clean.match(/Reporting Person:\s*([^\n(]+)/i);
    if (reportingPersonMatch && reportingPersonMatch[1]) {
      clean = reportingPersonMatch[1].trim();
    }
    
    // Check for Form 4 filing patterns
    const form4Match = clean.match(/Form 4\s+(.+)/i);
    if (form4Match && form4Match[1]) {
      clean = form4Match[1].trim();
    }
    
    // Check for "filed by" pattern
    const filedByMatch = clean.match(/filed by\s+(.+)/i);
    if (filedByMatch && filedByMatch[1]) {
      clean = filedByMatch[1].trim();
    }
    
    // Remove any remaining HTML tags
    clean = clean.replace(/<[^>]*>/g, '');
    
    // Remove common suffixes
    clean = clean.replace(/\s+(Jr\.?|Sr\.?|III|IV|II|I)$/i, '');
    
    // Remove any trailing punctuation
    clean = clean.replace(/[.,;:\s]+$/, '');
    
    // If we still have nothing useful, return a generic label
    if (!clean || clean.length === 0 || clean === 'Executive') {
      return 'Insider (Name Not Available)';
    }
    
    return clean;
  };
  
  // Function to sanitize and validate ticker symbols
  const processTicker = (rawTicker: string) => {
    if (!rawTicker || rawTicker === '-') {
      return { display: '-', isValid: false, original: rawTicker };
    }

    // Remove common trailing characters and HTML then trim
    let clean = stripHtml(rawTicker)
      .replace(/[)\/]/g, '') // remove ) and /
      .trim();

    // Sometimes the ticker is embedded within other words (e.g., "XYZ - Executive").
    // Extract first contiguous 1–5 uppercase letters at string start
    const match = clean.match(/^[A-Z]{1,5}/);
    if (match) {
      clean = match[0];
    }

    // Standard ticker format (1-5 uppercase letters or 1-4 digits)
    const isStandardTicker = /^[A-Z]{1,5}$/.test(clean) || /^\d{1,4}$/.test(clean);
    
    // Allow special case for investment managers with generated tickers
    const isInvestmentManagerTicker = /^[A-Z]{2,4}[A-Z]{2,3}$/.test(clean);
    
    // Accept more variations for institutional investors
    const isValid = isStandardTicker || isInvestmentManagerTicker;

    // For investment managers, add a small badge but still consider valid
    const isInvestmentFirm = isInvestmentManagerTicker && !isStandardTicker;

    // Fallback: if still invalid, just show raw cleaned string
    return {
      display: clean || '-',
      isValid,
      isInvestmentFirm,
      original: rawTicker
    };
  };
  
  // Helper function to filter trades by timeRange
  const filterTradesByTimeRange = (trades: InsiderTrade[], range: TimeRange): InsiderTrade[] => {
    // Safety check: ensure trades is a valid array
    if (!trades || !Array.isArray(trades)) {
      console.warn('filterTradesByTimeRange: received invalid trades data:', trades);
      return [];
    }
    
    if (trades.length === 0) {
      console.log('🗓️ FILTERING: No trades to filter');
      return trades;
    }
    
    // Backend already filters by time range, so we don't need to filter again
    // This prevents double-filtering that can exclude valid trades
    console.log(`🗓️ FILTERING: Returning all ${trades.length} trades from backend (already filtered by timeRange ${range})`);
    
    // DEBUG: Log sample dates from the data
    if (trades.length > 0) {
      const sampleTrade = trades[0];
      console.log(`🗓️ FRONTEND DEBUG: Sample trade date data:`, {
        filingDate: sampleTrade.filingDate,
        filingDateType: typeof sampleTrade.filingDate,
        transactionDate: sampleTrade.transactionDate,
        parsedFilingDate: new Date(sampleTrade.filingDate).toISOString(),
        formattedForDisplay: new Date(sampleTrade.filingDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      });
      
      // Log first 3 trades' dates
      trades.slice(0, 3).forEach((trade, index) => {
        console.log(`🗓️ FRONTEND Trade ${index + 1} dates:`, {
          ticker: trade.ticker,
          filingDate: trade.filingDate,
          formatted: new Date(trade.filingDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        });
      });
    }
    
    return trades;
  };

  // Load data from API
  const loadData = async (refresh: boolean = false) => {
    console.log(`🔄 INSIDER TAB: Loading insider trades for time range: ${timeRange}, refresh: ${refresh}`);
    
    // CRITICAL FIX: Set loading ref immediately to prevent duplicate calls
    if (isLoadingRef.current) {
      console.log('🔄 INSIDER TAB: Already loading, skipping duplicate call');
      return;
    }
    
    isLoadingRef.current = true;
    setError(null);
    onLoadingChange(true, 0, 'Initializing insider trades data...');
    
    try {
      // If refresh is requested, use streaming API for real-time progress
      if (refresh) {
        console.log('🌊 INSIDER TAB: Using streaming API for real-time progress updates');
        
        let streamCompleted = false;
        
        // Set up SSE stream for real-time progress using user cache system
        const eventSource = streamInsiderTradesWithUserCache(
          timeRange,
          true, // refresh = true
          // Progress callback
          (progressData) => {
            console.log('🌊 INSIDER TAB: Stream progress:', progressData);
            // Don't update loading if stream has already completed
            if (!streamCompleted) {
              onLoadingChange(true, progressData.progress, progressData.stage);
            }
          },
          // Complete callback
          (data) => {
            console.log('🌊 INSIDER TAB: Stream completed with data:', data);
            streamCompleted = true;
            isLoadingRef.current = false; // Reset loading ref on completion
            
            const allTrades = data.insiderTrades || [];
            // Apply frontend timeRange filtering
            const filteredTrades = filterTradesByTimeRange(allTrades, timeRange);
            setInsiderTrades(filteredTrades);
            
            // Analyze for abnormal activity
            if (filteredTrades.length > 0) {
              detectAbnormalActivity(filteredTrades);
            }
            
            console.log(`🌊 INSIDER TAB: Calling onLoadingChange with ${filteredTrades.length} filtered trades`);
            onLoadingChange(false, 100, 'Insider trades loaded successfully', filteredTrades, null);
          },
          // Error callback
          (error) => {
            console.error('🌊 INSIDER TAB: Stream error:', error);
            streamCompleted = true;
            isLoadingRef.current = false; // Reset loading ref on error
            
            // Extract user-friendly error message from error object or string
            let errorMessage: string;
            if (typeof error === 'string') {
              errorMessage = error;
            } else if (error && typeof error === 'object') {
              errorMessage = (error as any).userMessage || (error as any).message || 'Failed to load insider trades data';
            } else {
              errorMessage = 'Failed to load insider trades data';
            }
            
            // Handle specific credit errors
            if (errorMessage.includes('credits') || errorMessage.includes('INSUFFICIENT_CREDITS')) {
              console.warn('🌊 INSIDER TAB: Credit error detected, user needs more credits');
              errorMessage = 'You need 10 credits to access SEC filings data. Please upgrade your plan or wait for credits to refresh.';
            }
            
            setError(errorMessage);
            onLoadingChange(false, 0, 'Error loading insider trades', [], errorMessage);
          }
        );
        
        // Set up a timeout to ensure the stream doesn't hang indefinitely
        const streamTimeout = setTimeout(() => {
          if (!streamCompleted) {
            console.warn('🌊 INSIDER TAB: Stream timeout reached, closing SSE connection');
            streamCompleted = true;
            eventSource.close();
            isLoadingRef.current = false;
          }
        }, 60000); // 60 second timeout
        
        // Clean up function
        return () => {
          clearTimeout(streamTimeout);
          if (!streamCompleted) {
            eventSource.close();
            isLoadingRef.current = false;
          }
        };
      } else {
        // Use regular API for non-refresh requests
        console.log('📡 INSIDER TAB: Using regular API for non-refresh request');
        
        // Helper function to update progress
        const updateProgress = (step: number, stage: string) => {
          console.log(`📡 INSIDER TAB: Insider trades loading progress: ${step}%, Stage: ${stage}`);
          onLoadingChange(true, step, stage);
        };

        // Show initial loading state with proper animation
        updateProgress(0, 'Initializing insider trades data...');
        
        // Add longer delay to ensure loading animation is visible
        await new Promise(resolve => setTimeout(resolve, 800));

        // Step 1: Fetch insider trades with refresh parameter
        updateProgress(25, 'Fetching insider trades data...');
        
        // Add delay before API call to show the fetching stage
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const allTrades = await fetchInsiderTradesWithUserCache(timeRange, refresh);
        
        if (!allTrades || !Array.isArray(allTrades)) {
          console.warn('📡 INSIDER TAB: Invalid or missing insider trades data in response:', allTrades);
          setError('Failed to load insider trades data');
          onLoadingChange(false, 0, 'Error loading insider trades', [], 'Invalid data received from server');
          return;
        }
        
        console.log(`📡 INSIDER TAB: Received ${allTrades.length} insider trades from API`);
        
        // Step 2: Apply frontend timeRange filtering
        updateProgress(50, 'Filtering trades by time range...');
        
        // Add longer delay for UX during filtering
        await new Promise(resolve => setTimeout(resolve, 600));
        
        const filteredTrades = filterTradesByTimeRange(allTrades, timeRange);
        console.log(`📡 INSIDER TAB: Filtered to ${filteredTrades.length} trades for ${timeRange} range`);
        
        // Log a sample trade to help with debugging
        if (filteredTrades.length > 0) {
          console.log('📡 INSIDER TAB: Sample filtered insider trade:', JSON.stringify(filteredTrades[0], null, 2));
        }
        
        // Update state with filtered trades
        setInsiderTrades(filteredTrades);

        // Step 3: Analyze insider trades for abnormal activity if we have data
        updateProgress(75, 'Analyzing insider trading patterns...');
        
        // Add longer delay for analysis
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (filteredTrades.length > 0) {
          detectAbnormalActivity(filteredTrades);
        } else {
          console.warn('📡 INSIDER TAB: No insider trades data available for analysis after filtering');
        }
        
        // Final steps
        updateProgress(100, 'Finalizing insider trades display...');
        
        // Longer final delay to show completion
        await new Promise(resolve => setTimeout(resolve, 400));
        
        console.log(`📡 INSIDER TAB: Calling onLoadingChange with ${filteredTrades.length} filtered trades (regular API)`);
        onLoadingChange(false, 100, 'Insider trades loaded successfully', filteredTrades, null);
      }
    } catch (error) {
      console.error('❌ INSIDER TAB: Insider trades error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch insider trades data';
      
      // Handle specific credit errors
      let finalErrorMessage = errorMessage;
      if (errorMessage.includes('credits') || errorMessage.includes('INSUFFICIENT_CREDITS')) {
        console.warn('❌ INSIDER TAB: Credit error detected, user needs more credits');
        finalErrorMessage = 'You need 10 credits to access SEC filings data. Please upgrade your plan or wait for credits to refresh.';
      }
      
      setError(finalErrorMessage);
      onLoadingChange(false, 0, 'Error loading insider trades', [], finalErrorMessage);
    } finally {
      // Always ensure loading ref is reset
      isLoadingRef.current = false;
    }
  };
  
  // Detect abnormal insider trading activity
  const detectAbnormalActivity = (trades: InsiderTrade[]) => {
    // Group trades by ticker to identify cluster buying
    const tickerGroups: Record<string, InsiderTrade[]> = {};
    const largeTransactions: InsiderTrade[] = [];
    const priceDipBuying: InsiderTrade[] = [];
    
    // Process each trade
    trades.forEach(trade => {
      // Skip invalid trades
      if (!trade.ticker || !trade.insiderName || !trade.shares || !trade.value) return;
      
      // Group by ticker for cluster analysis
      if (!tickerGroups[trade.ticker]) {
        tickerGroups[trade.ticker] = [];
      }
      tickerGroups[trade.ticker].push(trade);
      
      // Check for large transactions (over $500,000)
      if (trade.value > 500000) {
        largeTransactions.push(trade);
      }
      
      // Check for suspected price dip buying
      // This is a simplistic check - in a real app, you'd compare to actual price data
      if (trade.value > 300000 && trade.shares > 10000) {
        priceDipBuying.push(trade);
      }
    });
    
    // Identify cluster buying (multiple insiders buying the same stock)
    const clusterBuying: InsiderTrade[][] = [];
    
    Object.keys(tickerGroups).forEach(ticker => {
      const tickerTrades = tickerGroups[ticker];
      
      // If we have multiple insider transactions for the same ticker and they're purchases
      if (tickerTrades.length >= 2) {
        // Count unique insiders
        const uniqueInsiders = new Set(tickerTrades.map(t => t.insiderName));
        
        // If we have at least 2 different insiders buying
        if (uniqueInsiders.size >= 2) {
          clusterBuying.push(tickerTrades);
        }
      }
    });
    
    // Sort large transactions by value
    largeTransactions.sort((a, b) => b.value - a.value);
    
    // Update state with detected abnormal activity
    setAbnormalActivities({
      clusterBuying,
      largeTransactions,
      priceDipBuying
    });
  };
  
  // Sort trades by the configured sort key
  const sortInsiderTrades = (trades: InsiderTrade[]): InsiderTrade[] => {
    // Safety check: ensure trades is a valid array
    if (!trades || !Array.isArray(trades)) {
      console.warn('sortInsiderTrades: received invalid trades data:', trades);
      return [];
    }
    
    return [...trades].sort((a, b) => {
      switch (sortConfig.key) {
        case 'filingDate':
          const dateA = new Date(a.filingDate).getTime();
          const dateB = new Date(b.filingDate).getTime();
          return sortConfig.direction === 'ascending' ? dateA - dateB : dateB - dateA;
          
        case 'ticker':
          const tickerA = a.ticker || '';
          const tickerB = b.ticker || '';
          return sortConfig.direction === 'ascending' 
            ? tickerA.localeCompare(tickerB)
            : tickerB.localeCompare(tickerA);
            
        case 'value':
          const valueA = a.value || 0;
          const valueB = b.value || 0;
          return sortConfig.direction === 'ascending' ? valueA - valueB : valueB - valueA;
          
        default:
          return 0;
      }
    });
  };
  
  // Handle sorting when column headers are clicked
  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: 
        sortConfig.key === key && sortConfig.direction === 'ascending' 
          ? 'descending' 
          : 'ascending'
    });
  };
  
  // Load data when component mounts or when explicitly requested
  // Using a ref to track if we've started loading to avoid repeat calls
  const isLoadingRef = React.useRef(false);
  const lastLoadParamsRef = React.useRef({ timeRange: timeRange, hasInitialLoad: false }); // Initialize with current timeRange
  
  useEffect(() => {
    // Simple parameter tracking - only care about timeRange changes
    const hasTimeRangeChanged = timeRange !== lastLoadParamsRef.current.timeRange;
    const hasNoData = initialData.length === 0;
    const hasNoInitialLoad = !lastLoadParamsRef.current.hasInitialLoad;
    
    console.log(`🔄 INSIDER TAB: useEffect triggered`, {
      isLoading,
      isLoadingRef: isLoadingRef.current,
      hasTimeRangeChanged,
      forceReload,
      timeRange,
      lastTimeRange: lastLoadParamsRef.current.timeRange,
      hasNoData,
      hasNoInitialLoad,
      error
    });

    // Don't load if already loading
    if (isLoadingRef.current) {
      console.log('🔄 INSIDER TAB: Load already in progress, skipping...');
      return;
    }

    // Don't retry if we have a credit error - user needs to get more credits
    if (error && (error.includes('credits') || error.includes('INSUFFICIENT_CREDITS'))) {
      console.log('🔄 INSIDER TAB: Credit error detected, not retrying until user gets more credits');
      return;
    }

    // Determine if we should load data
    const shouldLoad = 
      (hasTimeRangeChanged && !isLoading) ||                    // Time range changed and not currently loading
      (hasNoInitialLoad && hasNoData && !isLoading) ||         // Initial load needed
      (forceReload && !isLoading);                              // Forced reload requested

    if (shouldLoad) {
      console.log('🔄 INSIDER TAB: Conditions met, starting loading process');
      
      // Update tracking IMMEDIATELY to prevent retriggering
      lastLoadParamsRef.current = { timeRange, hasInitialLoad: true };
      
      // Start the loading process
      const needsRefresh = forceReload || hasTimeRangeChanged;
      loadData(needsRefresh);
    } else {
      console.log('🔄 INSIDER TAB: No action taken', {
        reason: isLoading ? 'already loading' :
                isLoadingRef.current ? 'loading ref true' :
                !hasTimeRangeChanged && !forceReload && lastLoadParamsRef.current.hasInitialLoad ? 'no changes' :
                error ? 'has error' : 'unknown'
      });
    }
  }, [timeRange, forceReload]); // Removed isLoading, initialData.length, error from deps to prevent feedback loops
  
  const sortedTrades = sortInsiderTrades(insiderTrades);
  
  return (
    <div className="space-y-4">
      {/* Main insider trades table */}
      <div className={`${cardBg} rounded-lg overflow-hidden border ${cardBorder}`}>
        <div className={`${headerBg} p-4`}>
          <h2 className={`text-lg font-semibold ${textColor}`}>Recent Insider Transactions</h2>
        </div>
        
        {error ? (
          <div className={`flex flex-col items-center justify-center p-10 ${errorTextColor} text-center`}>
            <AlertTriangle className="mb-2 text-yellow-500" size={32} />
            <p>{error}</p>
          </div>
        ) : (
          sortedTrades.length === 0 ? (
            <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
              <Info className="mb-2" size={32} />
              <p>No insider transactions found in the selected time range</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${headerBg}`}>
                  <tr>
                    <th className={`p-3 text-left ${textColor}`} onClick={() => handleSort('filingDate')}>
                      <div className="flex items-center cursor-pointer">
                        <span>Date</span>
                        {sortConfig.key === 'filingDate' && (
                          <ArrowUpDown size={14} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th className={`p-3 text-left ${textColor}`} onClick={() => handleSort('ticker')}>
                      <div className="flex items-center cursor-pointer">
                        <span>Ticker</span>
                        {sortConfig.key === 'ticker' && (
                          <ArrowUpDown size={14} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th className={`p-3 text-left ${textColor}`}>Insider</th>
                    <th className={`p-3 text-left ${textColor}`}>Title</th>
                    <th className={`p-3 text-right ${textColor}`}>Shares</th>
                    <th className={`p-3 text-right ${textColor}`} onClick={() => handleSort('value')}>
                      <div className="flex items-center justify-end cursor-pointer">
                        <span>Value</span>
                        {sortConfig.key === 'value' && (
                          <ArrowUpDown size={14} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th className={`p-3 text-right ${textColor}`}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTrades.map((trade, index) => {
                    // Process ticker for display
                    const tickerInfo = processTicker(trade.ticker);
                    
                    return (
                      <tr 
                        key={trade.id || index} 
                        className={`${index % 2 === 0 ? `${cardBg}` : `${isLight ? 'bg-stone-200' : 'bg-gray-800'}`} hover:${isLight ? 'bg-stone-400/30' : 'bg-gray-700/30'}`}
                      >
                        <td className={`p-3 ${textColor}`}>
                          {new Date(trade.filingDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </td>
                        <td className={`p-3 font-medium ${tickerInfo.isValid ? textColor : errorTextColor}`}>
                          {tickerInfo.display}
                          {tickerInfo.isInvestmentFirm && (
                            <span className="ml-1 px-1 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">Fund</span>
                          )}
                        </td>
                        <td className={`p-3 ${textColor}`}>
                          {sanitizeInsiderName(trade.insiderName)}
                        </td>
                        <td className={`p-3 ${subTextColor} text-sm`}>
                          {cleanTitle(trade.title)}
                        </td>
                        <td className={`p-3 text-right ${textColor}`}>
                          {typeof trade.shares === 'number' ? trade.shares.toLocaleString() : '-'}
                        </td>
                        <td className={`p-3 text-right ${trade.value > 500000 ? 'text-green-500 font-medium' : textColor}`}>
                          {typeof trade.value === 'number' ? `$${trade.value.toLocaleString()}` : '-'}
                        </td>
                        <td className={`p-3 text-right ${textColor}`}>
                          {typeof trade.price === 'number' && !isNaN(trade.price) ? `$${trade.price.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
      
      {/* Abnormal Activity Summary */}
      <div className={`${cardBg} rounded-lg p-4 border ${cardBorder}`}>
        <h2 className={`text-lg font-semibold mb-4 ${textColor}`}>Unusual Insider Activity</h2>
        {error ? (
          <div className={`flex flex-col items-center justify-center p-10 ${errorTextColor} text-center`}>
            <AlertTriangle className="mb-2 text-yellow-500" size={32} />
            <p>Unable to analyze unusual activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {abnormalActivities.largeTransactions.length > 0 || abnormalActivities.clusterBuying.length > 0 ? (
              <>
                {abnormalActivities.largeTransactions.map((trade, index) => (
                  <div key={trade.id} className={`p-4 ${alertBg} rounded-lg ${index === 0 ? `border ${isLight ? 'border-green-600/50' : 'border-green-600/50'}` : ''}`}>
                    <p className={`${index === 0 ? 'text-green-500' : textColor} font-medium`}>
                      {trade.ticker}: Large insider purchase worth ${trade.value.toLocaleString()}
                    </p>
                    <p className={`text-sm ${subTextColor} mt-1`}>
                      {sanitizeInsiderName(trade.insiderName)} ({cleanTitle(trade.title)}) purchased {trade.shares.toLocaleString()} shares
                    </p>
                  </div>
                ))}
                
                {abnormalActivities.clusterBuying.length > 1 && (
                  <div className={`p-4 ${alertBg} rounded-lg`}>
                    <p className={`${textColor}`}>
                      Multiple companies showing cluster buying patterns
                    </p>
                    <p className={`text-sm ${subTextColor} mt-1`}>
                      {abnormalActivities.clusterBuying.length} companies with multiple insider purchases
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className={`flex flex-col items-center justify-center p-6 ${errorTextColor} text-center`}>
                <Info className="mb-2" size={24} />
                <p>No abnormal activity detected in the selected time range</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Price Dip Alerts */}
      <div className={`${cardBg} rounded-lg p-4 border ${cardBorder}`}>
        <h2 className={`text-lg font-semibold mb-4 ${textColor}`}>Price Dip Alerts</h2>
        {error ? (
          <div className={`flex flex-col items-center justify-center p-10 ${errorTextColor} text-center`}>
            <AlertTriangle className="mb-2 text-yellow-500" size={32} />
            <p>Unable to analyze price dip patterns</p>
          </div>
        ) : (
          <div className="space-y-4">
            {abnormalActivities.priceDipBuying.length > 0 ? (
              <>
                {abnormalActivities.priceDipBuying.map((trade, index) => (
                  <div key={trade.id} className={`p-4 ${alertBg} rounded-lg ${index === 0 ? `border ${isLight ? 'border-green-600/50' : 'border-green-600/50'}` : ''}`}>
                    <p className={`${index === 0 ? 'text-green-500' : textColor} font-medium`}>
                      {trade.ticker}: Insider buying worth ${trade.value.toLocaleString()}
                    </p>
                    <p className={`text-sm ${subTextColor} mt-1`}>
                      {sanitizeInsiderName(trade.insiderName)} ({cleanTitle(trade.title)}) purchased {trade.shares.toLocaleString()} shares at {typeof trade.price === 'number' && !isNaN(trade.price) ? `$${trade.price.toFixed(2)}` : '-'}
                    </p>
                  </div>
                ))}
                
                <div className={`p-4 ${alertBg} rounded-lg`}>
                  <p className={`${textColor}`}>Monitoring stocks with recent price drops</p>
                  <p className={`text-sm ${subTextColor} mt-1`}>
                    Looking for insider buying opportunities in stocks with recent declines
                  </p>
                </div>
              </>
            ) : (
              <div className={`flex flex-col items-center justify-center p-6 ${errorTextColor} text-center`}>
                <Info className="mb-2" size={24} />
                <p>No price dip alerts in the selected time range</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InsiderTradesTab;