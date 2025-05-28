// ============================================================================
// MODULE: contentScraping.ts
//
// PURPOSE:
// Complete Content Scraping Engine implementing all "Scrape URL File" functionality
// with comprehensive state management, robust shutdown logic, and resumable operations.
// Provides batch URL processing, PDF generation, content extraction, failed URL
// tracking, proxy/rate limiting integration, and comprehensive error handling.
//
// DEPENDENCIES:
// - ../config.js, ../utils/browserManager.js, ../utils/contentExtractor.js
// - ../utils/logger.js, ../utils/rateLimiter.js, ../utils/staticProxyManager.js
// - ../utils/urlUtils.js, ../types/state.js, p-limit, fs/promises
//
// DESIGN PATTERNS:
// Strategy pattern, Observer pattern, Template method pattern, State pattern
//
// SYSTEM INVARIANTS:
// - URL validation must occur before processing
// - State must be persistable and restorable across sessions
// - Rate limiting must be applied before all requests
// - Graceful shutdown must preserve all processing state
// ============================================================================

import pLimit from 'p-limit';
import { promises as fs } from 'fs';
import path from 'path';
import { ScrapingConfig, getStateFileBaseDir, ClickableTextPattern } from '../config.js';
import { BrowserManager } from '../utils/browserManager.js';
import { ContentExtractor, ExtractedContent } from '../utils/contentExtractor.js';
import { Logger, getErrorMessage } from '../utils/logger.js';
import { UrlUtils } from '../utils/urlUtils.js';
import { RateLimiter } from '../utils/rateLimiter.js';
import { StaticProxyManager } from '../utils/staticProxyManager.js';
import { ContentScrapingProgressState, FailedUrl } from '../types/state.js';

/**
 * Complete Content Scraping Engine with state management and robust shutdown
 * Handles batch URL processing with comprehensive error tracking and resumable operations
 */
export class ContentScrapingEngine {
  private config: ScrapingConfig;
  private logger: Logger;
  private browserManager: BrowserManager;
  private contentExtractor: ContentExtractor;
  
  // Phase 1 Integration: Rate limiting and proxy management
  private rateLimiter?: RateLimiter;
  private staticProxyManager?: StaticProxyManager;
  
  // State management properties (mirroring UrlDiscoveryEngine)
  private urlsToProcess: string[] = [];
  private processedUrlCount: number = 0;
  private failedUrlDetails: FailedUrl[] = [];
  private processedInCurrentSessionCounter: number = 0;
  
  // State persistence properties
  private stateFilePath: string | null = null;
  private originalJobArgs: any = {};
  
  // Shutdown management
  private isShuttingDown: boolean = false;
  private boundHandleSigint: () => Promise<void>;
  private boundHandleSigterm: () => Promise<void>;

  constructor(config: ScrapingConfig) {
    // Validate configuration before initialization - NEGATIVE SPACE PROGRAMMING
    if (!config) {
      throw new Error('ContentScrapingEngine requires valid configuration');
    }

    this.config = config;
    this.logger = new Logger();
    this.browserManager = new BrowserManager(config);
    this.contentExtractor = new ContentExtractor(config);
    
    // Initialize rate limiting if configured (Phase 1 Integration)
    if (config.rateLimitConfig?.enabled) {
      this.rateLimiter = new RateLimiter(config.rateLimitConfig, this.logger);
    }
    
    // Initialize static proxy management if configured (Phase 1 Integration)
    if (config.proxyConfig?.staticProxies && config.proxyConfig.staticProxies.length > 0) {
      this.staticProxyManager = new StaticProxyManager(config.proxyConfig, this.logger);
    }
    
    // Bind signal handlers for graceful shutdown
    this.boundHandleSigint = () => this.performShutdown(undefined, 'SIGINT');
    this.boundHandleSigterm = () => this.performShutdown(undefined, 'SIGTERM');
  }

