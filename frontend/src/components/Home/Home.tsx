import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart2, ListChecks, TrendingUp, ArrowRight, Eye, Star, Map, MoreHorizontal } from 'lucide-react';
import { 
  SentimentPreview, 
  EarningsPreview, 
  SECFilingsPreview, 
  WatchlistPreview, 
  ActivityPreview 
} from './PreviewComponents';
import PricingSection from '../Pricing/PricingSection';
import YearlyPricingCards from '../Pricing/YearlyPricingCards';
import { createCheckoutSession } from '../../utils/pricing';

const Home: React.FC = () => {
  const { theme } = useTheme();
  const { isAuthenticated, signIn, token } = useAuth();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  
  // Theme-specific styling
  const isLight = theme === 'light';
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';
  
  // Add logo filter for theme switching (same as in Navbar)
  const logoFilter = isLight ? 'invert(1) brightness(0)' : 'none';
  
  const handlePurchaseClick = async (tierName: string, isYearly: boolean = false) => {
    if (!isAuthenticated) {
      signIn();
      return;
    }

    setSelectedTier(tierName);
    setUpgrading(true);

    try {
      await createCheckoutSession(
        tierName,
        isYearly,
        token,
        `${window.location.origin}/settings/billing?success=true`,
        `${window.location.origin}/?cancelled=true`
      );
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setUpgrading(false);
    }
  };
  
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
    },
    {
      icon: <Star className="w-6 h-6" />,
      title: 'Watchlist',
      description: 'Track your favorite stocks with real-time prices and sentiment indicators'
    },
    {
      icon: <MoreHorizontal className="w-6 h-6" />,
      title: 'And More',
      description: 'Discover additional features and tools to enhance your trading strategy'
    }
  ];

  return (
    <div className={`min-h-screen ${bgColor}`}>
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            {/* Show full logo on sm screens and up */}
            <img 
              src="/hrvstr_logo.png" 
              alt="HRVSTR Logo"
              className="hidden sm:block h-16 md:h-24 w-auto object-contain"
              style={{ filter: logoFilter }}
            />
            {/* Show icon on screens smaller than sm */}
            <img 
              src="/hrvstr_icon.png" 
              alt="HRVSTR Icon"
              className="block sm:hidden h-16 w-auto object-contain"
              style={{ filter: logoFilter }}
            />
          </div>
          <h1 className={`text-4xl md:text-6xl font-bold mb-6 ${textColor}`}>
            Strategic Web Scraping,{" "}
            <span className="bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
                Simplified.
            </span>
            </h1>

          <p className={`text-xl md:text-2xl mb-8 ${secondaryTextColor} max-w-4xl mx-auto`}>
            A comprehensive solution for market sentiment analysis and financial monitoring.
          </p>
          {!isAuthenticated && (
            <button
              onClick={signIn}
              className={`${buttonBgColor} text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors flex items-center mx-auto`}
            >
              Get Started
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 max-w-7xl mx-auto mb-20">
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

        {/* Live Preview Section */}
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <Eye className="w-6 h-6 text-blue-500 mr-2" />
              <h2 className={`text-3xl md:text-4xl font-bold ${textColor}`}>
                Seeing is believing.
              </h2>
            </div>
            <p className={`text-lg ${secondaryTextColor} max-w-2xl mx-auto`}>
              Powerful analytics dashboards driven by real-time market data and insights.
            </p>
          </div>

          {/* Preview Components Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
            <SentimentPreview />
            <EarningsPreview />
            <SECFilingsPreview />
            <WatchlistPreview />
            <ActivityPreview />
            
            {/* Call to Action Card */}
            <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} h-64 flex flex-col items-center justify-center text-center`}>
              <div className="mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-teal-400 to-blue-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <ArrowRight className="w-8 h-8 text-white" />
                </div>
                <h3 className={`text-xl font-semibold mb-2 ${textColor}`}>
                  Ready to Get Started?
                </h3>
                <p className={`${secondaryTextColor} mb-4 text-sm`}>
                  Access the full dashboard with live data and advanced analytics.
                </p>
              </div>
              {!isAuthenticated && (
                <button
                  onClick={signIn}
                  className={`${buttonBgColor} text-white px-6 py-2 rounded-lg font-medium transition-colors`}
                >
                  Log In Now
                </button>
              )}
            </div>
          </div>


        </div>

        {/* Pricing Section */}
        <div className="mt-20">
          <PricingSection onPurchaseClick={handlePurchaseClick} />
        </div>

        {/* Yearly Pricing Section */}
        <div className="mt-20">
          <div className="max-w-6xl mx-auto">
            <YearlyPricingCards 
              onPurchaseClick={handlePurchaseClick}
              theme={theme}
            />
          </div>
        </div>

        {/* Loading State */}
        {upgrading && selectedTier && (
          <div className="mt-12 max-w-lg mx-auto">
            <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} text-center`}>
              <div className="flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
              <p className={textColor}>
                Processing your {selectedTier} plan upgrade...
              </p>
              <p className={`text-sm ${secondaryTextColor} mt-2`}>
                Redirecting to secure checkout...
              </p>
            </div>
          </div>
        )}

        {/* Progress Section */}
        <div className="max-w-7xl mx-auto mt-20">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <Map className="w-6 h-6 text-blue-500 mr-2" />
              <h2 className={`text-3xl md:text-4xl font-bold ${textColor}`}>
                Roadmap to 1.0!
              </h2>
            </div>
            <p className={`text-lg ${secondaryTextColor} max-w-2xl mx-auto mb-6`}>
              Tracking the progress of work to be done until 1.0 Release.
            </p>
            
            {/* Version Notes Link */}
            <div className="mb-8">
              <a 
                href="/help/Version/0.8.1-overview"
                className="text-sm text-blue-500 hover:text-blue-600 flex items-center justify-center"
              >
                📋 Version 0.8.1 Notes
                <ArrowRight className="w-4 h-4 ml-1" />
              </a>
            </div>
          </div>

          {/* Progress Bar */}
          <div className={`${cardBgColor} rounded-lg p-8 border ${borderColor} max-w-4xl mx-auto mb-12`}>
            <div className="space-y-6">
              {/* Overall Progress */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-lg font-medium ${textColor}`}>v0.8.1</span>
                  <span className={`text-lg font-bold ${textColor}`}>v1.0 Stable Release</span>
                </div>
                <div className={`w-full bg-gray-300 rounded-full h-3 ${isLight ? 'bg-stone-400' : 'bg-gray-700'}`}>
                  <div className="bg-gradient-to-r from-teal-400 to-blue-500 h-3 rounded-full transition-all duration-500" style={{ width: '81%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Home; 