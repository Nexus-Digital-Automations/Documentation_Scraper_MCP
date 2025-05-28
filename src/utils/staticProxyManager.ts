// ============================================================================
// MODULE: utils/staticProxyManager.ts
// PURPOSE: Static proxy management for Rayobyte integration
// ============================================================================

import { ProxyConfig } from '../config.js';
import { Logger, getErrorMessage } from './logger.js';
import { StaticProxyManagerState } from '../types/state.js';

interface StaticProxyInfo {
  url: string;
  lastUsed: number;
  // Could add usageCount, errorCount, isRestingUntil timestamp etc.
}

/**
 * Static proxy manager for Rayobyte static IP integration
 * Manages IP assignment strategies and rotation for consistent scraping
 */
export class StaticProxyManager {
  private logger: Logger;
  private config: ProxyConfig;
  private proxies: StaticProxyInfo[];
  private hostToIpMap: Map<string, string>; // hostname -> proxyUrl
  private currentIpIndex: number; // For 'sequentialCycle'

  constructor(proxyConfig: ProxyConfig, logger?: Logger) {
    if (!proxyConfig) {
      throw new Error('StaticProxyManager requires valid proxy configuration');
    }

    this.config = proxyConfig;
    this.logger = logger || new Logger();
    this.proxies = this.config.staticProxies.map(url => ({ url, lastUsed: 0 }));
    this.hostToIpMap = new Map();
    this.currentIpIndex = 0;

    if (this.proxies.length === 0) {
      this.logger.warn('StaticProxyManager initialized with NO static proxies. Using direct connection.');
    } else {
      this.logger.info(`StaticProxyManager initialized with ${this.proxies.length} static IPs. Strategy: ${this.config.assignmentStrategy || 'stickyByHost'}`);
    }
  }

  public hasProxies(): boolean {
    return this.proxies.length > 0;
  }

  /**
   * Gets a static proxy for a given hostname based on the assignment strategy.
   */
  public getProxyForHost(hostname: string): string | undefined {
    if (!this.hasProxies()) {
      return undefined; // No proxies configured, use direct connection
    }

    const strategy = this.config.assignmentStrategy || 'stickyByHost';

    if (strategy === 'stickyByHost') {
      if (this.hostToIpMap.has(hostname)) {
        const assignedIp = this.hostToIpMap.get(hostname)!;
        this.logger.debug(`Using sticky IP ${assignedIp} for host ${hostname}`);
        return assignedIp;
      } else {
        // Assign a new IP to this host (e.g., least recently used or round-robin)
        // For simplicity, using round-robin for new host assignments
        const assignedIp = this.getNextSequentialProxy();
        this.hostToIpMap.set(hostname, assignedIp.url);
        this.logger.info(`Assigned new sticky IP ${assignedIp.url} to host ${hostname}`);
        return assignedIp.url;
      }
    } else if (strategy === 'sequentialCycle') {
      const proxyInfo = this.getNextSequentialProxy();
      this.logger.debug(`Using sequential IP ${proxyInfo.url} for host ${hostname}`);
      return proxyInfo.url;
    }

    this.logger.warn(`Unknown proxy assignment strategy: ${strategy}. Defaulting to no proxy.`);
    return undefined;
  }

  private getNextSequentialProxy(): StaticProxyInfo {
    const proxyInfo = this.proxies[this.currentIpIndex];
    this.currentIpIndex = (this.currentIpIndex + 1) % this.proxies.length;
    proxyInfo.lastUsed = Date.now();
    return proxyInfo;
  }

  /**
   * Call this if an IP is confirmed bad (e.g., Rayobyte says it's blocked, or consistent errors)
   */
  public reportPermanentIpFailure(proxyUrl: string): void {
    this.logger.error(`Static IP ${proxyUrl} reported as permanently failing. Manual check with Rayobyte may be needed.`);
    
    // Remove from hostToIpMap if it was assigned
    for (const [host, ip] of this.hostToIpMap.entries()) {
        if (ip === proxyUrl) {
            this.hostToIpMap.delete(host);
            this.logger.info(`Removed failed IP ${proxyUrl} assignment from host ${host}. It will get a new IP on next request.`);
        }
    }
  }

  public getState(): StaticProxyManagerState {
    return {
      hostToIpMap: Array.from(this.hostToIpMap.entries()),
      currentIpIndex: this.currentIpIndex,
    };
  }

  public loadState(state?: StaticProxyManagerState): void {
    if (!state) return;
    this.hostToIpMap = new Map(state.hostToIpMap);
    this.currentIpIndex = state.currentIpIndex || 0;
    this.logger.info('StaticProxyManager state loaded successfully.', {
      hostMappings: this.hostToIpMap.size,
      currentIndex: this.currentIpIndex
    });
  }
}
