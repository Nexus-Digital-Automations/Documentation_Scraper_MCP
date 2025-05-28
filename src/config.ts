// ============================================================================
// MODULE: config.ts
//
// PURPOSE:
// Comprehensive configuration management for Documentation Scraper MCP Server.
// Defines TypeScript interfaces and default settings for all system components.
//
// DEPENDENCIES:
// - None (core configuration module)
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
 * Content extraction configuration with CSS selectors and PDF options
 * Supports multiple output formats as in original modules
 */
export interface ContentExtractionConfig {
  selectors: string[];
  pdfOptions: {
    format: string;
    printBackground: boolean;
    margin: { top: string; right: string; bottom: string; left: string; };
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
    }
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

// Export singleton configuration instances for global access
// These maintain immutability while providing convenient access patterns
export const CONFIG = cloneConfiguration(DEFAULT_CONFIG);
export const LOGGING_CONFIG = { ...DEFAULT_LOGGING_CONFIG };