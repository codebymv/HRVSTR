# Earnings Processing Implementation

This document outlines the implementation of earnings data processing in the HRVSTR application.

## 1. Data Model and Interfaces

The earnings processing system uses several well-defined TypeScript interfaces:

```typescript
export interface EarningsEvent {
  ticker: string;
  companyName: string;
  reportDate: string;
  estimatedEPS: number;
  estEPS?: number; // Alias for estimatedEPS
  actualEPS?: number;
  surprisePercentage?: number;
  consensusEstimate?: number;
  previousEPS?: number;
  yearAgoEPS?: number;
  revenueEstimate?: number;
  actualRevenue?: number;
  revenueSurprise?: number;
}

export interface EarningsAnalysis {
  ticker: string;
  surprisePercentage: number;
  magnitude: number;
  direction: 'positive' | 'negative';
  historicalPattern: {
    averageSurprise: number;
    consistency: number;
    postEarningsDrift: number;
    beatFrequency: number;
  };
  marketReaction: {
    immediateReaction: number;
    weekAfterReaction: number;
  };
}
```

These interfaces provide a strongly-typed structure for earnings data throughout the application.

## 2. Earnings Data Retrieval

The application fetches earnings data through a proxy server to avoid CORS issues and provide centralized caching:

```typescript
export async function fetchUpcomingEarnings(timeRange: TimeRange = '1m'): Promise<EarningsEvent[]> {
  try {
    const proxyUrl = getProxyUrl();
    const response = await fetch(`${proxyUrl}/api/earnings/upcoming?timeRange=${timeRange}`);
    
    if (!response.ok) {
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.earningsEvents as EarningsEvent[];
  } catch (error) {
    console.error('Earnings API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch earnings data');
  }
}
```

Key aspects of the implementation:
- Uses a configurable time range parameter (1d, 1w, 1m, 3m)
- Error handling with specific error messages
- Proxy server routing for API abstraction

## 3. Historical Earnings Processing

The application retrieves and processes historical earnings data for specific tickers:

```typescript
export async function fetchHistoricalEarnings(ticker: string): Promise<EarningsEvent[]> {
  try {
    console.log(`Fetching historical earnings for ticker: ${ticker}`);
    const proxyUrl = getProxyUrl();
    const url = `${proxyUrl}/api/earnings/historical/${ticker}`;
    
    const response = await fetch(url);
    
    // Error handling and validation
    if (!response.ok) {
      console.error(`HTTP error ${response.status}: ${response.statusText}`);
      const errorText = await response.text().catch(() => 'No error text available');
      console.error(`Error response: ${errorText}`);
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Response format validation
    if (!data.historicalEarnings || !Array.isArray(data.historicalEarnings)) {
      console.error('Unexpected response format:', data);
      throw new Error('Invalid response format from server');
    }
    
    return data.historicalEarnings as EarningsEvent[];
  } catch (error) {
    console.error('Historical earnings API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch historical earnings data');
  }
}
```

This historical data forms the foundation for earnings analysis and prediction.

## 4. Earnings Analysis Processing

The core of the earnings processing system is the earnings analysis functionality:

