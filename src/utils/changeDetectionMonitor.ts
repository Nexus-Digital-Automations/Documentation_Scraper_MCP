import { Page } from 'puppeteer';
import { ChangeDetectionConfig } from '../config.js';
import { Logger, getErrorMessage } from './logger.js';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface ContentSnapshot {
  url: string;
  contentHash: string;
  capturedAt: string;
  contentLength: number;
  selectors: string[];
}

export interface ChangeDetectionResult {
  url: string;
  hasChanged: boolean;
  changePercentage?: number;
  previousSnapshot?: ContentSnapshot;
  currentSnapshot: ContentSnapshot;
}

export class ChangeDetectionMonitor {
  private config: ChangeDetectionConfig;
  private logger: Logger;
  private snapshotsDir: string;

  constructor(config: ChangeDetectionConfig) {
    if (!config.enabled) {
      throw new Error('Change detection is not enabled');
    }
    this.config = config;
    this.logger = new Logger();
    this.snapshotsDir = config.storagePath || '/tmp/change_detection';
  }

  async detectChanges(page: Page, url: string): Promise<ChangeDetectionResult> {
    try {
      const currentSnapshot = await this.captureSnapshot(page, url);
      const previousSnapshot = await this.loadPreviousSnapshot(url);
      
      if (!previousSnapshot) {
        await this.saveSnapshot(currentSnapshot);
        return { url, hasChanged: false, currentSnapshot };
      }

      const hasChanged = currentSnapshot.contentHash !== previousSnapshot.contentHash;
      let changePercentage = 0;
      
      if (hasChanged) {
        changePercentage = this.calculateChangePercentage(
          previousSnapshot.contentLength, 
          currentSnapshot.contentLength
        );
      }

      return { url, hasChanged, changePercentage, previousSnapshot, currentSnapshot };
    } catch (error) {
      this.logger.error('Change detection failed', { error: getErrorMessage(error), url });
      throw error;
    }
  }

  private async captureSnapshot(page: Page, url: string): Promise<ContentSnapshot> {
    try {
      const selectors = this.config.monitoringSelectors || ['main', '.content', '.article'];
      const excludeSelectors = this.config.excludeFromHashing || [];
      
      let allContent = '';
      
      for (const selector of selectors) {
        try {
          const content = await page.evaluate((sel, exclude) => {
            const elements = document.querySelectorAll(sel);
            let text = '';
            
            elements.forEach(element => {
              // Skip elements that match exclude selectors
              const shouldExclude = exclude.some((excludeSel: string) => {
                return element.querySelector(excludeSel) || element.matches(excludeSel);
              });
              
              if (!shouldExclude) {
                const elementText = element.textContent || (element as HTMLElement).innerText || '';
                if (elementText.trim().length > 0) {
                  text += elementText.trim() + '\n';
                }
              }
            });
            
            return text.trim();
          }, selector, excludeSelectors);
          
          if (content) {
            allContent += content + '\n';
          }
        } catch (selectorError) {
          this.logger.debug('Selector failed during snapshot capture', { 
            selector, 
            error: getErrorMessage(selectorError) 
          });
        }
      }
      
      const contentHash = this.generateContentHash(allContent);
      
      return {
        url,
        contentHash,
        capturedAt: new Date().toISOString(),
        contentLength: allContent.length,
        selectors
      };
    } catch (error) {
      throw new Error(`Snapshot capture failed: ${getErrorMessage(error)}`);
    }
  }

  private generateContentHash(content: string): string {
    const algorithm = this.config.hashAlgorithm || 'sha256';
    return crypto.createHash(algorithm).update(content, 'utf8').digest('hex');
  }

  private async loadPreviousSnapshot(url: string): Promise<ContentSnapshot | null> {
    try {
      const filename = this.getSnapshotFilename(url);
      const filePath = path.join(this.snapshotsDir, filename);
      
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null; // No previous snapshot exists
    }
  }

  private async saveSnapshot(snapshot: ContentSnapshot): Promise<void> {
    try {
      await fs.mkdir(this.snapshotsDir, { recursive: true });
      
      const filename = this.getSnapshotFilename(snapshot.url);
      const filePath = path.join(this.snapshotsDir, filename);
      
      await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Failed to save snapshot', { 
        url: snapshot.url, 
        error: getErrorMessage(error) 
      });
    }
  }

  private getSnapshotFilename(url: string): string {
    const urlHash = crypto.createHash('md5').update(url).digest('hex');
    return `snapshot_${urlHash}.json`;
  }

  private calculateChangePercentage(oldLength: number, newLength: number): number {
    if (oldLength === 0) return newLength > 0 ? 100 : 0;
    return Math.abs((newLength - oldLength) / oldLength) * 100;
  }
}
