import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { useCreditBalance } from '../../hooks/useCreditBalance';
import { 
  Crown, 
  Zap, 
  Battery, 
  TrendingUp, 
  BookOpen, 
  ChevronRight,
  Star,
  AlertCircle,
  Sparkles,
  Loader2
} from 'lucide-react';

interface ResearchSession {
  id: string;
  symbol: string;
  startTime: string;
  creditsUsed: number;
  queries: number;
  status: 'active' | 'paused' | 'completed';
}

interface PremiumCreditControlsProps {
  onStartResearch?: (symbol: string) => void;
  onPurchaseCredits?: () => void;
  currentSymbol?: string;
}

const PremiumCreditControls: React.FC<PremiumCreditControlsProps> = ({
  onStartResearch,
  onPurchaseCredits,
  currentSymbol = 'AAPL'
}) => {
  const { theme } = useTheme();
  const { tierInfo } = useTier();
  const { 
    balance, 
    tierLimits, 
    creditCosts, 
    loading, 
    error, 
    refreshBalance, 
    purchaseCredits 
  } = useCreditBalance();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const cardBg = isLight ? 'bg-white' : 'bg-gray-800';
  const borderColor = isLight ? 'border-gray-200' : 'border-gray-700';
  const textColor = isLight ? 'text-gray-900' : 'text-white';
  const mutedTextColor = isLight ? 'text-gray-600' : 'text-gray-400';
  const accentBg = isLight ? 'bg-blue-50' : 'bg-blue-900/20';
  const accentBorder = isLight ? 'border-blue-200' : 'border-blue-800';
  const premiumGradient = 'bg-gradient-to-r from-amber-500 to-orange-600';
  
  const [activeSession, setActiveSession] = useState<ResearchSession | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  
  const tier = tierInfo?.tier?.toLowerCase() || 'free';
  
  // Debug logging
  console.log('🔍 PremiumCreditControls Debug:', {
    tier,
    balance,
    loading,
    error,
    tierInfo
  });
  
  const handleStartResearchSession = () => {
    if (onStartResearch) {
      onStartResearch(currentSymbol);
    }
    
    // Create new session
    const newSession: ResearchSession = {
      id: `session_${Date.now()}`,
      symbol: currentSymbol,
      startTime: new Date().toISOString(),
      creditsUsed: 0,
      queries: 0,
      status: 'active'
    };
    setActiveSession(newSession);
  };

  const handlePauseSession = () => {
    if (activeSession) {
      setActiveSession({
        ...activeSession,
        status: 'paused'
      });
    }
  };

  const handleCompleteSession = () => {
    if (activeSession) {
      setActiveSession({
        ...activeSession,
        status: 'completed'
      });
      // After a delay, clear the session
      setTimeout(() => setActiveSession(null), 2000);
    }
  };

  const handleQuickPurchase = async (credits: number) => {
    setPurchaseLoading(true);
    try {
      const success = await purchaseCredits(credits);
      if (success) {
        console.log(`✅ Successfully purchased ${credits} credits`);
      }
    } catch (error) {
      console.error('Purchase failed:', error);
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handlePurchaseCreditsClick = () => {
    if (onPurchaseCredits) {
      onPurchaseCredits();
    } else {
      // Show quick purchase options
      handleQuickPurchase(100);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className={`${cardBg} rounded-lg border ${borderColor} p-4`}>
        <div className="flex items-center justify-center space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className={`ml-2 ${mutedTextColor}`}>Loading credits...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={`${cardBg} rounded-lg border ${borderColor} p-4`}>
        <div className="flex items-center gap-2 text-red-500">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">Error loading credits: {error}</span>
        </div>
        <button
          onClick={refreshBalance}
          className="mt-2 text-sm text-blue-500 hover:text-blue-600"
        >
          Try again
        </button>
      </div>
    );
  }

  // Show for free tier users with upgrade prompt
  if (tier === 'free') {
    return (
      <div className={`${cardBg} rounded-lg border ${borderColor} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-2 rounded-lg ${premiumGradient}`}>
            <Crown className="w-4 h-4 text-white" />
          </div>
          <h3 className={`font-semibold ${textColor}`}>Premium Credits</h3>
        </div>
        
        <div className={`${accentBg} rounded-lg p-3 border ${accentBorder} mb-3`}>
          <p className={`text-sm ${mutedTextColor} text-center`}>
            Upgrade to Pro to access the credit system and premium features!
          </p>
        </div>
        
        <button
          onClick={handlePurchaseCreditsClick}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1"
        >
          <Crown className="w-4 h-4" />
          Upgrade to Pro
        </button>
      </div>
    );
  }

  // Temporarily comment out this conditional to force showing the main interface
  /*
  // Show debug info if no balance data for paid tiers
  if (!balance && tier !== 'free') {
    return (
      <div className={`${cardBg} rounded-lg border ${borderColor} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-2 rounded-lg ${premiumGradient}`}>
            <AlertCircle className="w-4 h-4 text-white" />
          </div>
          <h3 className={`font-semibold ${textColor}`}>Credit System Debug</h3>
        </div>
        
        <div className={`${accentBg} rounded-lg p-3 border ${accentBorder} space-y-2`}>
          <p className={`text-xs ${mutedTextColor}`}>
            <strong>Tier:</strong> {tier || 'unknown'}
          </p>
          <p className={`text-xs ${mutedTextColor}`}>
            <strong>Balance:</strong> {balance ? 'loaded' : 'null'}
          </p>
          <p className={`text-xs ${mutedTextColor}`}>
            <strong>Loading:</strong> {loading ? 'true' : 'false'}
          </p>
          <p className={`text-xs ${mutedTextColor}`}>
            <strong>Error:</strong> {error || 'none'}
          </p>
        </div>
        
        <button
          onClick={refreshBalance}
          className="mt-3 w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Refresh Credit Data
        </button>
      </div>
    );
  }
  */

  // For now, create mock balance data if none exists
  const mockBalance = balance || {
    total: 500,
    used: 45,
    remaining: 455,
    monthly_allocation: 500,
    purchased: 0,
    tier: tier
  };

  const creditUsagePercentage = mockBalance && mockBalance.total > 0 ? (mockBalance.used / mockBalance.total) * 100 : 0;

  return (
    <div className="w-full">
      {/* Credit Balance removed - using toast notifications instead */}
    </div>
  );
};

export default PremiumCreditControls; 