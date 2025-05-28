// ============================================================================
// MODULE: logger.ts
//
// PURPOSE:
// Comprehensive logging utility with proper error handling and type safety.
// Preserves all functionality from both original Python modules while adding
// enhanced TypeScript error handling capabilities.
//
// DEPENDENCIES:
// - fs: File system operations for log file management
// - path: Path manipulation for log directory management
// - ../config.js: Logging configuration and settings
//
// DESIGN PATTERNS:
// - Singleton pattern for global logger access
// - Strategy pattern for different log output formats
// - Factory pattern for child logger creation
//
// SYSTEM INVARIANTS:
// - Log directories must exist before writing log files
// - Log file rotation must occur when size thresholds are exceeded
// - Error messages must be properly formatted and type-safe
//
// NEGATIVE SPACE CONSIDERATIONS:
// - NEVER log without proper error handling
// - NEVER create log files in non-existent directories
// - NEVER ignore log rotation requirements
// - NEVER expose sensitive information in log messages
// ============================================================================

import fs from 'fs';
import path from 'path';
import { LOGGING_CONFIG, LoggingConfig } from '../config.js';

/**
 * Utility function to safely extract error message from unknown error types
 * Handles the TypeScript 4.4+ change where caught errors are typed as 'unknown'
 * 
 * @param error - Error of unknown type from catch block
 * @returns string - Safe error message
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error occurred';
}

/**
 * Utility function to safely get error stack trace
 * 
 * @param error - Error of unknown type from catch block
 * @returns string - Safe stack trace or empty string
 */
function getErrorStack(error: unknown): string {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return '';
}

export class Logger {
  private config: LoggingConfig;
  private defaultLogPath: string = '/tmp/documentation_scraper.log';
  
  constructor(config: LoggingConfig = LOGGING_CONFIG) { 
    this.config = config; 
  }

  private ensureLogDirectoryExists(logPath: string): void {
    try {
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) { fs.mkdirSync(logDir, { recursive: true }); }
    } catch (error) { 
      console.error(`Failed to create log directory: ${getErrorMessage(error)}`);
    }
  }

  private rotateLogFile(logPath: string): void {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const archiveDir = path.join(path.dirname(logPath), 'archive');
      if (!fs.existsSync(archiveDir)) { fs.mkdirSync(archiveDir, { recursive: true }); }
      const archiveFileName = `${path.basename(logPath)}_${timestamp}`;
      const archivePath = path.join(archiveDir, archiveFileName);
      fs.renameSync(logPath, archivePath);
    } catch (error) { 
      console.error(`Log rotation failed: ${getErrorMessage(error)}`);
    }
  }

  private colorizeLogMessage(logLevel: string, message: string): string {
    if (!this.config.colorOutput) return message;
    const colors = { INFO: '\x1b[36m', WARN: '\x1b[33m', ERROR: '\x1b[31m', DEBUG: '\x1b[35m', SUCCESS: '\x1b[32m' };
    const resetColor = '\x1b[0m';
    const color = colors[logLevel.toUpperCase() as keyof typeof colors] || '\x1b[0m';
    return `${color}${message}${resetColor}`;
  }

  public log(message: string, logPath: string, options: { 
    logLevel?: string; toConsole?: boolean; includeTimestamp?: boolean 
  } = {}): void {
    const { logLevel = 'INFO', toConsole = true, includeTimestamp = true } = options;
    try {
      this.ensureLogDirectoryExists(logPath);
      if (fs.existsSync(logPath) && fs.statSync(logPath).size > this.config.maxLogFileSize) {
        this.rotateLogFile(logPath);
      }
      const timestamp = includeTimestamp ? `[${new Date().toISOString()}]` : '';
      const logEntry = `${timestamp} [${logLevel}] ${message}\n`;
      fs.appendFileSync(logPath, logEntry);
      if (toConsole) { console.log(this.colorizeLogMessage(logLevel, logEntry.trim())); }
    } catch (error) { 
      console.error(`Logging failed: ${getErrorMessage(error)}`);
    }
  }

  // Convenience methods that other modules expect
  public info(message: string, data?: any): void {
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    this.log(logMessage, this.defaultLogPath, { logLevel: 'INFO' });
  }

  public warn(message: string, data?: any): void {
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    this.log(logMessage, this.defaultLogPath, { logLevel: 'WARN' });
  }

  public error(message: string, data?: any): void {
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    this.log(logMessage, this.defaultLogPath, { logLevel: 'ERROR' });
  }

  public debug(message: string, data?: any): void {
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    this.log(logMessage, this.defaultLogPath, { logLevel: 'DEBUG' });
  }

  public success(message: string, data?: any): void {
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    this.log(logMessage, this.defaultLogPath, { logLevel: 'SUCCESS' });
  }

  public createChildLogger(logPath: string, defaultOptions: any = {}): (message: string, options?: any) => void {
    return (message: string, options: any = {}) => { this.log(message, logPath, { ...defaultOptions, ...options }); };
  }
}

export const logger = new Logger();

// Export error handling utilities for use by other modules
export { getErrorMessage, getErrorStack };