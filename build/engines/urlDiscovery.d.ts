import { ScrapingConfig } from '../config.js';
/**
 * Complete URL Discovery Engine preserving all Make URL File functionality
 * Handles website crawling, recursive link discovery, and comprehensive content extraction
 */
export declare class UrlDiscoveryEngine {
    private config;
    private logger;
    private browserManager;
    private contentExtractor;
    private interactionHandler?;
    private structuredDataExtractor?;
    private changeDetectionMonitor?;
    private discoveredUrls;
    private visitedUrls;
    private failedUrls;
    constructor(config: ScrapingConfig);
    /**
     * Main URL discovery orchestration method - Complete Make URL File functionality
     * Crawls website recursively starting from single URL with comprehensive filtering
     *
     * @param args - Discovery arguments from MCP tool
     * @param context - MCP context with progress reporting and logging
     * @returns Promise<DiscoveryResults> - Comprehensive discovery results
     * @throws Error if discovery fails or parameters are invalid
     */
    discoverUrls(args: any, context: any): Promise<DiscoveryResults>; /**
     * Process individual URL with comprehensive content extraction and link discovery
     * Handles page loading, content extraction, and link extraction with stealth features
     *
     * @param item - Crawl item containing URL and depth information
     * @param args - Discovery arguments and options
     * @param outputDir - Output directory for extracted content
     * @returns Promise<string[]> - Array of discovered links from the page
     * @throws Error if URL processing fails
     */
    private processUrl;
    /**
     * Generate randomized user agent for stealth browsing
     * Rotates between different browsers and platforms from configuration
     *
     * @returns string - Random user agent string
     */
    private generateUserAgent;
    /**
     * Perform comprehensive auto-scrolling to load dynamic content
     * Preserves original module auto-scrolling functionality with enhanced detection
     *
     * @param page - Puppeteer page instance to scroll
     */
    private autoScrollPage;
    /**
     * Click toggle buttons to expand collapsed content sections with comprehensive enhancements
     * Features: smart waiting, state tracking, custom selectors, text-based targeting, and expansion verification
     *
     * @param page - Puppeteer page instance to process
     * @param sessionTextBasedClickTargets - Optional session-specific text-based click patterns
     * @returns Promise<boolean> - True if any toggles were successfully clicked and expanded
     */
    private clickToggleButtons;
    /**
     * Helper method for clicking and verifying toggle expansion
     * Implements comprehensive state verification using page.waitForFunction
     *
     * @param page - Puppeteer page instance
     * @param element - Element to click
     * @param identifier - Identifier string for logging
     * @returns Promise<boolean> - True if click and verification succeeded
     */
    private clickAndVerify;
    /**
     * Determine if URL should be included in crawling based on filtering rules
     * Implements comprehensive URL filtering with both inclusion and exclusion logic
     *
     * @param url - URL to evaluate for inclusion
     * @param keywords - Optional keywords for inclusion filtering (URLs must contain at least one keyword)
     * @param excludePatterns - Optional custom exclude patterns
     * @returns boolean - True if URL should be included, false otherwise
     */
    private shouldIncludeUrl;
    /**
     * Extract hostname from URL for directory naming
     * Handles URL parsing and sanitization for filesystem use
     *
     * @param url - URL to extract hostname from
     * @returns string - Sanitized hostname for directory naming
     */
    private extractHostname;
    /**
     * Get current discovery statistics for monitoring and reporting
     * Provides comprehensive discovery metrics and progress information
     *
     * @returns Object with current discovery statistics
     */
    getDiscoveryStats(): object;
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
//# sourceMappingURL=urlDiscovery.d.ts.map