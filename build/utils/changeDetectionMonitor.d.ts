import { Page } from 'puppeteer';
import { ChangeDetectionConfig } from '../config.js';
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
export declare class ChangeDetectionMonitor {
    private config;
    private logger;
    private snapshotsDir;
    constructor(config: ChangeDetectionConfig);
    detectChanges(page: Page, url: string): Promise<ChangeDetectionResult>;
    private captureSnapshot;
    private generateContentHash;
    private loadPreviousSnapshot;
    private saveSnapshot;
    private getSnapshotFilename;
    private calculateChangePercentage;
}
//# sourceMappingURL=changeDetectionMonitor.d.ts.map