// ============================================================================
// MODULE: urlDiscovery.ts
//
// PURPOSE:
// Complete URL Discovery Engine implementing all "Make URL File" functionality.
// Provides website crawling, recursive link discovery, auto-scrolling, toggle
// clicking, language filtering, and comprehensive stealth browsing capabilities.
//
// DEPENDENCIES:
// - puppeteer-extra: Enhanced Puppeteer with plugin support
// - puppeteer-extra-plugin-stealth: Anti-detection capabilities
// - p-limit: Concurrency control for crawling operations
// - ../config.js: Scraping configuration and settings
// - ../utils/browserManager.js: Browser lifecycle management
// - ../utils/contentExtractor.js: Content extraction and text processing
// - ../utils/logger.js: Comprehensive logging system
// - ../utils/urlUtils.js: URL processing and validation utilities
//
// DESIGN PATTERNS:
// - Strategy pattern for different crawling approaches
// - Observer pattern for progress reporting and monitoring
// - Template method pattern for URL processing pipeline
// - Factory pattern for browser and page creation
//
// SYSTEM INVARIANTS:
// - URLs must be validated and normalized before processing
// - Crawl depth limits must be respected to prevent infinite loops
// - Concurrency limits must be enforced to prevent resource exhaustion
// - Duplicate URLs must be prevented through comprehensive tracking
// - Browser resources must be cleaned up properly after processing
//
// NEGATIVE SPACE CONSIDERATIONS:
// - NEVER crawl beyond configured maximum depth limits
// - NEVER process duplicate URLs to prevent infinite loops
// - NEVER exceed concurrency limits to prevent resource exhaustion
// - NEVER proceed with invalid or malformed URLs
// - NEVER ignore browser cleanup requirements
// ============================================================================

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import pLimit from 'p-limit';
import { ScrapingConfig } from '../config.js';
import { Logger, getErrorMessage } from '../utils/logger.js';
import { UrlUtils } from '../utils/urlUtils.js';
import { BrowserManager } from '../utils/browserManager.js';
import { ContentExtractor } from '../utils/contentExtractor.js';
import { promises as fs } from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

/**
 * Complete URL Discovery Engine preserving all Make URL File functionality
 * Handles website crawling, recursive link discovery, and comprehensive content extraction
 */
export class UrlDiscoveryEngine {
  private config: ScrapingConfig;
  private logger: Logger;
  private browserManager: BrowserManager;
  private contentExtractor: ContentExtractor;
  private discoveredUrls: Set<string>;
  private visitedUrls: Set<string>;
  private failedUrls: Set<string>;

  constructor(config: ScrapingConfig) {
    // Validate configuration before initialization
    if (!config) {
      throw new Error('UrlDiscoveryEngine requires valid configuration');
    }

    this.config = config;
    this.logger = new Logger();
    this.browserManager = new BrowserManager(config);
    this.contentExtractor = new ContentExtractor(config);
    this.discoveredUrls = new Set();
    this.visitedUrls = new Set();
    this.failedUrls = new Set();
  }

