import { SentimentData } from '../../types';
import { TimeRange, buildApiUrl, handleApiResponse } from '../shared/apiUtils';
import { fetchSentimentData as fetchRedditSentiment } from './redditSentimentApi';

/**
 * Fetch market sentiment from Yahoo Finance
 */
export const fetchYahooMarketSentiment = async (timeRange: TimeRange = '1w', signal?: AbortSignal): Promise<SentimentData[]> => {
  try {
    console.log(`[YAHOO SENTIMENT DEBUG] Starting fetchYahooMarketSentiment for timeRange: ${timeRange}`);
    
    const url = buildApiUrl(`/api/sentiment/yahoo/market?timeRange=${timeRange}`);
    console.log(`[YAHOO SENTIMENT DEBUG] Making request to: ${url}`);
    
    const response = await fetch(url, { signal });
    const data = await handleApiResponse(response);
    
    console.log(`[YAHOO SENTIMENT DEBUG] Response data:`, data);
    
    // Check if sentimentData exists and is an array
    if (!data || !data.sentimentData || !Array.isArray(data.sentimentData)) {
      console.warn('[YAHOO SENTIMENT WARNING] Unexpected response format from Yahoo sentiment API:', data);
      return [];
    }
    
    const sentimentArray = data.sentimentData as SentimentData[];
    console.log(`[YAHOO SENTIMENT DEBUG] Successfully received ${sentimentArray.length} sentiment items`);
    
    // Validate each item has required fields
    const validatedData = sentimentArray.filter((item, index) => {
      const isValid = item && 
                     typeof item.ticker === 'string' && 
                     typeof item.score === 'number' && 
                     typeof item.sentiment === 'string' &&
                     typeof item.source === 'string';
      
      if (!isValid) {
        console.warn(`[YAHOO SENTIMENT WARNING] Invalid sentiment item at index ${index}:`, item);
        return false;
      }
      
      return true;
    });
    
    console.log(`[YAHOO SENTIMENT DEBUG] Returning ${validatedData.length} validated sentiment items`);
    return validatedData;
    
  } catch (error) {
    console.error('[YAHOO SENTIMENT ERROR] Yahoo sentiment API error:', error);
    console.error('[YAHOO SENTIMENT ERROR] Returning empty array due to API failure');
    return [];
  }
};

/**
 * Fetch market sentiment from FinViz
 */
export const fetchFinvizMarketSentiment = async (timeRange: TimeRange = '1w', signal?: AbortSignal): Promise<SentimentData[]> => {
  try {
    console.log(`[FINVIZ SENTIMENT DEBUG] Starting fetchFinvizMarketSentiment for timeRange: ${timeRange}`);
    
    const url = buildApiUrl(`/api/sentiment/finviz/market?timeRange=${timeRange}`);
    console.log(`[FINVIZ SENTIMENT DEBUG] Making request to: ${url}`);
    
    const response = await fetch(url, { signal });
    const data = await handleApiResponse(response);
    
    console.log(`[FINVIZ SENTIMENT DEBUG] Response data:`, data);
    
    // Check if sentimentData exists and is an array
    if (!data || !data.sentimentData || !Array.isArray(data.sentimentData)) {
      console.warn('[FINVIZ SENTIMENT WARNING] Unexpected response format from FinViz sentiment API:', data);
      return [];
    }
    
    const sentimentArray = data.sentimentData as SentimentData[];
    console.log(`[FINVIZ SENTIMENT DEBUG] Successfully received ${sentimentArray.length} sentiment items`);
    
    // Validate each item has required fields
    const validatedData = sentimentArray.filter((item, index) => {
      const isValid = item && 
                     typeof item.ticker === 'string' && 
                     typeof item.score === 'number' && 
                     typeof item.sentiment === 'string' &&
                     typeof item.source === 'string';
      
      if (!isValid) {
        console.warn(`[FINVIZ SENTIMENT WARNING] Invalid sentiment item at index ${index}:`, item);
        return false;
      }
      
      return true;
    });
    
    console.log(`[FINVIZ SENTIMENT DEBUG] Returning ${validatedData.length} validated sentiment items`);
    return validatedData;
    
  } catch (error) {
    console.error('[FINVIZ SENTIMENT ERROR] FinViz sentiment API error:', error);
    console.error('[FINVIZ SENTIMENT ERROR] Returning empty array due to API failure');
    return [];
  }
};

/**
 * Fetch aggregated market sentiment from multiple sources
 */
