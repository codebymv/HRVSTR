import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { setupWindowMock } from './setupTestEnv';

// Mock axios
vi.mock('axios');
// Use Vi's typing approach instead of Jest's
const mockedAxios = axios as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

// Setup cleanup functions
let cleanupWindow: () => void;

describe('Reddit Client Data Authenticity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup window mock before importing the module
    cleanupWindow = setupWindowMock();
    
    // Setup axios mock
    vi.mocked(axios.get).mockClear();
    vi.mocked(axios.post).mockClear();
  });

  afterEach(() => {
    // Clean up window mock
    cleanupWindow();
    vi.resetAllMocks();
  });

  describe('fetchRedditPosts', () => {
    it('should make real API requests to fetch Reddit posts', async () => {
      // Import the function after window mock is set up
      const { fetchRedditPosts } = await import('../src/services/redditClient');
      
      // Mock fetch response with realistic data structure
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            children: [
              {
                data: {
                  id: 'abc123',
                  title: 'Real post about AAPL',
                  selftext: 'Actual content about Apple',
                  created_utc: Date.now() / 1000 - 3600, // 1 hour ago
                  author: 'realUser123',
                  ups: 42,
                  num_comments: 12,
                  permalink: '/r/stocks/comments/abc123/aapl_post',
                  subreddit: 'stocks'
                }
              }
            ]
          }
        })
      });
      
      // Call the function with its actual signature (accepting AbortSignal)  
      await fetchRedditPosts();
      
      // Verify fetch was called with the correct subreddit endpoints
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/reddit\/subreddit\/(stocks|wallstreetbets)/),
        expect.any(Object)
      );
      
      // Verify it correctly calls multiple subreddits
      expect(global.fetch).toHaveBeenCalledTimes(3); // wallstreetbets, stocks, and investing
    });

    it('should fetch and process real Reddit posts with correct data structure', async () => {
      // Import the fetchRedditPosts function - this is all we need since it internally handles parsing
      const { fetchRedditPosts } = await import('../src/services/redditClient');
      
      // Create a realistic Reddit API response with the structure expected by the module
      const mockRedditApiResponse = {
        data: {
          children: [
            {
              data: {
                id: 'abc123',
                title: 'Real AAPL Discussion',
                selftext: 'Genuine content about Apple stock performance',
                created_utc: Date.now() / 1000 - 7200, // 2 hours ago
                author: 'investor123',
                ups: 156,
                num_comments: 45,
                permalink: '/r/wallstreetbets/comments/abc123/real_aapl_discussion',
                subreddit: 'wallstreetbets'
              }
            },
            {
              data: {
                id: 'def456',
                title: 'AMZN vs AAPL',
                selftext: 'Comparison between Amazon and Apple',
                created_utc: Date.now() / 1000 - 14400, // 4 hours ago
                author: 'trader456',
                ups: 78,
                num_comments: 23,
                permalink: '/r/wallstreetbets/comments/def456/amzn_vs_aapl',
                subreddit: 'wallstreetbets'
              }
            }
          ]
        }
      };
      
      // Mock fetch to return our test data
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockRedditApiResponse)
      });
      
      // Call fetchRedditPosts which internally does the parsing
      const redditPosts = await fetchRedditPosts();
      
      // Verify we get results with the expected structure
      // The actual number of posts depends on implementation (4 because there are 2 subreddits)
      expect(redditPosts.length).toBeGreaterThan(0);
      
      // Find the post that matches our test data title
      const aaplDiscussionPost = redditPosts.find(p => p.title === 'Real AAPL Discussion');
      expect(aaplDiscussionPost).toBeDefined();
      
      // Only run these tests if we found the post
      if (aaplDiscussionPost) {
        expect(aaplDiscussionPost.title).toBe('Real AAPL Discussion');
        expect(aaplDiscussionPost.content).toBe('Genuine content about Apple stock performance');
        expect(aaplDiscussionPost.author).toBe('investor123');
        expect(aaplDiscussionPost.upvotes).toBeGreaterThan(0);
        expect(aaplDiscussionPost.commentCount).toBeGreaterThan(0);
        expect(aaplDiscussionPost.url).toContain('/r/wallstreetbets/comments/abc123/real_aapl_discussion');
        expect(aaplDiscussionPost.created).toBeDefined();
        
        // Ensure timestamps are converted correctly
        const expectedTimestamp = new Date((mockRedditApiResponse.data.children[0].data.created_utc) * 1000);
        expect(new Date(aaplDiscussionPost.created).getTime()).toBe(expectedTimestamp.getTime());
      }
    });
    
    it('should fetch data from different Reddit subreddits', async () => {
      // Since getSubredditUrl isn't exported, we'll test the actual behavior directly
      // Import fetchRedditPosts which internally uses the correct URLs
      const redditModule = await import('../src/services/redditClient');
      
      // Mock implementation of fetchSubreddit to capture URLs
      const capturedUrls: string[] = [];
      vi.spyOn(global, 'fetch').mockImplementation((url) => {
        capturedUrls.push(url as string);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { children: [] } })
        }) as any;
      });
      
      // Call the exported function
      await redditModule.fetchRedditPosts();
      
      // Verify we're actually making calls to the expected subreddits
      expect(capturedUrls.some(url => url.includes('subreddit/stocks'))).toBe(true);
      expect(capturedUrls.some(url => url.includes('subreddit/wallstreetbets'))).toBe(true);
      
      // Verify we make a unique call for each subreddit
      const uniqueSubreddits = new Set();
      capturedUrls.forEach(url => {
        const match = url.match(/subreddit\/([^?/]+)/);
        if (match) uniqueSubreddits.add(match[1]);
      });
      
      // Verify we're fetching from multiple distinct subreddits
      expect(uniqueSubreddits.size).toBeGreaterThan(1);
    });
  });
});
