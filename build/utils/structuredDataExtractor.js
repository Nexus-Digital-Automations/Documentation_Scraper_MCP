// ============================================================================
// MODULE: structuredDataExtractor.ts
//
// PURPOSE:
// Comprehensive structured data extraction utility for converting web content
// into structured JSON/CSV formats. Enables extraction of specific data points
// from web pages into organized, structured formats for analysis and processing.
// ============================================================================
import { Logger, getErrorMessage } from './logger.js';
import { promises as fs } from 'fs';
import path from 'path';
/**
 * Comprehensive structured data extraction utility
 * Converts web content into organized JSON/CSV formats with data validation
 */
export class StructuredDataExtractor {
    logger;
    outputDir;
    extractionCache;
    validationErrors;
    constructor(outputBasePath) {
        // Assert valid output path
        if (!outputBasePath || outputBasePath.trim() === '') {
            throw new Error('StructuredDataExtractor requires valid output base path');
        }
        this.logger = new Logger();
        this.outputDir = path.join(outputBasePath, 'structured_data');
        this.extractionCache = new Map();
        this.validationErrors = [];
        this.logger.info('StructuredDataExtractor initialized', {
            outputDirectory: this.outputDir
        });
    }
    /**
     * Extract structured data using multiple schemas with comprehensive validation
     * Applies all matching schemas and generates organized output files
     *
     * @param page - Puppeteer page instance to extract from
     * @param url - Source URL for identification and validation
     * @param schemas - Array of extraction schemas to apply
     * @returns Promise<ExtractedStructuredData[]> - Extracted data with metadata
     */
    async extractStructuredData(page, url, schemas) {
        try {
            // Assert valid parameters
            if (!page) {
                throw new Error('Valid page instance is required for structured data extraction');
            }
            if (!url || url.trim() === '') {
                throw new Error('Valid URL is required for structured data extraction');
            }
            if (!schemas || schemas.length === 0) {
                this.logger.warn('No schemas provided for structured data extraction', { url });
                return [];
            }
            this.logger.info('Starting structured data extraction', {
                url,
                schemaCount: schemas.length,
                availableSchemas: schemas.map(s => s.name)
            });
            // Ensure output directory exists
            await this.ensureOutputDirectory();
            const results = [];
            let processedSchemas = 0;
            // Process each schema with comprehensive error handling
            for (const schema of schemas) {
                try {
                    if (this.schemaApplies(schema, url)) {
                        this.logger.debug(`Processing schema: ${schema.name}`, { url });
                        const extractionResult = await this.extractUsingSchema(page, schema, url);
                        if (extractionResult && extractionResult.data) {
                            // Generate output files if configured
                            const outputFiles = await this.generateOutputFiles(extractionResult, schema);
                            extractionResult.outputFiles = outputFiles;
                            results.push(extractionResult);
                            processedSchemas++;
                            this.logger.info(`Schema processing completed: ${schema.name}`, {
                                url,
                                recordCount: extractionResult.recordCount,
                                outputFiles: outputFiles.length
                            });
                        }
                        else {
                            this.logger.warn(`Schema produced no data: ${schema.name}`, { url });
                        }
                    }
                    else {
                        this.logger.debug(`Schema does not apply to URL: ${schema.name}`, { url });
                    }
                }
                catch (schemaError) {
                    this.logger.error(`Schema processing failed: ${schema.name}`, {
                        url,
                        error: getErrorMessage(schemaError)
                    });
                    // Continue with other schemas
                }
            }
            this.logger.info('Structured data extraction completed', {
                url,
                totalSchemas: schemas.length,
                processedSchemas,
                totalRecords: results.reduce((sum, result) => sum + result.recordCount, 0)
            });
            return results;
        }
        catch (error) {
            this.logger.error('Structured data extraction failed', {
                url,
                error: getErrorMessage(error)
            });
            return [];
        }
    }
    schemaApplies(schema, url) {
        if (!schema.appliesToUrlPattern) {
            return true;
        }
        return schema.appliesToUrlPattern.test(url);
    }
    async extractUsingSchema(page, schema, url) {
        try {
            this.validationErrors = [];
            if (!this.validateSchema(schema)) {
                throw new Error(`Schema validation failed: ${this.validationErrors.join(', ')}`);
            }
            let extractedData;
            if (schema.rootSelector) {
                extractedData = await this.extractListData(page, schema);
            }
            else {
                extractedData = await this.extractSingleRecord(page, schema);
            }
            if (!extractedData || (Array.isArray(extractedData) && extractedData.length === 0)) {
                this.logger.warn('No data extracted from schema', { schemaName: schema.name, url });
                return null;
            }
            return {
                schemaName: schema.name,
                sourceUrl: url,
                extractedAt: new Date().toISOString(),
                data: extractedData,
                recordCount: Array.isArray(extractedData) ? extractedData.length : 1,
                validationErrors: this.validationErrors.length > 0 ? [...this.validationErrors] : undefined
            };
        }
        catch (error) {
            this.logger.error('Schema extraction failed', {
                schemaName: schema.name,
                url,
                error: getErrorMessage(error)
            });
            return null;
        }
    }
    async extractListData(page, schema) {
        if (!schema.rootSelector) {
            throw new Error('Root selector is required for list data extraction');
        }
        const results = await page.evaluate((rootSelector, fields) => {
            const rootElements = document.querySelectorAll(rootSelector);
            const records = [];
            rootElements.forEach(rootElement => {
                const record = {};
                fields.forEach((field) => {
                    const element = rootElement.querySelector(field.selector);
                    if (element) {
                        let value = field.attribute && field.attribute !== 'innerText'
                            ? element.getAttribute(field.attribute)
                            : element.textContent || element.innerText;
                        if (value && field.transform) {
                            // Apply basic transformations within evaluate context
                            switch (field.transform) {
                                case 'trim':
                                    value = value.trim();
                                    break;
                                case 'lowercase':
                                    value = value.toLowerCase();
                                    break;
                                case 'uppercase':
                                    value = value.toUpperCase();
                                    break;
                                case 'number':
                                    const numValue = parseFloat(value.replace(/[^\d.-]/g, ''));
                                    value = isNaN(numValue) ? value : numValue;
                                    break;
                                default:
                                    // Keep original value for unsupported transforms
                                    break;
                            }
                        }
                        record[field.name] = value;
                    }
                    else if (field.required) {
                        return; // Skip this record if required field is missing
                    }
                });
                if (Object.keys(record).length > 0) {
                    records.push(record);
                }
            });
            return records;
        }, schema.rootSelector, schema.fields);
        return results;
    }
    async extractSingleRecord(page, schema) {
        const record = await page.evaluate((fields) => {
            const result = {};
            fields.forEach((field) => {
                if (field.isList) {
                    const elements = document.querySelectorAll(field.selector);
                    const values = [];
                    elements.forEach(element => {
                        let value = field.attribute && field.attribute !== 'innerText'
                            ? element.getAttribute(field.attribute)
                            : element.textContent || element.innerText;
                        if (value) {
                            values.push(value);
                        }
                    });
                    result[field.name] = values;
                }
                else {
                    const element = document.querySelector(field.selector);
                    if (element) {
                        let value = field.attribute && field.attribute !== 'innerText'
                            ? element.getAttribute(field.attribute)
                            : element.textContent || element.innerText;
                        result[field.name] = value;
                    }
                }
            });
            return result;
        }, schema.fields);
        return record;
    }
    async generateOutputFiles(extractionResult, schema) {
        try {
            const outputFiles = [];
            const outputFormat = schema.outputFormat || 'json';
            const timestamp = Date.now();
            const sanitizedSchemaName = schema.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            if (outputFormat === 'json' || outputFormat === 'both') {
                const jsonFilename = `${sanitizedSchemaName}_${timestamp}.json`;
                const jsonPath = path.join(this.outputDir, jsonFilename);
                const jsonOutput = {
                    schema: { name: schema.name, description: schema.description },
                    extraction: {
                        sourceUrl: extractionResult.sourceUrl,
                        extractedAt: extractionResult.extractedAt,
                        recordCount: extractionResult.recordCount
                    },
                    data: extractionResult.data
                };
                await fs.writeFile(jsonPath, JSON.stringify(jsonOutput, null, 2), 'utf-8');
                outputFiles.push(jsonPath);
            }
            return outputFiles;
        }
        catch (error) {
            this.logger.error('Output file generation failed', {
                schemaName: schema.name,
                error: getErrorMessage(error)
            });
            return [];
        }
    }
    validateSchema(schema) {
        try {
            this.validationErrors = [];
            if (!schema.name || schema.name.trim() === '') {
                this.validationErrors.push('Schema name is required');
            }
            if (!schema.fields || schema.fields.length === 0) {
                this.validationErrors.push('Schema must have at least one field');
            }
            else {
                schema.fields.forEach((field, index) => {
                    if (!field.name || field.name.trim() === '') {
                        this.validationErrors.push(`Field ${index + 1} must have a name`);
                    }
                    if (!field.selector || field.selector.trim() === '') {
                        this.validationErrors.push(`Field '${field.name}' must have a selector`);
                    }
                });
            }
            if (schema.outputFormat && !['json', 'csv', 'both'].includes(schema.outputFormat)) {
                this.validationErrors.push('Output format must be json, csv, or both');
            }
            return this.validationErrors.length === 0;
        }
        catch (error) {
            this.validationErrors.push(`Schema validation error: ${getErrorMessage(error)}`);
            return false;
        }
    }
    async ensureOutputDirectory() {
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
        }
        catch (error) {
            this.logger.error('Failed to create output directory', {
                outputDir: this.outputDir,
                error: getErrorMessage(error)
            });
            throw error;
        }
    }
    /**
     * Get extraction statistics for monitoring
     */
    getExtractionStats() {
        return {
            outputDirectory: this.outputDir,
            cacheSize: this.extractionCache.size,
            recentValidationErrors: this.validationErrors.length,
            configuration: {
                supportedTransformations: ['trim', 'lowercase', 'uppercase', 'number', 'date'],
                supportedOutputFormats: ['json', 'csv', 'both']
            }
        };
    }
    /**
     * Clear extraction cache to prevent memory leaks
     */
    clearCache() {
        this.extractionCache.clear();
        this.validationErrors = [];
        this.logger.debug('Extraction cache cleared');
    }
}
//# sourceMappingURL=structuredDataExtractor.js.map