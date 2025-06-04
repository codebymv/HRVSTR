/**
 * Utility functions to format activity data for display
 * Avoids camelCase formatting in user-facing text
 */

// Activity type to human-readable title mapping
const ACTIVITY_TYPE_TITLES: Record<string, string> = {
  // User Actions
  'login': 'User Login',
  'logout': 'User Logout',
  'search': 'Stock Search',
  'watchlist_add': 'Added to Watchlist',
  'watchlist_remove': 'Removed from Watchlist',
  'profile_update': 'Profile Updated',
  'tier_upgrade': 'Tier Switched',
  'tier_downgrade': 'Tier Switched',
  'tier_change': 'Tier Switched',
  
  // System Events
  'price_update': 'Price Updated',
  'credit_deduction': 'Credits Used',
  'credit_reset': 'Credits Reset',
  'api_call': 'API Request',
  'error': 'System Error',
  
  // Data Events
  'sec_filing': 'SEC Filing Processed',
  'earnings_announcement': 'Earnings Update',
  'dividend_announcement': 'Dividend Update',
  'news_update': 'News Update',
  
  // Research unlocks
  'component_unlock': 'Research Unlocked'
};

// Component name to research area mapping
const COMPONENT_RESEARCH_NAMES: Record<string, string> = {
  'earningsAnalysis': 'Earnings Analysis Research',
  'institutionalHoldings': 'Institutional Holdings Research', 
  'insiderTrading': 'Insider Trading Research',
  'sentimentAnalysis': 'Sentiment Analysis Research',
  'technicalAnalysis': 'Technical Analysis Research',
  'fundamentalAnalysis': 'Fundamental Analysis Research',
  'marketTrends': 'Market Trends Research',
  'newsAnalysis': 'News Analysis Research',
  'socialSentiment': 'Social Sentiment Research',
  'redditAnalysis': 'Reddit Analysis Research'
};

/**
 * Convert component name to research area name
 * @param componentName - The raw component name (e.g., 'earningsAnalysis')
 * @returns Research area name (e.g., 'Earnings Analysis Research')
 */
export const formatComponentName = (componentName: string): string => {
  return COMPONENT_RESEARCH_NAMES[componentName] || formatFallbackComponentName(componentName);
};

/**
 * Fallback formatter for unknown component names
 * Converts camelCase to Title Case + "Research"
 * @param componentName - The raw component name
 * @returns Formatted research area name
 */
const formatFallbackComponentName = (componentName: string): string => {
  // Convert camelCase to space-separated words
  const formatted = componentName
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .trim() // Remove leading/trailing spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return `${formatted} Research`;
};

/**
 * Convert activity_type to human-readable title
 * @param activityType - The raw activity type (e.g., 'watchlist_add')
 * @returns Human-readable title (e.g., 'Added to Watchlist')
 */
export const formatActivityType = (activityType: string): string => {
  return ACTIVITY_TYPE_TITLES[activityType] || formatFallbackActivityType(activityType);
};

/**
 * Fallback formatter for unknown activity types
 * Converts snake_case to Title Case properly
 * @param activityType - The raw activity type
 * @returns Formatted title
 */
