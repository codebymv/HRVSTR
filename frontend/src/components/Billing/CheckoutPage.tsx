import React from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import CheckoutForm from './CheckoutForm';

const CheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();

  // Extract parameters from URL
  const tier = searchParams.get('tier');
  const priceId = searchParams.get('priceId');
  const amount = searchParams.get('amount');
  const interval = searchParams.get('interval') as 'month' | 'year';

  const isLight = theme === 'light';
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';

  // Redirect if required parameters are missing
  if (!tier || !priceId || !amount || !interval) {
    return <Navigate to="/settings/tiers" replace />;
  }

  const subscriptionName = `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`;
  const amountNumber = parseInt(amount, 10);

  const handleSuccess = (subscriptionId: string) => {
    console.log('Subscription created successfully:', subscriptionId);
    // The CheckoutForm will handle the redirect to billing page
  };

  const handleCancel = () => {
    window.history.back(); // Go back to previous page
  };

  return (
    <div className={`${bgColor} min-h-screen`}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className={`text-3xl font-bold ${textColor} mb-2`}>
              Complete Your Subscription
            </h1>
            <p className={`text-lg ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
              You're subscribing to the {subscriptionName}
            </p>
          </div>

          <CheckoutForm
            priceId={priceId}
            subscriptionName={subscriptionName}
            amount={amountNumber}
            interval={interval}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage; 