  /**
   * Main URL discovery orchestration method - Complete Make URL File functionality
   * Crawls website recursively starting from single URL with comprehensive filtering
   * 
   * @param args - Discovery arguments from MCP tool
   * @param context - MCP context with progress reporting and logging
   * @returns Promise<DiscoveryResults> - Comprehensive discovery results
   * @throws Error if discovery fails or parameters are invalid
   */
  async discoverUrls(args: any, context: any): Promise<DiscoveryResults> {
    const { reportProgress, log } = context;
    const startTime = Date.now();

    try {
      log.info('Starting URL discovery operation', {
        startUrl: args.startUrl,
        maxDepth: args.maxDepth,
        maxConcurrent: args.maxConcurrent
      });

      // Validate start URL
      const normalizedStartUrl = UrlUtils.normalizeUrl(args.startUrl);
      if (!normalizedStartUrl || !UrlUtils.isValidUrl(normalizedStartUrl)) {
        throw new Error(`Invalid start URL provided: ${args.startUrl}`);
      }

      // Set up output directory structure
      const hostname = this.extractHostname(normalizedStartUrl);
      const timestamp = Date.now();
      const outputDir = path.join(this.config.outputBasePath, `${hostname}_discovery_${timestamp}`);
      
      // Organize output directories
      await this.contentExtractor.organizeOutputFiles();
      await fs.mkdir(outputDir, { recursive: true });
      await fs.mkdir(path.join(outputDir, 'texts'), { recursive: true });

      // Initialize crawling data structures
      this.discoveredUrls.clear();
      this.visitedUrls.clear();
      this.failedUrls.clear();
      
      // Add starting URL to discovery set
      this.discoveredUrls.add(normalizedStartUrl);
      
      // Initialize crawl queue with starting URL
      const crawlQueue: CrawlItem[] = [{ url: normalizedStartUrl, depth: 0 }];
      
      // Set up concurrency control
      const limit = pLimit(args.maxConcurrent || this.config.maxConcurrentPages);
      
      let processedCount = 0;
      reportProgress({ progress: 5, total: 100 });

      // Main crawling loop with depth-first exploration
      while (crawlQueue.length > 0) {
        // Process current batch of URLs with concurrency control
        const currentBatch = crawlQueue.splice(0, args.maxConcurrent || this.config.maxConcurrentPages);
        
        const batchPromises = currentBatch.map(item => 
          limit(async () => {
            try {
              const discoveredLinks = await this.processUrl(item, args, outputDir);
              
              // Add discovered links to queue if within depth limit
              for (const link of discoveredLinks) {
                const normalizedLink = UrlUtils.normalizeUrl(link);
                if (normalizedLink && 
                    !this.discoveredUrls.has(normalizedLink) && 
                    item.depth < args.maxDepth &&
                    this.shouldIncludeUrl(normalizedLink, args.excludePatterns)) {
                  
                  this.discoveredUrls.add(normalizedLink);
                  crawlQueue.push({ url: normalizedLink, depth: item.depth + 1 });
                }
              }
              
              this.visitedUrls.add(item.url);
              processedCount++;
              
              // Calculate and report progress
              const progress = Math.min(90, (processedCount / Math.max(this.discoveredUrls.size, 1)) * 85 + 5);
              reportProgress({ progress, total: 100 });
              
              log.debug('URL processed successfully', { 
                url: item.url, 
                depth: item.depth,
                linksFound: discoveredLinks.length
              });
              
            } catch (error) {
              this.failedUrls.add(item.url);
              log.warn('URL processing failed', { 
                url: item.url, 
                depth: item.depth,
                error: getErrorMessage(error) 
              });
            }
          })
        );

        // Wait for current batch to complete
        await Promise.allSettled(batchPromises);
      }

      // Save discovered URLs to file
      const urlListPath = path.join(outputDir, 'discovered_urls.txt');
      const urlList = Array.from(this.discoveredUrls).join('\n');
      await fs.writeFile(urlListPath, urlList, 'utf-8');

      // Calculate final statistics
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      
      reportProgress({ progress: 100, total: 100 });

      const results: DiscoveryResults = {
        startUrl: normalizedStartUrl,
        totalUrlsDiscovered: this.discoveredUrls.size,
        urlsSuccessfullyVisited: this.visitedUrls.size,
        failedUrls: this.failedUrls.size,
        maxDepthReached: args.maxDepth,
        processingTime: duration,
        outputDirectory: outputDir,
        urlListFile: urlListPath,
        discoveredUrlsList: Array.from(this.discoveredUrls)
      };

      log.info('URL discovery completed successfully', {
        totalDiscovered: results.totalUrlsDiscovered,
        visited: results.urlsSuccessfullyVisited,
        failed: results.failedUrls,
        duration: results.processingTime
      });

      return results;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      log.error('URL discovery operation failed', { error: errorMessage });
      throw new Error(`URL discovery failed: ${errorMessage}`);
    }
  }  /**
   * Process individual URL with comprehensive content extraction and link discovery
   * Handles page loading, content extraction, and link extraction with stealth features
   * 
   * @param item - Crawl item containing URL and depth information
   * @param args - Discovery arguments and options
   * @param outputDir - Output directory for extracted content
   * @returns Promise<string[]> - Array of discovered links from the page
   * @throws Error if URL processing fails
   */
  private async processUrl(item: CrawlItem, args: any, outputDir: string): Promise<string[]> {
    let browser = null;
    let page = null;
    const discoveredLinks: string[] = [];

    try {
      // Launch browser and create page
      browser = await this.browserManager.launchBrowser();
      page = await this.browserManager.createPage(browser);

      // Apply user agent rotation if enabled
      if (args.userAgentRotation) {
        const userAgent = this.generateUserAgent();
        await page.setUserAgent(userAgent);
      }

      // Navigate to URL with comprehensive timeout handling
      await page.goto(item.url, { 
        waitUntil: 'networkidle0',
        timeout: this.config.navigationTimeout
      });

      // Wait for initial page load
      await page.waitForTimeout(1000);

      // Perform auto-scrolling if enabled to load dynamic content
      if (args.enableAutoScroll) {
        await this.autoScrollPage(page);
      }

      // Click toggle buttons if enabled to expand collapsed content
      if (args.enableToggleClicking) {
        await this.clickToggleButtons(page);
      }

      // Extract content if text output is requested
      if (args.outputFormat === 'text' || args.outputFormat === 'both') {
        try {
          await this.contentExtractor.extractAndSaveText(page, item.url);
        } catch (contentError) {
          this.logger.warn('Content extraction failed but continuing with link discovery', {
            url: item.url,
            error: getErrorMessage(contentError)
          });
        }
      }

      // Extract all links from the page
      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors
          .map(a => (a as HTMLAnchorElement).href)
          .filter(href => href && !href.startsWith('#') && !href.startsWith('javascript:'));
      });

