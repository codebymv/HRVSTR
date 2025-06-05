import { useMemo } from 'react';
import { useTier } from '../contexts/TierContext';

export interface TierAccess {
  hasAccess: boolean;
  currentTier: string;
  requiredTier: string | null;
  isLoading: boolean;
}

export interface FeatureAccess {
  [featureName: string]: TierAccess;
}

// Define feature access requirements
const TIER_HIERARCHY = ['free', 'pro', 'elite', 'institutional'] as const;
type TierType = typeof TIER_HIERARCHY[number];

const FEATURE_REQUIREMENTS: Record<string, TierType> = {
  // Sentiment features
  redditSentiment: 'pro',
  sentimentChart: 'free', // Available via credits for free users
  sentimentScores: 'free', // Available via credits for free users
  
  // SEC features
  insiderTrading: 'free', // Available via credits for free users
  institutionalHoldings: 'pro',
  
  // Earnings features
  upcomingEarnings: 'free', // Available via credits for free users
  earningsAnalysis: 'pro',
  
  // Settings features
  apiKeyManagement: 'pro',
  advancedSettings: 'elite',
  institutionalFeatures: 'institutional'
};

const getTierLevel = (tier: string): number => {
  const index = TIER_HIERARCHY.indexOf(tier as TierType);
  return index === -1 ? 0 : index;
};

export const useTierAccess = (features: string[] | string) => {
  const { tierInfo } = useTier();
  
  const featureList = Array.isArray(features) ? features : [features];
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  const currentTierLevel = getTierLevel(currentTier);
  
  const access = useMemo(() => {
    const result: FeatureAccess = {};
    
    featureList.forEach(feature => {
      const requiredTier = FEATURE_REQUIREMENTS[feature];
      const requiredTierLevel = requiredTier ? getTierLevel(requiredTier) : 0;
      
      result[feature] = {
        hasAccess: currentTierLevel >= requiredTierLevel,
        currentTier,
        requiredTier,
        isLoading: !tierInfo
      };
    });
    
    return result;
  }, [featureList, currentTier, currentTierLevel, tierInfo]);
  
  // Helper functions for single feature access
  const hasAccess = (feature: string): boolean => {
    return access[feature]?.hasAccess ?? false;
  };
  
  const getRequiredTier = (feature: string): string | null => {
    return access[feature]?.requiredTier ?? null;
  };
  
  const isFeatureLoading = (feature: string): boolean => {
    return access[feature]?.isLoading ?? true;
  };
  
  // Upgrade helpers
  const getUpgradeMessage = (feature: string): string => {
    const requiredTier = getRequiredTier(feature);
    if (!requiredTier) return '';
    
    const tierName = requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1);
    return `This feature requires ${tierName} tier or higher.`;
  };
  
  const canUseCredits = (feature: string): boolean => {
    // Features that can be unlocked with credits for free users
    const creditFeatures = ['sentimentChart', 'sentimentScores', 'insiderTrading', 'upcomingEarnings'];
    return currentTier === 'free' && creditFeatures.includes(feature);
  };
  
  return {
    // Access information
    access,
    currentTier,
    tierInfo,
    
    // Helper functions
    hasAccess,
    getRequiredTier,
    isFeatureLoading,
    getUpgradeMessage,
    canUseCredits,
    
    // Tier level information
    currentTierLevel,
    tierHierarchy: TIER_HIERARCHY
  };
}; 