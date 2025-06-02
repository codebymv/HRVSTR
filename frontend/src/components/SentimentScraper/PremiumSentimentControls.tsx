import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { Crown, Target, TrendingUp, Brain, AlertCircle, Zap } from 'lucide-react';

interface PremiumSentimentControlsProps {
  onResearchStart: (config: ResearchConfig) => void;
  remainingCredits: number;
  isLoading?: boolean;
}

interface ResearchConfig {
  analysisType: 'quick' | 'deep' | 'premium';
  timeframe: '1d' | '7d' | '30d';
  sources: string[];
  features: string[];
}

const PremiumSentimentControls: React.FC<PremiumSentimentControlsProps> = ({
  onResearchStart,
  remainingCredits,
  isLoading = false
}) => {
  const { theme } = useTheme();
  const { tierInfo } = useTier();
  const isLight = theme === 'light';
  
  const [selectedAnalysis, setSelectedAnalysis] = useState<'quick' | 'deep' | 'premium'>('quick');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1d' | '7d' | '30d'>('7d');
  const [selectedSources, setSelectedSources] = useState<string[]>(['reddit', 'finviz']);

  const analysisTypes = [
    {
      id: 'quick' as const,
      name: 'Quick Scan',
      credits: 5,
      description: 'Basic sentiment overview',
      icon: Zap,
      color: 'emerald',
      features: ['Reddit sentiment', 'Basic charts', '7-day analysis']
    },
    {
      id: 'deep' as const,
      name: 'Deep Analysis',
      credits: 15,
      description: 'Comprehensive market sentiment',
      icon: TrendingUp,
      color: 'blue',
      features: ['Multi-source sentiment', 'Trend analysis', 'Correlation insights', 'News impact']
    },
    {
      id: 'premium' as const,
      name: 'AI Insights',
      credits: 25,
      description: 'AI-powered market intelligence',
      icon: Brain,
      color: 'purple',
      features: ['AI pattern recognition', 'Predictive insights', 'Risk assessment', 'Trading signals']
    }
  ];

  const timeframes = [
    { id: '1d' as const, name: '24 Hours', multiplier: 1 },
    { id: '7d' as const, name: '7 Days', multiplier: 1.5 },
    { id: '30d' as const, name: '30 Days', multiplier: 2 }
  ];

  const sources = [
    { id: 'reddit', name: 'Reddit', enabled: true },
    { id: 'finviz', name: 'FinViz', enabled: true },
    { id: 'yahoo', name: 'Yahoo Finance', enabled: tierInfo?.tier !== 'free' },
    { id: 'news', name: 'Financial News', enabled: tierInfo?.tier === 'elite' || tierInfo?.tier === 'institutional' }
  ];

  const selectedAnalysisData = analysisTypes.find(a => a.id === selectedAnalysis)!;
  const selectedTimeframeData = timeframes.find(t => t.id === selectedTimeframe)!;
  const totalCredits = Math.ceil(selectedAnalysisData.credits * selectedTimeframeData.multiplier);

  const canAfford = remainingCredits >= totalCredits;
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';

  const handleStartAnalysis = () => {
    if (!canAfford || isLoading) return;
    
    onResearchStart({
      analysisType: selectedAnalysis,
      timeframe: selectedTimeframe,
      sources: selectedSources,
      features: selectedAnalysisData.features
    });
  };

  const toggleSource = (sourceId: string) => {
    setSelectedSources(prev => 
      prev.includes(sourceId) 
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  return (
    <div className={`${isLight ? 'bg-white border-stone-200' : 'bg-gray-800 border-gray-700'} border rounded-xl p-6 mb-6`}>
      <div className="flex items-center gap-3 mb-6">
        <Crown className="w-6 h-6 text-yellow-500" />
        <div>
          <h3 className={`font-semibold text-lg ${isLight ? 'text-stone-800' : 'text-white'}`}>
            Premium Analysis
          </h3>
          <p className={`text-sm ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
            {remainingCredits} credits remaining
          </p>
        </div>
      </div>

      {/* Analysis Type Selection */}
      <div className="space-y-4 mb-6">
        <h4 className={`font-medium ${isLight ? 'text-stone-700' : 'text-gray-300'}`}>
          Analysis Type
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {analysisTypes.map((analysis) => {
            const Icon = analysis.icon;
            const isSelected = selectedAnalysis === analysis.id;
            const creditCost = Math.ceil(analysis.credits * selectedTimeframeData.multiplier);
            
            return (
              <button
                key={analysis.id}
                onClick={() => setSelectedAnalysis(analysis.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? `border-${analysis.color}-500 bg-${analysis.color}-50 ${isLight ? '' : 'bg-opacity-10'}`
                    : `border-gray-300 ${isLight ? 'hover:border-gray-400' : 'border-gray-600 hover:border-gray-500'}`
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={`w-5 h-5 text-${analysis.color}-500`} />
                  <span className={`font-medium ${isLight ? 'text-stone-800' : 'text-white'}`}>
                    {analysis.name}
                  </span>
                  <span className={`ml-auto text-sm px-2 py-1 rounded ${
                    isSelected ? `bg-${analysis.color}-100 text-${analysis.color}-700` : 'bg-gray-100 text-gray-600'
                  }`}>
                    {creditCost} credits
                  </span>
                </div>
                <p className={`text-sm mb-3 ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
                  {analysis.description}
                </p>
                <div className="space-y-1">
                  {analysis.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full bg-${analysis.color}-500`} />
                      <span className={`text-xs ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeframe Selection */}
      <div className="mb-6">
        <h4 className={`font-medium mb-3 ${isLight ? 'text-stone-700' : 'text-gray-300'}`}>
          Analysis Timeframe
        </h4>
        <div className="flex gap-2">
          {timeframes.map((timeframe) => (
            <button
              key={timeframe.id}
              onClick={() => setSelectedTimeframe(timeframe.id)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                selectedTimeframe === timeframe.id
                  ? `border-blue-500 bg-blue-50 text-blue-700 ${isLight ? '' : 'bg-blue-900 bg-opacity-30 text-blue-300'}`
                  : `border-gray-300 ${isLight ? 'hover:border-gray-400' : 'border-gray-600 hover:border-gray-500'} ${isLight ? 'text-stone-700' : 'text-gray-300'}`
              }`}
            >
              {timeframe.name}
              {timeframe.multiplier > 1 && (
                <span className="ml-2 text-xs opacity-75">
                  +{Math.round((timeframe.multiplier - 1) * 100)}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Data Sources */}
      <div className="mb-6">
        <h4 className={`font-medium mb-3 ${isLight ? 'text-stone-700' : 'text-gray-300'}`}>
          Data Sources
        </h4>
        <div className="flex flex-wrap gap-2">
          {sources.map((source) => (
            <button
              key={source.id}
              onClick={() => source.enabled && toggleSource(source.id)}
              disabled={!source.enabled}
              className={`px-3 py-2 rounded-lg border transition-all ${
                selectedSources.includes(source.id) && source.enabled
                  ? `border-green-500 bg-green-50 text-green-700 ${isLight ? '' : 'bg-green-900 bg-opacity-30 text-green-300'}`
                  : source.enabled
                  ? `border-gray-300 ${isLight ? 'hover:border-gray-400 text-stone-700' : 'border-gray-600 hover:border-gray-500 text-gray-300'}`
                  : 'border-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {source.name}
              {!source.enabled && (
                <Crown className="w-3 h-3 ml-2 inline" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className={`${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
            Total cost: 
          </span>
          <span className={`ml-2 font-semibold ${canAfford ? 'text-green-600' : 'text-red-500'}`}>
            {totalCredits} credits
          </span>
        </div>
        
        <button
          onClick={handleStartAnalysis}
          disabled={!canAfford || isLoading || selectedSources.length === 0}
          className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
            canAfford && !isLoading && selectedSources.length > 0
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Target className="w-4 h-4" />
          {isLoading ? 'Analyzing...' : 'Start Analysis'}
        </button>
      </div>

      {!canAfford && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700">
            Insufficient credits. You need {totalCredits - remainingCredits} more credits.
          </span>
        </div>
      )}
    </div>
  );
};

export default PremiumSentimentControls; 