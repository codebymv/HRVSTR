/**
 * Setup file for Vitest
 * This file runs before each test file
 */

// Import vitest globals
import { vi } from 'vitest';

// Enable global variables like window, document, etc. for DOM testing
import '@testing-library/jest-dom';

// Add any global mocks or test setup here
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock localStorage
if (!global.localStorage) {
  global.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0
  };
}

// Mock fetch API if needed
// global.fetch = vi.fn();

// Any additional setup or mocks that should run before each test
