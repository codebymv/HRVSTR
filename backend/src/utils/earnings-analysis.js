/**
 * Earnings Analysis Utilities
 * Provides functions for analyzing historical earnings data
 */

/**
 * Calculate beat frequency (percentage of times a company beat estimates)
 * @param {Array} historicalEarnings - Array of historical earnings events
 * @returns {number} Beat frequency percentage
 */
function calculateBeatFrequency(historicalEarnings) {
  if (!historicalEarnings || historicalEarnings.length === 0) {
    return 0;
  }
  
  const beatCount = historicalEarnings.filter(event => event.beat).length;
  return (beatCount / historicalEarnings.length) * 100;
}

/**
 * Calculate average surprise percentage
 * @param {Array} historicalEarnings - Array of historical earnings events
 * @returns {number} Average surprise percentage
 */
function calculateAverageSurprise(historicalEarnings) {
  if (!historicalEarnings || historicalEarnings.length === 0) {
    return 0;
  }
  
  const surprisePercentages = historicalEarnings.map(event => {
    // Parse the surprise percentage string to a number
    const surpriseStr = event.epsSurprisePercent || '0%';
    return parseFloat(surpriseStr.replace('%', ''));
  });
  
  const sum = surprisePercentages.reduce((total, value) => total + value, 0);
  return sum / surprisePercentages.length;
}

/**
 * Calculate consistency (standard deviation of surprises)
 * @param {Array} historicalEarnings - Array of historical earnings events
 * @returns {number} Consistency score (lower is more consistent)
 */
function calculateConsistency(historicalEarnings) {
  if (!historicalEarnings || historicalEarnings.length < 2) {
    return 0;
  }
  
  const surprisePercentages = historicalEarnings.map(event => {
    const surpriseStr = event.epsSurprisePercent || '0%';
    return parseFloat(surpriseStr.replace('%', ''));
  });
  
  const mean = surprisePercentages.reduce((total, value) => total + value, 0) / surprisePercentages.length;
  
  // Calculate variance
  const variance = surprisePercentages.reduce((total, value) => {
    const diff = value - mean;
    return total + (diff * diff);
  }, 0) / surprisePercentages.length;
  
  // Standard deviation is the square root of variance
  return Math.sqrt(variance);
}

/**
 * Predict post-earnings drift based on historical patterns
 * @param {Array} historicalEarnings - Array of historical earnings events
 * @param {boolean} isBeat - Whether the latest earnings beat expectations
 * @param {number} surprisePercent - Surprise percentage for the latest earnings
 * @returns {number} Predicted drift percentage
 */
function predictPostEarningsDrift(historicalEarnings, isBeat, surprisePercent) {
  if (!historicalEarnings || historicalEarnings.length < 2) {
    return 0;
  }
  
  // Simple model: Average of past drifts in similar situations (beat/miss)
  const similarEvents = historicalEarnings.filter(event => event.beat === isBeat);
  
  if (similarEvents.length === 0) {
    return 0;
  }
  
  // This is a placeholder - in a real system, you would have actual post-earnings price data
  // For now, we'll generate a synthetic drift based on the surprise percentage
  const driftFactor = isBeat ? 0.5 : -0.7; // Positive drift for beats, negative for misses
  return surprisePercent * driftFactor;
}

/**
 * Analyze historical earnings data and generate metrics
 * @param {Array} historicalEarnings - Array of historical earnings events
 * @returns {Object} Earnings analysis metrics
 */
function analyzeEarnings(historicalEarnings) {
  if (!historicalEarnings || historicalEarnings.length === 0) {
    return {
      beatFrequency: 0,
      averageSurprise: 0,
      consistency: 0,
      postEarningsDrift: 0,
      latestEarnings: {
        surprise: 0,
        magnitude: 0,
        marketReaction: 0
      }
    };
  }
  
  // Sort by date (newest first)
  const sortedEarnings = [...historicalEarnings].sort(
    (a, b) => new Date(b.reportDate) - new Date(a.reportDate)
  );
  
  // Get latest earnings
  const latestEarnings = sortedEarnings[0];
  const latestSurpriseStr = latestEarnings.epsSurprisePercent || '0%';
  const latestSurprise = parseFloat(latestSurpriseStr.replace('%', ''));
  
  // Calculate metrics
  const beatFrequency = calculateBeatFrequency(sortedEarnings);
  const averageSurprise = calculateAverageSurprise(sortedEarnings);
  const consistency = calculateConsistency(sortedEarnings);
  const postEarningsDrift = predictPostEarningsDrift(
    sortedEarnings.slice(1), // Exclude latest earnings
    latestEarnings.beat,
    latestSurprise
  );
  
  return {
    beatFrequency: parseFloat(beatFrequency.toFixed(2)),
    averageSurprise: parseFloat(averageSurprise.toFixed(2)),
    consistency: parseFloat(consistency.toFixed(2)),
    postEarningsDrift: parseFloat(postEarningsDrift.toFixed(2)),
    latestEarnings: {
      surprise: parseFloat(latestSurprise.toFixed(2)),
      magnitude: parseFloat(Math.abs(latestSurprise).toFixed(2)),
      marketReaction: parseFloat((latestSurprise * 0.3).toFixed(2)) // Simplified model
    }
  };
}

module.exports = {
  analyzeEarnings,
  calculateBeatFrequency,
  calculateAverageSurprise,
  calculateConsistency,
  predictPostEarningsDrift
};
