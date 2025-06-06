/**
 * Puppeteer Manager - Centralized browser management for scraping operations
 */

const puppeteer = require('puppeteer');

class PuppeteerManager {
  constructor(options = {}) {
    this.browser = null;
    this.pages = new Map();
    this.defaultOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      ...options
    };
  }

  /**
   * Launch a new browser instance
   * @param {Object} options - Browser launch options
   * @returns {Promise<Browser>} - Puppeteer browser instance
   */
  async launchBrowser(options = {}) {
    try {
      if (this.browser) {
        console.log('[PuppeteerManager] Reusing existing browser instance');
        return this.browser;
      }

      console.log('[PuppeteerManager] Launching new browser instance');
      this.browser = await puppeteer.launch({
        ...this.defaultOptions,
        ...options
      });

      // Handle browser disconnection
      this.browser.on('disconnected', () => {
        console.log('[PuppeteerManager] Browser disconnected');
        this.browser = null;
        this.pages.clear();
      });

      return this.browser;
    } catch (error) {
      console.error('[PuppeteerManager] Error launching browser:', error.message);
      throw error;
    }
  }

  /**
   * Create a new page with common settings
   * @param {string} pageId - Unique identifier for the page
   * @param {Object} options - Page configuration options
   * @returns {Promise<Page>} - Puppeteer page instance
   */
  async createPage(pageId = 'default', options = {}) {
    try {
      const browser = await this.launchBrowser();
      const page = await browser.newPage();

      // Set common page configurations
      await this.configurePage(page, options);

      // Store page reference
      this.pages.set(pageId, page);

      console.log(`[PuppeteerManager] Created page: ${pageId}`);
      return page;
    } catch (error) {
      console.error(`[PuppeteerManager] Error creating page ${pageId}:`, error.message);
      throw error;
    }
  }

  /**
   * Configure page with common settings
   * @param {Page} page - Puppeteer page instance
   * @param {Object} options - Configuration options
   */
  async configurePage(page, options = {}) {
    const {
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      viewport = { width: 1920, height: 1080 },
      timeout = 30000,
      interceptRequests = false
    } = options;

    try {
      // Set user agent
      await page.setUserAgent(userAgent);

      // Set viewport
      await page.setViewport(viewport);

      // Set timeout
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);

      // Request interception for performance (optional)
      if (interceptRequests) {
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          // Block unnecessary resources for faster loading
          const resourceType = request.resourceType();
          if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            request.abort();
          } else {
            request.continue();
          }
        });
      }

      console.log('[PuppeteerManager] Page configured successfully');
    } catch (error) {
      console.error('[PuppeteerManager] Error configuring page:', error.message);
      throw error;
    }
  }

  /**
   * Navigate to a URL with retry logic
   * @param {Page} page - Puppeteer page instance
   * @param {string} url - URL to navigate to
   * @param {Object} options - Navigation options
   * @returns {Promise<Response>} - Navigation response
   */
  async navigateWithRetry(page, url, options = {}) {
    const {
      waitUntil = 'networkidle2',
      timeout = 30000,
      retries = 3,
      retryDelay = 2000
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[PuppeteerManager] Navigating to ${url} (attempt ${attempt}/${retries})`);

        const response = await page.goto(url, {
          waitUntil,
          timeout
        });

        if (response && response.ok()) {
          console.log(`[PuppeteerManager] Successfully navigated to ${url}`);
          return response;
        } else {
          throw new Error(`Navigation failed with status: ${response?.status()}`);
        }
      } catch (error) {
        lastError = error;
        console.warn(`[PuppeteerManager] Navigation attempt ${attempt} failed: ${error.message}`);

        if (attempt < retries) {
          console.log(`[PuppeteerManager] Retrying in ${retryDelay}ms...`);
          await this.delay(retryDelay);
        }
      }
    }

    throw new Error(`Navigation failed after ${retries} attempts: ${lastError.message}`);
  }

  /**
   * Wait for content to load with multiple strategies
   * @param {Page} page - Puppeteer page instance
   * @param {Object} options - Wait options
   */
  async waitForContent(page, options = {}) {
    const {
      selectors = ['table', '[data-test*="earnings"]', '.earnings'],
      timeout = 30000,
      additionalDelay = 5000
    } = options;

    try {
      // Try to wait for specific selectors
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 10000 });
          console.log(`[PuppeteerManager] Found content with selector: ${selector}`);
          break;
        } catch (e) {
          console.log(`[PuppeteerManager] Selector ${selector} not found, trying next...`);
        }
      }

      // Additional delay for dynamic content
      if (additionalDelay > 0) {
        console.log(`[PuppeteerManager] Waiting additional ${additionalDelay}ms for dynamic content...`);
        await this.delay(additionalDelay);
      }

      console.log('[PuppeteerManager] Content loading wait completed');
    } catch (error) {
      console.warn('[PuppeteerManager] Content wait failed:', error.message);
      // Continue anyway as content might still be available
    }
  }

  /**
   * Get or create a page
   * @param {string} pageId - Page identifier
   * @param {Object} options - Page options
   * @returns {Promise<Page>} - Puppeteer page instance
   */
  async getPage(pageId = 'default', options = {}) {
    if (this.pages.has(pageId)) {
      const page = this.pages.get(pageId);
      
      // Check if page is still connected
      if (!page.isClosed()) {
        return page;
      } else {
        this.pages.delete(pageId);
      }
    }

    return await this.createPage(pageId, options);
  }

  /**
   * Close a specific page
   * @param {string} pageId - Page identifier
   */
  async closePage(pageId) {
    try {
      if (this.pages.has(pageId)) {
        const page = this.pages.get(pageId);
        await page.close();
        this.pages.delete(pageId);
        console.log(`[PuppeteerManager] Closed page: ${pageId}`);
      }
    } catch (error) {
      console.error(`[PuppeteerManager] Error closing page ${pageId}:`, error.message);
    }
  }

  /**
   * Close browser and all pages
   */
  async closeBrowser() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.pages.clear();
        console.log('[PuppeteerManager] Browser closed successfully');
      }
    } catch (error) {
      console.error('[PuppeteerManager] Error closing browser:', error.message);
    }
  }

  /**
   * Get browser status
   * @returns {Object} - Browser status information
   */
  getStatus() {
    return {
      hasBrowser: !!this.browser,
      isConnected: this.browser && this.browser.isConnected(),
      activePagesCount: this.pages.size,
      activePageIds: Array.from(this.pages.keys())
    };
  }

  /**
   * Utility delay function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute with automatic cleanup
   * @param {Function} operation - Async operation to execute
   * @param {Object} options - Options
   * @returns {Promise<*>} - Operation result
   */
  async executeWithCleanup(operation, options = {}) {
    const { pageId = 'temp', pageOptions = {}, cleanupOnError = true } = options;
    
    let page;
    try {
      page = await this.createPage(pageId, pageOptions);
      const result = await operation(page);
      return result;
    } catch (error) {
      console.error('[PuppeteerManager] Operation failed:', error.message);
      if (cleanupOnError && page) {
        await this.closePage(pageId);
      }
      throw error;
    } finally {
      if (page && !cleanupOnError) {
        await this.closePage(pageId);
      }
    }
  }
}

// Create singleton instance
const puppeteerManager = new PuppeteerManager();

module.exports = {
  PuppeteerManager,
  puppeteerManager
}; 