// ============================================================================
// MODULE: contentExtractor.ts
//
// PURPOSE:
// Comprehensive content extraction and output generation utility preserving
// all content processing functionality from both original Python modules while
// adding enhanced extraction capabilities and multiple output format support.
//
// DEPENDENCIES:
// - puppeteer: Browser automation and page interaction
// - fs/promises: File system operations for content output
// - path: Path manipulation for organized output structure
// - ../config.js: Scraping configuration and content extraction settings
// - ./logger.js: Comprehensive logging system
//
// EXPECTED INTERFACES:
// - ContentExtractor class with text and PDF extraction methods
// - Content extraction using configurable CSS selectors
// - PDF generation with customizable options
// - Organized file output with directory structure management
// - Content cleaning and sanitization capabilities
//
// DESIGN PATTERNS:
// - Strategy pattern for different extraction approaches
// - Template method pattern for extraction pipeline
// - Factory pattern for output format generation
//
// SYSTEM INVARIANTS:
// - Content must be extracted using configured CSS selectors
// - Output directories must be created before file operations
// - Content must be sanitized before saving
// - File paths must be valid and within configured boundaries
//
// NEGATIVE SPACE CONSIDERATIONS:
// - NEVER save content without proper sanitization
// - NEVER create files outside configured output directories
// - NEVER proceed with extraction without valid page content
// - NEVER ignore content length or quality validation
// ============================================================================
import { promises as fs } from 'fs';
import path from 'path';
import { Logger, getErrorMessage } from './logger.js';
import { UrlUtils } from './urlUtils.js';
/**
 * Comprehensive content extraction and output generation utility
 * Handles text extraction, PDF generation, and organized file output
 */
