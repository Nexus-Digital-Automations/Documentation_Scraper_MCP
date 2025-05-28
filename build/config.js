// ============================================================================
// MODULE: config.ts
//
// PURPOSE:
// Comprehensive configuration management for Documentation Scraper MCP Server.
// Defines TypeScript interfaces and default settings for all system components.
//
// DEPENDENCIES:
// - path: Path manipulation for state file directory resolution
//
// EXPECTED INTERFACES:
// - ScrapingConfig: Main configuration interface
// - Component-specific config interfaces for browser, URL filtering, etc.
// - Configuration validation functions
// - Default configuration constants
//
// DESIGN PATTERNS:
// - Interface segregation with modular configuration sections
// - Factory pattern for configuration validation
// - Singleton pattern for global configuration access
//
// SYSTEM INVARIANTS:
// - All configuration values must pass validation before use
// - Default configuration must preserve original module functionality
// - Configuration changes must maintain type safety
// ============================================================================
import path from 'path';
/**
 * Default configuration consolidating settings from both original Python modules
 * Maintains all original functionality while providing type-safe defaults
 */
export const DEFAULT_CONFIG = {
    maxConcurrentPages: 7,
    maxDepth: 100,
    navigationTimeout: 60000,
    pageLoadTimeout: 60000,
    maxPageProcessingWaitTime: 3000,
    minPageProcessingWaitTime: 1000,
    outputBasePath: '/Users/jeremyparker/Documents/MCP_Scraper_Output',
    browser: {
        headless: true,
        defaultViewport: { width: 1440, height: 900 },
        args: [
            '--disable-extensions', '--disable-sync', '--disable-translate',
            '--no-crash-upload', '--enable-strict-mixed-content-checking',
            '--block-new-web-contents', '--disable-client-side-phishing-detection',
            '--disable-features=DownloadsUI', '--disable-popup-blocking',
            '--disable-background-networking', '--disable-downloads',
            '--disable-downloads-extension', '--disable-file-system',
            '--disable-remote-fonts', '--disable-background-timer-throttling',
            '--metrics-recording-only', '--disable-permissions-api',
            '--disable-setuid-sandbox', '--js-flags="--noexpose_wasm"',
            '--disable-webgl', '--disable-storage-reset', '--disable-cache',
            '--disable-dev-shm-usage', '--disable-background-downloads',
            '--disable-component-update', '--disable-remote-fonts',
            '--disable-font-loading', '--disable-webfonts-service', '--mute-audio'
        ],
        protocolTimeout: 60000
    },
    urlFiltering: {
        excludePatterns: [/header/i, /footer/i, /nav/i, /menu/i],
        invalidUrlPrefixes: [
            'javascript:', '#', 'mailto:', 'data:', 'tel:', 'blob:',
            'chrome-extension:', 'about:'
        ],
        extensionsToAvoid: [
            '.css', '.jpeg', '.jpg', '.png', '.js', '.gif', '.svg',
            '.xml', '.json', '.mp3', '.mp4', '.zip', '.rar',
            '.tar', '.gz', '.mov', '.its'
        ]
    },
    userAgent: {
        browsers: ['Chrome', 'Firefox', 'Safari', 'Edge'],
        platforms: [
            'Windows NT 10.0', 'Macintosh; Intel Mac OS X 10_15_7',
            'X11; Linux x86_64', 'iPhone; CPU iPhone OS 14_4 like Mac OS X',
            'Android 11; Mobile'
        ]
    },
    errorHandling: { maxRetries: 3, retryDelay: 1000 },
    resourceMonitoring: { memoryThresholdMB: 500, cleanupIntervalMS: 60000 },
    languageFiltering: { allowedLanguages: ['en-US'], minimumConfidence: 0.7 },
    contentExtraction: {
        selectors: [
            'main', '.main-content', '.content', '.article', '.post', '#content',
            '.entry', '.primary-content', '.page-content', '.blog-post',
            '.article-content', '.post-content', '.main-body', '.content-area',
            '.entry-content', '.wrapper', '.container', '.content-wrapper',
            '.site-content', '.content-section', '.main-section', '.content-main',
            '.body-content', '.content-block', '.content-inner'
        ],
        pdfOptions: {
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
        },
        // Add the default for the new property:
        selectorsToExcludeFromText: [
            "header",
            "footer",
            "nav",
            "aside", // Common tag for sidebars
            ".sidebar", // Common class for sidebars
            "#sidebar", // Common ID for sidebars
            ".cookie-banner", // Common class for cookie banners
            ".cookie-consent", // Common class for cookie banners
            "#gdpr-consent", // Common ID for GDPR banners
            "[role='banner']", // ARIA role for headers
            "[role='contentinfo']", // ARIA role for footers
            "[role='navigation']", // ARIA role for navigation
            "[role='complementary']" // ARIA role for asides/sidebars
        ],
        customToggleSelectors: [], // Empty by default, can be customized per use case
        maxToggleIterations: 3, // Maximum nested toggle expansion iterations
        toggleExpansionTimeout: 5000, // 5 second timeout for expansion verification
        textBasedClickTargets: [ // Example patterns for common use cases
        // {
        //   clickTargetSelector: ".expandable-section-header",
        //   textMatchSelector: "h2.title", 
        //   textIncludes: ["Details", "More Information"],
        //   caseSensitive: false,
        //   matchType: 'any'
        // },
        // {
        //   clickTargetSelector: "button.show-comments",
        //   textIncludes: ["Show Comments", "View Replies"],
        //   caseSensitive: false
        // }
        ], // Empty by default, can be configured per session or globally
        structuredDataSchemas: [], // Empty by default, can be configured per use case
        enableStructuredExtraction: false // Disabled by default to maintain performance
    },
    pageInteraction: {
        loadWaitConditions: [],
        postClickWaitConditions: [],
        customInteractionSequences: {},
        defaultNetworkIdleTimeout: 5000,
        defaultElementTimeout: 10000,
        enableAdvancedWaiting: false
    },
    changeDetection: {
        enabled: false,
        storageBackend: 'file',
        storagePath: '/Users/jeremyparker/Documents/MCP_Scraper_Output/change_detection',
        hashAlgorithm: 'sha256',
        retentionDays: 30,
        monitoringSelectors: ['main', '.content', '.article'],
        notificationThreshold: 5, // 5% change threshold
        excludeFromHashing: ['.timestamp', '.date', '.ad', '.advertisement']
    },
    proxyConfig: {
        staticProxies: [], // User will populate this with their Rayobyte static IPs
        // Example: ["http://your_rayobyte_static_ip1:port", "http://user:pass@your_rayobyte_static_ip2:port"]
        assignmentStrategy: 'stickyByHost',
    },
    rateLimitConfig: {
        enabled: true,
        maxRequestsPerMinutePerHost: 15, // Be conservative: 15 requests per minute per host
        // maxRequestsPerMinutePerIp: 60, // Optional: 1 request per second per IP globally
        minDelayMsPerHost: 2000, // Minimum 2 seconds between requests to the same host
        maxRandomDelayMsPerHost: 3000, // Additional random delay up to 3 seconds
        hostBackoffMsOnError: 60000 * 5, // Back off for 5 minutes for a host on error
        ipBackoffMsOnError: 60000 * 10, // Rest an IP for 10 minutes on error
    },
    progressSavingConfig: {
        enabled: true,
        // stateFileBaseDir will be derived from outputBasePath if not set explicitly
        // stateFileBaseDir: path.join(DEFAULT_CONFIG.outputBasePath, 'scraper_states'), // Can't reference DEFAULT_CONFIG here directly
        autoSaveIntervalCount: 100, // Save progress every 100 URLs discovered/processed
    }
};
/**
 * Default logging configuration with comprehensive output formatting
 * Maintains colored output and rotation as in original modules
 */
