import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Lock, 
  Shield, 
  Check, 
  AlertCircle,
  Loader2 
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTier } from '../../contexts/TierContext';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';

interface CheckoutFormProps {
  priceId: string;
  subscriptionName: string;
  amount: number;
  interval: 'month' | 'year';
  onSuccess?: (subscriptionId: string) => void;
  onCancel?: () => void;
}

interface PricingPlan {
  id: string;
  product: string;
  amount: number;
  currency: string;
  interval: string;
  features: string[];
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  priceId,
  subscriptionName,
  amount,
  interval,
  onSuccess,
  onCancel
}) => {
  const stripe = useStripe();
  const elements = useElements();
  
  const { theme } = useTheme();
  const { user } = useAuth();
  const { refreshTierInfo } = useTier();
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const inputBgColor = isLight ? 'bg-white' : 'bg-gray-800';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

  // Stripe Elements styling
  const cardElementOptions = {
    style: {
      base: {
        fontSize: '14px',
        color: isLight ? '#374151' : '#f9fafb',
        backgroundColor: isLight ? '#ffffff' : '#1f2937',
        '::placeholder': {
          color: isLight ? '#6b7280' : '#9ca3af',
        },
      },
      invalid: {
        color: '#ef4444',
        iconColor: '#ef4444'
      }
    },
    hidePostalCode: false,
  };

  useEffect(() => {
    fetchPricingPlans();
  }, []);

  const fetchPricingPlans = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/billing/pricing`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPricingPlans(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching pricing plans:', error);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      setErrorMessage('Stripe has not loaded yet. Please try again.');
      return;
    }
    
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      const cardElement = elements.getElement(CardElement);
      
      if (!cardElement) {
        setErrorMessage('Card element not found. Please refresh and try again.');
        return;
      }

      // Create payment method
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: user?.name || user?.email || 'Customer',
          email: user?.email,
        },
      });

      if (pmError) {
        setErrorMessage(pmError.message || 'Failed to create payment method');
        return;
      }

      // Create subscription on backend
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/billing/create-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          priceId,
          paymentMethodId: paymentMethod.id,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setErrorMessage(data.error || data.details || 'Failed to create subscription');
        return;
      }

      if (data.success) {
        // If payment requires confirmation (3D Secure, etc.)
        if (data.data.clientSecret) {
          const { error: confirmError } = await stripe.confirmCardPayment(data.data.clientSecret);
          
          if (confirmError) {
            setErrorMessage(confirmError.message || 'Payment confirmation failed');
            return;
          }
        }

        setSuccessMessage(`Successfully created subscription for ${subscriptionName}!`);
        
        // Refresh tier info to reflect changes
        await refreshTierInfo();
        
        // Call success callback
        if (onSuccess) {
          onSuccess(data.data.subscriptionId);
        }
        
        // Redirect to billing page
        setTimeout(() => {
          window.location.href = '/settings/billing';
        }, 2000);
      } else {
        setErrorMessage(data.error || 'Payment failed');
      }
      
    } catch (error) {
      setErrorMessage('An unexpected error occurred');
      console.error('Checkout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const selectedPlan = pricingPlans.find(plan => plan.id === priceId);

  return (
    <div className={`${bgColor} min-h-screen p-4 lg:p-8`}>
      <div className="max-w-2xl mx-auto">
        <div className={`${cardBgColor} rounded-lg border ${borderColor} overflow-hidden`}>
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-2xl font-bold ${textColor}`}>Complete Your Subscription</h2>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className={`text-sm ${secondaryTextColor} hover:${textColor} transition-colors`}
                >
                  Cancel
                </button>
              )}
            </div>
            
            {/* Plan Summary */}
            <div className={`${inputBgColor} rounded-lg p-4 border ${borderColor}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-lg font-medium ${textColor}`}>{subscriptionName}</h3>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${textColor}`}>
                    {formatAmount(amount)}
                    <span className="text-sm font-normal">/{interval}</span>
                  </p>
                </div>
              </div>
              
              {selectedPlan && (
                <div className="mt-3">
                  <p className={`text-sm font-medium ${textColor} mb-2`}>Included features:</p>
                  <div className="grid grid-cols-1 gap-1">
                    {selectedPlan.features.slice(0, 4).map((feature, index) => (
                      <div key={index} className="flex items-center text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        <span className={secondaryTextColor}>{feature}</span>
                      </div>
                    ))}
                    {selectedPlan.features.length > 4 && (
                      <p className={`text-sm ${secondaryTextColor} mt-1`}>
                        +{selectedPlan.features.length - 4} more features
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="p-6">
            {/* Customer Info */}
            <div className="mb-6">
              <h4 className={`font-medium ${textColor} mb-3`}>Customer Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${textColor} mb-1`}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className={`w-full px-3 py-2 ${inputBgColor} border ${borderColor} rounded-lg text-sm ${textColor} bg-gray-100 dark:bg-gray-700`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${textColor} mb-1`}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={user?.name || ''}
                    disabled
                    className={`w-full px-3 py-2 ${inputBgColor} border ${borderColor} rounded-lg text-sm ${textColor} bg-gray-100 dark:bg-gray-700`}
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Section */}
            <div className="mb-6">
              <h4 className={`font-medium ${textColor} mb-3 flex items-center`}>
                <CreditCard className="w-4 h-4 mr-2" />
                Payment Method
              </h4>
              
              {/* Stripe Elements Card Input */}
              <div className={`border ${borderColor} rounded-lg p-4 ${inputBgColor}`}>
                <CardElement options={cardElementOptions} />
              </div>
            </div>

            {/* Security Info */}
            <div className="mb-6">
              <div className={`flex items-center justify-center space-x-4 text-sm ${secondaryTextColor}`}>
                <div className="flex items-center">
                  <Shield className="w-4 h-4 mr-1" />
                  <span>SSL Secured</span>
                </div>
                <div className="flex items-center">
                  <Lock className="w-4 h-4 mr-1" />
                  <span>PCI Compliant</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center text-red-700 dark:text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center text-green-700 dark:text-green-300 text-sm">
                  <Check className="w-4 h-4 mr-2" />
                  <span>{successMessage}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full ${buttonBgColor} text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Subscribe for {formatAmount(amount)}/{interval}
                </>
              )}
            </button>

            {/* Terms */}
            <p className={`text-xs ${secondaryTextColor} text-center mt-4`}>
              By subscribing, you agree to our{' '}
              <a href="/terms" className="text-blue-500 hover:text-blue-600">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" className="text-blue-500 hover:text-blue-600">Privacy Policy</a>.
              You can cancel anytime from your billing settings.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CheckoutForm; 