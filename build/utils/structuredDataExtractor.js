// ============================================================================
// MODULE: structuredDataExtractor.ts
//
// PURPOSE:
// Comprehensive structured data extraction utility for converting web content
// into structured JSON/CSV formats. Enables extraction of specific data points
// from web pages into organized, structured formats for analysis and processing.
//
// DEPENDENCIES:
// - puppeteer: Browser automation and DOM interaction
// - fs/promises: File system operations for output generation
// - path: Path manipulation for organized output structure
// - ../config.js: Structured data extraction configuration and schema definitions
// - ./logger.js: Comprehensive logging system
//
// EXPECTED INTERFACES:
// - StructuredDataExtractor class with comprehensive extraction capabilities
// - Support for multiple extraction schemas and output formats
// - Data transformation and validation capabilities
// - Organized file output with JSON and CSV format support
//
// DESIGN PATTERNS:
// - Strategy pattern for different extraction approaches
// - Template method pattern for extraction pipeline
// - Factory pattern for output format generation
// - Builder pattern for data record construction
//
// SYSTEM INVARIANTS:
// - All extraction schemas must be validated before use
// - Required fields must be present or extraction fails
// - Data transformations must be applied consistently
// - Output files must be organized by schema and format
//
// NEGATIVE SPACE CONSIDERATIONS:
// - NEVER proceed with extraction without schema validation
// - NEVER ignore required field validation requirements
// - NEVER save invalid or incomplete structured data
// - NEVER create output files outside designated directories
// ============================================================================
import { Page } from 'puppeteer';
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
    async extractUsingSchema(page, schema) {
        try {
            if (schema.rootSelector) {
                return await this.extractListData(page, schema);
            }
            else {
                return await this.extractSingleRecord(page, schema);
            }
        }
        catch (error) {
            this.logger.error('Schema extraction failed', { schemaName: schema.name, error: getErrorMessage(error) });
            return null;
        }
    }
    async extractListData(page, schema) {
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
                            value = this.transformValue(value, field.transform);
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
}
async;
extractUsingSchema(page, Page, schema, StructuredDataSchema, url, string);
Promise < ExtractedStructuredData | null > {
    try: {
        // Clear previous validation errors
        this: .validationErrors = [],
        : .validateSchema(schema)
    }
};
{
    throw new Error(`Schema validation failed: ${this.validationErrors.join(', ')}`);
}
let extractedData;
let transformationSummary;
if (schema.rootSelector) {
    // Extract list of records
    const listResult = await this.extractListData(page, schema);
    extractedData = listResult.data;
    transformationSummary = listResult.transformationSummary;
}
else {
    // Extract single record
    const recordResult = await this.extractSingleRecord(page, schema);
    extractedData = recordResult.data;
    transformationSummary = recordResult.transformationSummary;
}
// Validate extracted data
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
    validationErrors: this.validationErrors.length > 0 ? [...this.validationErrors] : undefined,
    transformationSummary
};
try { }
catch (error) {
    this.logger.error('Schema extraction failed', {
        schemaName: schema.name,
        url,
        error: getErrorMessage(error)
    });
    return null;
}
async;
extractListData(page, Page, schema, StructuredDataSchema);
Promise < { data: any[], transformationSummary: TransformationSummary } > {
    try: {
        const: results = await page.evaluate((rootSelector, fields) => {
            const rootElements = document.querySelectorAll(rootSelector);
            const records = [];
            let transformationStats = {
                totalFields: 0,
                transformedFields: 0,
                skippedFields: 0,
                errorFields: 0,
                transformationTypes: {}
            };
            // Helper function for transformation inside evaluate
            const applyTransformation = (value, transformationType) => {
                switch (transformationType) {
                    case 'trim':
                        return value.trim();
                    case 'lowercase':
                        return value.toLowerCase();
                    case 'uppercase':
                        return value.toUpperCase();
                    case 'number':
                        const numValue = parseFloat(value.replace(/[^\d.-]/g, ''));
                        return isNaN(numValue) ? value : numValue;
                    case 'date':
                        const dateValue = new Date(value);
                        return isNaN(dateValue.getTime()) ? value : dateValue.toISOString();
                    default:
                        return value;
                }
            };
            rootElements.forEach(rootElement => {
                const record = {};
                let hasRequiredFields = true;
                fields.forEach((field) => {
                    transformationStats.totalFields++;
                    try {
                        const element = rootElement.querySelector(field.selector);
                        if (element) {
                            let value = field.attribute && field.attribute !== 'innerText'
                                ? element.getAttribute(field.attribute)
                                : element.textContent || element.innerText;
                            if (value !== null && value !== undefined) {
                                // Apply data transformation if specified
                                if (field.transform) {
                                    try {
                                        value = applyTransformation(value, field.transform);
                                        transformationStats.transformedFields++;
                                        transformationStats.transformationTypes[field.transform] =
                                            (transformationStats.transformationTypes[field.transform] || 0) + 1;
                                    }
                                    catch (transformError) {
                                        transformationStats.errorFields++;
                                        console.warn(`Transformation failed for field ${field.name}:`, transformError);
                                    }
                                }
                                record[field.name] = value;
                            }
                            else if (field.required) {
                                hasRequiredFields = false;
                                transformationStats.errorFields++;
                            }
                        }
                        else if (field.required) {
                            hasRequiredFields = false;
                            transformationStats.errorFields++;
                        }
                        else {
                            transformationStats.skippedFields++;
                        }
                    }
                    catch (fieldError) {
                        transformationStats.errorFields++;
                        console.warn(`Field extraction failed for ${field.name}:`, fieldError);
                    }
                });
                // Only include record if it has required fields and contains data
                if (hasRequiredFields && Object.keys(record).length > 0) {
                    records.push(record);
                }
            });
            return { records, transformationStats };
        }, schema.rootSelector, schema.fields),
        return: {
            data: results.records,
            transformationSummary: results.transformationStats
        }
    }, catch(error) {
        throw new Error(`List data extraction failed: ${getErrorMessage(error)}`);
    }
};
async;
extractSingleRecord(page, Page, schema, StructuredDataSchema);
Promise < { data: any, transformationSummary: TransformationSummary } > {
    try: {
        const: result = await page.evaluate((fields) => {
            const record = {};
            let transformationStats = {
                totalFields: 0,
                transformedFields: 0,
                skippedFields: 0,
                errorFields: 0,
                transformationTypes: {}
            };
            // Helper function for transformation inside evaluate
            const applyTransformation = (value, transformationType) => {
                switch (transformationType) {
                    case 'trim':
                        return value.trim();
                    case 'lowercase':
                        return value.toLowerCase();
                    case 'uppercase':
                        return value.toUpperCase();
                    case 'number':
                        const numValue = parseFloat(value.replace(/[^\d.-]/g, ''));
                        return isNaN(numValue) ? value : numValue;
                    case 'date':
                        const dateValue = new Date(value);
                        return isNaN(dateValue.getTime()) ? value : dateValue.toISOString();
                    default:
                        return value;
                }
            };
            fields.forEach((field) => {
                transformationStats.totalFields++;
                try {
                    if (field.isList) {
                        // Handle list fields
                        const elements = document.querySelectorAll(field.selector);
                        const values = [];
                        elements.forEach(element => {
                            let value = field.attribute && field.attribute !== 'innerText'
                                ? element.getAttribute(field.attribute)
                                : element.textContent || element.innerText;
                            if (value !== null && value !== undefined) {
                                if (field.transform) {
                                    try {
                                        value = applyTransformation(value, field.transform);
                                        transformationStats.transformedFields++;
                                        transformationStats.transformationTypes[field.transform] =
                                            (transformationStats.transformationTypes[field.transform] || 0) + 1;
                                    }
                                    catch (transformError) {
                                        transformationStats.errorFields++;
                                    }
                                }
                                values.push(value);
                            }
                        });
                        record[field.name] = values;
                    }
                    else {
                        // Handle single fields
                        const element = document.querySelector(field.selector);
                        if (element) {
                            let value = field.attribute && field.attribute !== 'innerText'
                                ? element.getAttribute(field.attribute)
                                : element.textContent || element.innerText;
                            if (value !== null && value !== undefined) {
                                if (field.transform) {
                                    try {
                                        value = applyTransformation(value, field.transform);
                                        transformationStats.transformedFields++;
                                        transformationStats.transformationTypes[field.transform] =
                                            (transformationStats.transformationTypes[field.transform] || 0) + 1;
                                    }
                                    catch (transformError) {
                                        transformationStats.errorFields++;
                                    }
                                }
                                record[field.name] = value;
                            }
                            else if (field.required) {
                                transformationStats.errorFields++;
                            }
                        }
                        else if (field.required) {
                            transformationStats.errorFields++;
                        }
                        else {
                            transformationStats.skippedFields++;
                        }
                    }
                }
                catch (fieldError) {
                    transformationStats.errorFields++;
                    console.warn(`Field extraction failed for ${field.name}:`, fieldError);
                }
            });
            return { record, transformationStats };
        }, schema.fields),
        return: {
            data: result.record,
            transformationSummary: result.transformationStats
        }
    }, catch(error) {
        throw new Error(`Single record extraction failed: ${getErrorMessage(error)}`);
    }
};
async;
generateOutputFiles(extractionResult, ExtractedStructuredData, schema, StructuredDataSchema);
Promise < string[] > {
    try: {
        const: outputFiles, string, []:  = [],
        const: outputFormat = schema.outputFormat || 'json',
        const: timestamp = Date.now(),
        const: sanitizedSchemaName = schema.name.replace(/[^a-zA-Z0-9_-]/g, '_'),
        // Generate JSON output
        if(outputFormat) { }
    } === 'json' || outputFormat === 'both'
};
{
    const jsonFilename = `${sanitizedSchemaName}_${timestamp}.json`;
    const jsonPath = path.join(this.outputDir, jsonFilename);
    const jsonOutput = {
        schema: {
            name: schema.name,
            description: schema.description
        },
        extraction: {
            sourceUrl: extractionResult.sourceUrl,
            extractedAt: extractionResult.extractedAt,
            recordCount: extractionResult.recordCount
        },
        data: extractionResult.data,
        transformationSummary: extractionResult.transformationSummary
    };
    await fs.writeFile(jsonPath, JSON.stringify(jsonOutput, null, 2), 'utf-8');
    outputFiles.push(jsonPath);
    this.logger.debug('JSON output file generated', {
        schemaName: schema.name,
        filePath: jsonPath,
        recordCount: extractionResult.recordCount
    });
}
// Generate CSV output
if (outputFormat === 'csv' || outputFormat === 'both') {
    const csvFilename = `${sanitizedSchemaName}_${timestamp}.csv`;
    const csvPath = path.join(this.outputDir, csvFilename);
    const csvContent = this.convertToCSV(extractionResult.data, schema.fields);
    await fs.writeFile(csvPath, csvContent, 'utf-8');
    outputFiles.push(csvPath);
    this.logger.debug('CSV output file generated', {
        schemaName: schema.name,
        filePath: csvPath,
        recordCount: extractionResult.recordCount
    });
}
return outputFiles;
try { }
catch (error) {
    this.logger.error('Output file generation failed', {
        schemaName: schema.name,
        error: getErrorMessage(error)
    });
    return [];
}
convertToCSV(data, any, fields, FieldExtractor[]);
string;
{
    try {
        if (!data) {
            return '';
        }
        const records = Array.isArray(data) ? data : [data];
        if (records.length === 0) {
            return '';
        }
        // Generate headers from field definitions
        const headers = fields.map(field => field.name);
        // Generate CSV rows
        const csvRows = [headers.join(',')];
        records.forEach(record => {
            const row = headers.map(header => {
                const value = record[header];
                if (value === null || value === undefined) {
                    return '';
                }
                // Handle arrays in CSV
                if (Array.isArray(value)) {
                    return `"${value.join('; ')}"`;
                }
                // Escape CSV special characters
                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            });
            csvRows.push(row.join(','));
        });
        return csvRows.join('\n');
    }
    catch (error) {
        this.logger.error('CSV conversion failed', { error: getErrorMessage(error) });
        return '';
    }
}
validateSchema(schema, StructuredDataSchema);
boolean;
{
    try {
        this.validationErrors = [];
        // Validate schema name
        if (!schema.name || schema.name.trim() === '') {
            this.validationErrors.push('Schema name is required');
        }
        // Validate fields
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
        // Validate output format
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
async;
ensureOutputDirectory();
Promise < void  > {
    try: {
        await, fs, : .mkdir(this.outputDir, { recursive: true })
    }, catch(error) {
        this.logger.error('Failed to create output directory', {
            outputDir: this.outputDir,
            error: getErrorMessage(error)
        });
        throw error;
    }
};
/**
 * Get extraction statistics for monitoring
 * Provides insights into extraction performance and results
 *
 * @returns Object with extraction statistics
 */
getExtractionStats();
object;
{
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
 * Should be called periodically during long-running operations
 */
clearCache();
void {
    this: .extractionCache.clear(),
    this: .validationErrors = [],
    this: .logger.debug('Extraction cache cleared')
};
//# sourceMappingURL=structuredDataExtractor.js.map