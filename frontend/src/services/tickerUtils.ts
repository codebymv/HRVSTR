import { SentimentData } from '../types';

/**
 * Default popular tickers to use as fallbacks when API results lack diversity
 */
export const DEFAULT_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD', 
  'SPY', 'QQQ', 'INTC', 'JPM', 'V', 'DIS', 'NFLX', 'PYPL', 'ADBE', 
  'CSCO', 'CRM', 'CMCSA', 'PEP', 'AVGO', 'TXN', 'QCOM', 'COST'
];

/**
 * Ensure we have a diverse set of tickers for sentiment analysis
 * Function overloads to handle both string arrays and SentimentData arrays
 */
export function ensureTickerDiversity(tickers: string[], minCount?: number): string[];
export function ensureTickerDiversity(sentiments: SentimentData[], minCount?: number): SentimentData[];

/**
 * Implementation of ensureTickerDiversity
 * @param items - Tickers extracted from API results (either string[] or SentimentData[])
 * @param minCount - Minimum number of unique tickers desired
 * @returns A diverse array of tickers or sentiment data including fallbacks if needed
 */
export function ensureTickerDiversity(
  items: string[] | SentimentData[],
  minCount: number = 10
): string[] | SentimentData[] {  
  console.log('[TICKER_UTILS DEBUG] ensureTickerDiversity called with:', {
    length: items.length,
    firstItemType: items.length > 0 ? typeof items[0] : 'empty',
    firstItem: items.length > 0 ? items[0] : null,
    minCount
  });
  
  // Handle empty array case
  if (items.length === 0) {
    console.log('[TICKER_UTILS DEBUG] Empty array provided, returning default tickers');
    return DEFAULT_TICKERS.slice(0, minCount);
  }
  
  // If we have SentimentData[], extract the tickers and maintain a map for lookup
  if (items.length > 0 && typeof items[0] === 'object' && 'ticker' in items[0]) {
    console.log('[TICKER_UTILS DEBUG] Processing SentimentData array');
    const sentimentData = items as SentimentData[];
    
    // Check if this is real watchlist data (has actual scores/confidence) vs demo data
    const hasRealData = sentimentData.some(item => 
      (item.postCount && item.postCount > 0) || 
      (item.commentCount && item.commentCount > 0) || 
      (item.newsCount && item.newsCount > 0)
    );
    
    if (hasRealData) {
      // For real watchlist data, return only the actual data without padding
      console.log('[TICKER_UTILS DEBUG] Real watchlist data detected, returning without padding:', sentimentData.length);
      return sentimentData;
    }
    
    // For demo/empty data, continue with padding logic
    const tickerMap = new Map<string, SentimentData>();
    
    // Create a map of tickers to their SentimentData objects
    sentimentData.forEach(item => {
      tickerMap.set(item.ticker, item);
    });
    
    // Get unique ticker strings
    const uniqueTickers = Array.from(new Set(sentimentData.map(item => item.ticker)));
    
    // Ensure diversity with default tickers
    const diverseTickers = ensureDiverseTickerStrings(uniqueTickers, minCount);
    
    // Map back to SentimentData objects, creating default objects for any default tickers that were added
    const result = diverseTickers.map(ticker => {
      if (tickerMap.has(ticker)) {
        return tickerMap.get(ticker)!;
      } else {
        // Create a default SentimentData for added default tickers
        const defaultSentiment: SentimentData = {
          ticker,
          score: 0, // Neutral score
          sentiment: 'neutral',
          source: 'combined',
          timestamp: new Date().toISOString(),
          confidence: 50,
          postCount: 0,
          commentCount: 0
        };
        return defaultSentiment;
      }
    });
    
    console.log('[TICKER_UTILS DEBUG] Returning SentimentData array with padding:', result.length);
    return result;
  }
  
  // Handle simple string array case
  console.log('[TICKER_UTILS DEBUG] Processing string array');
  const result = ensureDiverseTickerStrings(items as string[], minCount);
  console.log('[TICKER_UTILS DEBUG] Returning string array:', result.length);
  return result;
}

/**
 * Helper function for the string array version of ensureTickerDiversity
 */
function ensureDiverseTickerStrings(
  tickers: string[],
  minCount: number = 10
): string[] {
  // Create a Set to remove duplicates
  const uniqueTickers = new Set(tickers);
  
  // If we already have enough unique tickers, return them (up to minCount)
  if (uniqueTickers.size >= minCount) {
    return Array.from(uniqueTickers).slice(0, minCount);
  }
  
  // Add default tickers until we reach minCount
  for (const ticker of DEFAULT_TICKERS) {
    if (uniqueTickers.size >= minCount) break;
    uniqueTickers.add(ticker);
  }
  
  return Array.from(uniqueTickers);
}

/**
 * Deduplicate sentiment results by ticker
 * For each ticker, keep only the most recent entry per source
 */
export function deduplicateSentiments(sentiments: SentimentData[]): SentimentData[] {
  // Group by ticker and source
  const grouped: Record<string, Record<string, SentimentData>> = {};
  
  // For each sentiment entry
  sentiments.forEach(s => {
    const key = `${s.ticker}`;
    const sourceKey = s.source;
    
    // Initialize the ticker group if needed
    if (!grouped[key]) {
      grouped[key] = {};
    }
    
    // Check if we already have an entry for this ticker+source
    if (!grouped[key][sourceKey] || 
        new Date(s.timestamp) > new Date(grouped[key][sourceKey].timestamp)) {
      // Keep this entry if it's the first one or more recent than existing
      grouped[key][sourceKey] = s;
    }
  });
  
  // Flatten the grouped results
  const result: SentimentData[] = [];
  Object.values(grouped).forEach(sourceGroup => {
    Object.values(sourceGroup).forEach(sentiment => {
      result.push(sentiment);
    });
  });
  
  return result;
}

/**
 * Sort sentiment data by score or recency
 */
export function sortSentimentData(
  data: SentimentData[], 
  sortBy: 'score' | 'recency' = 'score'
): SentimentData[] {
  if (sortBy === 'score') {
    // Sort by score descending (highest first)
    return [...data].sort((a, b) => b.score - a.score);
  } else {
    // Sort by timestamp descending (newest first)
    return [...data].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
}

/**
 * Get a diverse set of sentiment data by taking the top entries from each source
 * This prevents any single source from dominating the results
 */
export function getDiverseSentimentData(
  data: SentimentData[],
  maxPerTicker: number = 1,
  maxTotal: number = 10
): SentimentData[] {
  // First deduplicate to get a clean dataset
  const deduplicated = deduplicateSentiments(data);
  
  // Group by ticker
  const byTicker: Record<string, SentimentData[]> = {};
  deduplicated.forEach(item => {
    if (!byTicker[item.ticker]) {
      byTicker[item.ticker] = [];
    }
    byTicker[item.ticker].push(item);
  });
  
  // For each ticker, limit to maxPerTicker entries
  const limited: SentimentData[] = [];
  Object.values(byTicker).forEach(items => {
    // Sort the items for this ticker by score
    const sorted = sortSentimentData(items, 'score');
    // Take only the top maxPerTicker items
    limited.push(...sorted.slice(0, maxPerTicker));
  });
  
  // Finally, sort by score and take top maxTotal
  return sortSentimentData(limited, 'score').slice(0, maxTotal);
}
