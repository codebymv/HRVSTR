import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, Building2, Calendar, DollarSign, Activity } from 'lucide-react';

// Mock Sentiment Chart Preview
export const SentimentPreview: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-400';

  // Mock data for the last 7 days
  const mockData = [
    { date: 'Fri', bullish: 55, neutral: 25, bearish: 20 },
    { date: 'Sat', bullish: 42, neutral: 38, bearish: 20 },
    { date: 'Sun', bullish: 50, neutral: 30, bearish: 20 }
  ];

  return (
    <div className={`${cardBg} rounded-lg p-4 border ${cardBorder} h-64 flex flex-col`}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <BarChart2 size={20} className="text-blue-500" />
          <h3 className={`text-lg font-semibold ${textColor}`}>Sentiment Analysis</h3>
        </div>
        <span className={`text-sm ${subTextColor}`}>AAPL • 7D</span>
      </div>
      
      <div className="space-y-3 mb-4 flex-1">
        {mockData.map((day, index) => (
          <div key={day.date} className="flex items-center justify-between">
            <span className={`text-sm ${subTextColor} w-8`}>{day.date}</span>
            <div className="flex-1 mx-3">
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                <div 
                  className="bg-green-500"
                  style={{ width: `${(day.bullish / 100) * 100}%` }}
                />
                <div 
                  className="bg-yellow-500"
                  style={{ width: `${(day.neutral / 100) * 100}%` }}
                />
                <div 
                  className="bg-red-500"
                  style={{ width: `${(day.bearish / 100) * 100}%` }}
                />
              </div>
            </div>
            <span className={`text-sm font-medium ${textColor} w-12 text-right`}>
              {day.bullish > day.bearish ? '+' : ''}{day.bullish - day.bearish}%
            </span>
          </div>
        ))}
      </div>
      
      <div className="flex justify-between text-xs flex-shrink-0">
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-500 rounded"></div>
          <span className={subTextColor}>Bullish</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-yellow-500 rounded"></div>
          <span className={subTextColor}>Neutral</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-red-500 rounded"></div>
          <span className={subTextColor}>Bearish</span>
        </div>
      </div>
    </div>
  );
};

