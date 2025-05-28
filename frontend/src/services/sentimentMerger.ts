import { SentimentData } from '../types';

/**
 * Merge sentiment data from multiple sources
 * This function can handle data from different sources (reddit, finviz, etc)
 * and combines them into a single array of SentimentData objects.
 */
export function mergeSentimentData(...sources: SentimentData[][]): SentimentData[] {
  // Log data before merging for debugging
  sources.forEach((source, index) => {
    console.log(`Source ${index} data count:`, source.length);
  });
  
  // Flatten all sources into a single array
  const result = sources.flat();
  console.log('Merged sentiment data count:', result.length);
  return result;
}

/**
 * Group sentiment data by ticker
 * Useful for aggregating sentiment across different sources
 */
export function groupByTicker(data: SentimentData[]): Record<string, SentimentData[]> {
  return data.reduce((acc, item) => {
    if (!acc[item.ticker]) {
      acc[item.ticker] = [];
    }
    acc[item.ticker].push(item);
    return acc;
  }, {} as Record<string, SentimentData[]>);
}

/**
 * Create a single aggregated SentimentData per ticker across sources
 * Useful when you want to show a combined score
 */
export function aggregateByTicker(data: SentimentData[]): SentimentData[] {
  const grouped = groupByTicker(data);
  
  return Object.entries(grouped).map(([ticker, items]) => {
    // Calculate average score
    const totalScore = items.reduce((sum, item) => sum + item.score, 0);
    const avgScore = totalScore / items.length;
    
    // Determine sentiment category based on average score
    let sentiment: 'bullish' | 'bearish' | 'neutral';
    if (avgScore > 0.1) sentiment = 'bullish';
    else if (avgScore < -0.1) sentiment = 'bearish';
    else sentiment = 'neutral';
    
    // Sum post and comment counts
    // Some sources (e.g., FinViz) do not supply post/comment counts. Treat missing values as 0.
    const postCount = items.reduce((sum, item) => sum + (item.postCount ?? 0), 0);
    const commentCount = items.reduce((sum, item) => sum + (item.commentCount ?? 0), 0);
    const newsCount = items.reduce((sum, item) => sum + (item.newsCount ?? 0), 0);

    // For price-related fields use the latest FinViz entry if available
    const latestFinviz = items
      .filter((item) => item.source === 'finviz')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    const price = latestFinviz?.price;
    const changePercent = latestFinviz?.changePercent;
    const analystRating = latestFinviz?.analystRating;

    // Use the most recent timestamp
    const timestamp = items
      .map(item => new Date(item.timestamp).getTime())
      .reduce((latest, current) => Math.max(latest, current), 0);
    
    // Calculate confidence based on available confidence values and data quality
    // Either average existing confidence values or calculate based on volume
    const confidenceValues = items
      .map(item => item.confidence)
      .filter(v => v !== undefined && v !== null) as number[];
    
    // Calculate the weighted average confidence, or use a formula based on post volume
    let combinedConfidence: number;
    if (confidenceValues.length > 0) {
      // If we have confidence values, use their average
      combinedConfidence = Math.round(confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length);
    } else {
      // Otherwise calculate based on post and comment counts
      // Similar to backend logic: base 40% + 5% per post up to 12 posts
      const postVolume = Math.min((postCount || 0) + (commentCount || 0) / 100, 12);
      combinedConfidence = Math.round(40 + postVolume * 5);
    }
    
    // Return the aggregated data
    return {
      ticker,
      score: Number(avgScore.toFixed(3)),
      sentiment,
      source: 'combined', // Mark as combined source
      timestamp: new Date(timestamp).toISOString(),
      postCount,
      commentCount,
      newsCount,
      confidence: combinedConfidence, // Add the calculated confidence
      price,
      changePercent,
      analystRating,
    };
  });
}
