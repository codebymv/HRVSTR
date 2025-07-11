import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart2, ListChecks, TrendingUp, ArrowRight, Eye, Star, Map, MoreHorizontal, Activity, Brain, Check, Sparkle } from 'lucide-react';
import BackgroundLeaves from '../UI/BackgroundLeaves';
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
import { useImagePreloader } from '../../hooks/useImagePreloader';

// Define image arrays for preloading
const LOGO_IMAGES = [
  "/hrvstr_logo.png",
  "/hrvstr_icon.png"
];

const Home: React.FC = () => {
  const { theme } = useTheme();
  const { isAuthenticated, signIn, token } = useAuth();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  
  // Use image preloader
  const { imagesLoaded: logosLoaded, loadedImages: loadedLogos } = useImagePreloader({
    images: LOGO_IMAGES
  });

  const allLogosReady = logosLoaded && loadedLogos.size === LOGO_IMAGES.length;
  
  // Theme-specific styling
  const isLight = theme === 'light';
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBgColor = 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700';
  
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
    <div className={`min-h-screen ${bgColor} relative overflow-hidden`}>
      {/* Premium Background Animation */}
      <BackgroundLeaves 
        opacity={isLight ? 0.25 : 0.18} 
        leafCount={15}
        isLight={isLight}
      />
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            {/* Show full logo on sm screens and up */}
            <div className={`transition-opacity duration-350 ${allLogosReady ? 'opacity-100' : 'opacity-0'}`}>
              <img 
                src="/hrvstr_logo.png" 
                alt="HRVSTR Logo"
                className="hidden sm:block h-16 md:h-24 w-auto object-contain"
                style={{ filter: logoFilter }}
                loading="eager"
                decoding="sync"
              />
            </div>
            {/* Show icon on screens smaller than sm */}
            <div className={`transition-opacity duration-350 ${allLogosReady ? 'opacity-100' : 'opacity-0'}`}>
              <img 
                src="/hrvstr_icon.png" 
                alt="HRVSTR Icon"
                className="block sm:hidden h-16 w-auto object-contain"
                style={{ filter: logoFilter }}
                loading="eager"
                decoding="sync"
              />
            </div>
          </div>
          <h1 className={`text-4xl md:text-6xl font-bold mb-6 ${textColor}`}>
            Strategic Web Scraping,{" "}
            <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
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
              <div className={`text-purple-600 mb-4`}>
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
              <Eye className="w-6 h-6 text-purple-600 mr-2" />
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
            <div className={`${cardBgColor} rounded-lg p-4 border ${borderColor} shadow-sm hover:shadow-md transition-all duration-200 h-64 flex flex-col items-center justify-center text-center`}>
              <div className="mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <ArrowRight className="w-8 h-8 text-white" />
                </div>
                <h3 className={`text-lg font-semibold mb-2 ${textColor}`}>
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

          {/* AI Insights Preview - Full Width */}
          <div className="mt-8">
            <div className={`${cardBgColor} rounded-lg border ${borderColor} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden`}>
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                  <div>
                    <h3 className={`text-2xl font-bold ${textColor} mb-2 flex items-center`}>
                      <Sparkle className="w-5 h-5 mr-2 text-purple-500" />
                      AI-Powered Market Intelligence
                    </h3>
                    <p className={`${secondaryTextColor} max-w-3xl`}>
                      Get exclusive AI insights into custom datasets. Our advanced algorithms analyze market trends, sentiment, and technical indicators to deliver actionable intelligence.
                    </p>
                  </div>
                  <div 
                    className="mt-4 md:mt-0 bg-gradient-to-r from-blue-600/80 to-purple-700/80 text-white/70 px-6 py-2.5 rounded-lg font-medium flex items-center justify-center cursor-default shadow-inner border border-white/5"
                  >
                    <Brain className="w-5 h-5 mr-2" />
                    <span>Analysis Complete</span>
                  </div>
                </div>
                
                <div className={`border-t ${borderColor} pt-6`}>
                  <div className="grid grid-cols-1 gap-6">
                    <div className={`p-4 rounded-lg ${isLight ? 'bg-blue-50' : 'bg-blue-900 bg-opacity-30'} border border-blue-200`}>
                      <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">Deep Market Analysis</h4>
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        AI contextualizes unique and exclusive datasets to identify patterns and opportunities that traditional analysis might miss.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
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
              <Map className="w-6 h-6 text-purple-600 mr-2" />
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
                href="/help/Version/0.8.9-overview"
                className="text-sm text-blue-500 hover:text-blue-600 flex items-center justify-center"
              >
                📋 Version 0.8.9 Notes
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
                  <span className={`text-lg font-medium ${textColor}`}>v0.8.9</span>
                  <span className={`text-lg font-bold ${textColor}`}>v1.0 Stable Release</span>
                </div>
                <div className={`w-full bg-gray-300 rounded-full h-3 ${isLight ? 'bg-stone-400' : 'bg-gray-700'}`}>
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500" style={{ width: '89%' }}></div>
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