      // Filter and normalize discovered links
      for (const link of links) {
        const normalizedLink = UrlUtils.normalizeUrl(link);
        if (normalizedLink && this.shouldIncludeUrl(normalizedLink, args.excludePatterns)) {
          discoveredLinks.push(normalizedLink);
        }
      }

      return discoveredLinks;
    } catch (error) {
      throw new Error(`Failed to process URL ${item.url}: ${getErrorMessage(error)}`);
    } finally {
      // Clean up resources
      if (page) {
        await this.browserManager.closePage(page);
      }
      if (browser) {
        await this.browserManager.closeBrowser(browser);
      }
    }
  }

  /**
   * Generate randomized user agent for stealth browsing
   * Rotates between different browsers and platforms from configuration
   * 
   * @returns string - Random user agent string
   */
  private generateUserAgent(): string {
    const browsers = this.config.userAgent.browsers;
    const platforms = this.config.userAgent.platforms;

    // Assert user agent configuration validity
    if (!browsers || browsers.length === 0 || !platforms || platforms.length === 0) {
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    }

    const randomBrowser = browsers[Math.floor(Math.random() * browsers.length)];
    const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)];

    return `Mozilla/5.0 (${randomPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) ${randomBrowser}/91.0.4472.124 Safari/537.36`;
  }

  /**
   * Perform comprehensive auto-scrolling to load dynamic content
   * Preserves original module auto-scrolling functionality with enhanced detection
   * 
   * @param page - Puppeteer page instance to scroll
   */
  private async autoScrollPage(page: any): Promise<void> {
    try {
      let previousHeight = 0;
      let currentHeight = await page.evaluate(() => document.body.scrollHeight);
      let unchangedCount = 0;
      const maxUnchangedIterations = 3;

      while (unchangedCount < maxUnchangedIterations) {
        // Scroll to bottom of page
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        
        // Wait for potential content loading
        await page.waitForTimeout(this.config.minPageProcessingWaitTime);
        
        // Check for height changes
        previousHeight = currentHeight;
        currentHeight = await page.evaluate(() => document.body.scrollHeight);
        
        if (currentHeight === previousHeight) {
          unchangedCount++;
        } else {
          unchangedCount = 0; // Reset counter when content loads
        }
      }

      // Scroll back to top for consistent state
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
    } catch (error) {
      this.logger.debug('Auto-scroll completed with minor issues', { error: getErrorMessage(error) });
    }
  }

  /**
   * Click toggle buttons to expand collapsed content sections
   * Preserves original module toggle clicking functionality with comprehensive selectors
   * 
   * @param page - Puppeteer page instance to process
   */
  private async clickToggleButtons(page: any): Promise<void> {
    try {
      const toggleSelectors = [
        'button[aria-expanded="false"]',
        '.toggle:not(.active)', 
        '.expand:not(.expanded)', 
        '.show-more:not(.shown)',
        '[data-toggle]:not(.toggled)',
        '.accordion-toggle:not(.active)',
        '.collapsible:not(.active)',
        '.dropdown-toggle:not(.open)',
        'summary', // HTML5 details/summary elements
        '[role="button"][aria-expanded="false"]'
      ];

      for (const selector of toggleSelectors) {
        try {
          const elements = await page.$$(selector);
          
          for (const element of elements) {
            try {
              // Check if element is visible and clickable
              const isVisible = await element.isIntersectingViewport();
              if (isVisible) {
                await element.click();
                await page.waitForTimeout(300); // Wait for expansion animation
              }
            } catch (clickError) {
              // Continue with next element if click fails
              this.logger.debug('Toggle click failed for element', { 
                selector, 
                error: getErrorMessage(clickError) 
              });
            }
          }
        } catch (selectorError) {
          // Continue with next selector if current fails
          this.logger.debug('Toggle selector failed', { 
            selector, 
            error: getErrorMessage(selectorError) 
          });
        }
      }
    } catch (error) {
      this.logger.debug('Toggle clicking completed with minor issues', { error: getErrorMessage(error) });
    }
  }

  /**
   * Determine if URL should be included in crawling based on filtering rules
   * Implements comprehensive URL filtering logic from original module
   * 
   * @param url - URL to evaluate for inclusion
   * @param excludePatterns - Optional custom exclude patterns
   * @returns boolean - True if URL should be included, false otherwise
   */
  private shouldIncludeUrl(url: string, excludePatterns?: string[]): boolean {
    try {
      // Check against configured exclude patterns
      const configPatterns = this.config.urlFiltering.excludePatterns;
      for (const pattern of configPatterns) {
        if (pattern.test(url)) {
          return false;
        }
      }

      // Check against custom exclude patterns if provided
      if (excludePatterns && excludePatterns.length > 0) {
        for (const patternStr of excludePatterns) {
          try {
            const pattern = new RegExp(patternStr, 'i');
            if (pattern.test(url)) {
              return false;
            }
          } catch (regexError) {
            this.logger.debug('Invalid exclude pattern', { pattern: patternStr });
          }
        }
      }

      // Check against invalid URL prefixes
      const invalidPrefixes = this.config.urlFiltering.invalidUrlPrefixes;
      for (const prefix of invalidPrefixes) {
        if (url.toLowerCase().startsWith(prefix)) {
          return false;
        }
      }

      // Check against file extensions to avoid
      const extensionsToAvoid = this.config.urlFiltering.extensionsToAvoid;
      const urlLower = url.toLowerCase();
      for (const ext of extensionsToAvoid) {
        if (urlLower.includes(ext)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.debug('URL filtering error, excluding URL', { url, error: getErrorMessage(error) });
      return false;
    }
  }

  /**
   * Extract hostname from URL for directory naming
   * Handles URL parsing and sanitization for filesystem use
   * 
   * @param url - URL to extract hostname from
   * @returns string - Sanitized hostname for directory naming
   */
  private extractHostname(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    } catch {
      return 'unknown_host';
    }
  }

  /**
   * Get current discovery statistics for monitoring and reporting
   * Provides comprehensive discovery metrics and progress information
   * 
   * @returns Object with current discovery statistics
   */
  getDiscoveryStats(): object {
    return {
      discoveredUrls: this.discoveredUrls.size,
      visitedUrls: this.visitedUrls.size,
      failedUrls: this.failedUrls.size,
      configuration: {
        maxDepth: this.config.maxDepth,
        maxConcurrentPages: this.config.maxConcurrentPages,
        navigationTimeout: this.config.navigationTimeout,
        outputBasePath: this.config.outputBasePath
      }
    };
  }
}

/**
 * Interface for crawl queue items
 */
interface CrawlItem {
  url: string;
  depth: number;
}

/**
 * Interface for discovery operation results
 */
export interface DiscoveryResults {
  startUrl: string;
  totalUrlsDiscovered: number;
  urlsSuccessfullyVisited: number;
  failedUrls: number;
  maxDepthReached: number;
  processingTime: number;
  outputDirectory: string;
  urlListFile: string;
  discoveredUrlsList: string[];
}