```typescript
export async function analyzeEarningsSurprise(ticker: string): Promise<EarningsAnalysis> {
  try {
    const proxyUrl = getProxyUrl();
    const url = `${proxyUrl}/api/earnings/analysis/${ticker}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      // Fall back to local calculation if the API fails
      console.log('Falling back to local earnings analysis calculation');
      return calculateLocalEarningsAnalysis(ticker);
    }
    
    const data: BackendEarningsAnalysis = await response.json();
    
    // Convert backend analysis format to frontend format
    return {
      ticker,
      surprisePercentage: data.analysis.latestEarnings.surprise,
      magnitude: data.analysis.latestEarnings.magnitude,
      direction: data.analysis.latestEarnings.surprise >= 0 ? 'positive' : 'negative',
      historicalPattern: {
        averageSurprise: data.analysis.averageSurprise,
        consistency: data.analysis.consistency,
        postEarningsDrift: data.analysis.postEarningsDrift,
        beatFrequency: data.analysis.beatFrequency
      },
      marketReaction: {
        immediateReaction: data.analysis.latestEarnings.marketReaction,
        weekAfterReaction: data.analysis.postEarningsDrift
      }
    };
  } catch (error) {
    // Fall back to local calculation if the API fails
    console.log('Falling back to local earnings analysis calculation due to error');
    return calculateLocalEarningsAnalysis(ticker);
  }
}
```

This implementation:
1. Attempts to fetch pre-calculated analysis from the server
2. Falls back to local calculation if server request fails
3. Transforms backend data format to frontend format
4. Provides resilience through graceful degradation

## 5. Local Earnings Analysis Calculation

A key feature of the earnings processing system is the ability to perform local analysis when server-side analysis is unavailable:

```typescript
async function calculateLocalEarningsAnalysis(ticker: string): Promise<EarningsAnalysis> {
  try {
    // Fetch historical earnings for calculations
    const historicalEarnings = await fetchHistoricalEarnings(ticker);
    
    if (historicalEarnings.length === 0) {
      throw new Error('No historical earnings data available');
    }
    
    // Calculate average surprise
    const surprises = historicalEarnings
      .filter(e => e.surprisePercentage !== undefined)
      .map(e => e.surprisePercentage!);
    
    const averageSurprise = surprises.reduce((a, b) => a + b, 0) / surprises.length;
    
    // Calculate consistency (percentage of beats)
    const beats = surprises.filter(s => s > 0).length;
    const consistency = (beats / surprises.length) * 100;
    
    // Calculate historical post-earnings drift
    const postEarningsDrift = calculatePostEarningsDrift(historicalEarnings);
    
    // Get latest earnings event
    const latestEarnings = historicalEarnings[0];
    
    return {
      ticker,
      surprisePercentage: latestEarnings.surprisePercentage || 0,
      magnitude: Math.abs(latestEarnings.surprisePercentage || 0),
      direction: (latestEarnings.surprisePercentage || 0) > 0 ? 'positive' : 'negative',
      historicalPattern: {
        averageSurprise,
        consistency,
        postEarningsDrift,
        beatFrequency: consistency
      },
      marketReaction: {
        immediateReaction: 0,
        weekAfterReaction: 0
      }
    };
  } catch (error) {
    console.error('Local earnings analysis error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to analyze earnings data locally');
  }
}
```

This fallback mechanism ensures the application can provide earnings analysis even when the backend API is unavailable.

## 6. Post-Earnings Drift Calculation

The system calculates post-earnings drift to predict stock price movement following earnings announcements:

```typescript
function calculatePostEarningsDrift(earnings: EarningsEvent[]): number {
  // This is a placeholder - in reality, you'd need to:
  // 1. Get historical price data for each earnings date
  // 2. Calculate price changes from day before to day after
  // 3. Calculate price changes from day after to 5 days after
  // 4. Average these changes based on surprise magnitude
  
  // For now, return a simple average of surprise percentages
  const surprises = earnings
    .filter(e => e.surprisePercentage !== undefined)
    .map(e => e.surprisePercentage!);
  
  return surprises.reduce((a, b) => a + b, 0) / surprises.length;
}
```

This is a simplified implementation that serves as a foundation for more sophisticated price movement prediction.

## 7. User Interface Integration

The EarningsMonitor component integrates with the earnings processing system to provide a comprehensive UI:

```typescript
const loadData = async () => {
  setLoading({
    upcomingEarnings: true,
    analysis: true
  });
  
  // Reset progress tracking
  setLoadingProgress(0);
  setLoadingStage('Initializing earnings data...');
  
  // Total steps in loading process
  const totalSteps = 3;
  
  // Helper function to update progress
  const updateProgress = (step: number, stage: string) => {
    const progressPercentage = Math.round((step / totalSteps) * 100);
    setLoadingProgress(progressPercentage);
    setLoadingStage(stage);
    
    // Propagate to parent component if callback exists
    if (onLoadingProgressChange) {
      onLoadingProgressChange(progressPercentage, stage);
    }
  };
  
  try {
    // Step 1: Initialize loading
    updateProgress(1, 'Fetching upcoming earnings...');
    const earnings = await fetchUpcomingEarnings(timeRange);
    
    // Step 2: Process data
    updateProgress(2, 'Processing earnings data...');
    setUpcomingEarnings(earnings);
    
    // Step 3: Complete loading
    updateProgress(3, 'Finalizing earnings display...');
    setLoading(prev => ({ ...prev, upcomingEarnings: false }));
  } catch (error) {
    console.error('Upcoming earnings error:', error);
    setErrors(prev => ({ 
      ...prev, 
      upcomingEarnings: error instanceof Error ? error.message : 'Unknown error'
    }));
    setLoading(prev => ({ ...prev, upcomingEarnings: false }));
  }
};
```

The component provides:
1. Detailed progress tracking during data loading
2. Error handling and display
3. User-friendly visualization of earnings data and analysis
4. Interactive ticker selection for detailed analysis

## 8. On-Demand Analysis Loading

The system loads earnings analysis on-demand when a ticker is selected:

```typescript
const loadAnalysis = async (ticker: string) => {
  // Skip if already loading or no ticker selected
  if (loading.analysis || !ticker) return;
  
  setLoading(prev => ({ ...prev, analysis: true }));
  setLoadingProgress(0);
  setLoadingStage('Initializing analysis...');
  
  // Total steps in loading process
  const totalSteps = 3;
  
  // Helper function to update progress
  const updateProgress = (step: number, stage: string) => {
    const progressPercentage = Math.round((step / totalSteps) * 100);
    setLoadingProgress(progressPercentage);
    setLoadingStage(stage);
    
    if (onLoadingProgressChange) {
      onLoadingProgressChange(progressPercentage, stage);
    }
  };
  
  try {
    updateProgress(1, `Analyzing earnings for ${ticker}...`);
    const analysis = await analyzeEarningsSurprise(ticker);
    
    updateProgress(2, 'Processing earnings analysis...');
    setEarningsAnalysis(analysis);
    
    updateProgress(3, 'Finalizing analysis display...');
  } catch (error) {
    console.error('Earnings analysis error:', error);
    setErrors(prev => ({ 
      ...prev, 
      analysis: error instanceof Error ? error.message : 'Unknown error'
    }));
  } finally {
    setLoading(prev => ({ ...prev, analysis: false }));
  }
};
```

This approach:
1. Avoids loading analysis data for all tickers up front
2. Provides progressive loading feedback
3. Handles errors gracefully
4. Optimizes resource usage

## 9. Data Sorting and Presentation

The earnings system implements sophisticated sorting functionality:

```typescript
const sortEarnings = (earnings: EarningsEvent[]): EarningsEvent[] => {
  return [...earnings].sort((a, b) => {
    let comparison = 0;
    
    switch (sortConfig.key) {
      case 'ticker':
        comparison = a.ticker.localeCompare(b.ticker);
        break;
      case 'companyName':
        comparison = a.companyName.localeCompare(b.companyName);
        break;
      case 'reportDate':
        comparison = new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime();
        break;
      case 'estimatedEPS':
        const aEPS = a.estimatedEPS || a.estEPS || 0;
        const bEPS = b.estimatedEPS || b.estEPS || 0;
        comparison = aEPS - bEPS;
        break;
      default:
        break;
    }
    
    return sortConfig.direction === 'ascending' ? comparison : -comparison;
  });
};
```

This enables flexible data presentation based on user preferences.

## 10. Future Improvements

The earnings processing system could be enhanced with:

1. **Real Market Data Integration**
   - Replace placeholder price calculations with actual market data
   - Integrate with financial APIs for real-time stock prices
   - Implement actual post-earnings price movement analysis

2. **Machine Learning Models**
   - Develop predictive models for post-earnings price movement
   - Train models on historical earnings surprises and price movements
   - Implement confidence indicators for predictions

3. **Advanced Technical Analysis**
   - Add volume analysis around earnings dates
   - Implement options sentiment analysis for earnings predictions
   - Add historical volatility comparison

4. **Enhanced Visualization**
   - Add interactive charts showing historical earnings vs. expectations
   - Implement price movement visualization following earnings
   - Create comparative analysis across similar companies/sectors
