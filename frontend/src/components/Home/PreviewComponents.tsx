import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { TrendingUp, TrendingDown, Minus, Building2, Star, Activity, RefreshCw, Info, ArrowUpRight } from 'lucide-react';

// Mock Sentiment Preview (matching SentimentCard design)
export const SentimentPreview: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const headingTextColor = isLight ? 'text-stone-900' : 'text-white';
  const badgeBgColor = isLight ? 'bg-stone-200' : 'bg-gray-700';

  // Mock data
  const mockSentiment = {
    ticker: 'AAPL',
    score: 0.65,
    sentiment: 'bullish' as const,
    confidence: 78,
    price: 175.43,
    changePercent: 2.34,
    source: 'reddit',
    postCount: 156,
    commentCount: 89
  };

  const getSentimentColor = (score: number): string => {
    if (score > 0.15) return 'text-green-500';
    if (score < -0.15) return 'text-red-500';
    return 'text-yellow-500';
  };

  const getSentimentIcon = (score: number) => {
    if (score > 0.15) return <TrendingUp size={20} className="text-green-500" />;
    if (score < -0.15) return <TrendingDown size={20} className="text-red-500" />;
    return <Minus size={20} className="text-yellow-500" />;
  };

  const getSentimentDescription = (score: number): string => {
    if (score >= 0.5) return 'Bullish';
    if (score <= -0.5) return 'Bearish';
    if (score >= 0.15) return 'Slightly Bullish';
    if (score <= -0.15) return 'Slightly Bearish';
    return 'Neutral';
  };

  const sentimentColor = getSentimentColor(mockSentiment.score);
  const scoreValue = Math.round(Math.abs(mockSentiment.score) * 100);

  return (
    <div className={`${cardBgColor} rounded-lg border ${borderColor} shadow-sm hover:shadow-md transition-all duration-200 h-64 flex flex-col`}>
      <div className="flex items-center justify-between p-4 border-b ${borderColor}">
        <div className="flex items-center space-x-2">
          <Activity size={20} className="text-purple-600" />
          <h3 className={`text-lg font-semibold ${headingTextColor}`}>Sentiment Score</h3>
        </div>
        <span className={`text-sm ${headingTextColor}`}>Bullish • 78% confidence</span>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        {/* Header with ticker, sentiment badge, and score */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h3 className={`text-xl font-bold ${headingTextColor}`}>{mockSentiment.ticker}</h3>
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${badgeBgColor}`}>
              <span className={sentimentColor}>{getSentimentDescription(mockSentiment.score)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${sentimentColor}`}>
              {scoreValue}%
            </div>
          </div>
        </div>

        {/* Price information */}
        <div className="mb-4 p-3 rounded-lg bg-opacity-50" style={{backgroundColor: isLight ? '#f8f9fa' : '#374151'}}>
          <div className="flex items-center justify-between">
            <span className={`text-xs ${headingTextColor}`}>Current Price</span>
            <div className="text-right">
              <span className={`text-sm font-semibold ${headingTextColor}`}>
                ${mockSentiment.price.toFixed(2)}
              </span>
              <div className="flex items-center justify-end mt-1">
                <ArrowUpRight size={12} className="text-green-500" />
                <span className={`text-xs font-medium ml-1 text-green-500`}>
                  {mockSentiment.changePercent}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Data source and summary */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className={`text-xs ${headingTextColor}`}>Live • {mockSentiment.postCount + mockSentiment.commentCount} discussions</span>
          </div>
          <Info size={12} className={`${headingTextColor}`} />
        </div>

        {/* Progress indicator */}
        <div className="mt-auto">
          <div className={`h-1.5 ${isLight ? 'bg-gray-200' : 'bg-gray-700'} rounded-full overflow-hidden`}>
            <div 
              className={`h-full transition-all duration-500 bg-green-500`}
              style={{ width: `${Math.min(100, Math.max(5, scoreValue))}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mock Earnings Analysis Preview (matching EarningsAnalysis design)
export const EarningsPreview: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const headerBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const hoverBg = isLight ? 'hover:bg-stone-200' : 'hover:bg-gray-800';

  const mockAnalysis = [
    { 
      ticker: 'AAPL', 
      companyName: 'Apple Inc.', 
      analysisScore: 85, 
      surprisePercentage: 12.5, 
      riskLevel: 'Low',
      beatFrequency: 78
    },
    { 
      ticker: 'GOOGL', 
      companyName: 'Alphabet Inc.', 
      analysisScore: 72, 
      surprisePercentage: -3.2, 
      riskLevel: 'Medium',
      beatFrequency: 65
    },
    { 
      ticker: 'MSFT', 
      companyName: 'Microsoft Corp.', 
      analysisScore: 91, 
      surprisePercentage: 8.7, 
      riskLevel: 'Low',
      beatFrequency: 82
    },
    { 
      ticker: 'TSLA', 
      companyName: 'Tesla Inc.', 
      analysisScore: 68, 
      surprisePercentage: 15.3, 
      riskLevel: 'High',
      beatFrequency: 58
    }
  ];

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-red-500';
      default: return subTextColor;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className={`${cardBgColor} rounded-lg border ${borderColor} shadow-sm hover:shadow-md transition-all duration-200 h-64 flex flex-col`}>
      <div className="flex items-center justify-between p-4 border-b ${borderColor}">
        <div className="flex items-center space-x-2">
          <TrendingUp size={20} className="text-purple-600" />
          <h3 className={`text-lg font-semibold ${textColor}`}>Earnings Analysis</h3>
        </div>
        <span className={`text-sm ${subTextColor}`}>AI Insights</span>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <div className="overflow-x-auto h-full">
          <table className={`min-w-full ${textColor}`}>
            <thead className={`${headerBg} border-b ${borderColor}`}>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Ticker</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Score</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Surprise</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Risk</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${borderColor}`}>
              {mockAnalysis.map((analysis, index) => (
                <tr key={analysis.ticker} className={`${hoverBg} cursor-pointer transition-colors`}>
                  <td className="px-4 py-2 font-medium text-sm">{analysis.ticker}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`font-medium ${getScoreColor(analysis.analysisScore)}`}>
                      {analysis.analysisScore}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`font-medium ${analysis.surprisePercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {analysis.surprisePercentage >= 0 ? '+' : ''}{analysis.surprisePercentage.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`font-medium ${getRiskLevelColor(analysis.riskLevel)}`}>
                      {analysis.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Mock SEC Filings Preview (matching InstitutionalHoldingsTab design)
export const SECFilingsPreview: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const headerBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const hoverBg = isLight ? 'hover:bg-stone-200' : 'hover:bg-gray-800';

  const mockFilings = [
    { 
      institutionName: 'Berkshire Hathaway', 
      ticker: 'AAPL', 
      valueHeld: 174300000000,
      sharesHeld: 915600000,
      filingDate: '2024-10-15'
    },
    { 
      institutionName: 'Vanguard Group', 
      ticker: 'MSFT', 
      valueHeld: 142800000000,
      sharesHeld: 421200000,
      filingDate: '2024-10-14'
    },
    { 
      institutionName: 'BlackRock', 
      ticker: 'GOOGL', 
      valueHeld: 12100000000,
      sharesHeld: 89400000,
      filingDate: '2024-10-13'
    }
  ];

  const formatValue = (value: number): string => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toLocaleString()}`;
  };

  const formatShares = (shares: number): string => {
    if (shares >= 1e6) return `${(shares / 1e6).toFixed(1)}M`;
    if (shares >= 1e3) return `${(shares / 1e3).toFixed(1)}K`;
    return shares.toLocaleString();
  };

  return (
    <div className={`${cardBgColor} rounded-lg border ${borderColor} shadow-sm hover:shadow-md transition-all duration-200 h-64 flex flex-col`}>
      <div className="flex items-center justify-between p-4 border-b ${borderColor}">
        <div className="flex items-center space-x-2">
          <Building2 size={20} className="text-purple-600" />
          <h3 className={`text-lg font-semibold ${textColor}`}>Institutional Holdings</h3>
        </div>
        <span className={`text-sm ${subTextColor}`}>Latest 13F</span>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <div className="overflow-x-auto h-full">
          <table className={`min-w-full ${textColor}`}>
            <thead className={`${headerBg} border-b ${borderColor}`}>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Institution</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Ticker</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Value</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${borderColor}`}>
              {mockFilings.map((filing, index) => (
                <tr key={index} className={`${hoverBg} cursor-pointer transition-colors`}>
                  <td className="px-4 py-2 font-medium text-sm truncate max-w-32">{filing.institutionName}</td>
                  <td className="px-4 py-2 text-sm font-medium">{filing.ticker}</td>
                  <td className="px-4 py-2 text-sm">{formatValue(filing.valueHeld)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Mock Watchlist Preview (matching WatchlistSection design)
export const WatchlistPreview: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

  const mockWatchlist = [
    { ticker: 'AAPL', price: 175.43, change: 2.34, sentiment: 'Bullish' },
    { ticker: 'GOOGL', price: 135.67, change: -1.23, sentiment: 'Neutral' },
    { ticker: 'MSFT', price: 378.91, change: 0.87, sentiment: 'Bullish' },
    { ticker: 'TSLA', price: 248.50, change: 4.56, sentiment: 'Bullish' }
  ];

  const getSentimentBadgeClasses = (sentiment: string) => {
    if (sentiment === 'Bullish') {
      return isLight ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400';
    } else if (sentiment === 'Bearish') {
      return isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-400';
    } else {
      return isLight ? 'bg-yellow-100 text-yellow-700' : 'bg-yellow-500/20 text-yellow-400';
    }
  };

  return (
    <div className={`${cardBgColor} rounded-lg p-4 border ${borderColor} shadow-sm hover:shadow-md transition-all duration-200 h-64 flex flex-col`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Star size={20} className="text-purple-600" />
          <h3 className={`text-lg font-semibold ${textColor}`}>Watchlist</h3>
        </div>
        <div className="flex items-center space-x-2">
          <button className={`text-sm bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-3 py-1 rounded transition-all`}>
            Add Ticker
          </button>
          <button className={`p-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all`}>
            <RefreshCw size={14} className="text-white" />
          </button>
        </div>
      </div>
      
      <div className="space-y-3 flex-1 overflow-hidden">
        {mockWatchlist.map((stock, index) => (
          <div key={stock.ticker} className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <span className={`font-medium ${textColor} text-sm`}>{stock.ticker}</span>
              <span className={`text-xs px-2 py-1 rounded flex-shrink-0 font-medium ${getSentimentBadgeClasses(stock.sentiment)}`}>
                {stock.sentiment}
              </span>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`font-medium ${textColor} text-sm`}>${stock.price.toFixed(2)}</div>
              <div className={`text-xs font-medium ${stock.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Mock Activity Preview (enhanced design)
export const ActivityPreview: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const dividerBorder = isLight ? 'border-stone-400' : 'border-gray-600';

  const mockActivities = [
    { 
      type: 'watchlist_add', 
      title: 'Added AAPL to watchlist', 
      description: 'Apple Inc. (AAPL)',
      time: '2h ago',
      symbol: 'AAPL'
    },
    { 
      type: 'sentiment_check', 
      title: 'Checked TSLA sentiment', 
      description: 'Sentiment analysis completed',
      time: '4h ago',
      symbol: 'TSLA'
    },
    { 
      type: 'earnings_view', 
      title: 'Viewed MSFT earnings', 
      description: 'Upcoming earnings report',
      time: '1d ago',
      symbol: 'MSFT'
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'watchlist_add':
        return 'bg-green-500';
      case 'sentiment_check':
        return 'bg-blue-500';
      case 'earnings_view':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSymbolBadgeClasses = () => {
    return isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400';
  };

  return (
    <div className={`${cardBgColor} rounded-lg p-4 border ${borderColor} shadow-sm hover:shadow-md transition-all duration-200 h-64 flex flex-col`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Activity size={20} className="text-purple-600" />
          <h3 className={`text-lg font-semibold ${textColor}`}>Recent Activity</h3>
        </div>
        <span className={`text-sm ${subTextColor}`}>Last 24h</span>
      </div>
      
      <div className="space-y-3 flex-1 overflow-hidden">
        {mockActivities.map((activity, index) => (
          <div key={index} className="flex items-start space-x-3">
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getActivityIcon(activity.type)}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className={`text-sm font-medium ${textColor} truncate`}>{activity.title}</p>
                {activity.symbol && (
                  <span className={`text-xs px-2 py-1 rounded font-medium flex-shrink-0 ml-2 ${getSymbolBadgeClasses()}`}>
                    {activity.symbol}
                  </span>
                )}
              </div>
              <p className={`text-xs ${subTextColor} truncate`}>{activity.description}</p>
              <p className={`text-xs ${subTextColor}`}>{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className={`mt-4 pt-3 border-t ${dividerBorder} flex-shrink-0`}>
        <p className={`text-xs ${subTextColor} text-center`}>
          Track your research and analysis activities
        </p>
      </div>
    </div>
  );
};

// AI Insights Preview Component
export const AIInsightsPreview: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const headingTextColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBgColor = 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700';
  
  const [showAnalysis, setShowAnalysis] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  const handleAnalyzeClick = () => {
    setIsAnalyzing(true);
    // Simulate analysis delay
    setTimeout(() => {
      setIsAnalyzing(false);
      setShowAnalysis(true);
    }, 1500);
  };

  return (
    <div className={`${cardBgColor} rounded-lg border ${borderColor} shadow-sm hover:shadow-md transition-all duration-200 w-full`}>
      <div className="p-6">
        <div className="flex items-center mb-4">
          <div className={`p-2 rounded-lg ${isLight ? 'bg-blue-100' : 'bg-blue-900 bg-opacity-50'}`}>
            <Activity size={24} className="text-blue-600" />
          </div>
          <h3 className={`text-xl font-semibold ml-3 ${headingTextColor}`}>AI Insights</h3>
        </div>
        
        {!showAnalysis ? (
          <div className="space-y-4">
            <p className={subTextColor}>
              Get instant AI-powered analysis of any stock, combining technicals, sentiment, and fundamentals.
            </p>
            <button
              onClick={handleAnalyzeClick}
              disabled={isAnalyzing}
              className={`${buttonBgColor} text-white px-4 py-2 rounded-md text-sm font-medium w-full flex items-center justify-center transition-colors`}
            >
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// All components are already exported at their declarations above