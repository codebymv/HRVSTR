import { ChartData, SentimentData, TimeRange } from '../types';
import { fetchSentimentData } from './api';
import { fetchFinvizSentiment } from './finvizClient';
import { generateChartData } from './chartUtils';
import { ensureTickerDiversity } from './tickerUtils';
import { mergeSentimentData } from './sentimentMerger';

/**
 * Fetch and combine sentiment data from multiple sources for chart visualization
 * This integrates both Reddit and FinViz sentiment into a single chart dataset
 */
export async function fetchCombinedChartData(timeRange: TimeRange = '1w'): Promise<ChartData[]> {
  try {
    // 1. Get Reddit sentiment data (this already has timeline data)
    const redditSentiment = await fetchSentimentData(timeRange);
    console.log(`Fetched ${redditSentiment.length} Reddit sentiment data points for ${timeRange}`);
    
    // 2. Get default tickers if Reddit data is empty or use Reddit tickers
    let diverseTickers;
    if (redditSentiment.length > 0) {
      const tickers = Array.from(new Set(redditSentiment.map(d => d.ticker)));
      diverseTickers = ensureTickerDiversity(tickers, 10);
    } else {
      // Default tickers if Reddit data is empty
      diverseTickers = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'NVDA', 'AMD'];
    }
    
    // 3. Fetch FinViz sentiment for these tickers
    const finvizSentiment = await fetchFinvizSentiment(diverseTickers);
    console.log(`Fetched ${finvizSentiment.length} FinViz sentiment data points`);
    
    // 4. Merge both data sources
    const combinedSentiment = mergeSentimentData(redditSentiment, finvizSentiment);
    console.log(`Combined ${combinedSentiment.length} total sentiment data points`);
    
    // 5. Generate chart data directly from the merged sentiment
    const chartData = generateChartData(combinedSentiment, timeRange);
    
    return chartData;
  } catch (error) {
    console.error('Error generating combined chart data:', error);
    // Return empty chart data instead of throwing to prevent app crashes
    return [];
  }
}

/**
 * Calculate the percentage contribution of each data source to the chart
 * This is useful for displaying a breakdown of data sources in the UI
 */
export function getSourceBreakdown(data: SentimentData[]): Record<string, number> {
  if (!data.length) return {};
  
  // Count items by source
  const counts: Record<string, number> = {};
  
  data.forEach(item => {
    if (!counts[item.source]) {
      counts[item.source] = 0;
    }
    counts[item.source]++;
  });
  
  // Convert to percentages
  const total = data.length;
  const percentages: Record<string, number> = {};
  
  Object.entries(counts).forEach(([source, count]) => {
    percentages[source] = Math.round((count / total) * 100);
  });
  
  return percentages;
}