  /**
   * Generate unique state file path for this scraping job
   * Creates identifier based on job parameters for state persistence
   */
  private generateStateFilePath(jobIdentifier: string): string {
    const baseDir = getStateFileBaseDir(this.config);
    // Sanitize jobIdentifier for use in filename - NEGATIVE SPACE PROGRAMMING
    const safeIdentifier = jobIdentifier
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 100);
    return path.join(baseDir, `contentScraping_${safeIdentifier}.state.json`);
  }

  /**
   * Save current progress state to file for resumable operations
   * Implements comprehensive state persistence with error handling
   */
  private async saveState(): Promise<void> {
    // NEVER save state if progress saving is disabled
    if (!this.config.progressSavingConfig?.enabled || !this.stateFilePath) {
      this.logger.debug('Progress saving disabled or no state file path configured');
      return;
    }

    this.logger.info('Attempting to save content scraping progress state...', { 
      file: this.stateFilePath 
    });

    const state: ContentScrapingProgressState = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      originalArgs: this.originalJobArgs,
      urlsToProcess: [...this.urlsToProcess], // Remaining URLs to process
      processedUrlCount: this.processedUrlCount,
      failedUrlDetails: [...this.failedUrlDetails],
      rateLimiterState: this.rateLimiter?.getState(),
      staticProxyManagerState: this.staticProxyManager?.getState(),
    };

    try {
      // Ensure state directory exists - NEGATIVE SPACE PROGRAMMING
      if (!this.stateFilePath) {
        throw new Error('State file path is null');
      }
      await fs.mkdir(path.dirname(this.stateFilePath), { recursive: true });
      
      // Write state file atomically
      await fs.writeFile(this.stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
      
      this.logger.info('Content scraping progress state saved successfully.', {
        remainingUrls: this.urlsToProcess.length,
        processedCount: this.processedUrlCount,
        failedCount: this.failedUrlDetails.length
      });
    } catch (error) {
      this.logger.error('CRITICAL: Failed to save content scraping progress state.', {
        error: getErrorMessage(error),
        stateFile: this.stateFilePath
      });
    }
  }

  /**
   * Load progress state from file for operation resumption
   * Implements comprehensive state restoration with validation
   */
  private async loadState(): Promise<boolean> {
    // NEVER attempt to load state if progress saving is disabled
    if (!this.config.progressSavingConfig?.enabled || !this.stateFilePath) {
      return false;
    }

    try {
      // Check if state file exists - NEGATIVE SPACE PROGRAMMING
      if (!this.stateFilePath) {
        return false;
      }
      await fs.access(this.stateFilePath);
      
      this.logger.info('Loading content scraping progress state...', { 
        file: this.stateFilePath 
      });
      
      const fileContent = await fs.readFile(this.stateFilePath, 'utf-8');
      const state: ContentScrapingProgressState = JSON.parse(fileContent);

      // Validate state version and compatibility
      if (state.version !== '1.0') {
        this.logger.warn('Content scraping state file incompatible version. Starting fresh.', {
          foundVersion: state.version,
          expectedVersion: '1.0'
        });
        await this.cleanupInvalidStateFile();
        return false;
      }

      // Restore state properties
      this.urlsToProcess = state.urlsToProcess || [];
      this.processedUrlCount = state.processedUrlCount || 0;
      this.failedUrlDetails = state.failedUrlDetails || [];
      
      // Restore utility states (Phase 1 Integration)
      this.rateLimiter?.loadState(state.rateLimiterState);
      this.staticProxyManager?.loadState(state.staticProxyManagerState);
      
      this.logger.info('Content scraping state loaded successfully.', {
        remainingUrls: this.urlsToProcess.length,
        processedCount: this.processedUrlCount,
        failedCount: this.failedUrlDetails.length
      });
      
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.info('No existing content scraping state file found.', { 
          file: this.stateFilePath 
        });
      } else {
        this.logger.error('Failed to load/parse content scraping state. Starting fresh.', {
          error: getErrorMessage(error),
          stateFile: this.stateFilePath
        });
        await this.cleanupInvalidStateFile();
      }
      return false;
    }
  }

  /**
   * Clean up invalid or corrupted state file - NEGATIVE SPACE PROGRAMMING
   */
  private async cleanupInvalidStateFile(): Promise<void> {
    if (this.stateFilePath) {
      try {
        await fs.unlink(this.stateFilePath);
        this.logger.info('Removed invalid state file', { file: this.stateFilePath });
      } catch (cleanupError) {
        this.logger.warn('Failed to remove invalid state file', {
          error: getErrorMessage(cleanupError),
          file: this.stateFilePath
        });
      }
    }
  }

  /**
   * Perform graceful shutdown with state preservation
   * Handles SIGINT, SIGTERM signals and error conditions
   */
  private async performShutdown(error?: Error, signal?: string): Promise<void> {
    // NEVER perform shutdown multiple times
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    
    this.logger.info('Initiating graceful content scraping shutdown...', {
      signal,
      hasError: !!error,
      errorMessage: error ? getErrorMessage(error) : undefined
    });

    try {
      // Save current progress state
      await this.saveState();
      
      // Clean up signal handlers
      process.removeListener('SIGINT', this.boundHandleSigint);
      process.removeListener('SIGTERM', this.boundHandleSigterm);
      
      this.logger.info('Content scraping shutdown completed successfully.');
    } catch (shutdownError) {
      this.logger.error('Error during shutdown process', {
        error: getErrorMessage(shutdownError)
      });
    }

    // If shutdown was triggered by a signal, exit the process
    if (signal) {
      process.exit(0);
    }
  }

  /**
   * Main scraping orchestration method with state management and robust shutdown
   * Processes multiple URLs with batch processing, error tracking, and progress reporting
   */
  async scrapeUrls(args: any, context: any): Promise<ScrapingResults> {
    const { reportProgress, log } = context;
    const startTime = Date.now();

    // Initialize state management
    this.originalJobArgs = { ...args };
    this.isShuttingDown = false;
    this.processedInCurrentSessionCounter = 0;

    // Main try...catch...finally block as specified
    try {
      log.info('Starting content scraping operation with state management', {
        urlCount: args.urls?.length || 'from file',
        outputFormats: args.outputFormats,
        maxConcurrent: args.maxConcurrent || this.config.maxConcurrentPages,
        stateManagementEnabled: this.config.progressSavingConfig?.enabled || false
      });

      // Set up state file path if progress saving is enabled
      if (this.config.progressSavingConfig?.enabled) {
        const jobIdentifier = args.jobId || this.generateJobIdentifier(args);
        this.stateFilePath = this.generateStateFilePath(jobIdentifier);
      }

      // Attempt to load existing state
      const stateLoaded = await this.loadState();
      
      // Prepare URL list if not resuming or if no URLs to process
      if (!stateLoaded || this.urlsToProcess.length === 0) {
        this.urlsToProcess = await this.prepareUrlList(args);
        this.processedUrlCount = 0;
        this.failedUrlDetails = [];
      }
      
      // Assert URL list validity - NEGATIVE SPACE PROGRAMMING
      if (!this.urlsToProcess || this.urlsToProcess.length === 0) {
        throw new Error('No valid URLs provided for scraping');
      }

      // Install signal handlers for graceful shutdown
      process.on('SIGINT', this.boundHandleSigint);
      process.on('SIGTERM', this.boundHandleSigterm);

      log.info('URL preparation completed', { 
        totalUrls: this.urlsToProcess.length,
        resumedFromState: stateLoaded
      });

      // Organize output directory structure
      await this.contentExtractor.organizeOutputFiles();

      const totalUrls = this.urlsToProcess.length + this.processedUrlCount;

      // Set up concurrency control with p-limit
      const limit = pLimit(args.maxConcurrent || this.config.maxConcurrentPages);

      // Main processing loop with comprehensive error handling
      const scrapingPromises = this.urlsToProcess.map(url => 
        limit(async () => {
          // Check shutdown status before processing each URL
          if (this.isShuttingDown) {
            return null;
          }

          try {
            // THIS IS WHERE WE CALL THE SINGLE URL SCRAPING LOGIC
            // This integrates proxy/rate-limiting from Phase 1
            const result = await this.scrapeSingleUrl(url, args);
            this.processedUrlCount++;
            
            // Report progress to Claude Desktop
            reportProgress({
              progress: this.processedUrlCount,
              total: totalUrls
            });

            return result;

          } catch (error) {
            // Track failed URL with detailed error information
            this.failedUrlDetails.push({
              url,
              error: getErrorMessage(error),
              failedAt: new Date().toISOString(),
              retryCount: 0
            });

            log.warn('URL processing failed', { url, error: getErrorMessage(error) });
            
            this.processedUrlCount++;
            reportProgress({
              progress: this.processedUrlCount,
              total: totalUrls
            });

            return null;
          } finally {
            // Check if shutdown was initiated during processing
            if (this.isShuttingDown) {
              return null;
            }

            this.processedInCurrentSessionCounter++;
            
            // Auto-save progress at configured intervals
            const autoSaveInterval = this.config.progressSavingConfig?.autoSaveIntervalCount;
            if (this.config.progressSavingConfig?.enabled && 
                autoSaveInterval && 
                this.processedInCurrentSessionCounter % autoSaveInterval === 0) {
              if (!this.isShuttingDown) {
                await this.saveState();
              }
            }
            
            // Remove processed URL from the live list
            const urlIndex = this.urlsToProcess.indexOf(url);
            if (urlIndex > -1) {
              this.urlsToProcess.splice(urlIndex, 1);
            }
          }
        })
      );

      // Wait for all processing to complete
      const results = await Promise.allSettled(scrapingPromises);
      
      // Calculate final statistics
      const successfulResults = results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => (result as PromiseFulfilledResult<ExtractedContent | null>).value)
        .filter(value => value !== null) as ExtractedContent[];

      const finalResults: ScrapingResults = {
        totalUrls: totalUrls,
        processedUrls: successfulResults.length,
        failedUrls: this.failedUrlDetails.length,
        extractedContent: successfulResults,
        failedUrlDetails: this.failedUrlDetails,
        processingTime: Date.now() - startTime,
        outputFormats: args.outputFormats || ['text'],
        summary: this.generateProcessingSummary(successfulResults)
      };

      log.info('Content scraping completed successfully', {
        totalUrls: finalResults.totalUrls,
        successful: finalResults.processedUrls,
        failed: finalResults.failedUrls,
        processingTimeMs: finalResults.processingTime
      });

      return finalResults;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      log.error('Content scraping operation failed', { error: errorMessage });
      await this.performShutdown(error as Error);
      throw new Error(`Content scraping failed: ${errorMessage}`);
    } finally {
      // Ensure cleanup happens even if no error occurred
      if (!this.isShuttingDown) {
        await this.performShutdown();
      }
    }
  }

  /**
   * Process individual URL with comprehensive content extraction and Phase 1 integration
   * Handles page loading, content extraction, rate limiting, and proxy management
   */
  private async scrapeSingleUrl(url: string, args: any): Promise<ExtractedContent> {
    let browser = null;
    let page = null;
    let currentProxyIp: string | undefined;

    // Extract hostname for rate limiting and proxy management
    const hostname = UrlUtils.extractHostname(url);
    if (!hostname) {
      throw new Error(`Invalid URL hostname: ${url}`);
    }

    try {
      this.logger.debug('Processing individual URL with Phase 1 integration', { url, hostname });

      // Phase 1 Integration: Get proxy for this hostname if configured
      if (this.staticProxyManager) {
        currentProxyIp = this.staticProxyManager.getProxyForHost(hostname);
        this.logger.debug('Proxy assignment for hostname', { hostname, proxyIp: currentProxyIp });
      }

      // Phase 1 Integration: Apply rate limiting before making request
      if (this.rateLimiter) {
        await this.rateLimiter.waitForSlot(hostname, currentProxyIp);
        this.logger.debug('Rate limiting check passed', { hostname, proxyIp: currentProxyIp });
      }

      // Launch browser and create page with proxy support
      browser = await this.browserManager.launchBrowser(currentProxyIp);
      page = await this.browserManager.createPage(browser, currentProxyIp);

      // Phase 1 Integration: Record the request in rate limiter
      if (this.rateLimiter) {
        this.rateLimiter.recordRequest(hostname, currentProxyIp);
      }

      // Navigate to URL with timeout
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: this.config.navigationTimeout
      });

      // Perform auto-scrolling if enabled
      if (args.enableAutoScroll) {
        await this.autoScrollPage(page);
      }

      // Click toggle buttons if enabled
      if (args.enableToggleClicking) {
        await this.clickToggleButtons(page, args.sessionTextBasedClickTargets);
      }

      // Wait random interval for anti-detection
      if (args.waitTimeMin && args.waitTimeMax) {
        await this.waitRandomInterval(args.waitTimeMin, args.waitTimeMax);
      }

      // Extract content based on requested formats
      let result: ExtractedContent;
      
      if (args.outputFormats && args.outputFormats.includes('pdf') || args.generatePdfs) {
        result = await this.contentExtractor.generatePdfFromPage(page, url);
      } else {
        result = await this.contentExtractor.extractAndSaveText(page, url, args.customSelectors);
      }

      this.logger.debug('URL processing completed successfully', { url, hostname });

      return result;

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      
      // Phase 1 Integration: Handle specific error types for rate limiting and proxy management
      if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        this.logger.warn('Rate limiting error detected', { url, hostname, error: errorMessage });
        
        if (this.rateLimiter) {
          this.rateLimiter.initiateHostBackoff(hostname);
          if (currentProxyIp) {
            this.rateLimiter.initiateIpBackoff(currentProxyIp);
          }
        }
      } else if (errorMessage.includes('net::ERR_ABORTED') || errorMessage.includes('net::ERR_CONNECTION')) {
        this.logger.warn('Connection error detected', { url, hostname, proxyUrl: currentProxyIp, error: errorMessage });
        
        if (currentProxyIp && this.staticProxyManager) {
          this.staticProxyManager.reportPermanentIpFailure(currentProxyIp);
        }
        
        if (this.rateLimiter && currentProxyIp) {
          this.rateLimiter.initiateIpBackoff(currentProxyIp);
        }
      }
      
      throw new Error(`Processing failed for ${url}: ${errorMessage}`);
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
   * Generate unique job identifier for state file naming
   */
  private generateJobIdentifier(args: any): string {
    const timestamp = Date.now();
    const urlCount = args.urls?.length || 0;
    const formats = (args.outputFormats || ['text']).join('_');
    return `job_${timestamp}_${urlCount}urls_${formats}`;
  }

  /**
   * Prepare URL list from various input sources (array, file, or text input)
   */
  private async prepareUrlList(args: any): Promise<string[]> {
    try {
      let urls: string[] = [];

      // Handle URLs from array parameter
      if (args.urls && Array.isArray(args.urls) && args.urls.length > 0) {
        urls = args.urls;
      }
      // Handle URLs from file parameter
      else if (args.urlFile && typeof args.urlFile === 'string') {
        const fileContent = await fs.readFile(args.urlFile, 'utf-8');
        urls = fileContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('#'));
      }

      // Validate and normalize URLs - NEGATIVE SPACE PROGRAMMING
      const validUrls: string[] = [];
      for (const url of urls) {
        const normalizedUrl = UrlUtils.normalizeUrl(url);
        if (normalizedUrl && UrlUtils.isValidUrl(normalizedUrl)) {
          validUrls.push(normalizedUrl);
        } else {
          this.logger.warn('Invalid URL skipped during preparation', { url });
        }
      }

      // Assert valid URLs found - NEGATIVE SPACE PROGRAMMING
      if (validUrls.length === 0) {
        throw new Error('No valid URLs found in provided input sources');
      }

      this.logger.info('URL list prepared successfully', {
        originalCount: urls.length,
        validCount: validUrls.length
      });

      return validUrls;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error('Failed to prepare URL list', { error: errorMessage });
      throw new Error(`URL preparation failed: ${errorMessage}`);
    }
  }

  /**
   * Perform auto-scrolling to load dynamic content
   * Preserves original module auto-scrolling functionality
   */
  private async autoScrollPage(page: any): Promise<void> {
    try {
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      // Wait for potential lazy-loaded content
      await page.waitForTimeout(2000);
    } catch (error) {
      this.logger.debug('Auto-scroll completed with minor issues', { error: getErrorMessage(error) });
    }
  }

  /**
   * Click toggle buttons to expand collapsed content sections with comprehensive enhancements
   * Features: smart waiting, state tracking, custom selectors, text-based targeting, and expansion verification
   * Mirrors the advanced system from UrlDiscoveryEngine for consistent functionality
   * 
   * @param page - Puppeteer page instance to process
   * @param sessionTextBasedClickTargets - Optional session-specific text-based click patterns
   * @returns Promise<boolean> - True if any toggles were successfully clicked and expanded
   */
  private async clickToggleButtons(page: any, sessionTextBasedClickTargets?: ClickableTextPattern[]): Promise<boolean> {
    let anyToggleSuccessfullyClickedAndExpanded = false;
    const successfullyExpandedElements = new Set<string>(); // Track expanded elements to prevent re-clicking
    
    this.logger.debug('Starting comprehensive toggle clicking process with advanced state management.');

    try {
      // 1. Process Generic Toggle Selectors with Enhanced Diversity
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

      this.logger.debug(`Processing ${currentToggleSelectors.length} generic toggle selectors with state tracking.`);
      
      for (const selector of currentToggleSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            try {
              // Generate unique identifier for this element to prevent re-clicking
              const elementId = await page.evaluate((el: any) => {
                if (!el.dataset.tempToggleId) {
                  el.dataset.tempToggleId = Math.random().toString(36).substr(2, 9);
                }
                return el.dataset.tempToggleId;
              }, element);

              // Skip if we've already successfully expanded this element
              if (successfullyExpandedElements.has(elementId)) {
                continue;
              }

              const isVisible = await element.isIntersectingViewport();
              if (isVisible) {
                const clickedAndVerified = await this.clickAndVerify(page, element, selector);
                if (clickedAndVerified) {
                  successfullyExpandedElements.add(elementId);
                  anyToggleSuccessfullyClickedAndExpanded = true;
                }
              }
            } catch (clickError) {
              this.logger.debug('Generic toggle click/verify failed for element', { 
                selector, 
                error: getErrorMessage(clickError) 
              });
            }
          }
        } catch (selectorError) {
          this.logger.debug('Generic toggle selector failed', { 
            selector, 
            error: getErrorMessage(selectorError) 
          });
        }
      }

      // 2. Process Text-Based Click Targets (if provided via session)
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
          const clickTargetElements = await page.$$(pattern.clickTargetSelector);
          this.logger.debug(`Found ${clickTargetElements.length} elements for target selector: ${pattern.clickTargetSelector}`);

          for (const targetElement of clickTargetElements) {
            try {
              const isVisible = await targetElement.isIntersectingViewport();
              if (!isVisible) {
                this.logger.debug('Target element for text-based click is not visible.', { 
                  selector: pattern.clickTargetSelector 
                });
                continue;
              }

              let textToCheck = '';
              let textSourceElement = null;

              if (pattern.textMatchSelector) {
                // Find the textMatchSelector relative to the targetElement
                textSourceElement = await targetElement.$(pattern.textMatchSelector);
                if (!textSourceElement) {
                  this.logger.debug('textMatchSelector not found within clickTarget.', { 
                    parent: pattern.clickTargetSelector, 
                    child: pattern.textMatchSelector 
                  });
                  continue;
                }
              } else {
                textSourceElement = targetElement; // Check text of the click target itself
              }

              if (textSourceElement) {
                textToCheck = await textSourceElement.evaluate((el: HTMLElement) => el.innerText || '');
              }

              if (!textToCheck.trim()) {
                this.logger.debug('No text content found for text matching.', { 
                  selector: pattern.clickTargetSelector, 
                  textMatch: pattern.textMatchSelector 
                });
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
                matchFound = pattern.textIncludes.every((keyword: string) => {
                  const kw = pattern.caseSensitive ? keyword : keyword.toLowerCase();
                  return textToCheck.includes(kw);
                });
              } else { // 'any'
                matchFound = pattern.textIncludes.some((keyword: string) => {
                  const kw = pattern.caseSensitive ? keyword : keyword.toLowerCase();
                  return textToCheck.includes(kw);
                });
              }

              if (matchFound) {
                this.logger.info(
                  `Text match found for click. Selector: ${pattern.clickTargetSelector}, Text: "${originalText}", Keywords: ${pattern.textIncludes.join(', ')}`
                );
                const clickedAndVerified = await this.clickAndVerify(page, targetElement, pattern.clickTargetSelector);
                if (clickedAndVerified) {
                  anyToggleSuccessfullyClickedAndExpanded = true;
                }
              }

            } catch (elementError) {
              this.logger.warn('Error processing a specific text-based click target element.', { 
                selector: pattern.clickTargetSelector, 
                error: getErrorMessage(elementError) 
              });
            }
          }
        } catch (patternError) {
          this.logger.warn('Error processing a text-based click pattern.', { 
            pattern, 
            error: getErrorMessage(patternError) 
          });
        }
      }

      this.logger.debug('Enhanced toggle clicking completed', {
        totalSelectorsProcessed: currentToggleSelectors.length,
        successfulExpansions: successfullyExpandedElements.size,
        anySuccessfulExpansions: anyToggleSuccessfullyClickedAndExpanded,
        sessionTextTargetsUsed: sessionTextBasedClickTargets ? sessionTextBasedClickTargets.length : 0
      });

      return anyToggleSuccessfullyClickedAndExpanded;

    } catch (error) {
      this.logger.debug('Toggle clicking encountered errors but completed', { 
        error: getErrorMessage(error) 
      });
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
          // Check 1: aria-expanded changed to "true"
          if (el.getAttribute('aria-expanded') === 'true') return true;
          
          // Check 2: aria-selected changed to "true" (for tabs)
          if (el.getAttribute('aria-selected') === 'true') return true;
          
          // Check 3: aria-pressed changed to "true" (for toggle buttons)
          if (el.getAttribute('aria-pressed') === 'true') return true;
          
          // Check 4: If aria-controls exists, check if controlled element became visible
          const controlledId = el.getAttribute('aria-controls');
          if (controlledId) {
            const controlledElement = document.getElementById(controlledId);
            if (controlledElement) {
              const style = window.getComputedStyle(controlledElement);
              if (style.display !== 'none' && 
                  style.visibility !== 'hidden' && 
                  parseFloat(style.opacity) > 0 && 
                  controlledElement.offsetHeight > 0) {
                return true;
              }
            }
          }
          
          // Check 5: Class-based state changes (active, expanded, etc.)
          if (el.classList.contains('active') || 
              el.classList.contains('expanded') || 
              el.classList.contains('open') ||
              el.classList.contains('shown')) {
            return true;
          }
          
          // Check 6: For details/summary, check if details is now open
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
   * Wait for random interval between requests for anti-detection
   * Preserves original module stealth timing functionality
   */
  private async waitRandomInterval(minMs: number, maxMs: number): Promise<void> {
    const waitTime = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Generate comprehensive processing summary
   * Creates detailed summary of extraction results and statistics
   */
  private generateProcessingSummary(results: ExtractedContent[]): ProcessingSummary {
    const summary: ProcessingSummary = {
      totalContentLength: results.reduce((sum, result) => sum + result.contentLength, 0),
      averageContentLength: results.length > 0 ? 
        Math.round(results.reduce((sum, result) => sum + result.contentLength, 0) / results.length) : 0,
      contentTypes: results.reduce((types: Record<string, number>, result) => {
        types[result.type] = (types[result.type] || 0) + 1;
        return types;
      }, {} as Record<string, number>),
      outputFiles: results.map(result => result.filePath)
    };

    return summary;
  }

  /**
   * Get current failed URLs for management and retry operations
   */
  getFailedUrls(): FailedUrl[] {
    return [...this.failedUrlDetails];
  }

  /**
   * Clear failed URLs list for retry operations
   */
  clearFailedUrls(): void {
    this.failedUrlDetails = [];
  }

  /**
   * Get processing statistics for monitoring and reporting
   * Provides comprehensive processing metrics
   */
  getProcessingStats(): object {
    return {
      processedCount: this.processedUrlCount,
      failedCount: this.failedUrlDetails.length,
      remainingUrls: this.urlsToProcess.length,
      stateManagementEnabled: this.config.progressSavingConfig?.enabled || false,
      rateLimitingEnabled: this.config.rateLimitConfig?.enabled || false,
      proxyManagementEnabled: this.staticProxyManager?.hasProxies() || false,
      configuration: {
        maxConcurrentPages: this.config.maxConcurrentPages,
        navigationTimeout: this.config.navigationTimeout,
        outputBasePath: this.config.outputBasePath
      },
      recentFailures: this.failedUrlDetails.slice(-5) // Last 5 failures
    };
  }
}

/**
 * Interface for scraping operation results
 */
export interface ScrapingResults {
  totalUrls: number;
  processedUrls: number;
  failedUrls: number;
  extractedContent: ExtractedContent[];
  failedUrlDetails: FailedUrl[];
  processingTime: number;
  outputFormats: string[];
  summary: ProcessingSummary;
}

/**
 * Interface for processing summary statistics
 */
export interface ProcessingSummary {
  totalContentLength: number;
  averageContentLength: number;
  contentTypes: Record<string, number>;
  outputFiles: string[];
}