import React from 'react';
import { TrendingUp, TrendingDown, BarChart2, AlertTriangle, Info } from 'lucide-react';
import { EarningsAnalysis } from '../../types';

interface EarningsAnalysisContentProps {
  earningsAnalysis: EarningsAnalysis | null;
  isLoading: boolean;
  error: string | null;
  isLight: boolean;
  cardBg: string;
  cardBorder: string;
  headerBg: string;
  textColor: string;
  subTextColor: string;
}

const EarningsAnalysisContent: React.FC<EarningsAnalysisContentProps> = ({
  earningsAnalysis,
  isLoading,
  error,
  isLight,
  cardBg,
  cardBorder,
  headerBg,
  textColor,
  subTextColor
}) => {
  if (isLoading) {
    return (
      <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
        <div className={`${headerBg} p-4`}>
          <h2 className={`text-lg font-semibold ${textColor}`}>Earnings Analysis</h2>
        </div>
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
            Analyzing Earnings Data
          </h3>
          <p className={`text-sm ${subTextColor}`}>
            Processing financial metrics and historical data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
        <div className={`${headerBg} p-4`}>
          <h2 className={`text-lg font-semibold ${textColor}`}>Earnings Analysis</h2>
        </div>
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <AlertTriangle className="text-red-500 mb-4" size={32} />
          <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
            Analysis Error
          </h3>
          <p className={`text-sm ${subTextColor}`}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!earningsAnalysis) {
    return null;
  }

  return (
    <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
      <div className={`${headerBg} p-4`}>
        <h2 className={`text-lg font-semibold ${textColor}`}>
          Earnings Analysis - {earningsAnalysis.ticker}
        </h2>
      </div>
      <div className="p-6 overflow-auto h-full">
        <div className="space-y-6">
          {/* Company Overview */}
          <div className={`${isLight ? 'bg-stone-200' : 'bg-gray-800/90'} rounded-lg p-4`}>
            <div className="flex items-center space-x-2 mb-3">
              <Info size={20} className="text-blue-400" />
              <span className="text-sm font-medium">Company Overview</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Market Cap:</span>
                  <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                    {(earningsAnalysis.marketCap !== null && earningsAnalysis.marketCap !== undefined)
                      ? earningsAnalysis.marketCap > 1e12
                        ? `$${(earningsAnalysis.marketCap / 1e12).toFixed(2)}T`
                        : earningsAnalysis.marketCap > 1e9
                          ? `$${(earningsAnalysis.marketCap / 1e9).toFixed(2)}B`
                          : `$${(earningsAnalysis.marketCap / 1e6).toFixed(2)}M`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>P/E Ratio:</span>
                  <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                    {(earningsAnalysis.pe !== null && earningsAnalysis.pe !== undefined) ? earningsAnalysis.pe.toFixed(2) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>EPS:</span>
                  <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                    {(earningsAnalysis.eps !== null && earningsAnalysis.eps !== undefined) ? `$${earningsAnalysis.eps.toFixed(2)}` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Metrics */}
          <div className={`${isLight ? 'bg-stone-200' : 'bg-gray-800/90'} rounded-lg p-4`}>
            <div className="flex items-center space-x-2 mb-3">
              <TrendingUp size={20} className="text-green-400" />
              <span className="text-sm font-medium">Financial Metrics</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Current Price:</span>
                  <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                    {(earningsAnalysis.currentPrice !== null && earningsAnalysis.currentPrice !== undefined)
                      ? `$${earningsAnalysis.currentPrice.toFixed(2)}`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Price Change:</span>
                  <span className={
                    (earningsAnalysis.priceChangePercent === null || earningsAnalysis.priceChangePercent === undefined)
                      ? isLight ? 'text-stone-600' : 'text-gray-400'
                      : earningsAnalysis.priceChangePercent > 0 
                        ? 'text-green-500 font-medium' 
                        : 'text-red-500 font-medium'
                  }>
                    {(earningsAnalysis.priceChangePercent !== null && earningsAnalysis.priceChangePercent !== undefined)
                      ? `${earningsAnalysis.priceChangePercent > 0 ? '+' : ''}${earningsAnalysis.priceChangePercent.toFixed(2)}%`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Day Range:</span>
                  <span className={isLight ? 'text-stone-900 font-medium' : 'text-white font-medium'}>
                    {earningsAnalysis.dayLow && earningsAnalysis.dayHigh
                      ? `$${earningsAnalysis.dayLow.toFixed(2)} - $${earningsAnalysis.dayHigh.toFixed(2)}`
                      : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>52W Range:</span>
                  <span className={isLight ? 'text-stone-900 font-medium' : 'text-white font-medium'}>
                    {earningsAnalysis.yearLow && earningsAnalysis.yearHigh
                      ? `$${earningsAnalysis.yearLow.toFixed(2)} - $${earningsAnalysis.yearHigh.toFixed(2)}`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Earnings Date:</span>
                  <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                    {earningsAnalysis.earningsDate 
                      ? new Date(earningsAnalysis.earningsDate).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Analysis Score:</span>
                  <span className={
                    (earningsAnalysis.analysisScore ?? 0) >= 70 ? 'text-green-500 font-medium' :
                    (earningsAnalysis.analysisScore ?? 0) >= 50 ? 'text-yellow-500 font-medium' :
                    'text-red-500 font-medium'
                  }>
                    {earningsAnalysis.analysisScore ? `${earningsAnalysis.analysisScore}/100` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Earnings History */}
          {/* Note: Earnings history would be displayed here if available in the interface */}
          
          {/* Analysis Summary */}
          {/* Note: Analysis summary would be displayed here if available in the interface */}
        </div>
      </div>
    </div>
  );
};

export default EarningsAnalysisContent; 