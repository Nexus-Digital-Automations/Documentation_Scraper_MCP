import { Page } from 'puppeteer';
import { StructuredDataSchema } from '../config.js';
/**
 * Interface for data transformation summary
 */
export interface TransformationSummary {
    totalFields: number;
    transformedFields: number;
    skippedFields: number;
    errorFields: number;
    transformationTypes: Record<string, number>;
}
/**
 * Interface for structured data extraction results
 */
export interface ExtractedStructuredData {
    schemaName: string;
    sourceUrl: string;
    extractedAt: string;
    data: any;
    recordCount: number;
    outputFiles?: string[];
    validationErrors?: string[];
    transformationSummary?: TransformationSummary;
}
/**
 * Comprehensive structured data extraction utility
 * Converts web content into organized JSON/CSV formats with data validation
 */
export declare class StructuredDataExtractor {
    private logger;
    private outputDir;
    private extractionCache;
    private validationErrors;
    constructor(outputBasePath: string);
    /**
     * Extract structured data using multiple schemas with comprehensive validation
     * Applies all matching schemas and generates organized output files
     *
     * @param page - Puppeteer page instance to extract from
     * @param url - Source URL for identification and validation
     * @param schemas - Array of extraction schemas to apply
     * @returns Promise<ExtractedStructuredData[]> - Extracted data with metadata
     */
    extractStructuredData(page: Page, url: string, schemas: StructuredDataSchema[]): Promise<ExtractedStructuredData[]>;
    private schemaApplies;
    private extractUsingSchema;
    private extractListData;
    private extractSingleRecord;
}
//# sourceMappingURL=structuredDataExtractor.d.ts.map