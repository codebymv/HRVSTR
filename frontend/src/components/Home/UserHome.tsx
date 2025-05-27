import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  BarChart2, 
  ListChecks, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  ArrowRight,
  Star,
  Activity
} from 'lucide-react';

const UserHome: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  
  // Theme-specific styling
  const isLight = theme === 'light';
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

  // Mock data - in a real app, this would come from your backend
  const recentActivity = [
    { type: 'sentiment', title: 'AAPL Sentiment Analysis', time: '2 hours ago' },
    { type: 'filing', title: 'New SEC Filing: MSFT', time: '5 hours ago' },
    { type: 'earnings', title: 'TSLA Earnings Report', time: '1 day ago' },
  ];

  const watchlist = [
    { symbol: 'AAPL', name: 'Apple Inc.', change: '+2.5%' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', change: '-1.2%' },
    { symbol: 'TSLA', name: 'Tesla Inc.', change: '+5.7%' },
  ];

  const upcomingEvents = [
    { type: 'earnings', company: 'NVDA', date: 'Tomorrow, 4:30 PM ET' },
    { type: 'filing', company: 'AMZN', date: 'In 2 days' },
    { type: 'earnings', company: 'META', date: 'In 3 days' },
  ];

  return (
    <div className={`min-h-screen ${bgColor} p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className={`${cardBgColor} rounded-lg p-6 mb-6 border ${borderColor}`}>
          <h1 className={`text-2xl font-bold ${textColor}`}>
            Welcome back, {user?.name}!
          </h1>
          <p className={`${secondaryTextColor} mt-2`}>
            Here's what's happening with your tracked companies
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <button 
            onClick={() => navigate('/sentiment')}
            className={`${cardBgColor} p-4 rounded-lg border ${borderColor} hover:scale-105 transition-transform flex items-center space-x-3`}
          >
            <BarChart2 className="w-6 h-6 text-blue-500" />
            <span className={textColor}>Sentiment Analysis</span>
          </button>
          <button 
            onClick={() => navigate('/sec-filings')}
            className={`${cardBgColor} p-4 rounded-lg border ${borderColor} hover:scale-105 transition-transform flex items-center space-x-3`}
          >
            <ListChecks className="w-6 h-6 text-blue-500" />
            <span className={textColor}>SEC Filings</span>
          </button>
          <button 
            onClick={() => navigate('/earnings')}
            className={`${cardBgColor} p-4 rounded-lg border ${borderColor} hover:scale-105 transition-transform flex items-center space-x-3`}
          >
            <TrendingUp className="w-6 h-6 text-blue-500" />
            <span className={textColor}>Earnings Monitor</span>
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Watchlist */}
          <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
                <Star className="w-5 h-5 mr-2 text-yellow-500" />
                Watchlist
              </h2>
              <button className={`text-sm ${buttonBgColor} text-white px-3 py-1 rounded`}>
                Add Ticker
              </button>
            </div>
            <div className="space-y-4">
              {watchlist.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${textColor}`}>{item.symbol}</p>
                    <p className={`text-sm ${secondaryTextColor}`}>{item.name}</p>
                  </div>
                  <span className={`font-medium ${item.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                    {item.change}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
                <Activity className="w-5 h-5 mr-2 text-blue-500" />
                Recent Activity
              </h2>
            </div>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${textColor}`}>{activity.title}</p>
                    <p className={`text-sm ${secondaryTextColor}`}>{activity.time}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-blue-500" />
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} lg:col-span-2`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
                <Clock className="w-5 h-5 mr-2 text-blue-500" />
                Upcoming Events
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {upcomingEvents.map((event, index) => (
                <div key={index} className={`p-4 rounded-lg border ${borderColor} ${cardBgColor}`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-blue-500" />
                    <span className={`font-medium ${textColor}`}>{event.company}</span>
                  </div>
                  <p className={`text-sm ${secondaryTextColor}`}>{event.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserHome; 