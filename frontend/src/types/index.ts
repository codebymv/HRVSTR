export interface SentimentData {
  ticker: string;
  score: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  source: 'reddit' | 'finviz' | 'yahoo' | 'combined';
  timestamp: string;
  // Sentiment components (0-1)
  bullish?: number;          // Bullish sentiment component
  bearish?: number;          // Bearish sentiment component
  neutral?: number;          // Neutral sentiment component
  // Enhanced metrics from VADER sentiment analysis
  confidence?: number;       // Confidence score (0-100)
  strength?: number;         // Sentiment strength as percentage (0-1000%)
  volume?: number;           // Discussion volume score (1-10)
  momentum?: number;         // Sentiment change over time
  positive?: number;         // Positive sentiment component (0-1)
  negative?: number;         // Negative sentiment component (0-1)
  // Social source metrics (Reddit)
  postCount?: number;
  commentCount?: number;
  upvotes?: number;          // Total upvotes
  // FinViz-specific metrics
  price?: number;
  changePercent?: number;
  analystRating?: string;
  newsCount?: number;
  // Source tracking
  sources?: Record<string, number>;
  
  // Debug information
  debug?: {
    rawScore?: number;
    sentimentThreshold?: string;
    confidenceBreakdown?: {
      base: number;
      source: string;
      dataVolume: number;
      final: number;
    };
  };
  
  // Test-only properties
  _test_flag?: string;
}

export interface WatchlistItem {
  ticker: string;
  name: string;
  isActive: boolean;
}

export interface ChartData {
  date: string;
  displayDate?: string; // Optional formatted date for UI display
  bullish: number;
  bearish: number;
  neutral: number;
  sources?: Record<string, number>; // Count of data points from each source
}

export interface RedditPost {
  id: string;
  title: string;
  content: string;
  author: string;
  upvotes: number;
  commentCount: number;
  url: string;
  created: string;
  subreddit: string;
}

export interface InsiderTrade {
  id: string;
  ticker: string;
  insiderName: string;
  title: string;
  tradeType: 'BUY' | 'SELL';
  shares: number;
  price: number;
  value: number;
  filingDate: string;
  transactionDate: string;
  formType: string;
}

export interface InstitutionalHolding {
  id: string;
  ticker: string;
  institutionName: string;
  // Support both old and new property names for shares/value
  sharesHeld?: number;
  valueHeld?: number;
  totalSharesHeld?: number;
  totalValueHeld?: number;
  percentChange: number;
  percentageOwnership?: number;
  quarterlyChange?: number;
  filingDate: string;
  quarterEnd: string;
  formType: string;
  // New properties for detailed holdings
  cik?: string;
  url?: string;
  holdings?: SecurityHolding[];
}

// New interface for individual security holdings
export interface SecurityHolding {
  id: string;
  institutionName: string;
  institutionCik?: string;
  institutionTicker?: string;
  ticker?: string;
  nameOfIssuer: string;
  titleOfClass?: string;
  cusip?: string;
  shares: number;
  value: number;
  filingDate: string;
  quarterEnd: string;
}

export interface EarningsEvent {
  ticker: string;
  companyName: string;
  reportDate: string;
  estimatedEPS: number;
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
  };
  marketReaction: {
    immediateReaction: number;
    weekAfterReaction: number;
  };
}

export type TimeRange = '1w' | '1m' | '3m' | '6m';