// Shared pricing configuration and utilities
import React from 'react';

export interface YearlyTier {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  icon: React.ReactNode;
  gradient: string;
  popular?: boolean;
  savings: string;
}

// Mapping of tier names to Stripe price IDs
export const getPriceIdForTier = (tierName: string, isYearly: boolean = false): string => {
  const priceIds = {
    'pro': {
      monthly: import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY || 'price_1RVeQnRxBJaRlFvtvP0hwPKG',
      yearly: import.meta.env.VITE_STRIPE_PRICE_PRO_YEARLY || 'price_1RVeS6RxBJaRlFvtrsDYhukj'
    },
    'elite': {
      monthly: import.meta.env.VITE_STRIPE_PRICE_ELITE_MONTHLY || 'price_1RVeRaRxBJaRlFvtAeoHlznc',
      yearly: import.meta.env.VITE_STRIPE_PRICE_ELITE_YEARLY || 'price_1RVeSgRxBJaRlFvtm4pgxpyh'
    },
    'institutional': {
      monthly: import.meta.env.VITE_STRIPE_PRICE_INSTITUTIONAL_MONTHLY || 'price_1RU7JLRxBJaRlFvtcQWSwReg',
      yearly: import.meta.env.VITE_STRIPE_PRICE_INSTITUTIONAL_YEARLY || 'price_1RU7JsRxBJaRlFvthkm01EeY'
    }
  };

  const tierKey = tierName.toLowerCase() as keyof typeof priceIds;
  const selectedPriceId = priceIds[tierKey]?.[isYearly ? 'yearly' : 'monthly'] || '';
  
  // Temporary debug logging
  console.log('🔍 Pricing Debug:', {
    tierName,
    isYearly,
    tierKey,
    envVars: {
      VITE_STRIPE_PRICE_PRO_MONTHLY: import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY,
      VITE_STRIPE_PRICE_ELITE_MONTHLY: import.meta.env.VITE_STRIPE_PRICE_ELITE_MONTHLY,
    },
    selectedPriceId
  });
  
  return selectedPriceId;
};

// Shared purchase click handler logic
export const createCheckoutSession = async (
  tierName: string, 
  isYearly: boolean, 
  token: string | null,
  successUrl: string,
  cancelUrl: string
) => {
  if (tierName === 'Free') {
    // Handle free tier "Get Started" - could trigger welcome flow
    return;
  }

  // For paid tiers, create Stripe Checkout Session
  const priceId = getPriceIdForTier(tierName, isYearly);

  if (!priceId) {
    throw new Error('Pricing configuration error. Please contact support.');
  }

  // Get auth token
  if (!token) {
    throw new Error('Authentication error. Please sign in again.');
  }

  // Create Stripe Checkout Session
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      priceId: priceId,
      mode: 'subscription',
      successUrl,
      cancelUrl
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create checkout session. Please try again.');
  }

  // Redirect to Stripe Checkout
  if (data.url) {
    window.location.href = data.url;
  } else {
    throw new Error('No checkout URL received from server.');
  }
}; 