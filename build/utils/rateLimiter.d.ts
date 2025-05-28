import { RateLimitConfig } from '../config.js';
import { Logger } from './logger.js';
import { RateLimiterState } from '../types/state.js';
export declare class RateLimiter {
    private logger;
    private config;
    private hostRequestLog;
    private ipRequestLog;
    constructor(rateLimitConfig: RateLimitConfig, logger?: Logger);
    private getCurrentTimestamp;
    /**
     * Waits if necessary to respect rate limits for a given host and IP.
     * Throws an error if the host or IP is in a backoff period.
     */
    waitForSlot(hostname: string, proxyIp?: string): Promise<void>;
    /** Call this *after* a request is successfully initiated (not necessarily completed). */
    recordRequest(hostname: string, proxyIp?: string): void;
    initiateHostBackoff(hostname: string): void;
    initiateIpBackoff(proxyIp: string): void;
    getState(): RateLimiterState;
    loadState(state?: RateLimiterState): void;
}
//# sourceMappingURL=rateLimiter.d.ts.map