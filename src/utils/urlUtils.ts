// URL utilities preserving all functionality from both modules
import { URL } from 'url';

export class UrlUtils {
  static normalizeUrl(inputUrl: string): string | null {
    try {
      let url = inputUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) { url = `https://${url}`; }
      const parsed = new URL(url);
      const normalizedUrl = parsed.origin + parsed.pathname.replace(/\/$/, '') + parsed.search;
      return this.isValidUrl(normalizedUrl) ? normalizedUrl : null;
    } catch { return null; }
  }

  static isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch { return false; }
  }

  static extractHostname(url: string): string | null {
    try { return new URL(url).hostname; } catch { return null; }
  }

  static resolveAbsoluteUrl(url: string, baseUrl: string): string | null {
    try {
      const base = new URL(baseUrl);
      const absolute = new URL(url, base);
      return absolute.href;
    } catch { return null; }
  }

  static cleanUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'ref', 'fbclid', 'gclid', 'pk_campaign', 'pk_kwd', 'zanpid', 'origin'
      ];
      trackingParams.forEach(param => parsedUrl.searchParams.delete(param));
      return parsedUrl.origin + parsedUrl.pathname.replace(/\/$/, '') + 
             (parsedUrl.search ? parsedUrl.search : '');
    } catch { return url; }
  }

  static areUrlsSimilar(url1: string, url2: string): boolean {
    try {
      const normalizedUrl1 = this.normalizeUrl(url1);
      const normalizedUrl2 = this.normalizeUrl(url2);
      if (!normalizedUrl1 || !normalizedUrl2) return false;
      const parsedUrl1 = new URL(normalizedUrl1);
      const parsedUrl2 = new URL(normalizedUrl2);
      return parsedUrl1.hostname === parsedUrl2.hostname && parsedUrl1.pathname === parsedUrl2.pathname;
    } catch { return false; }
  }
}