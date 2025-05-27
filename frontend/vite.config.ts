/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./setupTests.ts'],
    testTimeout: 10000, // Increase timeout to 10 seconds
  },
  server: {
     port: 5173,
     host: true // Explicitly set host to true
  },
  // Ensure base is correctly set for deployment if needed
  base: '/',
  build: {
    copyPublicDir: true // Explicitly copy public directory content to build output root
  }
});
