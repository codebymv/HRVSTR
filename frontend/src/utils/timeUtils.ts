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
    
    // Check if the event is in the past
    if (eventDate <= now) return null;
    
    // Calculate the difference in milliseconds
    const diffMs = eventDate.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    
    // Determine relative time based on difference
    if (diffMinutes < 60) {
      return "soon";
    } else if (diffHours < 24) {
      if (diffHours < 2) {
        return "soon";
      } else {
        // Check if it's today
        const today = new Date();
        const isToday = eventDate.toDateString() === today.toDateString();
        return isToday ? "today" : "soon";
      }
    } else if (diffDays === 1) {
      return "tomorrow";
    } else if (diffDays < 7) {
      return `~${diffDays} day${diffDays > 1 ? 's' : ''} away`;
    } else if (diffWeeks === 1) {
      return "~1 week away";
    } else if (diffWeeks < 4) {
      return `~${diffWeeks} week${diffWeeks > 1 ? 's' : ''} away`;
    } else if (diffMonths === 1) {
      return "~1 month away";
    } else if (diffMonths < 12) {
      return `~${diffMonths} month${diffMonths > 1 ? 's' : ''} away`;
    } else {
      return "~1 year+ away";
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
  // Use the same blue styling as the refresh button (bg-blue-600)
  return {
    className: "bg-blue-600 text-white",
    variant: 'default'
  };
} 