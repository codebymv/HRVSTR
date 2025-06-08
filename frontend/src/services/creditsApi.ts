import { getProxyUrl } from './apiService';

interface CreditBalance {
  total: number;
  used: number;
  remaining: number;
  monthly_allocation: number;
  purchased: number;
  tier: string;
}

interface CreditCost {
  action: string;
  cost: number;
  baseCost: number;
  discount: number;
  discountRate: number;
  tier: string;
  hasAccess: boolean;
}

interface CreditResponse {
  success: boolean;
  balance?: CreditBalance;
  error?: string;
}

interface CreditCostResponse {
  success: boolean;
  action?: string;
  cost?: number;
  baseCost?: number;
  discount?: number;
  discountRate?: number;
  tier?: string;
  hasAccess?: boolean;
  error?: string;
}

/**
 * Get user's current credit balance
 */
export const getCreditBalance = async (): Promise<CreditResponse> => {
  try {
    const proxyUrl = getProxyUrl();
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const response = await fetch(`${proxyUrl}/api/credits/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to fetch credit balance'
      };
    }
    
    return {
      success: true,
      balance: result.balance
    };
    
  } catch (error) {
    console.error('Error fetching credit balance:', error);
    return {
      success: false,
      error: 'Failed to connect to credits service'
    };
  }
};

/**
 * Get the credit cost for a specific action
 */
export const getCreditCost = async (action: string): Promise<CreditCostResponse> => {
  try {
    const proxyUrl = getProxyUrl();
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const response = await fetch(`${proxyUrl}/api/credits/cost/${action}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to fetch credit cost'
      };
    }
    
    return {
      success: true,
      ...result
    };
    
  } catch (error) {
    console.error('Error fetching credit cost:', error);
    return {
      success: false,
      error: 'Failed to connect to credits service'
    };
  }
};

/**
 * Check if user can afford a specific action
 */
export const canAffordAction = async (action: string): Promise<boolean> => {
  try {
    const [balanceResult, costResult] = await Promise.all([
      getCreditBalance(),
      getCreditCost(action)
    ]);
    
    if (!balanceResult.success || !costResult.success || !balanceResult.balance) {
      return false;
    }
    
    return balanceResult.balance.remaining >= (costResult.cost || 0);
    
  } catch (error) {
    console.error('Error checking if user can afford action:', error);
    return false;
  }
};

export type { CreditBalance, CreditCost, CreditResponse, CreditCostResponse }; 