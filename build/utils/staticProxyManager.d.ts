import { ProxyConfig } from '../config.js';
import { Logger } from './logger.js';
import { StaticProxyManagerState } from '../types/state.js';
/**
 * Static proxy manager for Rayobyte static IP integration
 * Manages IP assignment strategies and rotation for consistent scraping
 */
export declare class StaticProxyManager {
    private logger;
    private config;
    private proxies;
    private hostToIpMap;
    private currentIpIndex;
    constructor(proxyConfig: ProxyConfig, logger?: Logger);
    hasProxies(): boolean;
    /**
     * Gets a static proxy for a given hostname based on the assignment strategy.
     */
    getProxyForHost(hostname: string): string | undefined;
    private getNextSequentialProxy;
    /**
     * Call this if an IP is confirmed bad (e.g., Rayobyte says it's blocked, or consistent errors)
     */
    reportPermanentIpFailure(proxyUrl: string): void;
    getState(): StaticProxyManagerState;
    loadState(state?: StaticProxyManagerState): void;
}
//# sourceMappingURL=staticProxyManager.d.ts.map