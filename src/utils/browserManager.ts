// ============================================================================
// MODULE: browserManager.ts
//
// PURPOSE:
// Comprehensive Puppeteer browser lifecycle management utility preserving
// all browser functionality from both original Python modules while adding
// enhanced stealth capabilities and resource management.
//
// DEPENDENCIES:
// - puppeteer-extra: Enhanced Puppeteer with plugin support
// - puppeteer-extra-plugin-stealth: Anti-detection capabilities
// - ../config.js: Scraping configuration and browser settings
//
// EXPECTED INTERFACES:
// - BrowserManager class with browser/page lifecycle methods
// - Browser launching with stealth configuration
// - Page creation and management with resource cleanup
// - Memory monitoring and automatic cleanup capabilities
//
// DESIGN PATTERNS:
// - Factory pattern for browser and page creation
// - Resource management pattern with automatic cleanup
// - Observer pattern for resource monitoring
//
// SYSTEM INVARIANTS:
// - Browsers must be launched with stealth configuration
// - All pages must be properly closed to prevent memory leaks
// - Browser instances must be cleaned up after use
// - Resource usage must be monitored and controlled
//
// NEGATIVE SPACE CONSIDERATIONS:
// - NEVER launch browsers without stealth configuration
// - NEVER leave pages or browsers unclosed
// - NEVER exceed memory thresholds without cleanup
// - NEVER proceed with invalid browser configurations
// ============================================================================

import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ScrapingConfig } from '../config.js';
import { Logger, getErrorMessage } from './logger.js';

// Configure puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

/**
 * Comprehensive browser lifecycle management preserving all original functionality
 * Handles browser launching, page creation, resource monitoring, and cleanup
 */
export class BrowserManager {
  private config: ScrapingConfig;
  private logger: Logger;
  private activeBrowsers: Set<Browser>;
  private activePages: Set<Page>;
  private memoryMonitoringInterval?: NodeJS.Timeout;

  constructor(config: ScrapingConfig) {
    // Assert valid configuration
    if (!config) {
      throw new Error('BrowserManager requires valid configuration');
    }
    if (!config.browser) {
      throw new Error('Browser configuration is required');
    }
    if (!config.resourceMonitoring) {
      throw new Error('Resource monitoring configuration is required');
    }

    this.config = config;
    this.logger = new Logger();
    this.activeBrowsers = new Set();
    this.activePages = new Set();
    
    this.startMemoryMonitoring();
  }

  /**
   * Launch browser with comprehensive stealth configuration
   * Applies all browser settings from configuration while maintaining stealth capabilities
   * 
   * @returns Promise<Browser> - Configured Puppeteer browser instance
   * @throws Error if browser launch fails or configuration is invalid
   */
  async launchBrowser(): Promise<Browser> {
    try {
      // Assert browser configuration validity
      if (!this.config.browser.args || this.config.browser.args.length === 0) {
        throw new Error('Browser args cannot be empty');
      }
      if (this.config.browser.protocolTimeout <= 0) {
        throw new Error('Protocol timeout must be positive');
      }

      const browser = await puppeteer.launch({
        headless: this.config.browser.headless,
        defaultViewport: this.config.browser.defaultViewport,
        args: this.config.browser.args,
        protocolTimeout: this.config.browser.protocolTimeout,
        ignoreDefaultArgs: ['--enable-automation'],
        ignoreHTTPSErrors: true
      });

      // Assert browser launch success
      if (!browser) {
        throw new Error('Browser launch failed - null browser returned');
      }

      this.activeBrowsers.add(browser);
      
      this.logger.log(
        `Browser launched successfully with stealth configuration`,
        '/tmp/browser_manager.log',
        { logLevel: 'SUCCESS' }
      );

      return browser;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.log(
        `Browser launch failed: ${errorMessage}`,
        '/tmp/browser_manager.log',
        { logLevel: 'ERROR' }
      );
      throw new Error(`Browser launch failed: ${errorMessage}`);
    }
  }

  /**
   * Create new page with default configuration and stealth settings
   * Applies consistent page configuration while maintaining anti-detection capabilities
   * 
   * @param browser - Browser instance to create page in
   * @returns Promise<Page> - Configured Puppeteer page instance
   * @throws Error if page creation fails or browser is invalid
   */
  async createPage(browser: Browser): Promise<Page> {
    try {
      // Assert valid browser instance
      if (!browser) {
        throw new Error('Valid browser instance is required for page creation');
      }
      if (!browser.connected) {
        throw new Error('Browser must be connected to create pages');
      }

      const page = await browser.newPage();
      
      // Assert page creation success
      if (!page) {
        throw new Error('Page creation failed - null page returned');
      }

      // Configure page defaults with stealth settings
      await this.configurePageDefaults(page);
      
      this.activePages.add(page);
      
      this.logger.log(
        `Page created successfully with default configuration`,
        '/tmp/browser_manager.log',
        { logLevel: 'DEBUG' }
      );

      return page;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.log(
        `Page creation failed: ${errorMessage}`,
        '/tmp/browser_manager.log',
        { logLevel: 'ERROR' }
      );
      throw new Error(`Page creation failed: ${errorMessage}`);
    }
  }

