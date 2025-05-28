import React, { useState, useEffect } from 'react';
import { InstitutionalHolding, TimeRange } from '../../types';
import { fetchInstitutionalHoldings } from '../../services/api';
import { AlertTriangle, Info, ArrowUpDown } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

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
  
  // Load data when component mounts or forceReload changes
  useEffect(() => {
    // If we have initialData and don't need to force reload, use the cache
    if (initialData && initialData.length > 0 && !forceReload) {
      console.log('Using cached institutional holdings data, no reload needed');
      return;
    }
    
    // Otherwise load fresh data with the forceReload flag
    console.log(`Loading fresh institutional holdings data with forceReload=${forceReload}`);
    // Only force an API refresh if forceReload is explicitly true
    const shouldRefresh = forceReload === true;
    loadData(shouldRefresh);
  }, [timeRange, forceReload, initialData.length]);
  
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
  
  // Load data from API
  const loadData = async (refresh: boolean = false) => {
    console.log(`Loading institutional holdings for time range: ${timeRange}, refresh: ${refresh}`);
    
    setError(null);
    onLoadingChange(true, 0, 'Initializing institutional holdings data...');
    
    // Total steps in loading process
    const totalSteps = 4;
    
    // Helper function to update progress
    const updateProgress = (step: number, stage: string) => {
      const progressPercentage = Math.round((step / totalSteps) * 100);
      console.log(`Institutional holdings loading progress: ${progressPercentage}%, Stage: ${stage}`);
      onLoadingChange(true, progressPercentage, stage);
    };
    
    try {
      // Step 1: Fetch institutional holdings with refresh parameter
      updateProgress(1, 'Fetching institutional holdings data...');
      const holdings = await fetchInstitutionalHoldings(timeRange, refresh);
      console.log(`Received ${holdings.length} institutional holdings from API`);
      
      // Log a sample holding to help with debugging
      if (holdings.length > 0) {
        console.log('Sample institutional holding:', JSON.stringify(holdings[0], null, 2));
      }
      
      // Step 2: Process data
      updateProgress(2, 'Processing institutional holdings data...');
      
      // Step 3: Update state with holdings
      updateProgress(3, 'Organizing holdings data...');
      setInstitutionalHoldings(holdings);
      
      // Step 4: Analyze for concentration patterns
      updateProgress(4, 'Finalizing institutional holdings display...');
      setTimeout(() => {
        onLoadingChange(false, 100, 'Institutional holdings loaded successfully', holdings, null);
      }, 300);
    } catch (error) {
      console.error('Institutional holdings error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch institutional holdings data';
      setError(errorMessage);
      onLoadingChange(false, 0, 'Error loading institutional holdings', [], errorMessage);
    }
  };
  
  // Sort holdings by the configured sort key
  const sortInstitutionalHoldings = (holdings: InstitutionalHolding[]): InstitutionalHolding[] => {
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
  const lastLoadParamsRef = React.useRef({ timeRange: '', forceReload: false });
  
  useEffect(() => {
    // Create a unique key for the current load parameters
    const currentParams = { timeRange, forceReload };
    const paramsChanged = JSON.stringify(currentParams) !== JSON.stringify(lastLoadParamsRef.current);
    
    // Only load if:
    // 1. We're supposed to be loading AND haven't started yet
    // 2. OR the parameters have changed (timeRange or forceReload)
    if ((isLoading && !isLoadingRef.current) || (paramsChanged && forceReload)) {
      // Mark that we've started the loading process
      isLoadingRef.current = true;
      lastLoadParamsRef.current = currentParams;
      
      // Determine if we should use cached data or fetch fresh
      const hasValidCache = initialData && initialData.length > 0 && !forceReload;
      
      if (hasValidCache) {
        console.log('Using cached institutional holdings data, no API call needed');
        // Notify parent that loading is complete
        onLoadingChange(false, 100, 'Institutional holdings loaded from cache', initialData, null);
      } else {
        console.log(`Loading fresh institutional holdings data: timeRange=${timeRange}, forceReload=${forceReload}`);
        loadData(forceReload);
      }
    } else if (!isLoading && !forceReload) {
      // Reset the ref when loading is complete
      isLoadingRef.current = false;
    }
  }, [timeRange, isLoading, forceReload, initialData.length, onLoadingChange]);
  
  const sortedHoldings = sortInstitutionalHoldings(institutionalHoldings);
  
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
                    <th className={`p-3 text-right ${textColor}`}>% of Portfolio</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHoldings.map((holding, index) => {
                    // Process ticker for display
                    const tickerInfo = processTicker(holding.ticker);
                    
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
                        <td className={`p-3 text-right ${textColor}`}>
                          {typeof holding.percentageOwnership === 'number' ? `${holding.percentageOwnership.toFixed(2)}%` : '-'}
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
                {getTopInstitutionsByValue(sortedHoldings).map((inst, idx) => (
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
                {getTopHeldSecurities(sortedHoldings).map((sec, idx) => (
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