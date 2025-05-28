// ============================================================================
// MODULE: contentScraping.ts
//
// PURPOSE:
// Complete Content Scraping Engine implementing all "Scrape URL File" functionality
// with comprehensive state management, robust shutdown logic, and resumable operations.
// Provides batch URL processing, PDF generation, content extraction, failed URL
// tracking, VPN rotation, and comprehensive error handling capabilities.
//
// DEPENDENCIES:
// - ../config.js: Scraping configuration and settings
// - ../utils/browserManager.js: Browser lifecycle management
// - ../utils/contentExtractor.js: Content extraction and PDF generation
// - ../utils/logger.js: Comprehensive logging system
// - ../utils/rateLimiter.js: Rate limiting for responsible scraping
// - ../utils/staticProxyManager.js: Static proxy management
// - ../types/state.js: State management interfaces
// - p-limit: Concurrency control for batch processing
// - fs/promises: File system operations for state persistence
//
// EXPECTED INTERFACES:
// - scrapeUrls(): Main scraping orchestration method with state management
// - saveState(): Comprehensive state persistence for resumable operations
// - loadState(): State restoration from previous sessions
// - performShutdown(): Graceful shutdown with state preservation
//
// DESIGN PATTERNS:
// - Strategy pattern for different content extraction approaches
// - Observer pattern for progress reporting and monitoring
// - Template method pattern for URL processing pipeline
// - State pattern for operation persistence and resumption
//
// SYSTEM INVARIANTS:
// - URL validation must occur before processing
// - Failed URLs must be tracked and reported comprehensively
// - State must be persistable and restorable across sessions
// - Concurrency limits must be respected to prevent resource exhaustion
// - Graceful shutdown must preserve all processing state
//
// NEGATIVE SPACE CONSIDERATIONS:
// - NEVER process invalid or malformed URLs
// - NEVER exceed configured concurrency limits
// - NEVER proceed without proper state file validation
// - NEVER ignore signal handling for graceful shutdown
// - NEVER allow state corruption during persistence operations
// ============================================================================
import pLimit from 'p-limit';
import { promises as fs } from 'fs';
import path from 'path';
import { getStateFileBaseDir } from '../config.js';
import { BrowserManager } from '../utils/browserManager.js';
import { ContentExtractor } from '../utils/contentExtractor.js';
import { Logger, getErrorMessage } from '../utils/logger.js';
import { UrlUtils } from '../utils/urlUtils.js';
import { RateLimiter } from '../utils/rateLimiter.js';
import { StaticProxyManager } from '../utils/staticProxyManager.js';
/**
 * Complete Content Scraping Engine with state management and robust shutdown
 * Handles batch URL processing with comprehensive error tracking and resumable operations
 */
