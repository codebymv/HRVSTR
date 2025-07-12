import { useState, useEffect, useCallback } from 'react';
import { getApiUrlClient } from '../services/apiService';

interface CreditBalance {
  total: number;
  used: number;
  remaining: number;
  monthly_allocation: number;
  purchased: number;
  tier: string;
}

interface TierLimits {
  monthly_credits: number;
  can_purchase: boolean;
  max_sessions: number;
  features: string[];
  discount_rate?: number;
}

interface CreditCosts {
  reddit_sentiment: number;
  finviz_sentiment: number;
  yahoo_sentiment: number;
  research_bundle: number;
  deep_analysis: number;
  historical_data: number;
  refresh_data: number;
  page_load: number;
  pagination: number;
  filter: number;
  elite_research_bundle: number;
  institutional_bundle: number;
}

interface UseCreditBalanceReturn {
  balance: CreditBalance | null;
  tierLimits: TierLimits | null;
  creditCosts: CreditCosts | null;
  loading: boolean;
  error: string | null;
  refreshBalance: () => Promise<void>;
  purchaseCredits: (credits: number) => Promise<boolean>;
}

export const useCreditBalance = (): UseCreditBalanceReturn => {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [tierLimits, setTierLimits] = useState<TierLimits | null>(null);
  const [creditCosts, setCreditCosts] = useState<CreditCosts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = getApiUrlClient();
      const token = localStorage.getItem('auth_token');

      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await fetch(`${apiUrl}/api/credits/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setBalance(data.balance);
        setTierLimits(data.tierLimits);
        setCreditCosts(data.creditCosts);
      } else {
        throw new Error(data.error || 'Failed to fetch credit balance');
      }
    } catch (err) {
      console.error('Error fetching credit balance:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const purchaseCredits = useCallback(async (credits: number): Promise<boolean> => {
    try {
      const apiUrl = getApiUrlClient();
      const token = localStorage.getItem('auth_token');

      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await fetch(`${apiUrl}/api/credits/purchase`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credits,
          paymentIntentId: 'simulated_purchase' // In real app, this would come from Stripe
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Update balance with the new data
        setBalance(data.balance);
        return true;
      } else {
        throw new Error(data.error || 'Failed to purchase credits');
      }
    } catch (err) {
      console.error('Error purchasing credits:', err);
      setError(err instanceof Error ? err.message : 'Credit purchase failed');
      return false;
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    tierLimits,
    creditCosts,
    loading,
    error,
    refreshBalance,
    purchaseCredits,
  };
}; 