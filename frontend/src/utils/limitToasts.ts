import { useToast } from '../contexts/ToastContext';

// Types for different limit scenarios
export interface LimitInfo {
  feature: string;
  current?: number;
  limit?: number;
  tier?: string;
}

/**
 * Standardized limit reached toast notifications
 * These show consistent messaging and link to /settings/usage
 */
export const useLimitToasts = () => {
  const { error, warning, info, success } = useToast();

  /**
   * Show a generic limit reached toast
   */
  const showLimitReached = (customMessage?: string) => {
    const message = customMessage || 'Limit reached! Check your usage';
    warning(message, 6000, { 
      clickable: true, 
      linkTo: '/settings/usage' 
    });
  };

  /**
   * Show credit purchase success toast
   */
  const showCreditsPurchased = (amount: number = 250) => {
    success(`🎉 ${amount} credits added to your account!`, 6000, {
      clickable: true,
      linkTo: '/settings/usage'
    });
  };

  /**
   * Show credit purchase cancelled toast
   */
  const showCreditPurchaseCancelled = () => {
    warning('Credit purchase was cancelled. You can try again anytime!', 5000);
  };

  /**
   * Show credit limit exceeded toast
   */
  const showCreditLimitExceeded = (remainingCredits = 0) => {
    const message = remainingCredits > 0 
      ? `Credit limit reached! ${remainingCredits} credits remaining`
      : 'Credit limit exceeded! Check your usage';
    error(message, 6000, { 
      clickable: true, 
      linkTo: '/settings/usage' 
    });
  };

  /**
   * Show watchlist limit reached toast
   */
  const showWatchlistLimitReached = (current?: number, limit?: number, tier?: string) => {
    let message = 'Watchlist limit reached! Check your usage';
    
    if (current && limit) {
      message = `Watchlist limit reached! ${current}/${limit} stocks`;
    }
    
    if (tier && tier.toLowerCase() === 'free') {
      message += ' - Upgrade for more slots';
    }
    
    warning(message, 6000, { 
      clickable: true, 
      linkTo: '/settings/usage' 
    });
  };

  /**
   * Show search limit reached toast
   */
  const showSearchLimitReached = (current?: number, limit?: number, tier?: string) => {
    let message = 'Search limit reached! Check your usage';
    
    if (current && limit) {
      message = `Search limit reached! ${current}/${limit} searches today`;
    }
    
    if (tier && tier.toLowerCase() === 'free') {
      message += ' - Upgrade for unlimited searches';
    }
    
    warning(message, 6000, { 
      clickable: true, 
      linkTo: '/settings/usage' 
    });
  };

  /**
   * Show price update limit reached toast
   */
  const showPriceUpdateLimitReached = (current?: number, limit?: number, tier?: string) => {
    let message = 'Price update limit reached! Check your usage';
    
    if (current && limit) {
      message = `Price update limit reached! ${current}/${limit} updates today`;
    }
    
    if (tier && tier.toLowerCase() === 'free') {
      message += ' - Upgrade for unlimited updates';
    }
    
    warning(message, 6000, { 
      clickable: true, 
      linkTo: '/settings/usage' 
    });
  };

  /**
   * Show sentiment analysis limit reached toast
   */
  const showSentimentLimitReached = (current?: number, limit?: number, tier?: string) => {
    let message = 'Sentiment analysis limit reached! Check your usage';
    
    if (current && limit) {
      message = `Analysis limit reached! ${current}/${limit} analyses today`;
    }
    
    if (tier && tier.toLowerCase() === 'free') {
      message += ' - Upgrade for unlimited analysis';
    }
    
    warning(message, 6000, { 
      clickable: true, 
      linkTo: '/settings/usage' 
    });
  };

  /**
   * Show SEC filings limit reached toast
   */
  const showSecFilingsLimitReached = (current?: number, limit?: number, tier?: string) => {
    let message = 'SEC filings limit reached! Check your usage';
    
    if (current && limit) {
      message = `Filings limit reached! ${current}/${limit} filings today`;
    }
    
    if (tier && tier.toLowerCase() === 'free') {
      message += ' - Upgrade for unlimited access';
    }
    
    warning(message, 6000, { 
      clickable: true, 
      linkTo: '/settings/usage' 
    });
  };

  /**
   * Show earnings data limit reached toast
   */
  const showEarningsLimitReached = (current?: number, limit?: number, tier?: string) => {
    let message = 'Earnings data limit reached! Check your usage';
    
    if (current && limit) {
      message = `Earnings limit reached! ${current}/${limit} queries today`;
    }
    
    if (tier && tier.toLowerCase() === 'free') {
      message += ' - Upgrade for unlimited access';
    }
    
    warning(message, 6000, { 
      clickable: true, 
      linkTo: '/settings/usage' 
    });
  };

  /**
   * Show rate limit toast (temporary limit, not tier-based)
   */
  const showRateLimitReached = (retryAfter?: number) => {
    let message = 'Rate limit reached! Please wait and try again';
    
    if (retryAfter) {
      const minutes = Math.ceil(retryAfter / 60);
      message = `Rate limit reached! Try again in ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    
    info(message, 8000); // Show longer for rate limits, no click needed
  };

  /**
   * Show daily reset notification
   */
  const showDailyLimitReset = (feature?: string) => {
    const message = feature 
      ? `${feature} limits reset! You can continue using this feature`
      : 'Daily limits reset! All features are now available';
    
    info(message, 5000); // Good news, no need to click
  };

  return {
    showLimitReached,
    showCreditsPurchased,
    showCreditPurchaseCancelled,
    showCreditLimitExceeded,
    showWatchlistLimitReached,
    showSearchLimitReached,
    showPriceUpdateLimitReached,
    showSentimentLimitReached,
    showSecFilingsLimitReached,
    showEarningsLimitReached,
    showRateLimitReached,
    showDailyLimitReset
  };
};

/**
 * Static utility functions that don't require hooks (for use in non-React contexts)
 */
export const createLimitToastMessage = (
  limitType: 'credit' | 'watchlist' | 'search' | 'price' | 'sentiment' | 'filings' | 'earnings',
  current?: number,
  limit?: number,
  tier?: string
): string => {
  const isFreeTier = tier && tier.toLowerCase() === 'free';
  
  switch (limitType) {
    case 'credit':
      return current && limit 
        ? `Credit limit reached! ${current}/${limit} credits used`
        : 'Credit limit exceeded! Check your usage';
    
    case 'watchlist':
      let watchlistMsg = 'Watchlist limit reached! Check your usage';
      if (current && limit) {
        watchlistMsg = `Watchlist limit reached! ${current}/${limit} stocks`;
      }
      if (isFreeTier) {
        watchlistMsg += ' - Upgrade for more slots';
      }
      return watchlistMsg;
    
    case 'search':
      let searchMsg = 'Search limit reached! Check your usage';
      if (current && limit) {
        searchMsg = `Search limit reached! ${current}/${limit} searches today`;
      }
      if (isFreeTier) {
        searchMsg += ' - Upgrade for unlimited searches';
      }
      return searchMsg;
    
    case 'price':
      let priceMsg = 'Price update limit reached! Check your usage';
      if (current && limit) {
        priceMsg = `Price update limit reached! ${current}/${limit} updates today`;
      }
      if (isFreeTier) {
        priceMsg += ' - Upgrade for unlimited updates';
      }
      return priceMsg;
    
    case 'sentiment':
      let sentimentMsg = 'Sentiment analysis limit reached! Check your usage';
      if (current && limit) {
        sentimentMsg = `Analysis limit reached! ${current}/${limit} analyses today`;
      }
      if (isFreeTier) {
        sentimentMsg += ' - Upgrade for unlimited analysis';
      }
      return sentimentMsg;
    
    case 'filings':
      let filingsMsg = 'SEC filings limit reached! Check your usage';
      if (current && limit) {
        filingsMsg = `Filings limit reached! ${current}/${limit} filings today`;
      }
      if (isFreeTier) {
        filingsMsg += ' - Upgrade for unlimited access';
      }
      return filingsMsg;
    
    case 'earnings':
      let earningsMsg = 'Earnings data limit reached! Check your usage';
      if (current && limit) {
        earningsMsg = `Earnings limit reached! ${current}/${limit} queries today`;
      }
      if (isFreeTier) {
        earningsMsg += ' - Upgrade for unlimited access';
      }
      return earningsMsg;
    
    default:
      return 'Limit reached! Check your usage';
  }
}; 