const formatFallbackActivityType = (activityType: string): string => {
  return activityType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Format tier names properly (avoid camelCase display)
 * @param tier - The tier name (e.g., 'pro', 'elite')
 * @returns Formatted tier name (e.g., 'Pro', 'Elite')
 */
export const formatTierName = (tier: string): string => {
  const tierMap: Record<string, string> = {
    'free': 'Free',
    'pro': 'Pro',
    'elite': 'Elite',
    'institutional': 'Institutional'
  };
  
  return tierMap[tier.toLowerCase()] || tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
};

/**
 * Format status text (avoid camelCase)
 * @param status - The status string
 * @returns Formatted status
 */
export const formatStatus = (status: string): string => {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Generate activity description with proper formatting
 * @param activityType - The activity type
 * @param symbol - Optional stock symbol
 * @param details - Optional additional details
 * @returns Formatted description
 */
export const generateActivityDescription = (
  activityType: string, 
  symbol?: string | null, 
  details?: string | null
): string => {
  const baseDescriptions: Record<string, string> = {
    'watchlist_add': symbol ? `Added ${symbol} to your watchlist` : 'Added stock to watchlist',
    'watchlist_remove': symbol ? `Removed ${symbol} from your watchlist` : 'Removed stock from watchlist',
    'tier_upgrade': 'Subscription tier has been upgraded',
    'tier_downgrade': 'Subscription tier has been downgraded',
    'credit_deduction': 'Credits deducted for operation',
    'search': 'Stock search performed',
    'price_update': symbol ? `Updated price data for ${symbol}` : 'Price data updated',
    'component_unlock': details || 'Research component unlocked'
  };
  
  return details || baseDescriptions[activityType] || formatFallbackActivityType(activityType);
};

/**
 * Clean up existing activity titles that contain camelCase component names
 * @param title - The raw activity title from database
 * @param activityType - The activity type
 * @returns Cleaned title
 */
export const cleanActivityTitle = (title: string, activityType: string): string => {
  if (activityType === 'component_unlock') {
    // Handle old format like "Unlocked earningsAnalysis"
    if (title.startsWith('Unlocked ') && title.length > 9) {
      const componentName = title.substring(9); // Remove "Unlocked "
      return 'Research Unlocked';
    }
  }
  
  if (activityType === 'tier_change' || activityType === 'tier_upgrade' || activityType === 'tier_downgrade') {
    // Handle tier change titles - extract tier name and format consistently
    const tierPattern = /(upgraded|downgraded|changed|switched)\s+(?:to\s+)?(\w+)/i;
    const match = title.match(tierPattern);
    
    if (match) {
      const tierName = match[2];
      const formattedTier = formatTierName(tierName);
      return `Switched to ${formattedTier}`;
    }
    
    // Fallback patterns
    if (title.toLowerCase().includes('pro')) {
      return 'Switched to Pro';
    }
    if (title.toLowerCase().includes('free')) {
      return 'Switched to Free';
    }
    if (title.toLowerCase().includes('elite')) {
      return 'Switched to Elite';
    }
    if (title.toLowerCase().includes('institutional')) {
      return 'Switched to Institutional';
    }
  }
  
  return title;
};

/**
 * Clean up existing activity descriptions that contain camelCase component names
 * @param description - The raw activity description from database
 * @param activityType - The activity type
 * @returns Cleaned description
 */
export const cleanActivityDescription = (description: string, activityType: string): string => {
  if (activityType === 'component_unlock' && description) {
    // Handle old format like "8 credits used to unlock earningsAnalysis component for 2 hours"
    const componentPattern = /(\d+) credits used to unlock (\w+) component for (\d+) hours?/i;
    const match = description.match(componentPattern);
    
    if (match) {
      const [, credits, componentName, hours] = match;
      const formattedComponent = formatComponentName(componentName);
      return `${credits} Credits Used To Unlock ${formattedComponent} For ${hours} Hours`;
    }
    
    // Handle other variations
    const unlockPattern = /unlock (\w+)/i;
    const unlockMatch = description.match(unlockPattern);
    if (unlockMatch) {
      const componentName = unlockMatch[1];
      if (componentName !== 'component') { // Skip if it's just "component"
        const formattedComponent = formatComponentName(componentName);
        return description.replace(unlockMatch[0], `unlock ${formattedComponent}`);
      }
    }
  }
  
  if (activityType === 'tier_change' || activityType === 'tier_upgrade' || activityType === 'tier_downgrade') {
    // Handle tier change descriptions - make them consistent
    const tierPattern = /(successfully\s+)?(upgraded|downgraded|changed|switched)\s+(?:subscription\s+)?tier\s+(?:to\s+)?(\w+)/i;
    const match = description.match(tierPattern);
    
    if (match) {
      const tierName = match[3];
      const formattedTier = formatTierName(tierName);
      return `Successfully switched subscription tier to ${formattedTier}`;
    }
  }
  
  return description;
};

/**
 * Get the appropriate icon for a specific component unlock
 * @param componentName - The component name (e.g., 'earningsAnalysis')
 * @returns Icon name that matches the component's usage in the app
 */
export const getComponentIcon = (componentName: string): string => {
  const componentIcons: Record<string, string> = {
    'earningsAnalysis': 'TrendingUp', // Matches earnings navbar icon
    'upcomingEarnings': 'TrendingUp', // Matches earnings navbar icon
    'institutionalHoldings': 'ListChecks', // Matches SEC filings navbar icon  
    'insiderTrading': 'ListChecks', // Matches SEC filings navbar icon
    'sentimentAnalysis': 'BarChart2', // Matches sentiment page
    'technicalAnalysis': 'TrendingUp', // Matches technical indicators
    'fundamentalAnalysis': 'DollarSign', // Matches financial metrics
    'marketTrends': 'TrendingUp', // Matches trend analysis
    'newsAnalysis': 'Info', // Matches news/info
    'socialSentiment': 'BarChart2', // Matches sentiment analysis
    'redditAnalysis': 'BarChart2' // Matches sentiment analysis
  };
  
  return componentIcons[componentName] || 'Zap'; // Default to Zap for unknown components
};