  /**
   * Configure page with default settings for consistent behavior
   * Applies timeouts, viewport, and anti-detection measures
   * 
   * @param page - Page instance to configure
   */
  private async configurePageDefaults(page: Page): Promise<void> {
    try {
      // Set navigation timeouts
      page.setDefaultNavigationTimeout(this.config.navigationTimeout);
      page.setDefaultTimeout(this.config.pageLoadTimeout);

      // Block unnecessary resources for performance
      await page.setRequestInterception(true);
      
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Configure viewport to match configuration
      await page.setViewport({
        width: this.config.browser.defaultViewport.width,
        height: this.config.browser.defaultViewport.height
      });

      // Override navigator properties for enhanced stealth
      await page.evaluateOnNewDocument(() => {
        // Hide webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Override permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: PermissionDescriptor) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: 'denied' } as PermissionStatus) :
            originalQuery(parameters)
        );
      });
    } catch (error) {
      this.logger.log(
        `Page configuration failed: ${getErrorMessage(error)}`,
        '/tmp/browser_manager.log',
        { logLevel: 'WARN' }
      );
    }
  }

  /**
   * Safely close page and remove from active pages tracking
   * Ensures proper resource cleanup to prevent memory leaks
   * 
   * @param page - Page instance to close
   */
  async closePage(page: Page): Promise<void> {
    try {
      if (page && !page.isClosed()) {
        await page.close();
        this.activePages.delete(page);
        
        this.logger.log(
          `Page closed successfully`,
          '/tmp/browser_manager.log',
          { logLevel: 'DEBUG' }
        );
      }
    } catch (error) {
      this.logger.log(
        `Page closure failed: ${getErrorMessage(error)}`,
        '/tmp/browser_manager.log',
        { logLevel: 'WARN' }
      );
    }
  }

  /**
   * Safely close browser and remove from active browsers tracking
   * Ensures all pages are closed before browser closure
   * 
   * @param browser - Browser instance to close
   */
  async closeBrowser(browser: Browser): Promise<void> {
    try {
      if (browser && browser.connected) {
        const pages = await browser.pages();
        
        // Close all pages first
        for (const page of pages) {
          await this.closePage(page);
        }
        
        await browser.close();
        this.activeBrowsers.delete(browser);
        
        this.logger.log(
          `Browser closed successfully`,
          '/tmp/browser_manager.log',
          { logLevel: 'SUCCESS' }
        );
      }
    } catch (error) {
      this.logger.log(
        `Browser closure failed: ${getErrorMessage(error)}`,
        '/tmp/browser_manager.log',
        { logLevel: 'WARN' }
      );
    }
  }

  /**
   * Start memory monitoring with automatic cleanup triggers
   * Prevents resource exhaustion during large-scale operations
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitoringInterval = setInterval(async () => {
      await this.handleBrowserMemoryCleanup();
    }, this.config.resourceMonitoring.cleanupIntervalMS);
  }

  /**
   * Handle browser memory cleanup when thresholds are exceeded
   * Closes inactive resources to maintain system stability
   */
  private async handleBrowserMemoryCleanup(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      
      if (heapUsedMB > this.config.resourceMonitoring.memoryThresholdMB) {
        this.logger.log(
          `Memory threshold exceeded (${heapUsedMB}MB), initiating cleanup`,
          '/tmp/browser_manager.log',
          { logLevel: 'WARN' }
        );
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Close excess pages if many are active
        if (this.activePages.size > 10) {
          let closedCount = 0;
          for (const page of this.activePages) {
            if (closedCount >= 5) break; // Close up to 5 pages
            await this.closePage(page);
            closedCount++;
          }
        }
      }
    } catch (error) {
      this.logger.log(
        `Memory cleanup failed: ${getErrorMessage(error)}`,
        '/tmp/browser_manager.log',
        { logLevel: 'ERROR' }
      );
    }
  }

  /**
   * Get current resource usage statistics for monitoring
   * Provides insights into browser and page resource consumption
   * 
   * @returns Object containing resource usage statistics
   */
  getResourceStats(): object {
    const memoryUsage = process.memoryUsage();
    
    return {
      activeBrowsers: this.activeBrowsers.size,
      activePages: this.activePages.size,
      memoryUsage: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      configuration: {
        memoryThreshold: this.config.resourceMonitoring.memoryThresholdMB,
        cleanupInterval: this.config.resourceMonitoring.cleanupIntervalMS
      }
    };
  }

  /**
   * Cleanup all resources and stop monitoring
   * Should be called during shutdown to prevent resource leaks
   */
  async cleanup(): Promise<void> {
    try {
      // Stop memory monitoring
      if (this.memoryMonitoringInterval) {
        clearInterval(this.memoryMonitoringInterval);
      }
      
      // Close all active pages
      for (const page of this.activePages) {
        await this.closePage(page);
      }
      
      // Close all active browsers
      for (const browser of this.activeBrowsers) {
        await this.closeBrowser(browser);
      }
      
      this.logger.log(
        `BrowserManager cleanup completed successfully`,
        '/tmp/browser_manager.log',
        { logLevel: 'SUCCESS' }
      );
    } catch (error) {
      this.logger.log(
        `BrowserManager cleanup failed: ${getErrorMessage(error)}`,
        '/tmp/browser_manager.log',
        { logLevel: 'ERROR' }
      );
    }
  }
}