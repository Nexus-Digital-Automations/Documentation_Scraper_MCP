/**
 * Main configuration interface for the Documentation Scraper MCP Server
 * Consolidates settings from both original Python modules plus new enhancements
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
    pageInteraction?: PageInteractionConfig;
    changeDetection?: ChangeDetectionConfig;
    proxyConfig?: ProxyConfig;
    rateLimitConfig?: RateLimitConfig;
    progressSavingConfig?: ProgressSavingConfig;
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
 * Interface defining text-based clickable element patterns
 * Enables targeted clicking based on element content rather than just CSS selectors
 */
export interface ClickableTextPattern {
    /** The CSS selector for the element that should be clicked. */
    clickTargetSelector: string;
    /**
     * Optional: A CSS selector for an element within or related to the clickTargetSelector
     * whose text content will be checked. If omitted, the text content of
     * clickTargetSelector itself is checked.
     * Example: If clickTargetSelector is a div, textMatchSelector could be 'h3' or '.card-title'.
     */
    textMatchSelector?: string;
    /** An array of strings. The relevant text must include at least one of these. */
    textIncludes: string[];
    /** Optional: Set to true for case-sensitive text matching. Defaults to false. */
    caseSensitive?: boolean;
    /**
     * Optional: Defines how multiple strings in `textIncludes` are matched.
     * 'any': (Default) Matches if any of the strings in textIncludes are found.
     * 'all': Matches if all of the strings in textIncludes are found.
     */
    matchType?: 'any' | 'all';
}
/**
 * Enhanced JavaScript Rendering & Interaction Handling for SPAs
 * Defines sophisticated wait conditions and interaction sequences
 */
export interface InteractionStep {
    action: 'click' | 'type' | 'waitForSelector' | 'waitForNetworkIdle' | 'waitForFunction' | 'scroll' | 'hover';
    selector?: string;
    textToType?: string;
    functionToEvaluate?: string;
    timeout?: number;
    scrollDirection?: 'up' | 'down' | 'left' | 'right';
    scrollDistance?: number;
    description?: string;
}
export interface PageInteractionConfig {
    loadWaitConditions?: InteractionStep[];
    postClickWaitConditions?: InteractionStep[];
    customInteractionSequences?: {
        [sequenceName: string]: InteractionStep[];
    };
    defaultNetworkIdleTimeout?: number;
    defaultElementTimeout?: number;
    enableAdvancedWaiting?: boolean;
}
/**
 * Structured Data Extraction Configuration
 * Defines schemas for extracting specific data points into structured JSON format
 */
export interface FieldExtractor {
    name: string;
    selector: string;
    attribute?: string;
    isList?: boolean;
    transform?: 'trim' | 'lowercase' | 'uppercase' | 'number' | 'date';
    required?: boolean;
}
export interface StructuredDataSchema {
    name: string;
    description?: string;
    appliesToUrlPattern?: RegExp;
    rootSelector?: string;
    fields: FieldExtractor[];
    outputFormat?: 'json' | 'csv' | 'both';
}
/**
 * Content Change Detection and Monitoring Configuration
 * Enables tracking changes to specific content areas over time
 */
export interface ChangeDetectionConfig {
    enabled: boolean;
    storageBackend: 'file' | 'memory';
    storagePath?: string;
    hashAlgorithm: 'md5' | 'sha256';
    retentionDays?: number;
    monitoringSelectors?: string[];
    notificationThreshold?: number;
    excludeFromHashing?: string[];
}
/**
 * Content extraction configuration with CSS selectors and PDF options
 * Supports multiple output formats as in original modules plus new structured data extraction
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
    /**
     * Optional array of CSS selectors for elements to remove from the page's DOM
     * before the main content extraction process begins. This is useful for
     * eliminating common boilerplate content like headers, footers, navigation bars,
     * sidebars, cookie consent banners, etc.
     * Example: ["header", "footer", "nav", ".sidebar", "#cookie-banner"]
     */
    selectorsToExcludeFromText?: string[];
    customToggleSelectors?: string[];
    maxToggleIterations?: number;
    toggleExpansionTimeout?: number;
    textBasedClickTargets?: ClickableTextPattern[];
    structuredDataSchemas?: StructuredDataSchema[];
    enableStructuredExtraction?: boolean;
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
 * Static proxy configuration for Rayobyte integration
 * Manages static IP assignment and rotation strategies
 */
export interface ProxyConfig {
    /**
     * An array of static proxy server strings from Rayobyte.
     * Formats: "http://host:port" or "http://username:password@host:port"
     * Ensure these are your STATIC IPs from Rayobyte.
     */
    staticProxies: string[];
    /**
     * Strategy for assigning static IPs to target hostnames.
     * 'stickyByHost': Tries to use the same IP for the same host.
     * 'sequentialCycle': Cycles through IPs for new hosts or when sticky IP needs rotation.
     */
    assignmentStrategy?: 'stickyByHost' | 'sequentialCycle';
}
/**
 * Rate limiting configuration for responsible scraping
 * Implements per-host and per-IP rate limiting with backoff strategies
 */
export interface RateLimitConfig {
    /** Enable overall rate limiting. Defaults to true if this config object is present. */
    enabled: boolean;
    /** Maximum requests per minute for a single hostname. Example: 10 (10 RPM) */
    maxRequestsPerMinutePerHost: number;
    /** Maximum requests per minute for a single proxy IP (across all hosts). Example: 60 */
    maxRequestsPerMinutePerIp?: number;
    /** Minimum delay in milliseconds between requests to the same hostname. */
    minDelayMsPerHost: number;
    /** Maximum additional random delay in milliseconds to add to minDelayMsPerHost. */
    maxRandomDelayMsPerHost: number;
    /**
     * Backoff time in milliseconds if a 429 (Too Many Requests) or similar
     * rate-limiting error is encountered for a host.
     */
    hostBackoffMsOnError: number;
    /**
     * Backoff time in milliseconds if an IP receives a rate-limiting error.
     * This IP might be "rested" for this duration.
     */
    ipBackoffMsOnError: number;
}
/**
 * Progress saving configuration for resumable operations
 * Enables saving and resuming of scraping progress during interruptions
 */
export interface ProgressSavingConfig {
    /** Enables saving and resuming of scraping progress. */
    enabled: boolean;
    /**
     * Base directory where state files will be saved.
     * A subdirectory per job might be created under this.
     * Defaults to a 'scraper_states' directory relative to outputBasePath.
     */
    stateFileBaseDir?: string;
    /**
     * Interval in N URLs processed (for discoverUrls) or M items processed (for scrapeUrls)
     * for periodically saving the progress. Set to 0 or undefined to disable periodic saving
     * (only save on graceful shutdown/error).
     */
    autoSaveIntervalCount?: number;
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
/**
 * Get the state file base directory with proper fallback handling
 * Provides consistent state file directory resolution
 *
 * @param config - Configuration containing progress saving settings
 * @returns string - Resolved state file base directory path
 */
export declare function getStateFileBaseDir(config: ScrapingConfig): string;
export declare const CONFIG: ScrapingConfig;
export declare const LOGGING_CONFIG: {
    level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "SUCCESS";
    maxLogFileSize: number;
    rotateOldLogs: boolean;
    colorOutput: boolean;
};
//# sourceMappingURL=config.d.ts.map