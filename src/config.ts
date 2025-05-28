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
  pageInteraction?: PageInteractionConfig; // Enhanced SPA interaction handling
  changeDetection?: ChangeDetectionConfig; // Content change monitoring
  proxyConfig?: ProxyConfig; // Static IP proxy configuration for Rayobyte
  rateLimitConfig?: RateLimitConfig; // Rate limiting and IP management
  progressSavingConfig?: ProgressSavingConfig; // Progress saving and resuming
}

/**
 * Browser configuration for Puppeteer instances
 * Includes stealth settings and resource optimization
 */
export interface BrowserConfig {
  headless: boolean;
  defaultViewport: { width: number; height: number; };
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
  selector?: string; // For click, type, waitForSelector, hover
  textToType?: string; // For type action
  functionToEvaluate?: string; // For waitForFunction - JavaScript expression
  timeout?: number; // Override default timeout for this step
  scrollDirection?: 'up' | 'down' | 'left' | 'right'; // For scroll action
  scrollDistance?: number; // Pixels to scroll (default: 100)
  description?: string; // Human-readable description of this step
}

export interface PageInteractionConfig {
  loadWaitConditions?: InteractionStep[]; // Conditions to meet after initial page load
  postClickWaitConditions?: InteractionStep[]; // Default conditions after any click
  customInteractionSequences?: { [sequenceName: string]: InteractionStep[] }; // Named interaction sequences
  defaultNetworkIdleTimeout?: number; // Default network idle timeout (ms)
  defaultElementTimeout?: number; // Default element wait timeout (ms)
  enableAdvancedWaiting?: boolean; // Enable advanced waiting strategies
}

/**
 * Structured Data Extraction Configuration
 * Defines schemas for extracting specific data points into structured JSON format
 */
export interface FieldExtractor {
  name: string; // Field name in output JSON
  selector: string; // CSS selector for the data element
  attribute?: string; // Attribute to extract (default: innerText)
  isList?: boolean; // If true, extracts all matching elements as array
  transform?: 'trim' | 'lowercase' | 'uppercase' | 'number' | 'date'; // Data transformation
  required?: boolean; // If true, extraction fails if field not found
}

export interface StructuredDataSchema {
  name: string; // Schema identifier name
  description?: string; // Human-readable description
  appliesToUrlPattern?: RegExp; // Optional URL pattern filter
  rootSelector?: string; // For lists of items (e.g., product cards)
  fields: FieldExtractor[]; // Fields to extract
  outputFormat?: 'json' | 'csv' | 'both'; // Output format options
}

/**
 * Content Change Detection and Monitoring Configuration
 * Enables tracking changes to specific content areas over time
 */
export interface ChangeDetectionConfig {
  enabled: boolean; // Enable change detection features
  storageBackend: 'file' | 'memory'; // Where to store content snapshots
  storagePath?: string; // File path for storage backend (if file)
  hashAlgorithm: 'md5' | 'sha256'; // Hashing algorithm for content comparison
  retentionDays?: number; // How long to keep historical snapshots
  monitoringSelectors?: string[]; // Specific CSS selectors to monitor for changes
  notificationThreshold?: number; // Minimum content change percentage to trigger notification
  excludeFromHashing?: string[]; // CSS selectors to exclude from change detection
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
    margin: { top: string; right: string; bottom: string; left: string; };
  };
  /**
   * Optional array of CSS selectors for elements to remove from the page's DOM
   * before the main content extraction process begins. This is useful for
   * eliminating common boilerplate content like headers, footers, navigation bars,
   * sidebars, cookie consent banners, etc.
   * Example: ["header", "footer", "nav", ".sidebar", "#cookie-banner"]
   */
  selectorsToExcludeFromText?: string[];
  customToggleSelectors?: string[]; // Optional custom selectors for toggle button detection
  maxToggleIterations?: number; // Maximum iterations for nested toggle expansion (default: 3)
  toggleExpansionTimeout?: number; // Timeout for waiting for expansion verification (default: 5000ms)
  textBasedClickTargets?: ClickableTextPattern[]; // Optional text-based click target patterns
  structuredDataSchemas?: StructuredDataSchema[]; // Optional structured data extraction schemas
  enableStructuredExtraction?: boolean; // Enable structured data extraction features
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
export const DEFAULT_CONFIG: ScrapingConfig = {
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
    minDelayMsPerHost: 2000,         // Minimum 2 seconds between requests to the same host
    maxRandomDelayMsPerHost: 3000,   // Additional random delay up to 3 seconds
    hostBackoffMsOnError: 60000 * 5, // Back off for 5 minutes for a host on error
    ipBackoffMsOnError: 60000 * 10,  // Rest an IP for 10 minutes on error
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
export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
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
export function validateConfiguration(config: ScrapingConfig): boolean {
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
export function cloneConfiguration(config: ScrapingConfig): ScrapingConfig {
  return JSON.parse(JSON.stringify(config));
}

/**
 * Get the state file base directory with proper fallback handling
 * Provides consistent state file directory resolution
 * 
 * @param config - Configuration containing progress saving settings
 * @returns string - Resolved state file base directory path
 */
export function getStateFileBaseDir(config: ScrapingConfig): string {
  return config.progressSavingConfig?.stateFileBaseDir ||
         path.join(config.outputBasePath, 'scraper_states');
}

// Export singleton configuration instances for global access
// These maintain immutability while providing convenient access patterns
export const CONFIG = cloneConfiguration(DEFAULT_CONFIG);
export const LOGGING_CONFIG = { ...DEFAULT_LOGGING_CONFIG };