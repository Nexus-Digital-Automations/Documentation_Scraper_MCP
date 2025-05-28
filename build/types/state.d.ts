/**
 * Rate limiter state for persistence across sessions
 * Tracks request timestamps and backoff periods for hosts and IPs
 */
export interface RateLimiterState {
    hostRequestLog: Array<[string, {
        timestamps: number[];
        lastRequestTime: number;
        backoffUntil: number;
    }]>;
    ipRequestLog: Array<[string, {
        timestamps: number[];
        lastRequestTime: number;
        backoffUntil: number;
    }]>;
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
    version: string;
    timestamp: string;
    originalArgs: any;
    startUrl: string;
    maxDepth: number;
    discoveredUrls: string[];
    visitedUrls: string[];
    crawlQueue: CrawlItem[];
    failedUrls: string[];
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
    urlsToProcess: string[];
    processedUrlCount: number;
    failedUrlDetails: Array<{
        url: string;
        error: string;
        failedAt: string;
        retryCount: number;
    }>;
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
//# sourceMappingURL=state.d.ts.map