/**
 * Format relative time information for events (e.g., "today", "~1 week away", etc.)
 * @param scheduledAt The scheduled date/time string
 * @returns Relative time string or null if event is past or invalid
 */
export function formatEventRelativeTime(scheduledAt: string): string | null {
  if (!scheduledAt) return null;
  
  try {
    const eventDate = new Date(scheduledAt);
    const now = new Date();
    
    // Calculate the difference in milliseconds
    const diffMs = eventDate.getTime() - now.getTime();
    
    // Use Math.round for more accurate day calculation
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return null; // Past events
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays <= 13) {
      // Show days for up to 2 weeks for more precision
      return `${diffDays} days`;
    } else if (diffDays === 14) {
      return '2 weeks';
    } else if (diffDays <= 20) {
      // Show "2+ weeks" for 15-20 days
      return '2+ weeks';
    } else if (diffDays === 21) {
      return '3 weeks';
    } else if (diffDays <= 27) {
      return '3+ weeks';
    } else if (diffDays <= 35) {
      // 4-5 weeks, closer to a month
      const weeks = Math.round(diffDays / 7);
      return `${weeks} weeks`;
    } else if (diffDays <= 60) {
      // 1-2 months range
      const months = Math.round(diffDays / 30);
      return months === 1 ? '~1 month' : `~${months} months`;
    } else {
      // 2+ months
      const months = Math.round(diffDays / 30);
      return `~${months} months`;
    }
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return null;
  }
}

/**
 * Get badge styling based on urgency of the relative time
 * @param relativeTime The relative time string
 * @returns Object with className and style properties
 */
export function getRelativeTimeBadgeStyle(relativeTime: string): {
  className: string;
  variant: 'urgent' | 'warning' | 'info' | 'default';
} {
  if (relativeTime === 'Today') {
    return {
      className: 'bg-red-500 text-white font-medium',
      variant: 'urgent'
    };
  } else if (relativeTime === 'Tomorrow') {
    return {
      className: 'bg-orange-500 text-white font-medium',
      variant: 'warning'
    };
  } else if (relativeTime.includes('days')) {
    // Extract the number of days to determine urgency
    const days = parseInt(relativeTime.split(' ')[0]);
    if (days <= 3) {
      return {
        className: 'bg-orange-400 text-white font-medium',
        variant: 'warning'
      };
    } else if (days <= 7) {
      return {
        className: 'bg-blue-500 text-white font-medium',
        variant: 'info'
      };
    } else {
      return {
        className: 'bg-blue-400 text-white font-medium',
        variant: 'info'
      };
    }
  } else if (relativeTime.includes('week')) {
    // All week-based ranges
    if (relativeTime === '2 weeks' || relativeTime === '2+ weeks') {
      return {
        className: 'bg-blue-400 text-white font-medium',
        variant: 'info'
      };
    } else if (relativeTime.includes('3')) {
      return {
        className: 'bg-indigo-500 text-white font-medium',
        variant: 'default'
      };
    } else {
      return {
        className: 'bg-indigo-400 text-white font-medium',
        variant: 'default'
      };
    }
  } else if (relativeTime.includes('month')) {
    return {
      className: 'bg-gray-500 text-white font-medium',
      variant: 'default'
    };
  } else {
    return {
      className: 'bg-gray-500 text-white font-medium',
      variant: 'default'
    };
  }
} 