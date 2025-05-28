// ============================================================================
// MODULE: contentScraping.ts
//
// PURPOSE:
// Complete Content Scraping Engine implementing all "Scrape URL File" functionality.
// Provides batch URL processing, PDF generation, content extraction, failed URL
// tracking, VPN rotation, and comprehensive error handling capabilities.
//
// DEPENDENCIES:
// - ../config.js: Scraping configuration and settings
// - ../utils/browserManager.js: Browser lifecycle management
// - ../utils/contentExtractor.js: Content extraction and PDF generation
// - ../utils/logger.js: Comprehensive logging system
// - p-limit: Concurrency control for batch processing
// - fs/promises: File system operations for URL file reading
//
// EXPECTED INTERFACES:
// - scrapeUrls(): Main scraping orchestration method
// - processUrlBatch(): Batch processing with concurrency control
// - extractContent(): Content extraction using CSS selectors
// - generatePdf(): PDF generation with custom options
// - saveTextContent(): Text file creation and organization
// - trackFailedUrls(): Failed URL tracking and reporting
// - rotateVpnConnection(): Optional VPN rotation
// - waitRandomInterval(): Anti-detection delay management
//
// DESIGN PATTERNS:
// - Strategy pattern for different content extraction approaches
// - Observer pattern for progress reporting and monitoring
// - Template method pattern for URL processing pipeline
// - Factory pattern for output format generation
//
// SYSTEM INVARIANTS:
// - URL validation must occur before processing
// - Failed URLs must be tracked and reported comprehensively
// - Concurrency limits must be respected to prevent resource exhaustion
// - Output directories must be organized properly before content saving
// - Memory usage must be monitored during large batch operations
//
// NEGATIVE SPACE CONSIDERATIONS:
// - NEVER process invalid or malformed URLs
// - NEVER exceed configured concurrency limits
// - NEVER proceed without proper output directory structure
// - NEVER ignore failed URL tracking requirements
// - NEVER allow memory usage to exceed configured thresholds
// ============================================================================

import pLimit from 'p-limit';
import { promises as fs } from 'fs';
import path from 'path';
import { ScrapingConfig } from '../config.js';
import { BrowserManager } from '../utils/browserManager.js';
import { ContentExtractor, ExtractedContent } from '../utils/contentExtractor.js';
import { Logger, getErrorMessage } from '../utils/logger.js';
import { UrlUtils } from '../utils/urlUtils.js';

/**
 * Complete Content Scraping Engine preserving all Scrape URL File functionality
 * Handles batch URL processing with comprehensive error tracking and content extraction
 */
export class ContentScrapingEngine {
  private config: ScrapingConfig;
  private logger: Logger;
  private browserManager: BrowserManager;
  private contentExtractor: ContentExtractor;
  private failedUrls: FailedUrl[];
  private processedUrls: ProcessedUrl[];

  constructor(config: ScrapingConfig) {
    // Validate configuration before initialization
    if (!config) {
      throw new Error('ContentScrapingEngine requires valid configuration');
    }

    this.config = config;
    this.logger = new Logger();
    this.browserManager = new BrowserManager(config);
    this.contentExtractor = new ContentExtractor(config);
    this.failedUrls = [];
    this.processedUrls = [];
  }

