import React from 'react';
import { TrendingUp } from 'lucide-react';

interface EarningsAnalysisSearchProps {
  analysisTickerInput: string;
  setAnalysisTickerInput: (value: string) => void;
  onAnalyzeManualTicker: () => void;
  onTickerInputKeyPress: (e: React.KeyboardEvent) => void;
  onLoadAnalysis: (ticker: string) => void;
  upcomingEarningsCount: number;
  isLight: boolean;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  subTextColor: string;
}

const EarningsAnalysisSearch: React.FC<EarningsAnalysisSearchProps> = ({
  analysisTickerInput,
  setAnalysisTickerInput,
  onAnalyzeManualTicker,
  onTickerInputKeyPress,
  onLoadAnalysis,
  upcomingEarningsCount,
  isLight,
  cardBg,
  cardBorder,
  textColor,
  subTextColor
}) => {
  return (
    <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
      <div className="p-6 h-full flex flex-col items-center justify-center">
        <div className={`flex flex-col items-center text-center max-w-md mx-auto space-y-6`}>
          <div className={`p-4 rounded-full ${isLight ? 'bg-blue-100' : 'bg-blue-900/30'}`}>
            <TrendingUp className={`w-8 h-8 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
          </div>
          
          <div className="space-y-2">
            <h3 className={`text-lg font-semibold ${textColor}`}>
              Earnings Analysis
            </h3>
            <p className={`text-sm ${subTextColor}`}>
              Enter a ticker symbol to analyze earnings history, surprises, and financial metrics
            </p>
          </div>
          
          <div className="w-full space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={analysisTickerInput}
                onChange={(e) => setAnalysisTickerInput(e.target.value.toUpperCase())}
                onKeyPress={onTickerInputKeyPress}
                placeholder="Enter ticker (e.g., AAPL)"
                className={`flex-1 px-3 py-2 border rounded-md text-sm ${
                  isLight 
                    ? 'bg-white border-stone-300 text-stone-900 placeholder-stone-500 focus:border-blue-500' 
                    : 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                maxLength={10}
              />
              <button
                onClick={onAnalyzeManualTicker}
                disabled={!analysisTickerInput.trim()}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !analysisTickerInput.trim()
                    ? isLight 
                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed' 
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : isLight
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                Analyze
              </button>
            </div>
            
            <div className={`text-xs ${subTextColor} text-center`}>
              {upcomingEarningsCount > 0 ? 'Or click a ticker from the Upcoming Earnings tab' : 'Enter any ticker symbol to get started'}
            </div>
            
            <div className="w-full">
              <p className={`text-xs ${subTextColor} mb-2 text-center`}>
                Popular tickers:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'].map((ticker) => (
                  <button
                    key={ticker}
                    onClick={() => {
                      setAnalysisTickerInput(ticker);
                      onLoadAnalysis(ticker);
                    }}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      isLight
                        ? 'border-stone-300 text-stone-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50'
                        : 'border-gray-600 text-gray-400 hover:border-blue-400 hover:text-blue-400 hover:bg-blue-900/20'
                    }`}
                  >
                    {ticker}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EarningsAnalysisSearch; 