export class ContentExtractor {
    config;
    logger;
    outputDirectories;
    constructor(config) {
        // Assert valid configuration
        if (!config) {
            throw new Error('ContentExtractor requires valid configuration');
        }
        if (!config.contentExtraction) {
            throw new Error('Content extraction configuration is required');
        }
        if (!config.outputBasePath) {
            throw new Error('Output base path configuration is required');
        }
        this.config = config;
        this.logger = new Logger();
        this.outputDirectories = new Set();
    }
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
    async extractAndSaveText(page, url, customSelectors) {
        try {
            // Assert valid page and URL
            if (!page) {
                throw new Error('Valid page instance is required for content extraction');
            }
            if (!url || !UrlUtils.isValidUrl(url)) {
                throw new Error('Valid URL is required for content extraction');
            }
            // Extract content using configured or custom selectors
            const selectors = customSelectors || this.config.contentExtraction.selectors;
            const extractedContent = await this.extractUsingSelectors(page, selectors);
            // Assert content extraction success
            if (!extractedContent || extractedContent.trim().length === 0) {
                throw new Error('No content extracted from page');
            }
            if (extractedContent.length < 50) {
                this.logger.log(`Warning: Extracted content is very short (${extractedContent.length} chars)`, '/tmp/content_extractor.log', { logLevel: 'WARN' });
            }
            // Clean and sanitize extracted content
            const cleanedContent = this.cleanExtractedContent(extractedContent);
            // Generate filename and save content
            const hostname = this.extractHostnameForFilename(url);
            const filename = this.generateUniqueFilename(url, 'txt');
            const textsDir = path.join(this.config.outputBasePath, 'texts');
            await this.ensureDirectoryExists(textsDir);
            const filePath = path.join(textsDir, filename);
            await fs.writeFile(filePath, cleanedContent, 'utf-8');
            this.logger.log(`Text content extracted and saved successfully`, '/tmp/content_extractor.log', { logLevel: 'SUCCESS' });
            return {
                type: 'text',
                content: cleanedContent,
                filePath,
                contentLength: cleanedContent.length,
                extractedAt: new Date().toISOString(),
                sourceUrl: url
            };
        }
        catch (error) {
            const errorMessage = getErrorMessage(error);
            this.logger.log(`Text extraction failed: ${errorMessage}`, '/tmp/content_extractor.log', { logLevel: 'ERROR' });
            throw new Error(`Text extraction failed for ${url}: ${errorMessage}`);
        }
    }
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
    async generatePdfFromPage(page, url, customOptions) {
        try {
            // Assert valid page and URL
            if (!page) {
                throw new Error('Valid page instance is required for PDF generation');
            }
            if (!url || !UrlUtils.isValidUrl(url)) {
                throw new Error('Valid URL is required for PDF generation');
            }
            // Prepare PDF options with defaults and overrides
            const pdfOptions = {
                ...this.config.contentExtraction.pdfOptions,
                ...customOptions
            };
            // Generate filename and ensure output directory
            const filename = this.generateUniqueFilename(url, 'pdf');
            const pdfsDir = path.join(this.config.outputBasePath, 'pdfs');
            await this.ensureDirectoryExists(pdfsDir);
            const filePath = path.join(pdfsDir, filename);
            // Generate PDF with configured options
            const pdfBuffer = await page.pdf({
                format: pdfOptions.format,
                printBackground: pdfOptions.printBackground,
                margin: pdfOptions.margin,
                path: filePath
            });
            // Assert PDF generation success
            if (!pdfBuffer || pdfBuffer.length === 0) {
                throw new Error('PDF generation produced empty file');
            }
            this.logger.log(`PDF generated successfully`, '/tmp/content_extractor.log', { logLevel: 'SUCCESS' });
            return {
                type: 'pdf',
                content: `PDF generated with ${pdfBuffer.length} bytes`,
                filePath,
                contentLength: pdfBuffer.length,
                extractedAt: new Date().toISOString(),
                sourceUrl: url
            };
        }
        catch (error) {
            const errorMessage = getErrorMessage(error);
            this.logger.log(`PDF generation failed: ${errorMessage}`, '/tmp/content_extractor.log', { logLevel: 'ERROR' });
            throw new Error(`PDF generation failed for ${url}: ${errorMessage}`);
        }
    }
    /**
     * Extract content using CSS selectors with fallback strategies
     * Implements comprehensive selector-based extraction logic
     *
     * @param page - Puppeteer page instance to extract from
     * @param selectors - Array of CSS selectors to try for extraction
     * @returns Promise<string> - Extracted content text
     */
    async extractUsingSelectors(page, selectors) {
        try {
            // Assert valid selectors array
            if (!selectors || selectors.length === 0) {
                throw new Error('CSS selectors array cannot be empty');
            }
            let extractedContent = '';
            // Try each selector until content is found
            for (const selector of selectors) {
                try {
                    const content = await page.evaluate((sel) => {
                        const elements = document.querySelectorAll(sel);
                        if (elements.length === 0)
                            return '';
                        // Extract text from all matching elements
                        let text = '';
                        elements.forEach(element => {
                            const elementText = element.textContent || element.innerText || '';
                            if (elementText.trim().length > 0) {
                                text += elementText.trim() + '\n\n';
                            }
                        });
                        return text.trim();
                    }, selector);
                    if (content && content.length > extractedContent.length) {
                        extractedContent = content;
                    }
                }
                catch (selectorError) {
                    this.logger.log(`Selector failed: ${selector} - ${getErrorMessage(selectorError)}`, '/tmp/content_extractor.log', { logLevel: 'DEBUG' });
                }
            }
            // Fallback to body content if no selectors worked
            if (!extractedContent || extractedContent.length < 100) {
                const bodyContent = await page.evaluate(() => {
                    return document.body?.textContent || document.body?.innerText || '';
                });
                if (bodyContent && bodyContent.length > extractedContent.length) {
                    extractedContent = bodyContent;
                }
            }
            return extractedContent;
        }
        catch (error) {
            throw new Error(`Selector-based extraction failed: ${getErrorMessage(error)}`);
        }
    }
    /**
     * Clean and sanitize extracted content for output
     * Removes unwanted characters and normalizes formatting
     *
     * @param content - Raw extracted content to clean
     * @returns string - Cleaned and sanitized content
     */
    cleanExtractedContent(content) {
        try {
            let cleaned = content;
            // Remove excessive whitespace and normalize line breaks
            cleaned = cleaned.replace(/\r\n/g, '\n');
            cleaned = cleaned.replace(/\r/g, '\n');
            cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
            cleaned = cleaned.replace(/[ \t]+/g, ' ');
            // Remove common unwanted patterns
            cleaned = cleaned.replace(/\s*Cookie\s*[Pp]olicy.*/gi, '');
            cleaned = cleaned.replace(/\s*Privacy\s*[Pp]olicy.*/gi, '');
            cleaned = cleaned.replace(/\s*Terms\s*of\s*[Ss]ervice.*/gi, '');
            cleaned = cleaned.replace(/\s*Accept\s*[Cc]ookies.*/gi, '');
            // Trim and ensure proper spacing
            cleaned = cleaned.trim();
            // Assert content quality
            if (cleaned.length < 10) {
                throw new Error('Cleaned content is too short to be meaningful');
            }
            return cleaned;
        }
        catch (error) {
            throw new Error(`Content cleaning failed: ${getErrorMessage(error)}`);
        }
    }
    /**
     * Organize output file structure with proper directory creation
     * Ensures consistent directory structure for all output files
     */
    async organizeOutputFiles() {
        try {
            const requiredDirectories = [
                this.config.outputBasePath,
                path.join(this.config.outputBasePath, 'texts'),
                path.join(this.config.outputBasePath, 'pdfs'),
                path.join(this.config.outputBasePath, 'logs')
            ];
            for (const dir of requiredDirectories) {
                await this.ensureDirectoryExists(dir);
            }
            this.logger.log(`Output directory structure organized successfully`, '/tmp/content_extractor.log', { logLevel: 'SUCCESS' });
        }
        catch (error) {
            const errorMessage = getErrorMessage(error);
            this.logger.log(`Output organization failed: ${errorMessage}`, '/tmp/content_extractor.log', { logLevel: 'ERROR' });
            throw new Error(`Output organization failed: ${errorMessage}`);
        }
    }
    /**
     * Ensure directory exists with proper error handling
     * Creates directory recursively if it doesn't exist
     *
     * @param dirPath - Directory path to create
     */
    async ensureDirectoryExists(dirPath) {
        try {
            // Assert valid directory path
            if (!dirPath || dirPath.trim() === '') {
                throw new Error('Directory path cannot be empty');
            }
            if (!this.outputDirectories.has(dirPath)) {
                await fs.mkdir(dirPath, { recursive: true });
                this.outputDirectories.add(dirPath);
            }
        }
        catch (error) {
            throw new Error(`Directory creation failed for ${dirPath}: ${getErrorMessage(error)}`);
        }
    }
    /**
     * Generate unique filename from URL with proper sanitization
     * Creates filesystem-safe filenames while maintaining URL identification
     *
     * @param url - Source URL to generate filename from
     * @param extension - File extension (without dot)
     * @returns string - Unique, filesystem-safe filename
     */
    generateUniqueFilename(url, extension) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.replace(/\./g, '_');
            const pathname = urlObj.pathname
                .replace(/\//g, '_')
                .replace(/[^a-zA-Z0-9_-]/g, '')
                .substring(0, 50); // Limit length
            const timestamp = Date.now();
            const filename = `${hostname}${pathname}_${timestamp}.${extension}`;
            // Assert filename validity
            if (filename.length > 200) {
                return `${hostname}_${timestamp}.${extension}`;
            }
            return filename;
        }
        catch (error) {
            // Fallback to simple timestamp-based filename
            const timestamp = Date.now();
            return `content_${timestamp}.${extension}`;
        }
    }
    /**
     * Extract hostname for filename generation with sanitization
     * Converts hostname to filesystem-safe string
     *
     * @param url - URL to extract hostname from
     * @returns string - Sanitized hostname for filename use
     */
    extractHostnameForFilename(url) {
        try {
            const hostname = UrlUtils.extractHostname(url);
            if (!hostname) {
                return 'unknown_host';
            }
            return hostname.replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        }
        catch (error) {
            return 'unknown_host';
        }
    }
    /**
     * Get current extraction statistics for monitoring
     * Provides insights into extraction performance and output
     *
     * @returns Object containing extraction statistics
     */
    getExtractionStats() {
        return {
            outputDirectories: Array.from(this.outputDirectories),
            configuration: {
                outputBasePath: this.config.outputBasePath,
                selectors: this.config.contentExtraction.selectors,
                pdfFormat: this.config.contentExtraction.pdfOptions.format,
                selectorCount: this.config.contentExtraction.selectors.length
            }
        };
    }
}
//# sourceMappingURL=contentExtractor.js.map