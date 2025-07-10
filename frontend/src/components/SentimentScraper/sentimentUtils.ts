import { SentimentData } from '../../types';

// Sentiment thresholds based on sentimentUtils.authenticity.test.ts expectations
const BULLISH_THRESHOLD = 0.6; // Scores >= 0.6 are bullish
const BEARISH_THRESHOLD = 0.4; // Scores <= 0.4 are bearish

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
 * Scores >= 0.6 are bullish, <= 0.4 are bearish, between 0.41-0.59 are neutral
 */
export const getSentimentCategory = (score: number): 'bullish' | 'bearish' | 'neutral' => {
  if (score >= BULLISH_THRESHOLD) return 'bullish';
  if (score <= BEARISH_THRESHOLD) return 'bearish';
  return 'neutral';
};

/**
 * Get color based on sentiment score
 */
export const getSentimentColor = (score: number): string => {
  if (score >= BULLISH_THRESHOLD) return 'bg-green-500';
  if (score <= BEARISH_THRESHOLD) return 'bg-red-500';
  return 'bg-yellow-500';
};

/**
 * Get text color based on sentiment score
 */
export const getSentimentTextColor = (score: number): string => {
  if (score >= BULLISH_THRESHOLD) return 'text-green-500';
  if (score <= BEARISH_THRESHOLD) return 'text-red-500';
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
 * @param score Sentiment score (-1 to 1 range)
 * @returns Percentage value (0-100%)
 */
export const calculateSentimentStrength = (score: number): number => {
  // Convert score (-1 to 1) to percentage based on absolute value
  return Math.round(Math.abs(score) * 100); // 0-100 range
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

/**
 * Calculate sentiment quality score based on real data metrics
 * Uses actual data volume, source diversity, algorithm confidence, and freshness
 * @param sentimentData The sentiment data object
 * @returns Quality assessment object
 */
export const calculateSentimentQuality = (sentimentData: SentimentData) => {
  let qualityScore = 0;
  const factors: string[] = [];

  // Factor 1: Data Volume Quality (using real postCount, commentCount)
  const postCount = sentimentData.postCount || 0;
  const commentCount = sentimentData.commentCount || 0;
  const newsCount = sentimentData.newsCount || 0;
  
  // Calculate volume score based on actual data points
  const socialVolume = postCount + (commentCount * 0.1); // Comments weighted less than posts
  const newsVolume = newsCount * 2; // News articles weighted higher
  const totalVolume = socialVolume + newsVolume;
  
  const volumeScore = Math.min(totalVolume / 50, 1); // Normalize to max 50 data points = 100%
  qualityScore += volumeScore * 0.35;
  
  const volumeBreakdown = [];
  if (postCount > 0) volumeBreakdown.push(`${postCount} posts`);
  if (commentCount > 0) volumeBreakdown.push(`${commentCount} comments`);
  if (newsCount > 0) volumeBreakdown.push(`${newsCount} articles`);
  
  factors.push(`Data Volume: ${Math.round(volumeScore * 100)}% (${volumeBreakdown.join(', ') || 'No data'})`);

  // Factor 2: Source Diversity (using real sources data)
  let sourceCount = 1; // Default single source
  if (sentimentData.sources && typeof sentimentData.sources === 'object') {
    sourceCount = Object.keys(sentimentData.sources).length;
  } else if (sentimentData.source === 'combined') {
    sourceCount = 2; // Assume at least 2 sources for combined
  }
  
  const diversityScore = Math.min(sourceCount / 3, 1); // Max 3 sources currently (reddit, finviz, yahoo)
  qualityScore += diversityScore * 0.25;
  factors.push(`Source Diversity: ${Math.round(diversityScore * 100)}% (${sourceCount} source${sourceCount > 1 ? 's' : ''})`);

  // Factor 3: Algorithm Confidence (using real VADER confidence scores)
  const confidence = sentimentData.confidence || 50; // Default to medium confidence if not provided
  const confidenceScore = confidence / 100;
  qualityScore += confidenceScore * 0.25;
  factors.push(`Algorithm Confidence: ${Math.round(confidenceScore * 100)}% (${confidence.toFixed(0)}% from sentiment analysis)`);

  // Factor 4: Data Freshness (using real timestamp)
  let freshnessScore = 0.5; // Default to medium freshness if no timestamp
  if (sentimentData.timestamp) {
    const ageHours = (Date.now() - new Date(sentimentData.timestamp).getTime()) / (1000 * 60 * 60);
    freshnessScore = Math.max(0, 1 - (ageHours / 24)); // Decay over 24 hours
  }
  qualityScore += freshnessScore * 0.15;
  const ageHours = sentimentData.timestamp ? 
    Math.round((Date.now() - new Date(sentimentData.timestamp).getTime()) / (1000 * 60 * 60)) : 
    'unknown';
  factors.push(`Data Freshness: ${Math.round(freshnessScore * 100)}% (${ageHours}h old)`);

  // Final score and grade
  const finalScore = Math.round(qualityScore * 100);
  let grade: 'A' | 'B' | 'C' | 'D';
  if (finalScore >= 80) grade = 'A';
  else if (finalScore >= 65) grade = 'B';
  else if (finalScore >= 45) grade = 'C';
  else grade = 'D';

  return {
    qualityScore: finalScore,
    grade: grade,
    factors: factors,
    recommendation: getQualityRecommendation(finalScore),
    details: {
      volumeScore: Math.round(volumeScore * 100),
      diversityScore: Math.round(diversityScore * 100),
      confidenceScore: Math.round(confidenceScore * 100),
      freshnessScore: Math.round(freshnessScore * 100)
    }
  };
};

/**
 * Get quality recommendation based on score
 * @param score Quality score (0-100)
 * @returns Recommendation string
 */
const getQualityRecommendation = (score: number): string => {
  if (score >= 80) return "High-confidence signal - suitable for decision making";
  if (score >= 65) return "Good signal quality - consider with other indicators";
  if (score >= 45) return "Moderate quality - use caution, verify with other sources";
  return "Low quality signal - insufficient data for reliable analysis";
};

/**
 * Get quality grade color for UI display
 * @param grade Quality grade (A, B, C, D)
 * @returns Tailwind CSS color classes
 */
export const getQualityGradeColor = (grade: 'A' | 'B' | 'C' | 'D'): string => {
  switch (grade) {
    case 'A': return 'bg-green-100 text-green-800 border-green-300';
    case 'B': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'D': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

/**
 * Calculate unified reliability score combining confidence and signal quality
 * Confidence gets 40% weight (algorithm certainty), Signal Quality gets 60% weight (data reliability)
 * @param sentimentData The sentiment data object
 * @returns Unified reliability assessment
 */
export const calculateUnifiedReliability = (sentimentData: SentimentData) => {
  // Get the existing signal quality calculation
  const qualityData = calculateSentimentQuality(sentimentData);
  
  // Get confidence score (0-100)
  const confidenceScore = sentimentData.confidence || 50; // Default to medium if not provided
  
  // Calculate weighted unified score
  // Confidence: 40% weight, Signal Quality: 60% weight
  const unifiedScore = Math.round((confidenceScore * 0.4) + (qualityData.qualityScore * 0.6));
  
  // Determine reliability label based on unified score
  let reliabilityLabel: string;
  let reliabilityColor: string;
  
  if (unifiedScore >= 85) {
    reliabilityLabel = 'Excellent';
    reliabilityColor = 'bg-green-100 text-green-800 border-green-300';
  } else if (unifiedScore >= 70) {
    reliabilityLabel = 'High';
    reliabilityColor = 'bg-blue-100 text-blue-800 border-blue-300';
  } else if (unifiedScore >= 55) {
    reliabilityLabel = 'Good';
    reliabilityColor = 'bg-yellow-100 text-yellow-800 border-yellow-300';
  } else if (unifiedScore >= 40) {
    reliabilityLabel = 'Fair';
    reliabilityColor = 'bg-orange-100 text-orange-800 border-orange-300';
  } else {
    reliabilityLabel = 'Low';
    reliabilityColor = 'bg-red-100 text-red-800 border-red-300';
  }
  
  // Create recommendation based on unified score
  let recommendation: string;
  if (unifiedScore >= 85) {
    recommendation = "Excellent reliability - high confidence for investment decisions";
  } else if (unifiedScore >= 70) {
    recommendation = "High reliability - suitable for primary analysis";
  } else if (unifiedScore >= 55) {
    recommendation = "Good reliability - consider with additional indicators";
  } else if (unifiedScore >= 40) {
    recommendation = "Fair reliability - use caution, verify with other sources";
  } else {
    recommendation = "Low reliability - insufficient for investment decisions";
  }
  
  return {
    reliabilityScore: unifiedScore,
    reliabilityLabel: reliabilityLabel,
    reliabilityColor: reliabilityColor,
    recommendation: recommendation,
    breakdown: {
      confidenceContribution: Math.round(confidenceScore * 0.4),
      qualityContribution: Math.round(qualityData.qualityScore * 0.6),
      confidenceScore: confidenceScore,
      qualityScore: qualityData.qualityScore
    },
    // Keep the original quality details for expanded view if needed
    qualityDetails: qualityData
  };
};