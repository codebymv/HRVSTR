# Toast Notification System Overview

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Basic Usage](#basic-usage)
- [Limit-Specific Toasts](#limit-specific-toasts)
- [Clickable Toasts](#clickable-toasts)
- [Implementation Examples](#implementation-examples)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

## Overview

The HRVSTR application uses a custom toast notification system built with React Context and TypeScript. The system provides:

- **Standard toasts**: Success, error, info, and warning messages
- **Clickable toasts**: Navigate users to specific pages (e.g., `/settings/usage`)
- **Limit-specific toasts**: Standardized notifications for feature limits
- **Theme support**: Light and dark mode compatibility
- **Auto-dismiss**: Configurable duration with smooth animations

## Architecture

### Core Components

1. **ToastContext** (`/src/contexts/ToastContext.tsx`)
   - Manages toast state and provides CRUD operations
   - Supports clickable toasts with navigation
   - Type-safe interface for all toast operations

2. **Toast Component** (`/src/components/UI/Toast.tsx`)
   - Renders individual toast notifications
   - Handles animations and theme-based styling
   - Supports click navigation with visual indicators

3. **Limit Toast Utilities** (`/src/utils/limitToasts.ts`)
   - Specialized hooks and utilities for limit-related notifications
   - Consistent messaging and automatic linking to usage page
   - Support for tier-specific messaging

### Toast Types

```typescript
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  clickable?: boolean;
  linkTo?: string;
  onToastClick?: () => void;
}
```

## Basic Usage

### 1. Import the Hook

```typescript
import { useToast } from '../contexts/ToastContext';
```

### 2. Use in Components

```typescript
const MyComponent: React.FC = () => {
  const { success, error, warning, info } = useToast();

  const handleAction = () => {
    // Simple toast
    success('Operation completed successfully!');
    
    // Toast with custom duration
    error('Something went wrong', 8000);
    
    // Clickable toast
    warning('Check your settings', 6000, {
      clickable: true,
      linkTo: '/settings'
    });
  };

  return (
    <button onClick={handleAction}>
      Trigger Toast
    </button>
  );
};
```

## Limit-Specific Toasts

### Import Limit Toast Utilities

```typescript
import { useLimitToasts } from '../utils/limitToasts';
```

### Available Limit Toast Functions

```typescript
const {
  showLimitReached,           // Generic limit message
  showCreditLimitExceeded,    // Credit/billing limits
  showWatchlistLimitReached,  // Watchlist stock limits
  showSearchLimitReached,     // Search query limits
  showPriceUpdateLimitReached, // Price data limits
  showSentimentLimitReached,  // Sentiment analysis limits
  showSecFilingsLimitReached, // SEC filing limits
  showEarningsLimitReached,   // Earnings data limits
  showRateLimitReached,       // API rate limits
  showDailyLimitReset         // Limit reset notifications
} = useLimitToasts();
```

### Usage Examples

```typescript
// Basic limit notification
showLimitReached('Custom limit message');

// Watchlist limit with usage details
showWatchlistLimitReached(3, 5, 'free'); // 3/5 stocks used, free tier

// Search limit
showSearchLimitReached(25, 25, 'free'); // 25/25 searches used

// Credit limit
showCreditLimitExceeded(0); // No credits remaining
```

## Clickable Toasts

All limit toasts automatically link to `/settings/usage` where users can:
- View their current usage statistics
- Understand their tier limits
- Upgrade their plan if needed

### Visual Indicators

Clickable toasts display:
- 🖱️ **Cursor pointer** on hover
- 🔗 **External link icon** 
- 📈 **Hover scale effect**
- 💡 **Tooltip**: "Click to view usage details"

### Manual Clickable Toasts

```typescript
const { warning } = useToast();

// Navigate to specific page
warning('Please update your profile', 6000, {
  clickable: true,
  linkTo: '/settings/profile'
});

// Custom click handler
warning('Action required', 6000, {
  clickable: true,
  onToastClick: () => {
    // Custom logic here
    console.log('Custom action triggered');
  }
});
```

## Implementation Examples

### 1. Watchlist Limit Handling

```typescript
// In UserHome.tsx
import { useLimitToasts } from '../../utils/limitToasts';

const UserHome: React.FC = () => {
  const { showWatchlistLimitReached } = useLimitToasts();
  
  const handleAddTicker = async (symbol: string) => {
    try {
      // API call to add ticker
      await addTickerToWatchlist(symbol);
    } catch (error: any) {
      if (error.response?.status === 402 && 
          error.response?.data?.error === 'tier_limit') {
        
        const usage = error.response.data.usage;
        const tier = tierInfo?.tier || 'free';
        
        // Show standardized limit toast
        showWatchlistLimitReached(usage?.current, usage?.limit, tier);
        return;
      }
      // Handle other errors...
    }
  };
};
```

### 2. Search Limit in Modal

```typescript
// In AddTickerModal.tsx
import { useLimitToasts } from '../../utils/limitToasts';

const AddTickerModal: React.FC = () => {
  const { showSearchLimitReached } = useLimitToasts();
  
  const handleSearch = async () => {
    try {
      // Search API call
      await searchStocks(query);
    } catch (error: any) {
      if (error.response?.status === 402) {
        const usage = error.response.data.usage;
        const tier = tierInfo?.tier || 'free';
        
        showSearchLimitReached(usage?.current, usage?.limit, tier);
        onClose(); // Close modal after showing toast
        return;
      }
    }
  };
};
```

### 3. Credit Limit in Sentiment Analysis

```typescript
// In SentimentDashboard.tsx
import { useLimitToasts } from '../../utils/limitToasts';

const SentimentDashboard: React.FC = () => {
  const { showCreditLimitExceeded, showSentimentLimitReached } = useLimitToasts();
  
  const handleUnlockComponent = async (component: string, cost: number) => {
    try {
      await unlockComponent(component, cost);
    } catch (error: any) {
      if (error.response?.data?.error === 'insufficient_credits') {
        showCreditLimitExceeded(error.response.data.remaining);
      } else if (error.response?.data?.error === 'tier_limit') {
        showSentimentLimitReached(usage?.current, usage?.limit, tier);
      }
    }
  };
};
```

## Best Practices

### 1. Consistent Messaging

✅ **Use limit toast utilities** for standardized messaging:
```typescript
// Good
showWatchlistLimitReached(current, limit, tier);

// Avoid custom messages for limits
warning('You have reached your watchlist limit');
```

### 2. Appropriate Toast Types

- **Error** 🔴: Critical failures, credit exhausted
- **Warning** ⚠️: Limits reached, upgrade needed
- **Info** ℹ️: Rate limits, daily resets, neutral information
- **Success** ✅: Successful operations, confirmations

### 3. Duration Guidelines

```typescript
// Quick confirmations
success('Saved!', 3000);

// Important warnings
warning('Limit reached!', 6000);

// Rate limits (longer to read)
info('Please wait 2 minutes before retrying', 8000);
```

### 4. Error Handling

```typescript
const handleApiCall = async () => {
  try {
    await apiCall();
  } catch (error: any) {
    // Check for specific limit errors first
    if (error.response?.status === 402) {
      handleLimitError(error);
      return; // Don't show generic error
    }
    
    // Then handle other errors
    error('Something went wrong. Please try again.');
  }
};
```

### 5. User Experience

- **Always close modals** after showing limit toasts
- **Provide clear next steps** (upgrade, wait, check usage)
- **Don't stack multiple** limit toasts for the same action
- **Use appropriate icons** and visual cues

## API Reference

### useToast Hook

```typescript
interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: Toast['type'], duration?: number, options?: ToastOptions) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number, options?: ToastOptions) => void;
  error: (message: string, duration?: number, options?: ToastOptions) => void;
  info: (message: string, duration?: number, options?: ToastOptions) => void;
  warning: (message: string, duration?: number, options?: ToastOptions) => void;
}

interface ToastOptions {
  clickable?: boolean;
  linkTo?: string;
  onToastClick?: () => void;
}
```

### useLimitToasts Hook

```typescript
interface LimitToastHook {
  showLimitReached: (customMessage?: string) => void;
  showCreditLimitExceeded: (remainingCredits?: number) => void;
  showWatchlistLimitReached: (current?: number, limit?: number, tier?: string) => void;
  showSearchLimitReached: (current?: number, limit?: number, tier?: string) => void;
  showPriceUpdateLimitReached: (current?: number, limit?: number, tier?: string) => void;
  showSentimentLimitReached: (current?: number, limit?: number, tier?: string) => void;
  showSecFilingsLimitReached: (current?: number, limit?: number, tier?: string) => void;
  showEarningsLimitReached: (current?: number, limit?: number, tier?: string) => void;
  showRateLimitReached: (retryAfter?: number) => void;
  showDailyLimitReset: (feature?: string) => void;
}
```

### Static Utility Functions

```typescript
// For use outside React components
createLimitToastMessage: (
  limitType: 'credit' | 'watchlist' | 'search' | 'price' | 'sentiment' | 'filings' | 'earnings',
  current?: number,
  limit?: number,
  tier?: string
) => string;
```

## Integration Checklist

When adding limit toasts to a new feature:

- [ ] Import `useLimitToasts` hook
- [ ] Identify the appropriate limit type
- [ ] Handle 402 status codes from API
- [ ] Extract usage data from error response
- [ ] Call appropriate limit toast function
- [ ] Close modals/dialogs after showing toast
- [ ] Test with different tier levels
- [ ] Verify navigation to `/settings/usage` works
- [ ] Test toast appearance in both light/dark themes

## Troubleshooting

### Toast Not Appearing
- Ensure `ToastProvider` wraps your component tree
- Check console for errors in toast rendering
- Verify `ToastContainer` is included in your app

### Navigation Not Working
- Confirm `react-router-dom` is properly configured
- Check that `/settings/usage` route exists
- Verify the component is inside a Router context

### Styling Issues
- Check theme context is available
- Verify Tailwind classes are being applied
- Test in both light and dark modes

---

For questions or issues with the toast system, refer to the component implementations or reach out to the development team. 