export class ContentScrapingEngine {
    config;
    logger;
    browserManager;
    contentExtractor;
    rateLimiter;
    staticProxyManager;
    // State management properties
    urlsToProcess = [];
    processedUrlCount = 0;
    failedUrlDetails = [];
    processedInCurrentSessionCounter = 0;
    // State persistence properties
    stateFilePath = null;
    originalJobArgs = {};
    // Shutdown management
    isShuttingDown = false;
    boundHandleSigint;
    boundHandleSigterm;
    constructor(config) {
        // Validate configuration before initialization - NEGATIVE SPACE PROGRAMMING
        if (!config) {
            throw new Error('ContentScrapingEngine requires valid configuration');
        }
        this.config = config;
        this.logger = new Logger();
        this.browserManager = new BrowserManager(config);
        this.contentExtractor = new ContentExtractor(config);
        // Initialize rate limiting if configured
        if (config.rateLimitConfig?.enabled) {
            this.rateLimiter = new RateLimiter(config.rateLimitConfig, this.logger);
        }
        // Initialize static proxy management if configured
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
     *
     * @param jobIdentifier - Unique identifier for this scraping job
     * @returns string - Full path to state file
     */
    generateStateFilePath(jobIdentifier) {
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
    async saveState() {
        // NEVER save state if progress saving is disabled
        if (!this.config.progressSavingConfig?.enabled || !this.stateFilePath) {
            this.logger.debug('Progress saving disabled or no state file path configured');
            return;
        }
        this.logger.info('Attempting to save content scraping progress state...', {
            file: this.stateFilePath
        });
        const state = {
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
        }
        catch (error) {
            this.logger.error('CRITICAL: Failed to save content scraping progress state.', {
                error: getErrorMessage(error),
                stateFile: this.stateFilePath
            });
        }
    }
    /**
     * Load progress state from file for operation resumption
     * Implements comprehensive state restoration with validation
     *
     * @returns Promise<boolean> - True if state loaded successfully
     */
    async loadState() {
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
            const state = JSON.parse(fileContent);
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
            // Restore utility states
            this.rateLimiter?.loadState(state.rateLimiterState);
            this.staticProxyManager?.loadState(state.staticProxyManagerState);
            this.logger.info('Content scraping state loaded successfully.', {
                remainingUrls: this.urlsToProcess.length,
                processedCount: this.processedUrlCount,
                failedCount: this.failedUrlDetails.length
            });
            return true;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                this.logger.info('No existing content scraping state file found.', {
                    file: this.stateFilePath
                });
            }
            else {
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
    async cleanupInvalidStateFile() {
        if (this.stateFilePath) {
            try {
                await fs.unlink(this.stateFilePath);
                this.logger.info('Removed invalid state file', { file: this.stateFilePath });
            }
            catch (cleanupError) {
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
     *
     * @param error - Optional error that triggered shutdown
     * @param signal - Signal that triggered shutdown (SIGINT, SIGTERM)
     */
    async performShutdown(error, signal) {
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
        }
        catch (shutdownError) {
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
     *
     * @param args - Scraping arguments from MCP tool
     * @param context - MCP context with progress reporting and logging
     * @returns Promise<ScrapingResults> - Comprehensive scraping results
     * @throws Error if scraping fails or parameters are invalid
     */
    async scrapeUrls(args, context) {
        const { reportProgress, log } = context;
        const startTime = Date.now();
        // Initialize state management
        this.originalJobArgs = { ...args };
        this.isShuttingDown = false;
        this.processedInCurrentSessionCounter = 0;
        try {
            log.info('Starting content scraping operation with state management', {
                urlCount: args.urls?.length || 'from file',
                outputFormats: args.outputFormats,
                maxConcurrent: args.maxConcurrent,
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
            // Set up concurrency control
            const limit = pLimit(args.maxConcurrent || this.config.maxConcurrentPages);
            // Main processing loop with comprehensive error handling
            const scrapingPromises = this.urlsToProcess.map(url => limit(async () => {
                // Check shutdown status before processing each URL
                if (this.isShuttingDown) {
                    return null;
                }
                try {
                    const result = await this.processIndividualUrl(url, args);
                    this.processedUrlCount++;
                    // Report progress to Claude Desktop
                    reportProgress({
                        progress: this.processedUrlCount,
                        total: totalUrls
                    });
                    return result;
                }
                catch (error) {
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
                }
                finally {
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
                    // Remove processed URL from the list
                    const urlIndex = this.urlsToProcess.indexOf(url);
                    if (urlIndex > -1) {
                        this.urlsToProcess.splice(urlIndex, 1);
                    }
                }
            }));
            // Wait for all processing to complete
            const results = await Promise.allSettled(scrapingPromises);
            // Calculate final statistics
            const successfulResults = results
                .filter(result => result.status === 'fulfilled' && result.value)
                .map(result => result.value)
                .filter(value => value !== null);
            const finalResults = {
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
        }
        catch (error) {
            const errorMessage = getErrorMessage(error);
            log.error('Content scraping operation failed', { error: errorMessage });
            await this.performShutdown(error);
            throw new Error(`Content scraping failed: ${errorMessage}`);
        }
        finally {
            // Ensure cleanup happens even if no error occurred
            if (!this.isShuttingDown) {
                await this.performShutdown();
            }
        }
    }
    /**
     * Generate unique job identifier for state file naming
     * Creates consistent identifier based on job parameters
     *
     * @param args - Job arguments to generate identifier from
     * @returns string - Unique job identifier
     */
    generateJobIdentifier(args) {
        const timestamp = Date.now();
        const urlCount = args.urls?.length || 0;
        const formats = (args.outputFormats || ['text']).join('_');
        return `job_${timestamp}_${urlCount}urls_${formats}`;
    }
    /**
     * Process individual URL with comprehensive content extraction and rate limiting
     * Handles page loading, content extraction, and output generation with proxy support
     *
     * @param url - URL to process
     * @param args - Processing arguments and options
     * @returns Promise<ExtractedContent> - Extraction results
     * @throws Error if processing fails for the URL
     */
    async processIndividualUrl(url, args) {
        let browser = null;
        let page = null;
        let currentProxyIp;
        // Extract hostname for rate limiting and proxy management
        const hostname = UrlUtils.extractHostname(url);
        try {
            this.logger.debug('Processing individual URL with state management', { url });
            // Get proxy for this hostname if static proxy manager is configured
            if (this.staticProxyManager) {
                currentProxyIp = this.staticProxyManager.getProxyForHost(hostname);
            }
            // Apply rate limiting before making request
            if (this.rateLimiter) {
                await this.rateLimiter.waitForSlot(hostname, currentProxyIp);
            }
            // Launch browser and create page with proxy support
            browser = await this.browserManager.launchBrowser(currentProxyIp);
            page = await this.browserManager.createPage(browser, currentProxyIp);
            // Record the request in rate limiter
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
                await this.clickToggleButtons(page);
            }
            // Wait random interval for anti-detection
            if (args.waitTimeMin && args.waitTimeMax) {
                await this.waitRandomInterval(args.waitTimeMin, args.waitTimeMax);
            }
            // Extract content based on requested formats
            let result;
            if (args.outputFormats.includes('pdf') || args.generatePdfs) {
                result = await this.contentExtractor.generatePdfFromPage(page, url);
            }
            else {
                result = await this.contentExtractor.extractAndSaveText(page, url, args.customSelectors);
            }
            this.logger.debug('URL processing completed successfully', { url });
            return result;
        }
        catch (error) {
            const errorMessage = getErrorMessage(error);
            // Handle specific error types for rate limiting and proxy management
            if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
                this.logger.warn('Rate limiting error detected', { url, hostname, error: errorMessage });
                if (this.rateLimiter) {
                    this.rateLimiter.initiateHostBackoff(hostname);
                    if (currentProxyIp) {
                        this.rateLimiter.initiateIpBackoff(currentProxyIp);
                    }
                }
            }
            else if (errorMessage.includes('net::ERR_ABORTED') || errorMessage.includes('net::ERR_CONNECTION')) {
                this.logger.warn('Connection error detected', { url, hostname, proxyUrl: currentProxyIp, error: errorMessage });
                if (currentProxyIp && this.staticProxyManager) {
                    this.staticProxyManager.reportPermanentIpFailure(currentProxyIp);
                }
                if (this.rateLimiter && currentProxyIp) {
                    this.rateLimiter.initiateIpBackoff(currentProxyIp);
                }
            }
            throw new Error(`Processing failed for ${url}: ${errorMessage}`);
        }
        finally {
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
     * Prepare URL list from various input sources (array, file, or text input)
     * Validates and normalizes URLs for processing
     *
     * @param args - Scraping arguments containing URL sources
     * @returns Promise<string[]> - Validated and normalized URL list
     * @throws Error if no valid URLs found or file reading fails
     */
    async prepareUrlList(args) {
        try {
            let urls = [];
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
            const validUrls = [];
            for (const url of urls) {
                const normalizedUrl = UrlUtils.normalizeUrl(url);
                if (normalizedUrl && UrlUtils.isValidUrl(normalizedUrl)) {
                    validUrls.push(normalizedUrl);
                }
                else {
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
        }
        catch (error) {
            const errorMessage = getErrorMessage(error);
            this.logger.error('Failed to prepare URL list', { error: errorMessage });
            throw new Error(`URL preparation failed: ${errorMessage}`);
        }
    }
    /**
     * Perform auto-scrolling to load dynamic content
     * Preserves original module auto-scrolling functionality
     *
     * @param page - Puppeteer page instance to scroll
     */
    async autoScrollPage(page) {
        try {
            await page.evaluate(async () => {
                await new Promise((resolve) => {
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
        }
        catch (error) {
            this.logger.debug('Auto-scroll completed with minor issues', { error: getErrorMessage(error) });
        }
    }
    /**
     * Click toggle buttons to expand collapsed content
     * Preserves original module toggle clicking functionality
     *
     * @param page - Puppeteer page instance to process
     */
    async clickToggleButtons(page) {
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
                }
                catch {
                    // Continue with next selector if current fails
                }
            }
        }
        catch (error) {
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
    async waitRandomInterval(minMs, maxMs) {
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
    generateProcessingSummary(results) {
        const summary = {
            totalContentLength: results.reduce((sum, result) => sum + result.contentLength, 0),
            averageContentLength: results.length > 0 ?
                Math.round(results.reduce((sum, result) => sum + result.contentLength, 0) / results.length) : 0,
            contentTypes: results.reduce((types, result) => {
                types[result.type] = (types[result.type] || 0) + 1;
                return types;
            }, {}),
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
    getFailedUrls() {
        return [...this.failedUrlDetails];
    }
    /**
     * Clear failed URLs list for retry operations
     * Allows resetting failed URL tracking
     */
    clearFailedUrls() {
        this.failedUrlDetails = [];
    }
    /**
     * Get processing statistics for monitoring and reporting
     * Provides comprehensive processing metrics
     *
     * @returns Object with processing statistics and configuration info
     */
    getProcessingStats() {
        return {
            processedCount: this.processedUrlCount,
            failedCount: this.failedUrlDetails.length,
            remainingUrls: this.urlsToProcess.length,
            stateManagementEnabled: this.config.progressSavingConfig?.enabled || false,
            configuration: {
                maxConcurrentPages: this.config.maxConcurrentPages,
                navigationTimeout: this.config.navigationTimeout,
                outputBasePath: this.config.outputBasePath
            },
            recentFailures: this.failedUrlDetails.slice(-5) // Last 5 failures
        };
    }
}
//# sourceMappingURL=contentScraping.js.map