// Mock Earnings Monitor Preview
export const EarningsPreview: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const rowBg = isLight ? 'bg-stone-200' : 'bg-gray-800';

  const mockEarnings = [
    { ticker: 'AAPL', date: 'Oct 31', estimate: '$1.39', surprise: '+2.1%', reaction: '+3.2%' },
    { ticker: 'GOOGL', date: 'Nov 1', estimate: '$1.85', surprise: '-1.5%', reaction: '-2.8%' },
    { ticker: 'MSFT', date: 'Nov 2', estimate: '$2.99', surprise: '+4.2%', reaction: '+5.1%' },
    { ticker: 'TSLA', date: 'Nov 3', estimate: '$0.73', surprise: '+8.9%', reaction: '+12.4%' }
  ];

  return (
    <div className={`${cardBg} rounded-lg p-4 border ${cardBorder} h-64 flex flex-col`}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Calendar size={20} className="text-blue-500" />
          <h3 className={`text-lg font-semibold ${textColor}`}>Upcoming Earnings</h3>
        </div>
        <span className={`text-sm ${subTextColor}`}>This Week</span>
      </div>
      
      <div className="space-y-2 flex-1 overflow-hidden">
        {mockEarnings.map((earning, index) => (
          <div key={earning.ticker} className={`${rowBg} rounded p-2`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <span className={`font-medium ${textColor} text-sm`}>{earning.ticker}</span>
                <span className={`text-xs ${subTextColor}`}>{earning.date}</span>
              </div>
              <span className={`text-xs ${subTextColor}`}>{earning.estimate}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={earning.surprise.startsWith('+') ? 'text-green-500' : 'text-red-500'}>
                {earning.surprise} surprise
              </span>
              <span className={earning.reaction.startsWith('+') ? 'text-green-500' : 'text-red-500'}>
                {earning.reaction} reaction
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Mock SEC Filings Preview
export const SECFilingsPreview: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const rowBg = isLight ? 'bg-stone-200' : 'bg-gray-800';

  const mockFilings = [
    { 
      institution: 'Berkshire Hathaway', 
      ticker: 'AAPL', 
      action: 'Increased', 
      shares: '915.6M',
      value: '$174.3B',
      change: '+2.3%'
    },
    { 
      institution: 'Vanguard Group', 
      ticker: 'MSFT', 
      action: 'Decreased', 
      shares: '421.2M',
      value: '$142.8B',
      change: '-1.1%'
    },
    { 
      institution: 'BlackRock', 
      ticker: 'GOOGL', 
      action: 'New Position', 
      shares: '89.4M',
      value: '$12.1B',
      change: 'New'
    }
  ];

  return (
    <div className={`${cardBg} rounded-lg p-4 border ${cardBorder} h-64 flex flex-col`}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Building2 size={20} className="text-blue-500" />
          <h3 className={`text-lg font-semibold ${textColor}`}>Institutional Holdings</h3>
        </div>
        <span className={`text-sm ${subTextColor}`}>Latest 13F</span>
      </div>
      
      <div className="space-y-2 flex-1 overflow-hidden">
        {mockFilings.map((filing, index) => (
          <div key={index} className={`${rowBg} rounded p-2`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                <span className={`font-medium ${textColor} text-sm truncate`}>{filing.institution}</span>
                <span className={`text-xs px-1 py-0.5 rounded flex-shrink-0 ${
                  filing.action === 'Increased' ? 'bg-green-500/20 text-green-400' :
                  filing.action === 'Decreased' ? 'bg-red-500/20 text-red-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {filing.action}
                </span>
              </div>
              <span className={`font-medium ${textColor} text-sm`}>{filing.ticker}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={`${subTextColor} truncate`}>{filing.shares} • {filing.value}</span>
              <span className={`flex-shrink-0 ${filing.change === 'New' ? 'text-blue-400' : 
                filing.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                {filing.change}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Mock Watchlist Preview
export const WatchlistPreview: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-400';

  const mockWatchlist = [
    { ticker: 'AAPL', price: '$175.43', change: '+2.34%', sentiment: 'Bullish' },
    { ticker: 'GOOGL', price: '$135.67', change: '-1.23%', sentiment: 'Neutral' },
    { ticker: 'MSFT', price: '$378.91', change: '+0.87%', sentiment: 'Bullish' },
    { ticker: 'TSLA', price: '$248.50', change: '+4.56%', sentiment: 'Bullish' }
  ];

  return (
    <div className={`${cardBg} rounded-lg p-4 border ${cardBorder} h-64 flex flex-col`}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <DollarSign size={20} className="text-blue-500" />
          <h3 className={`text-lg font-semibold ${textColor}`}>Watchlist</h3>
        </div>
        <span className={`text-sm ${subTextColor}`}>Live Prices</span>
      </div>
      
      <div className="space-y-3 flex-1 overflow-hidden">
        {mockWatchlist.map((stock, index) => (
          <div key={stock.ticker} className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <span className={`font-medium ${textColor} text-sm`}>{stock.ticker}</span>
              <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ${
                stock.sentiment === 'Bullish' ? 'bg-green-500/20 text-green-400' :
                stock.sentiment === 'Bearish' ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {stock.sentiment}
              </span>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`font-medium ${textColor} text-sm`}>{stock.price}</div>
              <div className={`text-xs ${stock.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                {stock.change}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Mock Activity Preview
export const ActivityPreview: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-400';

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

  return (
    <div className={`${cardBg} rounded-lg p-4 border ${cardBorder} h-64 flex flex-col`}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Activity size={20} className="text-blue-500" />
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
                  <span className={`text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 flex-shrink-0 ml-2`}>
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
      
      <div className="mt-4 pt-3 border-t border-gray-600 flex-shrink-0">
        <p className={`text-xs ${subTextColor} text-center`}>
          Track your research and analysis activities
        </p>
      </div>
    </div>
  );
}; 