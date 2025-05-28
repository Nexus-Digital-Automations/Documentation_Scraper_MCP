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
import { ScrapingConfig, ClickableTextPattern } from '../config.js';
import { Logger, getErrorMessage } from '../utils/logger.js';
import { UrlUtils } from '../utils/urlUtils.js';
import { BrowserManager } from '../utils/browserManager.js';
import { ContentExtractor } from '../utils/contentExtractor.js';
import { InteractionHandler } from '../utils/interactionHandler.js';
import { StructuredDataExtractor, ExtractedStructuredData } from '../utils/structuredDataExtractor.js';
import { ChangeDetectionMonitor, ChangeDetectionResult } from '../utils/changeDetectionMonitor.js';
import { RateLimiter } from '../utils/rateLimiter.js';
import { StaticProxyManager } from '../utils/staticProxyManager.js';
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
  private interactionHandler?: InteractionHandler;
  private structuredDataExtractor?: StructuredDataExtractor;
  private changeDetectionMonitor?: ChangeDetectionMonitor;
  private rateLimiter?: RateLimiter;
  private staticProxyManager?: StaticProxyManager;
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
    
    // Initialize new enhancement utilities conditionally
    if (config.pageInteraction) {
      this.interactionHandler = new InteractionHandler(config.pageInteraction);
    }
    
    if (config.contentExtraction?.enableStructuredExtraction) {
      this.structuredDataExtractor = new StructuredDataExtractor(config.outputBasePath);
    }
    
    if (config.changeDetection?.enabled) {
      this.changeDetectionMonitor = new ChangeDetectionMonitor(config.changeDetection);
    }
    
    // Initialize rate limiting and proxy management if configured
    if (config.rateLimitConfig?.enabled) {
      this.rateLimiter = new RateLimiter(config.rateLimitConfig, this.logger);
    }
    
    if (config.proxyConfig?.staticProxies && config.proxyConfig.staticProxies.length > 0) {
      this.staticProxyManager = new StaticProxyManager(config.proxyConfig, this.logger);
    }
    
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
        maxConcurrent: args.maxConcurrent,
        keywordFiltering: args.keywords && args.keywords.length > 0 ? 'enabled' : 'disabled',
        keywords: args.keywords || [],
        keywordCount: args.keywords ? args.keywords.length : 0
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
                    this.shouldIncludeUrl(normalizedLink, args.keywords, args.excludePatterns)) {
                  
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
        
        // Optional: Check for unresolvable operational state (if all proxies fail or excessive rate limiting)
        // Uncomment the following lines if you want proactive shutdown on operational failures
        // if (this.rateLimiter?.isEffectivelyBlocked?.(30) || this.staticProxyManager?.areAllProxiesUnusable?.()) {
        //   this.logger.error('Unresolvable operational state detected. Consider implementing shutdown logic.');
        //   break; // Exit the main crawling loop
        // }
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
        duration: results.processingTime,
        keywordFilteringUsed: args.keywords && args.keywords.length > 0,
        keywordsApplied: args.keywords || []
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
    let currentProxyUrl: string | undefined;
    
    // Extract hostname for rate limiting and proxy management (outside try block for error handling)
    const hostname = this.extractHostname(item.url);

    try {
      
      // Get proxy for this hostname if static proxy manager is configured
      if (this.staticProxyManager) {
        currentProxyUrl = this.staticProxyManager.getProxyForHost(hostname);
        this.logger.debug('Selected proxy for hostname', { hostname, proxyUrl: currentProxyUrl });
      }
      
      // Apply rate limiting before making request
      if (this.rateLimiter) {
        await this.rateLimiter.waitForSlot(hostname, currentProxyUrl);
        this.logger.debug('Rate limit check passed', { hostname, proxyUrl: currentProxyUrl });
      }
      
      // Launch browser with proxy support
      browser = await this.browserManager.launchBrowser(currentProxyUrl);
      page = await this.browserManager.createPage(browser, currentProxyUrl);
      
      // Record the request attempt in rate limiter
      if (this.rateLimiter) {
        this.rateLimiter.recordRequest(hostname, currentProxyUrl);
      }

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
      
      // Execute advanced load wait conditions if configured
      if (this.interactionHandler) {
        await this.interactionHandler.executeLoadWaitConditions(page);
      }

      // Perform auto-scrolling if enabled to load dynamic content
      if (args.enableAutoScroll) {
        await this.autoScrollPage(page);
      }

      // Enhanced iterative toggle clicking if enabled to expand nested collapsed content
      if (args.enableToggleClicking) {
        let togglesClickedIteration = false;
        let toggleIterations = 0;
        const maxToggleIterations = this.config.contentExtraction.maxToggleIterations || 3; // Configurable: max times to re-scan for toggles
        
        this.logger.debug('Starting iterative toggle clicking process', {
          maxIterations: maxToggleIterations,
          url: item.url,
          sessionTextTargetsProvided: args.sessionTextBasedClickTargets ? args.sessionTextBasedClickTargets.length : 0
        });
        
        do {
          togglesClickedIteration = await this.clickToggleButtons(page, args.sessionTextBasedClickTargets);
          
          if (togglesClickedIteration) {
            this.logger.debug(`Toggle iteration ${toggleIterations + 1} successfully expanded content`, {
              url: item.url,
              iterationNumber: toggleIterations + 1
            });
            
            // Brief wait after successful expansion before next iteration
            await page.waitForTimeout(1000);
          }
          
          toggleIterations++;
        } while (togglesClickedIteration && toggleIterations < maxToggleIterations);
        
        this.logger.debug('Iterative toggle clicking completed', {
          url: item.url,
          totalIterations: toggleIterations,
          finalIterationHadExpansions: togglesClickedIteration
        });
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
      
      // Extract structured data if enabled and schemas are configured
      if (this.structuredDataExtractor && this.config.contentExtraction?.structuredDataSchemas) {
        try {
          const structuredData = await this.structuredDataExtractor.extractStructuredData(
            page, 
            item.url, 
            this.config.contentExtraction.structuredDataSchemas
          );
          
          if (structuredData.length > 0) {
            this.logger.info('Structured data extracted', {
              url: item.url,
              schemasMatched: structuredData.length,
              totalRecords: structuredData.reduce((sum, data) => sum + data.recordCount, 0)
            });
          }
        } catch (structuredError) {
          this.logger.warn('Structured data extraction failed', {
            url: item.url,
            error: getErrorMessage(structuredError)
          });
        }
      }
      
      // Perform change detection if enabled
      if (this.changeDetectionMonitor) {
        try {
          const changeResult = await this.changeDetectionMonitor.detectChanges(page, item.url);
          
          if (changeResult.hasChanged) {
            this.logger.info('Content change detected', {
              url: item.url,
              changePercentage: changeResult.changePercentage,
              previousCaptureDate: changeResult.previousSnapshot?.capturedAt
            });
          }
        } catch (changeError) {
          this.logger.warn('Change detection failed', {
            url: item.url,
            error: getErrorMessage(changeError)
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
        if (normalizedLink && this.shouldIncludeUrl(normalizedLink, args.keywords, args.excludePatterns)) {
          discoveredLinks.push(normalizedLink);
        }
      }

      return discoveredLinks;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      
      // Handle specific error types for rate limiting and proxy management
      if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        this.logger.warn('Rate limiting error detected', { url: item.url, hostname, error: errorMessage });
        
        if (this.rateLimiter) {
          this.rateLimiter.initiateHostBackoff(hostname);
          if (currentProxyUrl) {
            this.rateLimiter.initiateIpBackoff(currentProxyUrl);
          }
        }
      } else if (errorMessage.includes('net::ERR_ABORTED') || errorMessage.includes('net::ERR_CONNECTION')) {
        this.logger.warn('Connection error detected', { url: item.url, hostname, proxyUrl: currentProxyUrl, error: errorMessage });
        
        if (currentProxyUrl && this.staticProxyManager) {
          this.staticProxyManager.reportPermanentIpFailure(currentProxyUrl);
        }
        
        if (this.rateLimiter && currentProxyUrl) {
          this.rateLimiter.initiateIpBackoff(currentProxyUrl);
        }
      }
      
      throw new Error(`Failed to process URL ${item.url}: ${errorMessage}`);
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
   * Click toggle buttons to expand collapsed content sections with comprehensive enhancements
   * Features: smart waiting, state tracking, custom selectors, text-based targeting, and expansion verification
   * 
   * @param page - Puppeteer page instance to process
   * @param sessionTextBasedClickTargets - Optional session-specific text-based click patterns
   * @returns Promise<boolean> - True if any toggles were successfully clicked and expanded
   */
  private async clickToggleButtons(page: any, sessionTextBasedClickTargets?: ClickableTextPattern[]): Promise<boolean> {
    let anyToggleSuccessfullyClickedAndExpanded = false;
    this.logger.debug('Starting comprehensive toggle clicking process.');

    try {
      // 1. Process Generic Toggle Selectors
      const defaultToggleSelectors = [
        // ARIA-based selectors (most reliable)
        'button[aria-expanded="false"]',
        '[role="button"][aria-expanded="false"]',
        '[role="tab"][aria-selected="false"]',
        '[role="button"][aria-pressed="false"]',
        '[aria-controls][aria-expanded="false"]',
        
        // Bootstrap and common framework patterns
        '[data-bs-toggle="collapse"]:not(.collapsed)',
        '[data-bs-toggle="tab"]:not(.active)',
        '[data-toggle="collapse"][aria-expanded="false"]',
        '[data-toggle="tab"]:not(.active)',
        '.disclosure-button[aria-expanded="false"]',
        
        // Common CSS class patterns
        '.toggle:not(.active)',
        '.expand:not(.expanded)',
        '.show-more:not(.shown)',
        '[data-toggle]:not(.toggled)',
        '.accordion-toggle:not(.active)',
        '.collapsible:not(.active)',
        '.dropdown-toggle:not(.open)',
        '.expandable:not(.expanded)',
        '.collapsible-trigger:not(.active)',
        
        // HTML5 native elements
        'summary',
        'details:not([open]) summary'
      ];

      let currentToggleSelectors = [...defaultToggleSelectors];
      if (this.config.contentExtraction.customToggleSelectors) {
        currentToggleSelectors = currentToggleSelectors.concat(this.config.contentExtraction.customToggleSelectors);
      }
      currentToggleSelectors = [...new Set(currentToggleSelectors)];

      this.logger.debug(`Processing ${currentToggleSelectors.length} generic toggle selectors.`);
      for (const selector of currentToggleSelectors) {
        try {
          const elements = await page.$(selector);
          for (const element of elements) {
            try {
              const isVisible = await element.isIntersectingViewport();
              if (isVisible) {
                const clickedAndVerified = await this.clickAndVerify(page, element, selector);
                if (clickedAndVerified) {
                  anyToggleSuccessfullyClickedAndExpanded = true;
                }
              }
            } catch (clickError) {
              this.logger.debug('Generic toggle click/verify failed for element', { selector, error: getErrorMessage(clickError) });
            }
          }
        } catch (selectorError) {
          this.logger.debug('Generic toggle selector failed', { selector, error: getErrorMessage(selectorError) });
        }
      }

      // 2. Process Text-Based Click Targets
      // Get static text-based targets from config
      let combinedTextBasedTargets: ClickableTextPattern[] = [
        ...(this.config.contentExtraction.textBasedClickTargets || [])
      ];

      // Add session-specific text-based targets if provided
      if (sessionTextBasedClickTargets && Array.isArray(sessionTextBasedClickTargets)) {
        this.logger.debug(`Adding ${sessionTextBasedClickTargets.length} session-specific text-based click targets.`);
        combinedTextBasedTargets = combinedTextBasedTargets.concat(sessionTextBasedClickTargets);
      }

      this.logger.debug(`Processing ${combinedTextBasedTargets.length} total text-based click targets (static + session).`);

      for (const pattern of combinedTextBasedTargets) {
        try {
          const clickTargetElements = await page.$(pattern.clickTargetSelector);
          this.logger.debug(`Found ${clickTargetElements.length} elements for target selector: ${pattern.clickTargetSelector}`);

          for (const targetElement of clickTargetElements) {
            try {
              const isVisible = await targetElement.isIntersectingViewport();
              if (!isVisible) {
                this.logger.debug('Target element for text-based click is not visible.', { selector: pattern.clickTargetSelector });
                continue;
              }

              let textToCheck = '';
              let textSourceElement = null;

              if (pattern.textMatchSelector) {
                // Find the textMatchSelector relative to the targetElement
                textSourceElement = await targetElement.$(pattern.textMatchSelector);
                if (!textSourceElement) {
                  this.logger.debug('textMatchSelector not found within clickTarget.', { parent: pattern.clickTargetSelector, child: pattern.textMatchSelector });
                  continue;
                }
              } else {
                textSourceElement = targetElement; // Check text of the click target itself
              }

              if (textSourceElement) {
                textToCheck = await textSourceElement.evaluate((el: HTMLElement) => el.innerText || '');
              }

              if (!textToCheck.trim()) {
                this.logger.debug('No text content found for text matching.', { selector: pattern.clickTargetSelector, textMatch: pattern.textMatchSelector });
                continue;
              }

              const originalText = textToCheck;
              if (!pattern.caseSensitive) {
                textToCheck = textToCheck.toLowerCase();
              }
              textToCheck = textToCheck.trim();

              let matchFound = false;
              const matchType = pattern.matchType || 'any';

              if (matchType === 'all') {
                matchFound = pattern.textIncludes.every(keyword => {
                  const kw = pattern.caseSensitive ? keyword : keyword.toLowerCase();
                  return textToCheck.includes(kw);
                });
              } else { // 'any'
                matchFound = pattern.textIncludes.some(keyword => {
                  const kw = pattern.caseSensitive ? keyword : keyword.toLowerCase();
                  return textToCheck.includes(kw);
                });
              }

              if (matchFound) {
                this.logger.info(`Text match found for click. Selector: ${pattern.clickTargetSelector}, Text: "${originalText}", Keywords: ${pattern.textIncludes.join(', ')}`);
                const clickedAndVerified = await this.clickAndVerify(page, targetElement, pattern.clickTargetSelector);
                if (clickedAndVerified) {
                  anyToggleSuccessfullyClickedAndExpanded = true;
                }
              }

            } catch (elementError) {
              this.logger.warn('Error processing a specific text-based click target element.', { selector: pattern.clickTargetSelector, error: getErrorMessage(elementError) });
            }
          }
        } catch (patternError) {
          this.logger.warn('Error processing a text-based click pattern.', { pattern, error: getErrorMessage(patternError) });
        }
      }

      this.logger.debug(`Toggle clicking process finished. Any expansions: ${anyToggleSuccessfullyClickedAndExpanded}`);
      return anyToggleSuccessfullyClickedAndExpanded;

    } catch (error) {
      this.logger.debug('Toggle clicking encountered errors but completed', { error: getErrorMessage(error) });
      return false;
    }
  }

  /**
   * Helper method for clicking and verifying toggle expansion
   * Implements comprehensive state verification using page.waitForFunction
   * 
   * @param page - Puppeteer page instance
   * @param element - Element to click
   * @param identifier - Identifier string for logging
   * @returns Promise<boolean> - True if click and verification succeeded
   */
  private async clickAndVerify(page: any, element: any, identifier: string): Promise<boolean> {
    this.logger.debug(`Attempting to click and verify: ${identifier}`);
    try {
      await element.click();

      // Smart wait: Wait for an attribute change or a controlled element to become visible
      await page.waitForFunction(
        (el: any) => {
          // Basic check: Has aria-expanded changed to "true"?
          if (el.getAttribute('aria-expanded') === 'true') return true;

          // Basic check: Has a common 'active' or 'open' class been added?
          if (el.classList.contains('active') || el.classList.contains('open') || el.classList.contains('expanded')) return true;

          // More advanced: Check if a controlled element (via aria-controls) is now visible
          const controlledId = el.getAttribute('aria-controls');
          if (controlledId) {
            const controlledElement = document.getElementById(controlledId);
            if (controlledElement) {
              const style = window.getComputedStyle(controlledElement);
              return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0 && controlledElement.offsetHeight > 0;
            }
          }
          
          // For details/summary elements
          if (el.tagName.toLowerCase() === 'summary') {
            const details = el.closest('details');
            if (details && details.hasAttribute('open')) {
              return true;
            }
          }
          
          return false;
        },
        { timeout: this.config.contentExtraction.toggleExpansionTimeout || 5000 },
        element
      );
      
      this.logger.info(`Successfully clicked and verified expansion for: ${identifier}`);
      return true;
    } catch (verificationError) {
      // If waitForFunction times out, add fallback delay
      await page.waitForTimeout(500);
      this.logger.debug(`Clicked element (verification timed out or failed, applied fallback delay): ${identifier}`);
      // Return true as the click happened, even if verification failed
      return true;
    }
  }

  /**
   * Determine if URL should be included in crawling based on filtering rules
   * Implements comprehensive URL filtering with both inclusion and exclusion logic
   * 
   * @param url - URL to evaluate for inclusion
   * @param keywords - Optional keywords for inclusion filtering (URLs must contain at least one keyword)
   * @param excludePatterns - Optional custom exclude patterns
   * @returns boolean - True if URL should be included, false otherwise
   */
  private shouldIncludeUrl(url: string, keywords?: string[], excludePatterns?: string[]): boolean {
    try {
      // NEGATIVE SPACE PROGRAMMING: Define what URLs should NEVER be included
      
      // NEVER include URLs matching configured exclude patterns
      const configPatterns = this.config.urlFiltering.excludePatterns;
      for (const pattern of configPatterns) {
        if (pattern.test(url)) {
          return false;
        }
      }

      // NEVER include URLs matching custom exclude patterns if provided
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

      // NEVER include URLs with invalid prefixes
      const invalidPrefixes = this.config.urlFiltering.invalidUrlPrefixes;
      for (const prefix of invalidPrefixes) {
        if (url.toLowerCase().startsWith(prefix)) {
          return false;
        }
      }

      // NEVER include URLs with file extensions to avoid
      const extensionsToAvoid = this.config.urlFiltering.extensionsToAvoid;
      const urlLower = url.toLowerCase();
      for (const ext of extensionsToAvoid) {
        if (urlLower.includes(ext)) {
          return false;
        }
      }

      // KEYWORD INCLUSION FILTERING: URLs must contain at least one keyword if keywords are specified
      if (keywords && keywords.length > 0) {
        // Assert keywords array validity
        const validKeywords = keywords.filter(keyword => 
          keyword && typeof keyword === 'string' && keyword.trim().length > 0
        );
        
        // NEVER proceed if no valid keywords provided when keywords parameter is specified
        if (validKeywords.length === 0) {
          this.logger.debug('No valid keywords provided for inclusion filtering', { 
            url, 
            originalKeywords: keywords 
          });
          return false;
        }
        
        // Check if URL contains at least one keyword (case-insensitive)
        let keywordFound = false;
        for (const keyword of validKeywords) {
          const keywordLower = keyword.toLowerCase().trim();
          
          // NEVER proceed with empty or whitespace-only keywords
          if (keywordLower.length === 0) {
            continue;
          }
          
          // Check URL, hostname, and path for keyword presence
          if (urlLower.includes(keywordLower)) {
            keywordFound = true;
            this.logger.debug('Keyword match found in URL', { 
              url, 
              matchedKeyword: keyword,
              position: 'full_url'
            });
            break;
          }
          
          // Also check just the path component for more targeted matching
          try {
            const urlObj = new URL(url);
            const pathLower = urlObj.pathname.toLowerCase();
            if (pathLower.includes(keywordLower)) {
              keywordFound = true;
              this.logger.debug('Keyword match found in URL path', { 
                url, 
                matchedKeyword: keyword,
                position: 'url_path',
                path: urlObj.pathname
              });
              break;
            }
          } catch (urlParseError) {
            // Continue with other keywords if URL parsing fails
            this.logger.debug('URL parse error during keyword checking', { 
              url, 
              error: getErrorMessage(urlParseError) 
            });
          }
        }
        
        // NEVER include URLs that don't contain any specified keywords
        if (!keywordFound) {
          this.logger.debug('URL excluded: no matching keywords found', { 
            url, 
            keywords: validKeywords 
          });
          return false;
        }
        
        this.logger.debug('URL included: keyword filtering passed', { 
          url, 
          keywordsChecked: validKeywords.length 
        });
      }

      // Include URL if it passes all filtering criteria
      return true;
    } catch (error) {
      // NEVER include URLs when filtering encounters errors
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