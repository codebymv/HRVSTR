import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  CreditCard, 
  Calendar, 
  Receipt, 
  Settings, 
  Plus,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Edit3,
  Trash2,
  X,
  Star,
  Crown,
  Zap,
  Building
} from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useTier } from '../../../contexts/TierContext';

interface PaymentMethod {
  id: string;
  type: 'card';
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  date: string;
  description: string;
  downloadUrl?: string;
}

interface Subscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  plan: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
}

const BillingPage: React.FC = () => {
  const { theme } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const { tierInfo, refreshTierInfo } = useTier();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';
  const dangerButtonBg = isLight ? 'bg-red-500 hover:bg-red-600' : 'bg-red-600 hover:bg-red-700';

  useEffect(() => {
    // Check for success/cancel parameters from Stripe Checkout
    const success = searchParams.get('success');
    const cancelled = searchParams.get('cancelled');

    if (success === 'true') {
      setSuccessMessage('🎉 Payment successful! Your subscription has been activated.');
      // Refresh tier info to reflect the new subscription
      refreshTierInfo();
      // Clear URL parameters after showing message
      searchParams.delete('success');
      setSearchParams(searchParams);
      
      // Auto-hide success message after 10 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 10000);
    }

    if (cancelled === 'true') {
      setCancelMessage('Payment was cancelled. You can try again anytime by selecting a plan.');
      // Clear URL parameters
      searchParams.delete('cancelled');
      setSearchParams(searchParams);
      
      // Auto-hide cancel message after 7 seconds
      setTimeout(() => {
        setCancelMessage(null);
      }, 7000);
    }
  }, [searchParams, setSearchParams, refreshTierInfo]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBillingData();
    }
  }, [isAuthenticated]);

  const fetchBillingData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use the same API URL pattern as other components
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const authToken = localStorage.getItem('auth_token');

      if (!authToken) {
        setError('Not authenticated');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      };

      // Fetch subscription info
      const subResponse = await fetch(`${apiUrl}/api/billing/subscription`, { headers });
      if (subResponse.ok) {
        const subData = await subResponse.json();
        if (subData.success) {
          setSubscription(subData.data);
        }
      }

      // Fetch payment methods
      const pmResponse = await fetch(`${apiUrl}/api/billing/payment-methods`, { headers });
      if (pmResponse.ok) {
        const pmData = await pmResponse.json();
        if (pmData.success) {
          setPaymentMethods(pmData.data);
        }
      }

      // Fetch invoices
      const invoiceResponse = await fetch(`${apiUrl}/api/billing/invoices`, { headers });
      if (invoiceResponse.ok) {
        const invoiceData = await invoiceResponse.json();
        if (invoiceData.success) {
          setInvoices(invoiceData.data);
        }
      }

    } catch (err) {
      setError('Failed to load billing information');
      console.error('Billing data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const authToken = localStorage.getItem('auth_token');

      if (!authToken) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${apiUrl}/api/billing/customer-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.url) {
          window.open(data.url, '_blank');
        }
      } else if (response.status === 400) {
        // Handle the case where user doesn't have a Stripe subscription
        const errorData = await response.json().catch(() => ({}));
        
        // Show a user-friendly message
        alert(`🔔 Subscription Required\n\nTo manage your subscription, you need to first subscribe to a paid plan through Stripe.\n\nYour current "${tierInfo?.tier || 'free'}" tier is simulated for development/testing purposes.\n\nClick "Upgrade Plan" to subscribe to a real plan with payment processing.`);
        
        // Optionally redirect to upgrade page
        setTimeout(() => {
          window.location.href = '/settings/tiers';
        }, 2000);
      } else {
        console.error('Customer portal error:', response.status);
        alert('Unable to open customer portal. Please try again later.');
      }
    } catch (err) {
      console.error('Error opening customer portal:', err);
      alert('Failed to open customer portal. Please check your connection and try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      canceled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      past_due: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClasses[status as keyof typeof statusClasses] || statusClasses.canceled}`}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatAmount = (amount: number, currency = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  };

  // Helper function to get user tier information with icon and color
  const getUserTierInfo = () => {
    // Use TierContext tierInfo instead of hardcoded user data
    const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
    
    const tierData = {
      free: {
        name: 'HRVSTR Free',
        icon: <Star className="w-4 h-4" />,
        iconColor: 'text-gray-400',
        textColor: 'text-gray-400'
      },
      pro: {
        name: 'HRVSTR Pro',
        icon: <Crown className="w-4 h-4" />,
        iconColor: 'text-blue-500',
        textColor: 'text-blue-400'
      },
      elite: {
        name: 'HRVSTR Elite',
        icon: <Zap className="w-4 h-4" />,
        iconColor: 'text-purple-500',
        textColor: 'text-purple-400'
      },
      institutional: {
        name: 'HRVSTR Institutional',
        icon: <Building className="w-4 h-4" />,
        iconColor: 'text-green-500',
        textColor: 'text-green-400'
      }
    };

    return tierData[currentTier as keyof typeof tierData] || tierData.free;
  };

  if (!isAuthenticated) {
    return (
      <div className={`${bgColor} min-h-screen p-4 lg:p-8`}>
        <div className="max-w-6xl mx-auto">
          <div className={`${cardBgColor} rounded-lg p-8 border ${borderColor} text-center`}>
            <h2 className={`text-xl font-semibold ${textColor} mb-4`}>Sign In Required</h2>
            <p className={secondaryTextColor}>Please sign in to view your billing information.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${bgColor} min-h-screen p-4 lg:p-8`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold ${textColor} mb-2`}>Billing & Payments</h1>
          <p className={secondaryTextColor}>
            Manage your subscription, payment methods, and billing history
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-lg border border-green-500 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-700 dark:text-green-300 font-medium">
                    {successMessage}
                  </p>
                  <p className="text-green-600 dark:text-green-400 text-sm mt-1">
                    Your new subscription features are now available. Check your usage limits in the settings.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-green-500 hover:text-green-700 dark:hover:text-green-300 ml-4"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Cancel Message */}
        {cancelMessage && (
          <div className="mb-6 p-4 rounded-lg border border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-yellow-700 dark:text-yellow-300 font-medium">
                    {cancelMessage}
                  </p>
                  <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-1">
                    No charges were made to your account.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCancelMessage(null)}
                className="text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-300 ml-4"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className={`${cardBgColor} rounded-lg p-8 border ${borderColor} text-center`}>
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className={secondaryTextColor}>Loading billing information...</p>
          </div>
        )}

        {error && (
          <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} mb-6`}>
            <div className="flex items-center text-red-500 mb-2">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="font-medium">Error</span>
            </div>
            <p className={secondaryTextColor}>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {/* Current Plan */}
            <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Current Plan
                </h2>
                {tierInfo && (
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(subscription?.status || 'active')}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  {/* <h3 className={`font-medium ${textColor} mb-1`}>Plan</h3> */}
                  <div className="flex items-center">
                    <p className={`${secondaryTextColor} capitalize mr-2`}>
                      {tierInfo?.tier || 'Free'}
                    </p>
                    {tierInfo && (
                      <div className={`w-5 h-5 flex items-center justify-center ${getUserTierInfo().iconColor}`}>
                        {getUserTierInfo().icon}
                      </div>
                    )}
                  </div>
                </div>
                
                {subscription && (
                  <>
                    <div>
                      <h3 className={`font-medium ${textColor} mb-1`}>Billing</h3>
                      <p className={secondaryTextColor}>
                        {formatAmount(subscription.amount)} / {subscription.interval}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className={`font-medium ${textColor} mb-1`}>Next Billing Date</h3>
                      <p className={secondaryTextColor}>
                        {formatDate(subscription.currentPeriodEnd)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {tierInfo?.tier !== 'free' && (
                  <button
                    onClick={openCustomerPortal}
                    className={`${buttonBgColor} text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors`}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Manage Subscription
                    <ExternalLink className="w-4 h-4 ml-1" />
                  </button>
                )}
                
                {tierInfo?.tier === 'free' && (
                  <button
                    onClick={() => window.location.href = '/settings/tiers'}
                    className={`${buttonBgColor} text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors`}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Upgrade Plan
                  </button>
                )}
              </div>
            </div>

            {/* Payment Methods */}
            <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Payment Methods
                </h2>
                {/* <button
                  onClick={openCustomerPortal}
                  className={`${buttonBgColor} text-white px-3 py-1 rounded text-sm font-medium flex items-center transition-colors`}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Method
                </button> */}
              </div>

              {paymentMethods.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className={`w-12 h-12 ${secondaryTextColor} mx-auto mb-3`} />
                  <p className={`${secondaryTextColor} mb-4`}>No payment methods on file</p>
                  <button
                    onClick={openCustomerPortal}
                    className={`${buttonBgColor} text-white px-4 py-2 rounded-lg font-medium transition-colors`}
                  >
                    Add Payment Method
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className={`border ${borderColor} rounded-lg p-4 flex items-center justify-between`}>
                      <div className="flex items-center">
                        <CreditCard className={`w-5 h-5 ${secondaryTextColor} mr-3`} />
                        <div>
                          <p className={`font-medium ${textColor}`}>
                            {method.brand.toUpperCase()} •••• {method.last4}
                          </p>
                          <p className={`text-sm ${secondaryTextColor}`}>
                            Expires {method.expMonth}/{method.expYear}
                            {method.isDefault && <span className="text-blue-500 ml-2">• Default</span>}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={openCustomerPortal}
                        className={`text-sm ${secondaryTextColor} hover:${textColor} flex items-center transition-colors`}
                      >
                        <Edit3 className="w-4 h-4 mr-1" />
                        Manage
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Billing History */}
            <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
                  <Receipt className="w-5 h-5 mr-2" />
                  Billing History
                </h2>
              </div>

              {invoices.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className={`w-12 h-12 ${secondaryTextColor} mx-auto mb-3`} />
                  <p className={`${secondaryTextColor} mb-2`}>No billing history yet</p>
                  <p className={`text-sm ${secondaryTextColor}`}>
                    Your invoices and receipts will appear here once you have a paid subscription.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className={`border ${borderColor} rounded-lg p-4 flex items-center justify-between`}>
                      <div className="flex items-center">
                        <Calendar className={`w-5 h-5 ${secondaryTextColor} mr-3`} />
                        <div>
                          <p className={`font-medium ${textColor}`}>{invoice.description}</p>
                          <p className={`text-sm ${secondaryTextColor}`}>
                            {formatDate(invoice.date)} • {formatAmount(invoice.amount, invoice.currency)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {getStatusBadge(invoice.status)}
                        {invoice.downloadUrl && (
                          <button
                            onClick={() => window.open(invoice.downloadUrl, '_blank')}
                            className={`text-sm ${secondaryTextColor} hover:${textColor} flex items-center transition-colors`}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Billing Info Note */}
            {/* <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor}`}>
              <div className="flex items-start">
                <AlertCircle className={`w-5 h-5 ${secondaryTextColor} mr-3 mt-0.5`} />
                <div>
                  <h3 className={`font-medium ${textColor} mb-2`}>Billing Information</h3>
                  <p className={`text-sm ${secondaryTextColor} mb-3`}>
                    All billing is securely processed through Stripe. You can manage your subscription, 
                    update payment methods, and download invoices through our customer portal.
                  </p>
                  <p className={`text-sm ${secondaryTextColor}`}>
                    For billing support, please contact us at billing@hrvstr.com or use the customer portal above.
                  </p>
                </div>
              </div>
            </div> */}
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingPage;