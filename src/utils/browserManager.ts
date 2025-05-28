// ============================================================================
// MODULE: browserManager.ts - Enhanced with Rayobyte Static Proxy Support
//
// PURPOSE:
// Comprehensive Puppeteer browser lifecycle management utility with integrated
// Rayobyte static proxy support and enhanced stealth capabilities.
// ============================================================================

import puppeteer from 'puppeteer-extra';
import { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ScrapingConfig } from '../config.js';
import { Logger, getErrorMessage } from './logger.js';

// Configure puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

/**
 * Enhanced browser lifecycle management with Rayobyte static proxy support
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
   * Launch browser with comprehensive stealth configuration and optional proxy support
   * Integrates Rayobyte static IP configuration for enhanced scraping capabilities
   * 
   * @param proxyServerUrl - Optional proxy server URL for Rayobyte static IP usage
   * @returns Promise<Browser> - Configured Puppeteer browser instance
   * @throws Error if browser launch fails or configuration is invalid
   */
  async launchBrowser(proxyServerUrl?: string): Promise<Browser> {
    try {
      // Assert browser configuration validity
      if (!this.config.browser.args || this.config.browser.args.length === 0) {
        throw new Error('Browser args cannot be empty');
      }
      if (this.config.browser.protocolTimeout <= 0) {
        throw new Error('Protocol timeout must be positive');
      }

      // Prepare launch options with stealth configuration
      const launchOptions: PuppeteerLaunchOptions = {
        headless: this.config.browser.headless,
        defaultViewport: this.config.browser.defaultViewport,
        args: [...this.config.browser.args],
        protocolTimeout: this.config.browser.protocolTimeout,
        ignoreDefaultArgs: ['--enable-automation'],
        ignoreHTTPSErrors: true
      };

      // Add proxy configuration if provided
      if (proxyServerUrl) {
        this.logger.info(`Launching browser with Rayobyte static proxy: ${proxyServerUrl}`);
        launchOptions.args?.push(`--proxy-server=${proxyServerUrl}`);
      } else if (this.config.proxyConfig?.staticProxies && this.config.proxyConfig.staticProxies.length > 0) {
        this.logger.warn('Static proxies configured but no specific proxy provided for this browser launch');
      }

      const browser = await puppeteer.launch(launchOptions);

      // Assert browser launch success
      if (!browser) {
        throw new Error('Browser launch failed - null browser returned');
      }

      this.activeBrowsers.add(browser);
      
      const logMessage = proxyServerUrl 
        ? `Browser launched with Rayobyte static proxy: ${proxyServerUrl}`
        : 'Browser launched with direct connection';
      
      this.logger.success(logMessage);

      return browser;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Browser launch failed: ${errorMessage}`, { 
        proxyUrl: proxyServerUrl,
        hasStaticProxies: this.config.proxyConfig?.staticProxies?.length || 0
      });
      throw new Error(`Browser launch failed: ${errorMessage}`);
    }
  }
  /**
   * Create new page with default configuration, stealth settings, and proxy authentication
   * 
   * @param browser - Browser instance to create page in
   * @param proxyServerUrl - Optional proxy URL for authentication handling
   * @returns Promise<Page> - Configured Puppeteer page instance
   */
  async createPage(browser: Browser, proxyServerUrl?: string): Promise<Page> {
    try {
      if (!browser || !browser.connected) {
        throw new Error('Valid connected browser instance is required');
      }

      const page = await browser.newPage();
      if (!page) {
        throw new Error('Page creation failed - null page returned');
      }

      // Handle proxy authentication if proxy URL contains credentials
      if (proxyServerUrl && this.containsProxyCredentials(proxyServerUrl)) {
        try {
          const credentials = this.extractProxyCredentials(proxyServerUrl);
          if (credentials) {
            await page.authenticate({
              username: credentials.username,
              password: credentials.password
            });
            this.logger.debug('Proxy authentication configured for page');
          }
        } catch (authError) {
          this.logger.warn('Proxy authentication failed, continuing without auth', {
            error: getErrorMessage(authError)
          });
        }
      }

      await this.configurePageDefaults(page);
      this.activePages.add(page);
      this.logger.debug('Page created successfully with enhanced configuration');

      return page;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Page creation failed: ${errorMessage}`);
      throw new Error(`Page creation failed: ${errorMessage}`);
    }
  }
  /**
   * Configure page with default settings for consistent behavior
   */
  private async configurePageDefaults(page: Page): Promise<void> {
    try {
      page.setDefaultNavigationTimeout(this.config.navigationTimeout);
      page.setDefaultTimeout(this.config.pageLoadTimeout);

      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.setViewport({
        width: this.config.browser.defaultViewport.width,
        height: this.config.browser.defaultViewport.height
      });

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
    } catch (error) {
      this.logger.warn('Page configuration failed', {
        error: getErrorMessage(error)
      });
    }
  }

  /**
   * Check if proxy URL contains authentication credentials
   */
  private containsProxyCredentials(proxyUrl: string): boolean {
    try {
      const url = new URL(proxyUrl);
      return !!(url.username && url.password);
    } catch {
      return false;
    }
  }

  /**
   * Extract proxy credentials from URL
   */
  private extractProxyCredentials(proxyUrl: string): { username: string; password: string } | null {
    try {
      const url = new URL(proxyUrl);
      if (url.username && url.password) {
        return {
          username: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password)
        };
      }
      return null;
    } catch {
      return null;
    }
  }
  /**
   * Close page safely and remove from active tracking
   */
  async closePage(page: Page): Promise<void> {
    try {
      if (page && !page.isClosed()) {
        await page.close();
        this.activePages.delete(page);
        this.logger.debug('Page closed successfully');
      }
    } catch (error) {
      this.logger.warn('Page closure failed', { error: getErrorMessage(error) });
    }
  }

  /**
   * Close browser safely and remove from active tracking
   */
  async closeBrowser(browser: Browser): Promise<void> {
    try {
      if (browser && browser.connected) {
        await browser.close();
        this.activeBrowsers.delete(browser);
        this.logger.debug('Browser closed successfully');
      }
    } catch (error) {
      this.logger.warn('Browser closure failed', { error: getErrorMessage(error) });
    }
  }

  /**
   * Start memory monitoring for resource management
   */
  private startMemoryMonitoring(): void {
    if (this.memoryMonitoringInterval) {
      clearInterval(this.memoryMonitoringInterval);
    }

    this.memoryMonitoringInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;

      if (memoryUsageMB > this.config.resourceMonitoring.memoryThresholdMB) {
        this.logger.warn('Memory threshold exceeded', {
          currentMemoryMB: Math.round(memoryUsageMB),
          thresholdMB: this.config.resourceMonitoring.memoryThresholdMB,
          activeBrowsers: this.activeBrowsers.size,
          activePages: this.activePages.size
        });

        // Trigger garbage collection if available
        if (global.gc) {
          global.gc();
          this.logger.debug('Garbage collection triggered');
        }
      }
    }, this.config.resourceMonitoring.cleanupIntervalMS);
  }

  /**
   * Cleanup resources when shutting down
   */
  async shutdown(): Promise<void> {
    try {
      if (this.memoryMonitoringInterval) {
        clearInterval(this.memoryMonitoringInterval);
      }
      
      const pageClosePromises = Array.from(this.activePages).map(page => this.closePage(page));
      await Promise.allSettled(pageClosePromises);

      const browserClosePromises = Array.from(this.activeBrowsers).map(browser => this.closeBrowser(browser));
      await Promise.allSettled(browserClosePromises);

      this.logger.info('BrowserManager shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown', { error: getErrorMessage(error) });
    }
  }
}