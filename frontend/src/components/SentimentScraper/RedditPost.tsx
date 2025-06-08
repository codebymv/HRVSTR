import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { MessageSquare, ArrowUpRight, ExternalLink, Brain, Loader2, Key, Lock, Sparkles, CreditCard } from 'lucide-react';
import { RedditPost as RedditPostType } from '../../types';
import { formatDate } from './sentimentUtils';
import { analyzeRedditPost } from '../../services/redditAnalysisService';
import { getCreditBalance, getCreditCost, type CreditBalance } from '../../services/creditsApi';

interface RedditPostProps {
  post: RedditPostType;
  creditBalance?: CreditBalance | null;
  aiCreditCost?: number;
  canAffordAI?: boolean;
  loadingCredits?: boolean;
  onCreditUpdate?: (newBalance: CreditBalance) => void;
}

const RedditPost: React.FC<RedditPostProps> = ({ 
  post,
  creditBalance = null,
  aiCreditCost = 1,
  canAffordAI = false,
  loadingCredits = true,
  onCreditUpdate
}) => {
  const { title, author, upvotes, commentCount, content, url, created, subreddit } = post;
  
  // Get contexts
  const { theme } = useTheme();
  const { tierInfo } = useTier();
  const isLight = theme === 'light';
  
  // AI analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // User tier info
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  const hasAIAccess = !loadingCredits && canAffordAI;
  
  // AI analysis handler
  const handleAnalyzePost = async () => {
    if (isAnalyzing || analysis) return; // Don't re-analyze if already done
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const result = await analyzeRedditPost(post);
      
      if (result.success && result.data) {
        setAnalysis(result.data.analysis);
        setShowAnalysis(true);
        
        // Update credit balance after successful analysis
        if (result.creditInfo && onCreditUpdate && creditBalance) {
          const updatedBalance: CreditBalance = {
            ...creditBalance,
            remaining: result.creditInfo.remaining,
            used: creditBalance.used + result.creditInfo.used
          };
          onCreditUpdate(updatedBalance);
        }
      } else {
        setError(result.message || 'Analysis failed');
        if (result.error === 'INSUFFICIENT_CREDITS') {
          setError(`Insufficient credits. Need ${aiCreditCost} credits but only have ${creditBalance?.remaining || 0}.`);
        } else if (result.upgradeRequired) {
          setError('AI analysis feature is not available in your tier');
        }
      }
    } catch (err) {
      setError('Failed to analyze post');
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Theme-specific styling
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
  // Use subtle hover effects with opacity for both light and dark modes
  const cardHoverEffect = isLight 
    ? 'hover:bg-stone-400/20' // 20% opacity for subtle light mode hover
    : 'hover:bg-gray-600/20';  // 20% opacity for subtle dark mode hover
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const headingTextColor = isLight ? 'text-stone-800' : 'text-white';
  const textColor = isLight ? 'text-stone-700' : 'text-gray-400';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-500';
  const linkHoverColor = 'hover:text-blue-500';
  
  // AI button styling - consistent theme like other unlock buttons
  const aiButtonColor = 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white';
  const aiButtonBorderColor = 'border-blue-500';
  
  return (
    <div className={`${cardBgColor} rounded-lg p-4 ${cardHoverEffect} transition-colors duration-200 border ${borderColor} cursor-pointer overflow-hidden w-full`}>
      <div className="flex justify-between items-start gap-2">
        <h3 className={`text-md font-semibold ${headingTextColor} line-clamp-2 flex-1 break-words`}>{title}</h3>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className={`${textColor} ${linkHoverColor} transition-colors shrink-0`}
        >
          <ExternalLink size={16} />
        </a>
      </div>
      
      <p className={`text-sm ${textColor} mt-2 line-clamp-3 break-words whitespace-normal`}>{content}</p>
      
      <div className={`flex flex-wrap items-center gap-2 mt-3 text-xs ${mutedTextColor}`}>
        <span className={`font-medium ${textColor}`}>r/{subreddit}</span>
        <span className="hidden sm:inline">•</span>
        <span>{formatDate(created)}</span>
      </div>
      
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <div className="flex items-center">
          <span className={`text-xs ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>by </span>
          <span className={`text-xs font-medium ${isLight ? 'text-blue-600' : 'text-blue-400'} ml-1`}>{author}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`flex items-center ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
            <ArrowUpRight size={16} className="text-green-500" />
            <span className="text-xs ml-1">{upvotes}</span>
          </div>
          
          <div className={`flex items-center ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
            <MessageSquare size={16} />
            <span className="text-xs ml-1">{commentCount}</span>
          </div>
        </div>
      </div>
      
      {/* On-Demand AI Analysis Section */}
      <div className="mt-3 pt-3 border-t border-gray-300/50 dark:border-gray-600/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Sparkles size={16} className="text-blue-500" />
            <span className={`text-sm font-medium ${headingTextColor}`}>
              On-Demand Analysis
            </span>
          </div>
          
          <button
            onClick={handleAnalyzePost}
            disabled={isAnalyzing || !!analysis || loadingCredits}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${aiButtonColor} ${aiButtonBorderColor} border disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : analysis ? (
              <>
                <Brain size={14} />
                <span>Analysis Complete</span>
              </>
            ) : (
              <>
                <Brain size={14} />
                <span>
                  {loadingCredits 
                    ? 'Loading...' 
                    : `Get AI insights for ${aiCreditCost} credit${aiCreditCost !== 1 ? 's' : ''}`
                  }
                </span>
              </>
            )}
          </button>
          
        </div>
        
        {analysis && (
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${mutedTextColor}`}>
              Fresh analysis generated on-demand
            </span>
            <button
              onClick={() => setShowAnalysis(!showAnalysis)}
              className={`text-xs ${textColor} ${linkHoverColor} transition-colors`}
            >
              {showAnalysis ? 'Hide' : 'Show'} Analysis
            </button>
          </div>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded text-xs text-red-700 dark:text-red-300">
            <div className="flex items-center space-x-2">
              {!hasAIAccess && <Lock size={12} />}
              <span>{error}</span>
            </div>
          </div>
        )}
        
        {/* On-Demand Analysis Display */}
        {analysis && showAnalysis && (
          <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Brain size={14} className="text-green-500" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-300">Fresh AI Analysis</span>
            </div>
            <p className="text-xs text-green-800 dark:text-green-200 leading-relaxed">
              {analysis}
            </p>
            <div className="mt-2 pt-2 border-t border-green-200/50 dark:border-green-700/50 flex justify-between items-center">
              <span className="text-xs text-green-600 dark:text-green-400 opacity-75">
                Gemini 1.5 Flash
              </span>
              <div className="flex items-center space-x-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600 dark:text-green-400">Just now</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RedditPost;