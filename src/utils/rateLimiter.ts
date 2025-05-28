// ============================================================================
// MODULE: utils/rateLimiter.ts
// PURPOSE: Rate limiting utility for managing request rates to hosts and IPs
// ============================================================================

import { RateLimitConfig } from '../config.js';
import { Logger, getErrorMessage } from './logger.js';
import { RateLimiterState } from '../types/state.js';

interface HostRequestInfo {
  timestamps: number[];
  lastRequestTime: number;
  backoffUntil: number;
}

interface IpRequestInfo {
  timestamps: number[];
  lastRequestTime: number;
  backoffUntil: number;
}

export class RateLimiter {
  private logger: Logger;
  private config: RateLimitConfig;
  private hostRequestLog: Map<string, HostRequestInfo>;
  private ipRequestLog: Map<string, IpRequestInfo>;

  constructor(rateLimitConfig: RateLimitConfig, logger?: Logger) {
    if (!rateLimitConfig) {
      throw new Error('RateLimiter requires valid rate limit configuration');
    }
    
    this.config = rateLimitConfig;
    this.logger = logger || new Logger();
    this.hostRequestLog = new Map();
    this.ipRequestLog = new Map();

    if (!this.config.enabled) {
      this.logger.info('RateLimiter initialized but is disabled.');
    } else {
      this.logger.info('RateLimiter initialized with active rate limiting.');
    }
  }

  private getCurrentTimestamp(): number {
    return Date.now();
  }

  /**
   * Waits if necessary to respect rate limits for a given host and IP.
   * Throws an error if the host or IP is in a backoff period.
   */
  public async waitForSlot(hostname: string, proxyIp?: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const now = this.getCurrentTimestamp();

    // 1. Check Host Backoff
    const hostInfo = this.hostRequestLog.get(hostname) || { timestamps: [], lastRequestTime: 0, backoffUntil: 0 };
    if (now < hostInfo.backoffUntil) {
      const waitMs = hostInfo.backoffUntil - now;
      this.logger.warn(`Host ${hostname} is in backoff. Waiting for ${waitMs}ms.`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    // 2. Check IP Backoff (if IP is provided and per-IP limiting is enabled)
    if (proxyIp && this.config.maxRequestsPerMinutePerIp) {
      const ipInfo = this.ipRequestLog.get(proxyIp) || { timestamps: [], lastRequestTime: 0, backoffUntil: 0 };
      if (now < ipInfo.backoffUntil) {
        const waitMs = ipInfo.backoffUntil - now;
        this.logger.warn(`IP ${proxyIp} is in backoff. Waiting for ${waitMs}ms.`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }

    // 3. Enforce minDelayMsPerHost
    const timeSinceLastHostRequest = now - hostInfo.lastRequestTime;
    const requiredDelay = this.config.minDelayMsPerHost + Math.random() * this.config.maxRandomDelayMsPerHost;
    if (hostInfo.lastRequestTime > 0 && timeSinceLastHostRequest < requiredDelay) {
      const delay = requiredDelay - timeSinceLastHostRequest;
      this.logger.debug(`Waiting ${delay.toFixed(0)}ms for host ${hostname} due to minDelay + random.`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // 4. Check maxRequestsPerMinutePerHost
    hostInfo.timestamps = hostInfo.timestamps.filter(ts => now - ts < 60000);
    if (hostInfo.timestamps.length >= this.config.maxRequestsPerMinutePerHost) {
      const oldestRelevantTimestamp = hostInfo.timestamps[0];
      const waitFor = 60000 - (now - oldestRelevantTimestamp);
      this.logger.debug(`Waiting ${waitFor.toFixed(0)}ms for host ${hostname} due to RPM limit.`);
      await new Promise(resolve => setTimeout(resolve, waitFor));
      hostInfo.timestamps = hostInfo.timestamps.filter(ts => this.getCurrentTimestamp() - ts < 60000);
    }

    // 5. Check maxRequestsPerMinutePerIp (if IP is provided and per-IP limiting is enabled)
    if (proxyIp && this.config.maxRequestsPerMinutePerIp) {
      const ipInfo = this.ipRequestLog.get(proxyIp) || { timestamps: [], lastRequestTime: 0, backoffUntil: 0 };
      ipInfo.timestamps = ipInfo.timestamps.filter(ts => now - ts < 60000);
      if (ipInfo.timestamps.length >= this.config.maxRequestsPerMinutePerIp) {
        const oldestRelevantTimestamp = ipInfo.timestamps[0];
        const waitFor = 60000 - (now - oldestRelevantTimestamp);
        this.logger.debug(`Waiting ${waitFor.toFixed(0)}ms for IP ${proxyIp} due to RPM limit.`);
        await new Promise(resolve => setTimeout(resolve, waitFor));
        ipInfo.timestamps = ipInfo.timestamps.filter(ts => this.getCurrentTimestamp() - ts < 60000);
      }
    }
  }

  /** Call this *after* a request is successfully initiated (not necessarily completed). */
  public recordRequest(hostname: string, proxyIp?: string): void {
    if (!this.config.enabled) {
      return;
    }

    const now = this.getCurrentTimestamp();

    const hostInfo = this.hostRequestLog.get(hostname) || { timestamps: [], lastRequestTime: 0, backoffUntil: 0 };
    hostInfo.timestamps.push(now);
    hostInfo.lastRequestTime = now;
    this.hostRequestLog.set(hostname, hostInfo);

    if (proxyIp && this.config.maxRequestsPerMinutePerIp) {
      const ipInfo = this.ipRequestLog.get(proxyIp) || { timestamps: [], lastRequestTime: 0, backoffUntil: 0 };
      ipInfo.timestamps.push(now);
      ipInfo.lastRequestTime = now;
      this.ipRequestLog.set(proxyIp, ipInfo);
    }
  }

  public initiateHostBackoff(hostname: string): void {
    if (!this.config.enabled) return;
    const now = this.getCurrentTimestamp();
    const hostInfo = this.hostRequestLog.get(hostname) || { timestamps: [], lastRequestTime: 0, backoffUntil: 0 };
    hostInfo.backoffUntil = now + this.config.hostBackoffMsOnError;
    this.hostRequestLog.set(hostname, hostInfo);
    this.logger.warn(`Host ${hostname} put into backoff until ${new Date(hostInfo.backoffUntil).toISOString()}`);
  }

  public initiateIpBackoff(proxyIp: string): void {
    if (!this.config.enabled || !this.config.maxRequestsPerMinutePerIp) return;
    const now = this.getCurrentTimestamp();
    const ipInfo = this.ipRequestLog.get(proxyIp) || { timestamps: [], lastRequestTime: 0, backoffUntil: 0 };
    ipInfo.backoffUntil = now + this.config.ipBackoffMsOnError;
    this.ipRequestLog.set(proxyIp, ipInfo);
    this.logger.warn(`IP ${proxyIp} put into backoff until ${new Date(ipInfo.backoffUntil).toISOString()}`);
  }

  public getState(): RateLimiterState {
    return {
      hostRequestLog: Array.from(this.hostRequestLog.entries()),
      ipRequestLog: Array.from(this.ipRequestLog.entries()),
    };
  }

  public loadState(state?: RateLimiterState): void {
    if (!state) return;
    this.hostRequestLog = new Map(state.hostRequestLog);
    this.ipRequestLog = new Map(state.ipRequestLog);
    this.logger.info('RateLimiter state loaded successfully.', {
      hostsTracked: this.hostRequestLog.size,
      ipsTracked: this.ipRequestLog.size
    });
  }
}