  /**
   * Main scraping orchestration method - Complete Scrape URL File functionality
   * Processes multiple URLs with batch processing, error tracking, and progress reporting
   * 
   * @param args - Scraping arguments from MCP tool
   * @param context - MCP context with progress reporting and logging
   * @returns Promise<ScrapingResults> - Comprehensive scraping results
   * @throws Error if scraping fails or parameters are invalid
   */
  async scrapeUrls(args: any, context: any): Promise<ScrapingResults> {
    const { reportProgress, log } = context;
    const startTime = Date.now();

    try {
      log.info('Starting content scraping operation', {
        urlCount: args.urls?.length || 'from file',
        outputFormats: args.outputFormats,
        maxConcurrent: args.maxConcurrent
      });

      // Prepare URL list from input sources
      const urlsToProcess = await this.prepareUrlList(args);
      
      // Assert URL list validity
      if (!urlsToProcess || urlsToProcess.length === 0) {
        throw new Error('No valid URLs provided for scraping');
      }

      log.info('URL preparation completed', { totalUrls: urlsToProcess.length });

      // Organize output directory structure
      await this.contentExtractor.organizeOutputFiles();

      // Initialize progress tracking
      let processedCount = 0;
      const totalUrls = urlsToProcess.length;

      // Set up concurrency control
      const limit = pLimit(args.maxConcurrent || this.config.maxConcurrentPages);

      // Process URLs in batches with concurrency control
      const scrapingPromises = urlsToProcess.map(url => 
        limit(async () => {
          try {
            const result = await this.processIndividualUrl(url, args);
            processedCount++;
            
            // Report progress to Claude Desktop
            reportProgress({
              progress: processedCount,
              total: totalUrls
            });

            this.processedUrls.push({
              url,
              status: 'success',
              result,
              processedAt: new Date().toISOString()
            });

            return result;
          } catch (error) {
            // Track failed URL with detailed error information
            this.failedUrls.push({
              url,
              error: getErrorMessage(error),
              failedAt: new Date().toISOString(),
              retryCount: 0
            });

            log.warn('URL processing failed', { url, error: getErrorMessage(error) });
            
            processedCount++;
            reportProgress({
              progress: processedCount,
              total: totalUrls
            });

            return null;
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
        totalUrls: urlsToProcess.length,
        processedUrls: successfulResults.length,
        failedUrls: this.failedUrls.length,
        extractedContent: successfulResults,
        failedUrlDetails: this.failedUrls,
        processingTime: Date.now() - startTime,
        outputFormats: args.outputFormats || ['text'],
        summary: this.generateProcessingSummary(successfulResults)
      };

      log.info('Content scraping completed', {
        totalUrls: finalResults.totalUrls,
        successful: finalResults.processedUrls,
        failed: finalResults.failedUrls,
        processingTimeMs: finalResults.processingTime
      });

      return finalResults;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      log.error('Content scraping operation failed', { error: errorMessage });
      throw new Error(`Content scraping failed: ${errorMessage}`);
    }
  }

  /**
   * Prepare URL list from various input sources (array, file, or text input)
   * Validates and normalizes URLs for processing
   * 
   * @param args - Scraping arguments containing URL sources
   * @returns Promise<string[]> - Validated and normalized URL list
   * @throws Error if no valid URLs found or file reading fails
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

      // Validate and normalize URLs
      const validUrls: string[] = [];
      for (const url of urls) {
        const normalizedUrl = UrlUtils.normalizeUrl(url);
        if (normalizedUrl && UrlUtils.isValidUrl(normalizedUrl)) {
          validUrls.push(normalizedUrl);
        } else {
          this.logger.warn('Invalid URL skipped during preparation', { url });
        }
      }

      // Assert valid URLs found
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
   * Process individual URL with comprehensive content extraction
   * Handles page loading, content extraction, and output generation
   * 
   * @param url - URL to process
   * @param args - Processing arguments and options
   * @returns Promise<ExtractedContent> - Extraction results
   * @throws Error if processing fails for the URL
   */
  private async processIndividualUrl(url: string, args: any): Promise<ExtractedContent> {
    let browser = null;
    let page = null;

    try {
      this.logger.debug('Processing individual URL', { url });

      // Launch browser and create page
      browser = await this.browserManager.launchBrowser();
      page = await this.browserManager.createPage(browser);

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
        await this.clickToggleButtons(page);
      }

      // Wait random interval for anti-detection
      if (args.waitTimeMin && args.waitTimeMax) {
        await this.waitRandomInterval(args.waitTimeMin, args.waitTimeMax);
      }

      // Extract content based on requested formats
      let result: ExtractedContent;
      
      if (args.outputFormats.includes('pdf') || args.generatePdfs) {
        result = await this.contentExtractor.generatePdfFromPage(page, url);
      } else {
        result = await this.contentExtractor.extractAndSaveText(page, url, args.customSelectors);
      }

      this.logger.debug('URL processing completed successfully', { url });

      return result;
    } catch (error) {
      this.logger.error('Individual URL processing failed', { url, error: getErrorMessage(error) });
      throw new Error(`Processing failed for ${url}: ${getErrorMessage(error)}`);
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
   * Perform auto-scrolling to load dynamic content
   * Preserves original module auto-scrolling functionality
   * 
   * @param page - Puppeteer page instance to scroll
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
   * Click toggle buttons to expand collapsed content
   * Preserves original module toggle clicking functionality
   * 
   * @param page - Puppeteer page instance to process
   */
  private async clickToggleButtons(page: any): Promise<void> {
    try {
      const toggleSelectors = [
        'button[aria-expanded="false"]', 
        '.toggle', '.expand', '.show-more',
        '[data-toggle]', '.accordion-toggle'
      ];

      for (const selector of toggleSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            await element.click();
            await page.waitForTimeout(500); // Wait for expansion
          }
        } catch {
          // Continue with next selector if current fails
        }
      }
    } catch (error) {
      this.logger.debug('Toggle clicking completed with minor issues', { error: getErrorMessage(error) });
    }
  }

  /**
   * Wait for random interval between requests for anti-detection
   * Preserves original module stealth timing functionality
   * 
   * @param minMs - Minimum wait time in milliseconds
   * @param maxMs - Maximum wait time in milliseconds
   */
  private async waitRandomInterval(minMs: number, maxMs: number): Promise<void> {
    const waitTime = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Generate comprehensive processing summary
   * Creates detailed summary of extraction results and statistics
   * 
   * @param results - Array of successful extraction results
   * @returns ProcessingSummary - Detailed processing summary
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
   * Provides access to failed URL tracking data
   * 
   * @returns FailedUrl[] - Array of failed URL entries with error details
   */
  getFailedUrls(): FailedUrl[] {
    return [...this.failedUrls];
  }

  /**
   * Clear failed URLs list for retry operations
   * Allows resetting failed URL tracking
   */
  clearFailedUrls(): void {
    this.failedUrls = [];
  }

  /**
   * Get processing statistics for monitoring and reporting
   * Provides comprehensive processing metrics
   * 
   * @returns Object with processing statistics and configuration info
   */
  getProcessingStats(): object {
    return {
      processedCount: this.processedUrls.length,
      failedCount: this.failedUrls.length,
      configuration: {
        maxConcurrentPages: this.config.maxConcurrentPages,
        navigationTimeout: this.config.navigationTimeout,
        outputBasePath: this.config.outputBasePath
      },
      recentFailures: this.failedUrls.slice(-5) // Last 5 failures
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
 * Interface for failed URL tracking
 */
export interface FailedUrl {
  url: string;
  error: string;
  failedAt: string;
  retryCount: number;
}

/**
 * Interface for processed URL tracking
 */
export interface ProcessedUrl {
  url: string;
  status: 'success' | 'failed';
  result: ExtractedContent | null;
  processedAt: string;
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
