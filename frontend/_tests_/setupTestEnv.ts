// This file provides common test setup functionality for all tests
import { vi } from 'vitest';

/**
 * Set up mock window object for tests that need it
 * This is particularly needed for code that references window.location
 * like the redditClient module
 */
export function setupWindowMock() {
  // First save the original window if it exists
  const originalWindow = globalThis.window;

  // Now mock just what's needed
  vi.stubGlobal('window', {
    location: {
      hostname: 'localhost',
      href: 'http://localhost:3000/',
      protocol: 'http:',
      host: 'localhost:3000',
      pathname: '/',
      search: '',
      hash: '',
      origin: 'http://localhost:3000'
    }
  });
  
  // Return cleanup function
  return function cleanup() {
    if (originalWindow) {
      // @ts-ignore - restore original window
      globalThis.window = originalWindow;
    } else {
      // @ts-ignore - or delete the mock if there was no original
      delete globalThis.window;
    }
  };
}

/**
 * Mock fetch API for tests
 * @returns Cleanup function to restore original fetch
 */
export function setupFetchMock() {
  const originalFetch = global.fetch;
  
  // Default mock implementation
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({})
  });
  
  // Return cleanup function
  return function cleanup() {
    global.fetch = originalFetch;
  };
}
