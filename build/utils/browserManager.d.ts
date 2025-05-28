import { Browser, Page } from 'puppeteer';
import { ScrapingConfig } from '../config.js';
/**
 * Comprehensive browser lifecycle management preserving all original functionality
 * Handles browser launching, page creation, resource monitoring, and cleanup
 */
export declare class BrowserManager {
    private config;
    private logger;
    private activeBrowsers;
    private activePages;
    private memoryMonitoringInterval?;
    constructor(config: ScrapingConfig);
    /**
     * Launch browser with comprehensive stealth configuration
     * Applies all browser settings from configuration while maintaining stealth capabilities
     *
     * @returns Promise<Browser> - Configured Puppeteer browser instance
     * @throws Error if browser launch fails or configuration is invalid
     */
    launchBrowser(): Promise<Browser>;
    /**
     * Create new page with default configuration and stealth settings
     * Applies consistent page configuration while maintaining anti-detection capabilities
     *
     * @param browser - Browser instance to create page in
     * @returns Promise<Page> - Configured Puppeteer page instance
     * @throws Error if page creation fails or browser is invalid
     */
    createPage(browser: Browser): Promise<Page>;
    /**
     * Configure page with default settings for consistent behavior
     * Applies timeouts, viewport, and anti-detection measures
     *
     * @param page - Page instance to configure
     */
    private configurePageDefaults;
    /**
     * Safely close page and remove from active pages tracking
     * Ensures proper resource cleanup to prevent memory leaks
     *
     * @param page - Page instance to close
     */
    closePage(page: Page): Promise<void>;
    /**
     * Safely close browser and remove from active browsers tracking
     * Ensures all pages are closed before browser closure
     *
     * @param browser - Browser instance to close
     */
    closeBrowser(browser: Browser): Promise<void>;
    /**
     * Start memory monitoring with automatic cleanup triggers
     * Prevents resource exhaustion during large-scale operations
     */
    private startMemoryMonitoring;
    /**
     * Handle browser memory cleanup when thresholds are exceeded
     * Closes inactive resources to maintain system stability
     */
    private handleBrowserMemoryCleanup;
    /**
     * Get current resource usage statistics for monitoring
     * Provides insights into browser and page resource consumption
     *
     * @returns Object containing resource usage statistics
     */
    getResourceStats(): object;
    /**
     * Cleanup all resources and stop monitoring
     * Should be called during shutdown to prevent resource leaks
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=browserManager.d.ts.map