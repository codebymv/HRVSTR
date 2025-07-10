import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, formatNumber, getSentimentCategory } from '../src/components/SentimentScraper/sentimentUtils';
import axios from 'axios';

// Mock axios
vi.mock('axios');
// Use Vi's typing approach
const mockedAxios = axios as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('Data Authenticity Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Sentiment Utilities', () => {
    it('properly categorizes sentiment values based on real thresholds', () => {
      // Test all relevant ranges with actual threshold values (BULLISH_THRESHOLD = 0.6, BEARISH_THRESHOLD = 0.4)
      expect(getSentimentCategory(0.9)).toBe('bullish'); // Strongly bullish
      expect(getSentimentCategory(0.6)).toBe('bullish'); // Exactly at bullish threshold
      expect(getSentimentCategory(0.7)).toBe('bullish'); // Above bullish threshold
      expect(getSentimentCategory(0.59)).toBe('neutral'); // Just below bullish threshold
      expect(getSentimentCategory(0.5)).toBe('neutral'); // In neutral range
      expect(getSentimentCategory(0.45)).toBe('neutral'); // In neutral range
      expect(getSentimentCategory(0.41)).toBe('neutral'); // Just above bearish threshold
      expect(getSentimentCategory(0.4)).toBe('bearish'); // Exactly at bearish threshold
      expect(getSentimentCategory(0.3)).toBe('bearish'); // Below bearish threshold
      expect(getSentimentCategory(0.1)).toBe('bearish'); // Clearly bearish
      
      // Ensure values exactly at thresholds are handled correctly
      expect(getSentimentCategory(0.6)).toBe('bullish');  // >= 0.6 is bullish
      expect(getSentimentCategory(0.4)).toBe('bearish');  // <= 0.4 is bearish
    });

    it('formats large numbers consistently based on real thresholds', () => {
      // Check the actual threshold values for formatting
      expect(formatNumber(999)).toBe('999');         // Below 1k threshold
      expect(formatNumber(1000)).toBe('1.0k');      // Exactly at 1k threshold
      expect(formatNumber(1500)).toBe('1.5k');      // Between 1k and 1M
      expect(formatNumber(999999)).toBe('1000.0k'); // Just below 1M threshold
      expect(formatNumber(1000000)).toBe('1.0m');   // Exactly at 1M threshold
      expect(formatNumber(1500000)).toBe('1.5m');   // Above 1M

      // Verify edge cases are handled properly
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber(undefined)).toBe('0');
    });

    it('formats dates consistently using actual date objects', () => {
      // Create reference timestamps to test
      const timestamps = [
        new Date('2025-01-01T12:00:00Z').toISOString(),
        new Date('2025-05-07T15:30:45Z').toISOString(),
        new Date('2024-12-25T23:59:59Z').toISOString()
      ];
      
      // Format each timestamp
      const formattedDates = timestamps.map(ts => formatDate(ts));
      
      // Verify all formatted dates contain expected components
      formattedDates.forEach((date, index) => {
        const originalDate = new Date(timestamps[index]);
        
        // Verify month is present (looking for short month name)
        const monthName = originalDate.toLocaleString('en-US', { month: 'short' });
        expect(date).toContain(monthName);
        
        // Verify day is present
        const day = originalDate.getDate();
        expect(date).toContain(day.toString());
        
        // Should contain time separators
        expect(date).toMatch(/\d+:\d+/); // Check for time in format HH:MM
      });
      
      // Verify different dates produce different outputs
      expect(formattedDates[0]).not.toBe(formattedDates[1]);
      expect(formattedDates[1]).not.toBe(formattedDates[2]);
    });
  });

  describe('Data Source Authentication', () => {
    it('makes correctly structured API requests when fetching Reddit data', async () => {
      // Use a better approach - mock only what's needed instead of the entire window object
      // First save the original window if it exists
      const originalWindow = globalThis.window;

      // Now we'll mock just what's needed for the test
      // Override only location.hostname which is used in the redditClient
      vi.stubGlobal('window', {
        location: {
          hostname: 'localhost'
        }
      });
      
      // Clean up function to be called after test
      const cleanup = () => {
        if (originalWindow) {
          // @ts-ignore - restore original window
          globalThis.window = originalWindow;
        } else {
          // @ts-ignore - or delete the mock if there was no original
          delete globalThis.window;
        }
      };
      
      // Configure global.fetch mock
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            children: [
              {
                data: {
                  id: 'abc123',
                  title: 'AAPL just posted great earnings',
                  selftext: 'Thoughts on Apple stock after earnings?',
                  author: 'user123',
                  ups: 42,
                  num_comments: 17,
                  permalink: '/r/stocks/comments/abc123/aapl_earnings',
                  created_utc: Date.now() / 1000,
                  subreddit: 'stocks'
                }
              }
            ]
          }
        })
      });
      
      // Import the function only after mocking window and fetch
      const { fetchRedditPosts } = await import('../src/services/redditClient');
      
      try {
        // Call the function (with the correct signature)
        await fetchRedditPosts();
      
        // Verify fetch was called with the proper proxy URL and subreddit path
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringMatching(/\/api\/reddit\/subreddit\/(stocks|wallstreetbets)\?limit=\d+/),
          expect.any(Object)
        );
      
        // Verify it's called multiple times for each subreddit
        expect(global.fetch).toHaveBeenCalledTimes(3); // For 'wallstreetbets', 'stocks', and 'investing'
      } finally {
        // Always clean up the window mock, even if the test fails
        cleanup();
      }
    });
  });
});
