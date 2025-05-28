import { ScrapingConfig } from '../config.js';
import { ExtractedContent } from '../utils/contentExtractor.js';
import { FailedUrl } from '../types/state.js';
/**
 * Complete Content Scraping Engine with state management and robust shutdown
 * Handles batch URL processing with comprehensive error tracking and resumable operations
 */
export declare class ContentScrapingEngine {
    private config;
    private logger;
    private browserManager;
    private contentExtractor;
    private rateLimiter?;
    private staticProxyManager?;
    private urlsToProcess;
    private processedUrlCount;
    private failedUrlDetails;
    private processedInCurrentSessionCounter;
    private stateFilePath;
    private originalJobArgs;
    private isShuttingDown;
    private boundHandleSigint;
    private boundHandleSigterm;
    constructor(config: ScrapingConfig);
    /**
     * Generate unique state file path for this scraping job
     * Creates identifier based on job parameters for state persistence
     *
     * @param jobIdentifier - Unique identifier for this scraping job
     * @returns string - Full path to state file
     */
    private generateStateFilePath;
    /**
     * Save current progress state to file for resumable operations
     * Implements comprehensive state persistence with error handling
     */
    private saveState;
    /**
     * Load progress state from file for operation resumption
     * Implements comprehensive state restoration with validation
     *
     * @returns Promise<boolean> - True if state loaded successfully
     */
    private loadState;
    /**
     * Clean up invalid or corrupted state file - NEGATIVE SPACE PROGRAMMING
     */
    private cleanupInvalidStateFile;
    /**
     * Perform graceful shutdown with state preservation
     * Handles SIGINT, SIGTERM signals and error conditions
     *
     * @param error - Optional error that triggered shutdown
     * @param signal - Signal that triggered shutdown (SIGINT, SIGTERM)
     */
    private performShutdown;
    /**
     * Main scraping orchestration method with state management and robust shutdown
     * Processes multiple URLs with batch processing, error tracking, and progress reporting
     *
     * @param args - Scraping arguments from MCP tool
     * @param context - MCP context with progress reporting and logging
     * @returns Promise<ScrapingResults> - Comprehensive scraping results
     * @throws Error if scraping fails or parameters are invalid
     */
    scrapeUrls(args: any, context: any): Promise<ScrapingResults>;
    /**
     * Generate unique job identifier for state file naming
     * Creates consistent identifier based on job parameters
     *
     * @param args - Job arguments to generate identifier from
     * @returns string - Unique job identifier
     */
    private generateJobIdentifier;
    /**
     * Process individual URL with comprehensive content extraction and rate limiting
     * Handles page loading, content extraction, and output generation with proxy support
     *
     * @param url - URL to process
     * @param args - Processing arguments and options
     * @returns Promise<ExtractedContent> - Extraction results
     * @throws Error if processing fails for the URL
     */
    private processIndividualUrl;
    /**
     * Prepare URL list from various input sources (array, file, or text input)
     * Validates and normalizes URLs for processing
     *
     * @param args - Scraping arguments containing URL sources
     * @returns Promise<string[]> - Validated and normalized URL list
     * @throws Error if no valid URLs found or file reading fails
     */
    private prepareUrlList;
    /**
     * Perform auto-scrolling to load dynamic content
     * Preserves original module auto-scrolling functionality
     *
     * @param page - Puppeteer page instance to scroll
     */
    private autoScrollPage;
    /**
     * Click toggle buttons to expand collapsed content
     * Preserves original module toggle clicking functionality
     *
     * @param page - Puppeteer page instance to process
     */
    private clickToggleButtons;
    /**
     * Wait for random interval between requests for anti-detection
     * Preserves original module stealth timing functionality
     *
     * @param minMs - Minimum wait time in milliseconds
     * @param maxMs - Maximum wait time in milliseconds
     */
    private waitRandomInterval;
    /**
     * Generate comprehensive processing summary
     * Creates detailed summary of extraction results and statistics
     *
     * @param results - Array of successful extraction results
     * @returns ProcessingSummary - Detailed processing summary
     */
    private generateProcessingSummary;
    /**
     * Get current failed URLs for management and retry operations
     * Provides access to failed URL tracking data
     *
     * @returns FailedUrl[] - Array of failed URL entries with error details
     */
    getFailedUrls(): FailedUrl[];
    /**
     * Clear failed URLs list for retry operations
     * Allows resetting failed URL tracking
     */
    clearFailedUrls(): void;
    /**
     * Get processing statistics for monitoring and reporting
     * Provides comprehensive processing metrics
     *
     * @returns Object with processing statistics and configuration info
     */
    getProcessingStats(): object;
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
//# sourceMappingURL=contentScraping.d.ts.map