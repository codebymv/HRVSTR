import { SentimentData } from '../../types';

// Updated sentiment thresholds to match backend
const BULLISH_THRESHOLD = 0.2;
const BEARISH_THRESHOLD = -0.2;

/**
 * Calculate the average sentiment score for a given ticker
 */
export const calculateAverageSentiment = (data: SentimentData[], ticker: string): number => {
  const tickerData = data.filter(item => item.ticker === ticker);
  if (tickerData.length === 0) return 0;
  
  const sum = tickerData.reduce((acc, item) => acc + item.score, 0);
  return Number((sum / tickerData.length).toFixed(2));
};

/**
 * Get sentiment category based on score
 * Using updated thresholds to match backend
 */
export const getSentimentCategory = (score: number): 'bullish' | 'bearish' | 'neutral' => {
  if (score > BULLISH_THRESHOLD) return 'bullish';
  if (score < BEARISH_THRESHOLD) return 'bearish';
  return 'neutral';
};

/**
 * Get color based on sentiment score
 */
export const getSentimentColor = (score: number): string => {
  if (score > BULLISH_THRESHOLD) return 'bg-green-500';
  if (score < BEARISH_THRESHOLD) return 'bg-red-500';
  return 'bg-yellow-500';
};

/**
 * Get text color based on sentiment score
 */
export const getSentimentTextColor = (score: number): string => {
  if (score > BULLISH_THRESHOLD) return 'text-green-500';
  if (score < BEARISH_THRESHOLD) return 'text-red-500';
  return 'text-yellow-500';
};

/**
 * Get color based on confidence score
 */
export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 80) return 'text-green-500';
  if (confidence >= 60) return 'text-blue-500';
  if (confidence >= 40) return 'text-yellow-500';
  return 'text-red-500';
};

/**
 * Calculate sentiment strength percentage
 * @param score Normalized sentiment score (-1 to 1)
 * @returns Percentage value (0-1000%)
 */
export const calculateSentimentStrength = (score: number): number => {
  // Convert normalized score to percentage with amplification for visualization
  const absScore = Math.abs(score);
  const amplified = Math.min(10, Math.pow(absScore * 5, 1.5));
  return Math.round(amplified * 100);
};

/**
 * Calculate sentiment momentum (change over time)
 * @param currentScore Current sentiment score
 * @param previousScore Previous sentiment score
 * @returns Momentum percentage
 */
export const calculateMomentum = (currentScore: number, previousScore: number): number => {
  if (!previousScore) return 0;
  return Number(((currentScore - previousScore) * 100).toFixed(1));
};

/**
 * Format large numbers with k, m suffix
 * Safely handles undefined/null values
 */
export const formatNumber = (num: number | undefined | null): string => {
  // Handle undefined or null values
  if (num === undefined || num === null) {
    return '0';
  }
  
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'm';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
};

/**
 * Format date to human-readable format
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

/**
 * Calculate time-weighted sentiment score
 * Gives more weight to recent sentiment data
 * @param data Array of sentiment data points with timestamps
 * @returns Weighted sentiment score
 */
export const calculateTimeWeightedSentiment = (data: SentimentData[]): number => {
  if (!data || data.length === 0) return 0;
  
  // Sort by timestamp (newest first)
  const sorted = [...data].sort((a, b) => 
    new Date(b.timestamp || '').getTime() - new Date(a.timestamp || '').getTime()
  );
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  // Apply exponential decay weight based on recency
  sorted.forEach((item, index) => {
    const weight = Math.exp(-0.1 * index); // Exponential decay
    weightedSum += item.score * weight;
    totalWeight += weight;
  });
  
  return totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : 0;
};