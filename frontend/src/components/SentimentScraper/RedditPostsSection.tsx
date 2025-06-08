import React, { useRef, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import RedditPost from './RedditPost';
import ProgressBar from '../ProgressBar';
import { RedditPost as RedditPostType } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { getCreditBalance, getCreditCost, type CreditBalance } from '../../services/creditsApi';

interface RedditPostsSectionProps {
  posts: RedditPostType[];
  isLoading: boolean;
  loadingProgress?: number;
  loadingStage?: string;
  error: string | null;
  className?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  // New props to match the access-based pattern
  isCheckingAccess?: boolean;
  isFreshUnlock?: boolean;
}

const RedditPostsSection: React.FC<RedditPostsSectionProps> = ({
  posts,
  isLoading,
  loadingProgress = 0,
  loadingStage = 'Loading...',
  error,
  className = '',
  hasMore = false,
  onLoadMore,
  isCheckingAccess = false,
  isFreshUnlock = false
}) => {
  // Credit state for all posts
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [aiCreditCost, setAiCreditCost] = useState<number>(1);
  const [canAffordAI, setCanAffordAI] = useState<boolean>(false);
  const [loadingCredits, setLoadingCredits] = useState<boolean>(true);

  // Fetch credit information once for all posts
  useEffect(() => {
    const fetchCreditInfo = async () => {
      try {
        setLoadingCredits(true);
        const [balanceResult, costResult] = await Promise.all([
          getCreditBalance(),
          getCreditCost('ai_reddit_analysis')
        ]);
        
        if (balanceResult.success && balanceResult.balance) {
          setCreditBalance(balanceResult.balance);
        }
        
        if (costResult.success && costResult.cost !== undefined) {
          setAiCreditCost(costResult.cost);
        }
        
        // Check if user can afford AI analysis
        if (balanceResult.success && balanceResult.balance && costResult.success && costResult.cost !== undefined) {
          setCanAffordAI(balanceResult.balance.remaining >= costResult.cost);
        }
      } catch (error) {
        console.error('Error fetching credit info:', error);
      } finally {
        setLoadingCredits(false);
      }
    };
    
    fetchCreditInfo();
  }, []);

  // Handle credit updates from individual posts
  const handleCreditUpdate = useCallback((newBalance: CreditBalance) => {
    setCreditBalance(newBalance);
    setCanAffordAI(newBalance.remaining >= aiCreditCost);
  }, [aiCreditCost]);

  // Theme-specific styling using ThemeContext
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const headerBg = isLight ? 'bg-stone-400' : 'bg-gray-800';

  // Refs for infinite scroll
  const loadingRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(false);
  const lastLoadTimeRef = useRef(0);

  // Handle loading more posts
  const handleLoadMore = useCallback(() => {
    // Don't load if already loading, no more posts, or too soon since last load
    if (isLoadingMoreRef.current || !hasMore || isLoading || !onLoadMore) {
      return;
    }

    const now = Date.now();
    if (now - lastLoadTimeRef.current < 1000) {
      return;
    }

    isLoadingMoreRef.current = true;
    lastLoadTimeRef.current = now;

    onLoadMore();

    // Reset loading state after a delay
    setTimeout(() => {
      isLoadingMoreRef.current = false;
    }, 1000);
  }, [onLoadMore, isLoading, hasMore]);

  // Set up intersection observer
  useEffect(() => {
    if (!loadingRef.current || isLoading || !hasMore || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMoreRef.current) {
          handleLoadMore();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(loadingRef.current);

    return () => {
      if (loadingRef.current) observer.unobserve(loadingRef.current);
    };
  }, [handleLoadMore, isLoading, hasMore]);

  return (
    <div className={`${cardBgColor} rounded-lg border ${borderColor} overflow-hidden h-full ${className}`}>
      <div className={`${headerBg} p-4`}>
        <h2 className={`text-lg font-semibold ${textColor}`}>Latest Reddit Posts</h2>
      </div>
      
      {/* Show checking access state first */}
      {isCheckingAccess ? (
        <div className="flex flex-col items-center justify-center p-10 text-center min-h-[300px]">
          <Loader2 className="text-blue-500 animate-spin mb-4" size={32} />
          <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
            Checking Access...
          </h3>
          <p className={`text-sm ${mutedTextColor} mb-4`}>
            Verifying component access...
          </p>
          <div className="w-full max-w-md">
            <ProgressBar progress={50} />
            <div className={`text-xs ${mutedTextColor} mt-2 text-center`}>
              Checking access...
            </div>
          </div>
        </div>
      ) : isLoading || (posts.length === 0 && !error) ? (
        <div className="p-4 min-h-[300px]">
          {isFreshUnlock ? (
            // Use HarvestLoadingCard for fresh unlocks (import when needed)
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-6 mb-4">
                <Loader2 className="text-white animate-spin" size={40} />
              </div>
              <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                Harvesting Reddit Data
              </h3>
              <p className={`text-sm ${mutedTextColor} mb-4`}>
                {loadingStage}
              </p>
              <div className="w-full max-w-md">
                <ProgressBar progress={loadingProgress} />
                <div className={`text-xs ${mutedTextColor} mt-2 text-center`}>
                  {loadingProgress}% complete
                </div>
              </div>
            </div>
          ) : (
            // Regular loading for cache loads
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <Loader2 className="mb-2 text-blue-500 animate-spin" size={32} />
              <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                Loading Reddit Posts
              </h3>
              <p className={`text-sm ${mutedTextColor} mb-4`}>
                Loading from cache...
              </p>
              <div className="w-full max-w-md">
                <ProgressBar progress={loadingProgress} />
                <div className={`text-xs ${mutedTextColor} mt-2 text-center`}>
                  {loadingStage} - {loadingProgress}%
                </div>
              </div>
            </div>
          )}
        </div>
      ) : error ? (
        <div className="p-4 min-h-[300px]">
          <div className="flex flex-col items-center justify-center p-10 text-center">
            {error.toLowerCase().includes('rate limit') ? (
              <>
                <AlertTriangle className="mb-2 text-red-500" size={32} />
                <p className={`text-lg font-semibold ${textColor}`}>Rate Limit Exceeded</p>
                <p className={`mt-2 ${mutedTextColor}`}>The Reddit API is currently rate limiting requests. Please wait a moment and try again later.</p>
                <button 
                  className={`mt-4 px-4 py-2 ${isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md transition-colors`}
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </button>
              </>
            ) : (
              <>
                <AlertTriangle className="mb-2 text-yellow-500" size={32} />
                <p className={textColor}>{error}</p>
              </>
            )}
          </div>
        </div>
      ) : posts.length > 0 ? (
        <div className="p-4 h-full overflow-hidden">
          <div 
            ref={containerRef} 
            className="grid gap-4 max-h-[700px] overflow-y-auto pr-2"
          >
            {posts.map(post => (
              <RedditPost 
                key={post.id} 
                post={post}
                creditBalance={creditBalance}
                aiCreditCost={aiCreditCost}
                canAffordAI={canAffordAI}
                loadingCredits={loadingCredits}
                onCreditUpdate={handleCreditUpdate}
              />
            ))}
            
            {/* Infinite scroll loading indicator */}
            {onLoadMore && (
              <div 
                ref={loadingRef}
                className="w-full h-[80px] flex justify-center items-center"
                style={{ contain: 'layout size' }}
              >
                {isLoading && hasMore ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="mb-2 text-blue-500 animate-spin" size={20} />
                    <p className={`text-sm ${mutedTextColor}`}>Loading more posts...</p>
                  </div>
                ) : hasMore ? (
                  <div className="h-[40px] opacity-0" /> // Smaller invisible spacer
                ) : posts.length > 10 ? (
                  <div className={`text-sm ${mutedTextColor} text-center py-2`}>
                    All {posts.length} posts loaded
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <Info className={`mb-2 ${mutedTextColor}`} size={32} />
            <p className={`${textColor} font-medium mb-2`}>No Reddit posts found</p>
            <p className={mutedTextColor}>Check back later for the latest financial discussions from Reddit communities.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RedditPostsSection;