import { useState, useCallback } from 'react';
import { TimeRange } from '../types';

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T, 
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface UseTimeRangeDebounceReturn {
  isTransitioning: boolean;
  handleTimeRangeChange: (range: TimeRange, onRangeSet: (range: TimeRange) => void) => void;
  setIsTransitioning: (transitioning: boolean) => void;
}

export function useTimeRangeDebounce(
  onLoadingStateChange?: (states: { chart: boolean; posts: boolean }) => void,
  onProgressUpdate?: (progress: number, stage: string) => void,
  onDataClear?: () => void
): UseTimeRangeDebounceReturn {
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  
  // Debounced time range change handler with reduced delay
  const debouncedTimeRangeChange = useCallback(
    debounce((range: TimeRange, onRangeSet: (range: TimeRange) => void) => {
      console.log(`Executing debounced time range change to: ${range}`);
      onRangeSet(range);
    }, 150), // Reduced from 300ms to 150ms for better responsiveness
    []
  );
  
  // Handle time range change with transitioning logic
  const handleTimeRangeChange = useCallback((
    range: TimeRange, 
    onRangeSet: (range: TimeRange) => void
  ) => {
    console.log(`Time range changed to: ${range}`);
    
    // Set transitioning state to true to prevent chart flickering
    setIsTransitioning(true);
    
    // Show loading state immediately to prevent flickering for both chart and posts
    if (onLoadingStateChange) {
      onLoadingStateChange({ chart: true, posts: true });
    }
    
    if (onProgressUpdate) {
      onProgressUpdate(10, `Loading ${range.toUpperCase()} sentiment data...`);
    }
    
    // Clear UI displayed data (not the cached data)
    // This forces the UI to show loading state while we filter our cached data
    if (onDataClear) {
      onDataClear();
    }
    
    // Use debounced handler
    debouncedTimeRangeChange(range, onRangeSet);
  }, [debouncedTimeRangeChange, onLoadingStateChange, onProgressUpdate, onDataClear]);
  
  return {
    isTransitioning,
    handleTimeRangeChange,
    setIsTransitioning,
  };
} 