export const fetchAggregatedMarketSentiment = async (timeRange: TimeRange = '1w', signal?: AbortSignal, hasRedditAccess: boolean = true): Promise<SentimentData[]> => {
  try {
    console.log('=== AGGREGATED MARKET SENTIMENT FETCH START ===');
    console.log(`Time range: ${timeRange}, Has Reddit access: ${hasRedditAccess}`);
    
    const promises: Promise<SentimentData[]>[] = [];
    
    // Always include Yahoo and FinViz for all users
    promises.push(fetchYahooMarketSentiment(timeRange, signal));
    promises.push(fetchFinvizMarketSentiment(timeRange, signal));
    
    // Only include Reddit for Pro users
    if (hasRedditAccess) {
      console.log('🔥 PRO USER: Including Reddit sentiment data');
      promises.push(fetchRedditSentiment(timeRange, signal));
    } else {
      console.log('🆓 FREE USER: Using Yahoo + FinViz only (no Reddit access)');
    }
    
    // Fetch all data sources in parallel
    const results = await Promise.allSettled(promises);
    
    // Combine successful results
    let allSentimentData: SentimentData[] = [];
    results.forEach((result, index) => {
      const sourceName = index === 0 ? 'Yahoo' : index === 1 ? 'FinViz' : 'Reddit';
      if (result.status === 'fulfilled') {
        console.log(`✅ ${sourceName} sentiment fetch succeeded: ${result.value.length} items`);
        allSentimentData = [...allSentimentData, ...result.value];
      } else {
        console.warn(`❌ ${sourceName} sentiment fetch failed:`, result.reason);
      }
    });
    
    console.log(`Combined sentiment data: ${allSentimentData.length} total items`);
    
    if (allSentimentData.length === 0) {
      console.warn('No sentiment data available from any source');
      return [];
    }
    
    // Group by timestamp/date for aggregation
    const groupedData: { [key: string]: SentimentData[] } = {};
    allSentimentData.forEach(item => {
      const key = item.timestamp || new Date().toISOString();
      if (!groupedData[key]) {
        groupedData[key] = [];
      }
      groupedData[key].push(item);
    });
    
    // Create aggregated sentiment for each time period
    const aggregatedData: SentimentData[] = [];
    
    Object.entries(groupedData).forEach(([timestamp, items]) => {
      // Calculate source distribution
      const sources: Record<string, number> = {};
      let totalBullish = 0;
      let totalBearish = 0;
      let totalNeutral = 0;
      let totalConfidence = 0;
      
      items.forEach(item => {
        const source = item.source.charAt(0).toUpperCase() + item.source.slice(1);
        sources[source] = (sources[source] || 0) + 1;
        
        // Aggregate sentiment components if available
        totalBullish += item.bullish || 0;
        totalBearish += item.bearish || 0;
        totalNeutral += item.neutral || 0;
        totalConfidence += item.confidence || 0;
      });
      
      const itemCount = items.length;
      const avgBullish = totalBullish / itemCount;
      const avgBearish = totalBearish / itemCount;
      const avgNeutral = totalNeutral / itemCount;
      const avgConfidence = totalConfidence / itemCount;
      
      // Determine dominant sentiment
      let dominantSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      let sentimentScore = 0;
      
      if (avgBullish > avgBearish && avgBullish > avgNeutral) {
        dominantSentiment = 'bullish';
        sentimentScore = avgBullish;
      } else if (avgBearish > avgBullish && avgBearish > avgNeutral) {
        dominantSentiment = 'bearish';
        sentimentScore = -avgBearish;
      } else {
        dominantSentiment = 'neutral';
        sentimentScore = 0;
      }
      
      aggregatedData.push({
        timestamp,
        ticker: 'MARKET',
        source: 'combined',
        score: sentimentScore,
        sentiment: dominantSentiment,
        confidence: avgConfidence,
        bullish: avgBullish,
        bearish: avgBearish,
        neutral: avgNeutral,
        sources,
        postCount: 0,
        commentCount: 0,
        upvotes: 0
      });
    });
    
    // Sort by timestamp
    aggregatedData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    console.log(`Returning ${aggregatedData.length} aggregated sentiment data points`);
    console.log('=== AGGREGATED MARKET SENTIMENT FETCH COMPLETE ===');
    
    return aggregatedData;
    
  } catch (error) {
    console.error('[AGGREGATED MARKET ERROR] Error fetching aggregated market sentiment:', error);
    return [];
  }
}; 