import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart2, ListChecks, TrendingUp, ArrowRight } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  
  // Theme-specific styling
  const isLight = theme === 'light';
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';
  
  const features = [
    {
      icon: <BarChart2 className="w-6 h-6" />,
      title: 'Sentiment Analysis',
      description: 'Track market sentiment from Reddit, FinViz, and Yahoo Finance'
    },
    {
      icon: <ListChecks className="w-6 h-6" />,
      title: 'SEC Filings',
      description: 'Monitor insider trading and institutional holdings'
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Earnings Monitor',
      description: 'Stay updated with upcoming earnings and market reactions'
    }
  ];

  return (
    <div className={`min-h-screen ${bgColor}`}>
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img 
              src="/hrvstr_logo.png" 
              alt="HRVSTR" 
              className="h-16 md:h-24 w-auto object-contain"
            />
          </div>
          
          <h1 className={`text-4xl md:text-6xl font-bold mb-6 ${textColor}`}>
            Strategic Web Scraping, Simplified
          </h1>
          <p className={`text-xl md:text-2xl mb-8 ${secondaryTextColor} max-w-3xl mx-auto`}>
            Your comprehensive platform for market sentiment analysis and financial monitoring
          </p>
          {!isAuthenticated && (
            <button
              onClick={() => navigate('/sentiment')}
              className={`${buttonBgColor} text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors flex items-center mx-auto`}
            >
              Get Started
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`${cardBgColor} p-6 rounded-lg border ${borderColor} transition-transform hover:scale-105`}
            >
              <div className={`text-blue-500 mb-4`}>
                {feature.icon}
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${textColor}`}>
                {feature.title}
              </h3>
              <p className={secondaryTextColor}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home; 