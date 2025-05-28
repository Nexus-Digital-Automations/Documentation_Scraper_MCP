import { Page } from 'puppeteer';
import { ScrapingConfig } from '../config.js';
/**
 * Interface for extracted content results
 */
export interface ExtractedContent {
    type: 'text' | 'pdf';
    content: string;
    filePath: string;
    contentLength: number;
    extractedAt: string;
    sourceUrl: string;
}
/**
 * Comprehensive content extraction and output generation utility
 * Handles text extraction, PDF generation, and organized file output
 */
export declare class ContentExtractor {
    private config;
    private logger;
    private outputDirectories;
    constructor(config: ScrapingConfig);
    /**
     * Extract text content from page and save to organized file structure
     * Implements complete content extraction logic from original modules
     *
     * @param page - Puppeteer page instance to extract content from
     * @param url - Source URL for content identification and filename generation
     * @param customSelectors - Optional custom CSS selectors for extraction
     * @returns Promise<ExtractedContent> - Extracted content with metadata
     * @throws Error if extraction fails or content is invalid
     */
    extractAndSaveText(page: Page, url: string, customSelectors?: string[]): Promise<ExtractedContent>;
    /**
     * Generate PDF from page with customizable options
     * Preserves PDF generation functionality from original modules
     *
     * @param page - Puppeteer page instance to generate PDF from
     * @param url - Source URL for PDF identification and filename generation
     * @param customOptions - Optional custom PDF generation options
     * @returns Promise<ExtractedContent> - Generated PDF with metadata
     * @throws Error if PDF generation fails
     */
    generatePdfFromPage(page: Page, url: string, customOptions?: any): Promise<ExtractedContent>;
    /**
     * Extract content using CSS selectors with fallback strategies
     * Implements comprehensive selector-based extraction logic
     *
     * @param page - Puppeteer page instance to extract from
     * @param selectors - Array of CSS selectors to try for extraction
     * @returns Promise<string> - Extracted content text
     */
    private extractUsingSelectors;
    /**
     * Clean and sanitize extracted content for output
     * Removes unwanted characters and normalizes formatting
     *
     * @param content - Raw extracted content to clean
     * @returns string - Cleaned and sanitized content
     */
    private cleanExtractedContent;
    /**
     * Organize output file structure with proper directory creation
     * Ensures consistent directory structure for all output files
     */
    organizeOutputFiles(): Promise<void>;
    /**
     * Ensure directory exists with proper error handling
     * Creates directory recursively if it doesn't exist
     *
     * @param dirPath - Directory path to create
     */
    private ensureDirectoryExists;
    /**
     * Generate unique filename from URL with proper sanitization
     * Creates filesystem-safe filenames while maintaining URL identification
     *
     * @param url - Source URL to generate filename from
     * @param extension - File extension (without dot)
     * @returns string - Unique, filesystem-safe filename
     */
    private generateUniqueFilename;
    /**
     * Extract hostname for filename generation with sanitization
     * Converts hostname to filesystem-safe string
     *
     * @param url - URL to extract hostname from
     * @returns string - Sanitized hostname for filename use
     */
    private extractHostnameForFilename;
    /**
     * Get current extraction statistics for monitoring
     * Provides insights into extraction performance and output
     *
     * @returns Object containing extraction statistics
     */
    getExtractionStats(): object;
}
//# sourceMappingURL=contentExtractor.d.ts.map