// ============================================================================
// MODULE: types/state.ts
//
// PURPOSE:
// Comprehensive state management interfaces for progress saving and resuming.
// Defines TypeScript interfaces for saving scraping progress during interruptions
// and resuming operations from saved state.
//
// DEPENDENCIES:
// - None (pure type definitions)
//
// EXPECTED INTERFACES:
// - Progress state interfaces for URL discovery and content scraping
// - Rate limiter and proxy manager state interfaces
// - State serialization and deserialization support
//
// DESIGN PATTERNS:
// - Interface segregation for different engine state types
// - Version-based state schema for future migrations
// - Serializable state design for JSON persistence
//
// SYSTEM INVARIANTS:
// - All state must be serializable to JSON
// - State versions must be tracked for schema migrations
// - State must include sufficient context for resumption
// ============================================================================

/**
 * Rate limiter state for persistence across sessions
 * Tracks request timestamps and backoff periods for hosts and IPs
 */
export interface RateLimiterState {
  hostRequestLog: Array<[string, { timestamps: number[]; lastRequestTime: number; backoffUntil: number; }]>;
  ipRequestLog: Array<[string, { timestamps: number[]; lastRequestTime: number; backoffUntil: number; }]>;
}

/**
 * Static proxy manager state for IP assignment persistence
 * Maintains host-to-IP mappings and rotation state
 */
export interface StaticProxyManagerState {
  hostToIpMap: Array<[string, string]>;
  currentIpIndex: number;
}

/**
 * URL discovery engine progress state
 * Contains all necessary data to resume URL discovery operations
 */
export interface UrlDiscoveryProgressState {
  version: string; // For future schema migrations
  timestamp: string; // ISO string of when the state was saved
  originalArgs: any; // The initial arguments used to start this job

  // UrlDiscoveryEngine specific state
  startUrl: string;
  maxDepth: number;
  discoveredUrls: string[]; // Convert Set to Array
  visitedUrls: string[];   // Convert Set to Array
  crawlQueue: CrawlItem[]; // This is the primary queue to resume from
  failedUrls: string[];    // Convert Set to Array

  // State from utilities
  rateLimiterState?: RateLimiterState;
  staticProxyManagerState?: StaticProxyManagerState;
}

/**
 * Content scraping engine progress state
 * Contains all necessary data to resume content scraping operations
 */
export interface ContentScrapingProgressState {
  version: string;
  timestamp: string;
  originalArgs: any;

  // ContentScrapingEngine specific state
  urlsToProcess: string[]; // The remaining URLs from the input list
  processedUrlCount: number; // To track progress if urlsToProcess gets modified
  failedUrlDetails: Array<{ url: string; error: string; failedAt: string; retryCount: number }>;

  // State from utilities
  rateLimiterState?: RateLimiterState;
  staticProxyManagerState?: StaticProxyManagerState;
}

/**
 * Crawl queue item interface for URL discovery
 * Represents a URL with its depth in the crawl hierarchy
 */
export interface CrawlItem {
  url: string;
  depth: number;
}

/**
 * Failed URL tracking interface
 * Contains detailed information about URLs that failed processing
 */
export interface FailedUrl {
  url: string;
  error: string;
  failedAt: string;
  retryCount: number;
}

/**
 * Generic state serialization utilities
 * Provides common functionality for state persistence
 */
export interface StateMetadata {
  version: string;
  createdAt: string;
  lastModified: string;
  checksum?: string;
}

/**
 * State file management interface
 * Defines structure for state file operations
 */
export interface StateFileInfo {
  filePath: string;
  metadata: StateMetadata;
  sizeBytes: number;
  isValid: boolean;
}
