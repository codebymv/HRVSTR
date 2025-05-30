import React, { useEffect } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import TierManagement from '../TierManagement';

const UsagePage: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Check for success/error messages from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const creditsPurchased = urlParams.get('credits_purchased');
  const purchaseCancelled = urlParams.get('purchase_cancelled');
  
  // Clean up URL parameters after showing the message
  useEffect(() => {
    if (creditsPurchased || purchaseCancelled) {
      const timer = setTimeout(() => {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }, 5000); // Remove parameters after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [creditsPurchased, purchaseCancelled]);
  
  // Theme-specific styling
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';

  return (
    <div className={`${bgColor} min-h-screen p-4 lg:p-8`}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 lg:mb-8">
          <h1 className={`text-2xl lg:text-3xl font-bold ${textColor} mb-2`}>Usage</h1>
          <p className={secondaryTextColor}>Monitor your credit usage and subscription details</p>
        </div>

        {/* Success/Error Messages */}
        {creditsPurchased && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-lg">
            <div className="flex items-center">
              <div className="text-green-600 dark:text-green-400">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">Credits Purchased Successfully!</h3>
                <p className="text-green-700 dark:text-green-300 text-sm">Your credits have been added to your account and are ready to use.</p>
              </div>
            </div>
          </div>
        )}

        {purchaseCancelled && (
          <div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-lg">
            <div className="flex items-center">
              <div className="text-yellow-600 dark:text-yellow-400">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Purchase Cancelled</h3>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm">No charges were made. You can try purchasing credits again anytime.</p>
              </div>
            </div>
          </div>
        )}

        <TierManagement />
      </div>
    </div>
  );
};

export default UsagePage; 