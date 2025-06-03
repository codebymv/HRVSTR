import { useState } from 'react';
import { useTier } from '../contexts/TierContext';

interface TierLimitState {
  isOpen: boolean;
  featureName: string;
  message?: string;
  upgradeMessage?: string;
  context?: 'reddit' | 'watchlist' | 'search' | 'general' | 'sec' | 'institutional';
}

export const useTierLimits = () => {
  const { tierInfo } = useTier();
  const [tierLimitDialog, setTierLimitDialog] = useState<TierLimitState>({
    isOpen: false,
    featureName: '',
    message: undefined,
    upgradeMessage: undefined,
    context: 'general'
  });

  const checkTierLimit = (
    featureName: string,
    currentUsage: number,
    limit: number | null,
    customMessage?: string,
    customUpgradeMessage?: string
  ): boolean => {
    // If limit is null or undefined, there's no limit (probably unlimited tier)
    if (limit === null || limit === undefined) {
      return true;
    }

    // If usage is below limit, allow the action
    if (currentUsage < limit) {
      return true;
    }

    // Show tier limit dialog
    setTierLimitDialog({
      isOpen: true,
      featureName,
      message: customMessage,
      upgradeMessage: customUpgradeMessage
    });

    return false;
  };

  const showTierLimitDialog = (
    featureName: string,
    customMessage?: string,
    customUpgradeMessage?: string,
    context: 'reddit' | 'watchlist' | 'search' | 'general' | 'sec' | 'institutional' = 'general'
  ) => {
    setTierLimitDialog({
      isOpen: true,
      featureName,
      message: customMessage,
      upgradeMessage: customUpgradeMessage,
      context
    });
  };

  const closeTierLimitDialog = () => {
    setTierLimitDialog({
      isOpen: false,
      featureName: '',
      message: undefined,
      upgradeMessage: undefined,
      context: 'general'
    });
  };

  const getTierDisplayName = () => {
    return tierInfo?.tier || 'Free';
  };

  return {
    tierLimitDialog,
    checkTierLimit,
    showTierLimitDialog,
    closeTierLimitDialog,
    getTierDisplayName,
    tierInfo
  };
}; 