export const DEFAULT_LOGGING_CONFIG = {
    level: 'INFO',
    maxLogFileSize: 10 * 1024 * 1024, // 10MB
    rotateOldLogs: true,
    colorOutput: true
};
/**
 * Configuration validation function with comprehensive error checking
 * Ensures all critical configuration values are valid before system startup
 *
 * @param config - Configuration object to validate
 * @returns true if valid, throws Error if invalid
 * @throws Error with specific validation failure message
 */
export function validateConfiguration(config) {
    // Assert positive numeric values for critical settings
    if (config.maxConcurrentPages <= 0) {
        throw new Error('maxConcurrentPages must be positive integer');
    }
    if (config.maxDepth <= 0) {
        throw new Error('maxDepth must be positive integer');
    }
    if (config.navigationTimeout <= 0) {
        throw new Error('navigationTimeout must be positive number');
    }
    if (config.pageLoadTimeout <= 0) {
        throw new Error('pageLoadTimeout must be positive number');
    }
    // Assert valid output path configuration  
    if (!config.outputBasePath || config.outputBasePath.trim() === '') {
        throw new Error('outputBasePath cannot be empty or whitespace');
    }
    // Assert browser configuration validity
    if (!config.browser.args || config.browser.args.length === 0) {
        throw new Error('Browser args array cannot be empty');
    }
    if (config.browser.protocolTimeout <= 0) {
        throw new Error('Browser protocolTimeout must be positive');
    }
    // Assert URL filtering arrays are properly defined
    if (!Array.isArray(config.urlFiltering.excludePatterns)) {
        throw new Error('excludePatterns must be an array of RegExp objects');
    }
    if (!Array.isArray(config.urlFiltering.invalidUrlPrefixes)) {
        throw new Error('invalidUrlPrefixes must be an array of strings');
    }
    if (!Array.isArray(config.urlFiltering.extensionsToAvoid)) {
        throw new Error('extensionsToAvoid must be an array of strings');
    }
    // Assert content extraction selector validity
    if (!Array.isArray(config.contentExtraction.selectors) ||
        config.contentExtraction.selectors.length === 0) {
        throw new Error('Content extraction selectors array cannot be empty');
    }
    // Assert language filtering configuration
    if (config.languageFiltering.minimumConfidence < 0 ||
        config.languageFiltering.minimumConfidence > 1) {
        throw new Error('Language filtering confidence must be between 0 and 1');
    }
    return true;
}
/**
 * Deep clone configuration to prevent accidental mutations
 * Ensures configuration immutability across system components
 *
 * @param config - Configuration to clone
 * @returns Deep copy of configuration object
 */
export function cloneConfiguration(config) {
    return JSON.parse(JSON.stringify(config));
}
/**
 * Get the state file base directory with proper fallback handling
 * Provides consistent state file directory resolution
 *
 * @param config - Configuration containing progress saving settings
 * @returns string - Resolved state file base directory path
 */
export function getStateFileBaseDir(config) {
    return config.progressSavingConfig?.stateFileBaseDir ||
        path.join(config.outputBasePath, 'scraper_states');
}
// Export singleton configuration instances for global access
// These maintain immutability while providing convenient access patterns
export const CONFIG = cloneConfiguration(DEFAULT_CONFIG);
export const LOGGING_CONFIG = { ...DEFAULT_LOGGING_CONFIG };
//# sourceMappingURL=config.js.map