import { Browser, Page } from 'puppeteer';
import { ScrapingConfig } from '../config.js';
/**
 * Enhanced browser lifecycle management with Rayobyte static proxy support
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
     * Launch browser with comprehensive stealth configuration and optional proxy support
     * Integrates Rayobyte static IP configuration for enhanced scraping capabilities
     *
     * @param proxyServerUrl - Optional proxy server URL for Rayobyte static IP usage
     * @returns Promise<Browser> - Configured Puppeteer browser instance
     * @throws Error if browser launch fails or configuration is invalid
     */
    launchBrowser(proxyServerUrl?: string): Promise<Browser>;
    /**
     * Create new page with default configuration, stealth settings, and proxy authentication
     *
     * @param browser - Browser instance to create page in
     * @param proxyServerUrl - Optional proxy URL for authentication handling
     * @returns Promise<Page> - Configured Puppeteer page instance
     */
    createPage(browser: Browser, proxyServerUrl?: string): Promise<Page>;
    /**
     * Configure page with default settings for consistent behavior
     */
    private configurePageDefaults;
    /**
     * Check if proxy URL contains authentication credentials
     */
    private containsProxyCredentials;
    /**
     * Extract proxy credentials from URL
     */
    private extractProxyCredentials;
}
//# sourceMappingURL=browserManager.d.ts.map