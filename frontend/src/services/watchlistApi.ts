import { WatchlistItem } from '../types';

/**
 * Fetch user's watchlist
 * @returns Promise of watchlist items array
 */
export const fetchWatchlist = async (): Promise<WatchlistItem[]> => {
  // Demo watchlist data
  const demoWatchlist: WatchlistItem[] = [
    { ticker: 'TSLA', name: 'Tesla, Inc.', isActive: true },
    { ticker: 'NVDA', name: 'NVIDIA Corporation', isActive: true },
    { ticker: 'META', name: 'Meta Platforms, Inc.', isActive: false }
  ];
  
  return demoWatchlist;
}; 