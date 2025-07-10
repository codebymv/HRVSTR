import React, { useState, useEffect } from 'react';
import { InstitutionalHolding, TimeRange } from '../../types';
import { fetchInstitutionalHoldingsWithUserCache } from '../../services/api';
import { AlertTriangle, Info, ArrowUpDown } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

interface InstitutionalHoldingsTabProps {
  timeRange: TimeRange;
  isLoading: boolean;
  onLoadingChange: (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => void;
  forceReload?: boolean;
  initialData?: any[];
  error?: string | null;
}

const InstitutionalHoldingsTab: React.FC<InstitutionalHoldingsTabProps> = ({
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
  
  // Component state
  const [institutionalHoldings, setInstitutionalHoldings] = useState<InstitutionalHolding[]>(initialData as InstitutionalHolding[]);
  const [error, setError] = useState<string | null>(propError);
  
  // If props change, update local state
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setInstitutionalHoldings(initialData as InstitutionalHolding[]);
    }
    if (propError !== undefined) {
      setError(propError);
    }
  }, [initialData, propError]);
  
  // Load data when component mounts or when explicitly requested
  // Using a ref to track if we've started loading to avoid repeat calls
  const isLoadingRef = React.useRef(false);
  const lastLoadParamsRef = React.useRef({ timeRange: timeRange, hasInitialLoad: false }); // Initialize with current timeRange
  
  useEffect(() => {
    // Simple parameter tracking - only care about timeRange changes
    const hasTimeRangeChanged = timeRange !== lastLoadParamsRef.current.timeRange;
    const hasNoData = initialData.length === 0;
    const hasNoInitialLoad = !lastLoadParamsRef.current.hasInitialLoad;
    
    console.log(`🔄 INSTITUTIONAL TAB: useEffect triggered`, {
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
      console.log('🔄 INSTITUTIONAL TAB: Load already in progress, skipping...');
      return;
    }

    // Don't retry if we have a credit error - user needs to get more credits
    if (error && (error.includes('credits') || error.includes('INSUFFICIENT_CREDITS'))) {
      console.log('🔄 INSTITUTIONAL TAB: Credit error detected, not retrying until user gets more credits');
      return;
    }

    // Determine if we should load data
    const shouldLoad = 
      (hasTimeRangeChanged && !isLoading) ||                    // Time range changed and not currently loading
      (hasNoInitialLoad && hasNoData && !isLoading) ||         // Initial load needed
      (forceReload && !isLoading);                              // Forced reload requested

    if (shouldLoad) {
      console.log('🔄 INSTITUTIONAL TAB: Conditions met, starting loading process');
      
      // Update tracking IMMEDIATELY to prevent retriggering
      lastLoadParamsRef.current = { timeRange, hasInitialLoad: true };
      
      // Start the loading process
      const needsRefresh = forceReload || hasTimeRangeChanged;
      loadData(needsRefresh);
    } else {
      console.log('🔄 INSTITUTIONAL TAB: No action taken', {
        reason: isLoading ? 'already loading' :
                isLoadingRef.current ? 'loading ref true' :
                !hasTimeRangeChanged && !forceReload && lastLoadParamsRef.current.hasInitialLoad ? 'no changes' :
                error ? 'has error' : 'unknown'
      });
    }
  }, [timeRange, forceReload]); // Removed isLoading, initialData.length, error from deps to prevent feedback loops
  
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'ascending' | 'descending';
  }>({
    key: 'filingDate',
    direction: 'descending'
  });
  
  // Helper function to remove any residual HTML markup from API strings
  const stripHtml = (input: string): string =>
    typeof input === 'string' ? input.replace(/<[^>]*>/g, '').trim() : input;
  
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
  
  // Filter function to exclude SEC administrative codes and non-tradeable identifiers
  const filterTradeableSecurities = (holdings: InstitutionalHolding[]): InstitutionalHolding[] => {
    // Safety check: ensure holdings is a valid array
    if (!holdings || !Array.isArray(holdings)) {
      console.warn('filterTradeableSecurities: received invalid holdings data:', holdings);
      return [];
    }
    
    console.log('🔍 FILTER: Starting tradeable securities filter with', holdings.length, 'holdings');
    
    const filtered = holdings.filter(holding => {
      const ticker = holding.ticker;
      if (!ticker || ticker === '-') {
        console.log('🔍 FILTER: Rejected - no ticker or dash:', ticker);
        return false;
      }
      
      // Filter out SEC administrative codes
      if (ticker.match(/^13[A-Z0-9]/)) {
        console.log('🔍 FILTER: Rejected - SEC identifier:', ticker);
        return false; // 13XXX SEC identifiers
      }
      if (ticker.match(/^[0-9]{5,}/)) {
        console.log('🔍 FILTER: Rejected - long numeric:', ticker);
        return false; // Long numeric codes (likely CUSIPs)
      }
      if (ticker.length > 5) {
        console.log('🔍 FILTER: Rejected - too long:', ticker);
        return false; // Overly long identifiers
      }
      
      // Keep only valid ticker-like symbols
      const cleaned = ticker.replace(/[)\/]/g, '').trim();
      const isValid = cleaned.match(/^[A-Z]{1,5}$/) || cleaned.match(/^[A-Z]+\.[A-Z]$/) || cleaned.match(/^\d{1,4}$/);
      
      if (!isValid) {
        console.log('🔍 FILTER: Rejected - invalid pattern:', ticker, 'cleaned:', cleaned);
      } else {
        console.log('🔍 FILTER: Accepted:', ticker);
      }
      
      return isValid;
    });
    
    console.log('🔍 FILTER: Filtered from', holdings.length, 'to', filtered.length, 'holdings');
    return filtered;
  };
  
  // Helper function to filter holdings by timeRange
  const filterHoldingsByTimeRange = (holdings: InstitutionalHolding[], range: TimeRange): InstitutionalHolding[] => {
    // Safety check: ensure holdings is a valid array
    if (!holdings || !Array.isArray(holdings)) {
      console.warn('filterHoldingsByTimeRange: received invalid holdings data:', holdings);
      return [];
    }
    
    if (holdings.length === 0) {
      console.log('🗓️ FILTERING: No holdings to filter');
      return holdings;
    }
    
    const now = new Date();
    let cutoffDate: Date;
    
    switch (range) {
      case '1w':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        break;
      case '1m':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        break;
      case '3m':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
        break;
      case '6m':
        cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); // 180 days ago
        break;
      default:
        return holdings; // Return all if unknown range
    }
    
    console.log(`🗓️ FILTERING: Filtering ${holdings.length} holdings for timeRange ${range}, cutoff: ${cutoffDate.toISOString()}`);
    
    const filtered = holdings.filter(holding => {
      const filingDate = new Date(holding.filingDate);
      return filingDate >= cutoffDate;
    });
    
    console.log(`🗓️ FILTERING: Filtered down to ${filtered.length} holdings within ${range} timeRange`);
    return filtered;
  };
  
  // Load data from API
  const loadData = async (refresh: boolean = false) => {
    // CRITICAL FIX: Check loading state and set it atomically
    if (isLoadingRef.current) {
      console.log('📋 INSTITUTIONAL TAB: Load already in progress, skipping...');
      return;
    }
    
    // CRITICAL FIX: Set loading state here, not in useEffect
    isLoadingRef.current = true;
    
    // Set up timeout to prevent infinite loading with proper cleanup
    const timeoutId = setTimeout(() => {
      if (isLoadingRef.current) {
        console.warn('📋 INSTITUTIONAL TAB: Loading timeout reached, resetting...');
        isLoadingRef.current = false;
        setError('Loading timeout - please try again');
        onLoadingChange(false, 0, 'Loading timeout', [], 'Loading timeout - please try again');
      }
    }, 45000); // Reduced to 45 seconds for better UX
    
    // Start with loading animation - especially important for initial fetch
    const updateProgress = (step: number, stage: string) => {
      console.log(`🔄 INSTITUTIONAL TAB: Institutional holdings loading progress: ${step}%, Stage: ${stage}`);
      onLoadingChange(true, step, stage, [], null);
    };
    
    try {
      // Show initial loading state with proper animation
      updateProgress(0, 'Initializing institutional holdings data...');
      
      // Add longer delay to ensure loading animation is visible
      await new Promise(resolve => setTimeout(resolve, 800));
      
      updateProgress(25, 'Fetching institutional holdings data...');
      
      // Add delay before API call to show the fetching stage
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const data = await fetchInstitutionalHoldingsWithUserCache(timeRange, refresh);
      
      if (!data || !Array.isArray(data)) {
        console.warn('📋 INSTITUTIONAL TAB: Invalid or missing institutional holdings data in response:', data);
        setError('Failed to load institutional holdings data');
        onLoadingChange(false, 0, 'Error loading institutional holdings', [], 'Invalid data received from server');
        return;
      }
      
      console.log('🔍 INSTITUTIONAL: Raw holdings from API:', data.length);
      if (data.length > 0) {
        console.log('🔍 INSTITUTIONAL: Sample raw holding:', data[0]);
      }
      
      updateProgress(50, 'Filtering holdings by time range...');
      
      // Add longer delay for UX during filtering
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const filteredHoldings = filterHoldingsByTimeRange(data, timeRange);
      console.log('🔍 INSTITUTIONAL: After time filtering:', filteredHoldings.length);
      
      const tradeableHoldings = filterTradeableSecurities(filteredHoldings);
      console.log('🔍 INSTITUTIONAL: After tradeable filtering:', tradeableHoldings.length);
      
      // Log some examples of what was filtered out
      if (filteredHoldings.length > tradeableHoldings.length) {
        const filtered = filteredHoldings.filter(h => !tradeableHoldings.includes(h));
        console.log('🔍 INSTITUTIONAL: Examples of filtered out holdings:', filtered.slice(0, 5).map(h => ({ ticker: h.ticker, institutionName: h.institutionName })));
      }
      
      console.log(`🔄 INSTITUTIONAL TAB: Filtered to ${tradeableHoldings.length} holdings for ${timeRange} range`);
      
      if (tradeableHoldings.length > 0) {
        console.log('🔄 INSTITUTIONAL TAB: Sample filtered institutional holding:', tradeableHoldings[0]);
      }
      
      updateProgress(75, 'Organizing holdings data...');
      
      // Add longer delay for organizing data
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateProgress(100, 'Finalizing institutional holdings display...');
      
      // Longer final delay to show completion
      await new Promise(resolve => setTimeout(resolve, 400));
      
      setInstitutionalHoldings(tradeableHoldings);
      setError(null);
      
      console.log(`🔄 INSTITUTIONAL TAB: Calling onLoadingChange with ${tradeableHoldings.length} filtered holdings`);
      onLoadingChange(false, 100, 'Institutional holdings loaded successfully', tradeableHoldings, null);
      
    } catch (error) {
      console.error('❌ INSTITUTIONAL TAB: Error in loadData:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch institutional holdings data';
      
      // Handle specific credit errors
      let finalErrorMessage = errorMessage;
      if (errorMessage.includes('credits') || errorMessage.includes('INSUFFICIENT_CREDITS')) {
        console.warn('❌ INSTITUTIONAL TAB: Credit error detected, user needs more credits');
        finalErrorMessage = 'You need 10 credits to access SEC filings data. Please upgrade your plan or wait for credits to refresh.';
      }
      
      setError(finalErrorMessage);
      onLoadingChange(false, 0, 'Error loading institutional holdings', [], finalErrorMessage);
    } finally {
      // Always ensure loading ref is reset in finally block
      isLoadingRef.current = false;
      
      // Clear timeout if it exists
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };
  
  // Sort holdings by the configured sort key
  const sortInstitutionalHoldings = (holdings: InstitutionalHolding[]): InstitutionalHolding[] => {
    // Safety check: ensure holdings is a valid array
    if (!holdings || !Array.isArray(holdings)) {
      console.warn('sortInstitutionalHoldings: received invalid holdings data:', holdings);
      return [];
    }
    
    return [...holdings].sort((a, b) => {
      switch (sortConfig.key) {
        case 'filingDate':
          const dateA = new Date(a.filingDate).getTime();
          const dateB = new Date(b.filingDate).getTime();
          return sortConfig.direction === 'ascending' ? dateA - dateB : dateB - dateA;
          
        case 'institution':
          const instA = a.institutionName || '';
          const instB = b.institutionName || '';
          return sortConfig.direction === 'ascending' 
            ? instA.localeCompare(instB)
            : instB.localeCompare(instA);
            
        case 'ticker':
          const tickerA = a.ticker || '';
          const tickerB = b.ticker || '';
          return sortConfig.direction === 'ascending' 
            ? tickerA.localeCompare(tickerB)
            : tickerB.localeCompare(tickerA);
            
        case 'value':
          const valueA = a.valueHeld || a.totalValueHeld || 0;
          const valueB = b.valueHeld || b.totalValueHeld || 0;
          return sortConfig.direction === 'ascending' ? valueA - valueB : valueB - valueA;
          
        case 'shares':
          const sharesA = a.sharesHeld || a.totalSharesHeld || 0;
          const sharesB = b.sharesHeld || b.totalSharesHeld || 0;
          return sortConfig.direction === 'ascending' ? sharesA - sharesB : sharesB - sharesA;
          
        case 'aum':
          // Calculate AUM for each institution
          const aumA = holdings
            .filter(h => h.institutionName === a.institutionName)
            .reduce((sum, h) => sum + (h.valueHeld || h.totalValueHeld || 0), 0);
          const aumB = holdings
            .filter(h => h.institutionName === b.institutionName)
            .reduce((sum, h) => sum + (h.valueHeld || h.totalValueHeld || 0), 0);
          return sortConfig.direction === 'ascending' ? aumA - aumB : aumB - aumA;
         
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
  
  // Filter out SEC administrative codes and then sort
  const filteredHoldings = filterTradeableSecurities(institutionalHoldings);
  const sortedHoldings = sortInstitutionalHoldings(filteredHoldings);
  
  return (
    <div className="space-y-4">
      {/* Main institutional holdings table */}
      <div className={`${cardBg} rounded-lg overflow-hidden border ${cardBorder}`}>
        <div className={`${headerBg} p-4`}>
          <h2 className={`text-lg font-semibold ${textColor}`}>Institutional Holdings</h2>
        </div>
        
        {error ? (
          <div className={`flex flex-col items-center justify-center p-10 ${errorTextColor} text-center`}>
            <AlertTriangle className="mb-2 text-yellow-500" size={32} />
            <p>{error}</p>
          </div>
        ) : (
          sortedHoldings.length === 0 ? (
            <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
              <Info className="mb-2" size={32} />
              <p>No institutional holdings found in the selected time range</p>
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
                    <th className={`p-3 text-left ${textColor}`} onClick={() => handleSort('institution')}>
                      <div className="flex items-center cursor-pointer">
                        <span>Institution</span>
                        {sortConfig.key === 'institution' && (
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
                    <th className={`p-3 text-right ${textColor}`} onClick={() => handleSort('shares')}>
                      <div className="flex items-center justify-end cursor-pointer">
                        <span>Shares</span>
                        {sortConfig.key === 'shares' && (
                          <ArrowUpDown size={14} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th className={`p-3 text-right ${textColor}`} onClick={() => handleSort('value')}>
                      <div className="flex items-center justify-end cursor-pointer">
                        <span>Value</span>
                        {sortConfig.key === 'value' && (
                          <ArrowUpDown size={14} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th className={`p-3 text-right ${textColor}`} onClick={() => handleSort('aum')}>
                      <div className="flex items-center justify-end cursor-pointer">
                        <span>Total AUM</span>
                        {sortConfig.key === 'aum' && (
                          <ArrowUpDown size={14} className="ml-1" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHoldings.map((holding, index) => {
                    // Process ticker for display
                    const tickerInfo = processTicker(holding.ticker);
                    
                    // Calculate total AUM for this institution (sum of all their holdings)
                    const institutionAUM = sortedHoldings
                      .filter(h => h.institutionName === holding.institutionName)
                      .reduce((sum, h) => sum + (h.valueHeld || h.totalValueHeld || 0), 0);
                    
                    // Format AUM value
                    const formatAUM = (value: number): string => {
                      if (value >= 1000000000) {
                        return `$${(value / 1000000000).toFixed(1)}B`;
                      } else if (value >= 1000000) {
                        return `$${(value / 1000000).toFixed(1)}M`;
                      } else if (value >= 1000) {
                        return `$${(value / 1000).toFixed(1)}K`;
                      }
                      return `$${value.toLocaleString()}`;
                    };
                    
                    return (
                      <tr 
                        key={holding.id || index} 
                        className={`${index % 2 === 0 ? `${cardBg}` : `${isLight ? 'bg-stone-200' : 'bg-gray-800'}`} hover:${isLight ? 'bg-stone-400/30' : 'bg-gray-700/30'}`}
                      >
                        <td className={`p-3 ${textColor}`}>
                          {new Date(holding.filingDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </td>
                        <td className={`p-3 ${textColor}`}>
                          {stripHtml(holding.institutionName)}
                        </td>
                        <td className={`p-3 font-medium ${tickerInfo.isValid ? textColor : errorTextColor}`}>
                          {tickerInfo.display}
                          {tickerInfo.isInvestmentFirm && (
                            <span className="ml-1 px-1 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">Fund</span>
                          )}
                        </td>
                        <td className={`p-3 text-right ${textColor}`}>
                          {typeof holding.sharesHeld === 'number' ? holding.sharesHeld.toLocaleString() : 
                           typeof holding.totalSharesHeld === 'number' ? holding.totalSharesHeld.toLocaleString() : '-'}
                        </td>
                        <td className={`p-3 text-right ${(holding.valueHeld || holding.totalValueHeld || 0) > 1000000 ? 'text-green-500 font-medium' : textColor}`}>
                          {typeof holding.valueHeld === 'number' ? `$${holding.valueHeld.toLocaleString()}` : 
                           typeof holding.totalValueHeld === 'number' ? `$${holding.totalValueHeld.toLocaleString()}` : '-'}
                        </td>
                        <td className={`p-3 text-right font-medium ${institutionAUM > 10000000 ? 'text-blue-500' : textColor}`}>
                          {institutionAUM > 0 ? formatAUM(institutionAUM) : '-'}
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
      
      {/* Holdings Summary */}
      <div className={`${cardBg} rounded-lg p-4 border ${cardBorder}`}>
        <h2 className={`text-lg font-semibold mb-4 ${textColor}`}>Holdings Analysis</h2>
        
        {error ? (
          <div className={`flex flex-col items-center justify-center p-10 ${errorTextColor} text-center`}>
            <AlertTriangle className="mb-2 text-yellow-500" size={32} />
            <p>Unable to analyze holdings patterns</p>
          </div>
        ) : sortedHoldings.length === 0 ? (
          <div className={`flex flex-col items-center justify-center p-6 ${errorTextColor} text-center`}>
            <Info className="mb-2" size={24} />
            <p>No holdings data available to analyze</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg bg-${isLight ? 'stone-400/50' : 'gray-800/70'}`}>
              <h3 className={`font-medium ${textColor} mb-2`}>Top Institutions by Value</h3>
              <div className="space-y-2">
                {getTopInstitutionsByValue(filteredHoldings).map((inst, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className={`${textColor}`}>{stripHtml(inst.name)}</span>
                    <span className={`${subTextColor}`}>${inst.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className={`p-4 rounded-lg bg-${isLight ? 'stone-400/50' : 'gray-800/70'}`}>
              <h3 className={`font-medium ${textColor} mb-2`}>Most Held Securities</h3>
              <div className="space-y-2">
                {getTopHeldSecurities(filteredHoldings).map((sec, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className={`${textColor}`}>{sec.ticker}</span>
                    <span className={`${subTextColor}`}>{sec.institutions} institutions</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to get top institutions by total value of holdings
const getTopInstitutionsByValue = (holdings: InstitutionalHolding[]) => {
  const institutionMap = new Map<string, number>();
  
  // Sum up the values for each institution
  holdings.forEach(holding => {
    if (!holding.institutionName) return;
    
    const institution = holding.institutionName;
    const value = holding.valueHeld || holding.totalValueHeld || 0;
    
    const currentTotal = institutionMap.get(institution) || 0;
    institutionMap.set(institution, currentTotal + value);
  });
  
  // Convert to array and sort by value
  const institutionArray = Array.from(institutionMap).map(([name, value]) => ({ name, value }));
  institutionArray.sort((a, b) => b.value - a.value);
  
  // Return top 5
  return institutionArray.slice(0, 5);
};

// Helper function to get most commonly held securities
const getTopHeldSecurities = (holdings: InstitutionalHolding[]) => {
  const securitiesMap = new Map<string, number>();
  
  // Count occurrences of each ticker
  holdings.forEach(holding => {
    if (!holding.ticker) return;
    
    const ticker = holding.ticker;
    const currentCount = securitiesMap.get(ticker) || 0;
    securitiesMap.set(ticker, currentCount + 1);
  });
  
  // Convert to array and sort by count
  const securitiesArray = Array.from(securitiesMap).map(([ticker, count]) => ({ ticker, institutions: count }));
  securitiesArray.sort((a, b) => b.institutions - a.institutions);
  
  // Return top 5
  return securitiesArray.slice(0, 5);
};

export default InstitutionalHoldingsTab;