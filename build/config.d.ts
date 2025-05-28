/**
 * Main configuration interface for the Documentation Scraper MCP Server
 * Consolidates settings from both original Python modules
 */
export interface ScrapingConfig {
    maxConcurrentPages: number;
    maxDepth: number;
    navigationTimeout: number;
    pageLoadTimeout: number;
    maxPageProcessingWaitTime: number;
    minPageProcessingWaitTime: number;
    outputBasePath: string;
    browser: BrowserConfig;
    urlFiltering: UrlFilterConfig;
    userAgent: UserAgentConfig;
    errorHandling: ErrorHandlingConfig;
    resourceMonitoring: ResourceMonitoringConfig;
    languageFiltering: LanguageFilterConfig;
    contentExtraction: ContentExtractionConfig;
    vpn?: VpnConfig;
}
/**
 * Browser configuration for Puppeteer instances
 * Includes stealth settings and resource optimization
 */
export interface BrowserConfig {
    headless: boolean;
    defaultViewport: {
        width: number;
        height: number;
    };
    args: string[];
    protocolTimeout: number;
}
/**
 * URL filtering configuration to exclude unwanted content
 * Preserves original module filtering logic
 */
export interface UrlFilterConfig {
    excludePatterns: RegExp[];
    invalidUrlPrefixes: string[];
    extensionsToAvoid: string[];
}
/**
 * User agent rotation configuration for stealth browsing
 * Supports multiple browsers and platforms
 */
export interface UserAgentConfig {
    browsers: string[];
    platforms: string[];
}
/**
 * Error handling configuration with retry logic
 * Implements exponential backoff for network operations
 */
export interface ErrorHandlingConfig {
    maxRetries: number;
    retryDelay: number;
}
/**
 * Resource monitoring configuration for memory management
 * Prevents memory leaks during large-scale operations
 */
export interface ResourceMonitoringConfig {
    memoryThresholdMB: number;
    cleanupIntervalMS: number;
}
/**
 * Language filtering configuration with confidence thresholds
 * Preserves original language detection functionality
 */
export interface LanguageFilterConfig {
    allowedLanguages: string[];
    minimumConfidence: number;
}
/**
 * Content extraction configuration with CSS selectors and PDF options
 * Supports multiple output formats as in original modules
 */
export interface ContentExtractionConfig {
    selectors: string[];
    pdfOptions: {
        format: string;
        printBackground: boolean;
        margin: {
            top: string;
            right: string;
            bottom: string;
            left: string;
        };
    };
}
/**
 * Optional VPN configuration for enhanced anonymity
 * Preserves VPN functionality from original modules
 */
export interface VpnConfig {
    enabled: boolean;
    rotationInterval: number;
    providers: string[];
}
/**
 * Logging configuration with level control and output formatting
 * Maintains colored output as in original modules
 */
export interface LoggingConfig {
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
    maxLogFileSize: number;
    rotateOldLogs: boolean;
    colorOutput: boolean;
}
/**
 * Default configuration consolidating settings from both original Python modules
 * Maintains all original functionality while providing type-safe defaults
 */
export declare const DEFAULT_CONFIG: ScrapingConfig;
/**
 * Default logging configuration with comprehensive output formatting
 * Maintains colored output and rotation as in original modules
 */
export declare const DEFAULT_LOGGING_CONFIG: LoggingConfig;
/**
 * Configuration validation function with comprehensive error checking
 * Ensures all critical configuration values are valid before system startup
 *
 * @param config - Configuration object to validate
 * @returns true if valid, throws Error if invalid
 * @throws Error with specific validation failure message
 */
export declare function validateConfiguration(config: ScrapingConfig): boolean;
/**
 * Deep clone configuration to prevent accidental mutations
 * Ensures configuration immutability across system components
 *
 * @param config - Configuration to clone
 * @returns Deep copy of configuration object
 */
export declare function cloneConfiguration(config: ScrapingConfig): ScrapingConfig;
export declare const CONFIG: ScrapingConfig;
export declare const LOGGING_CONFIG: {
    level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "SUCCESS";
    maxLogFileSize: number;
    rotateOldLogs: boolean;
    colorOutput: boolean;
};
//# sourceMappingURL=config.d.ts.map