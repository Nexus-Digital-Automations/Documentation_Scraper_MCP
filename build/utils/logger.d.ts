import { LoggingConfig } from '../config.js';
/**
 * Utility function to safely extract error message from unknown error types
 * Handles the TypeScript 4.4+ change where caught errors are typed as 'unknown'
 *
 * @param error - Error of unknown type from catch block
 * @returns string - Safe error message
 */
declare function getErrorMessage(error: unknown): string;
/**
 * Utility function to safely get error stack trace
 *
 * @param error - Error of unknown type from catch block
 * @returns string - Safe stack trace or empty string
 */
declare function getErrorStack(error: unknown): string;
export declare class Logger {
    private config;
    private defaultLogPath;
    constructor(config?: LoggingConfig);
    private ensureLogDirectoryExists;
    private rotateLogFile;
    private colorizeLogMessage;
    log(message: string, logPath: string, options?: {
        logLevel?: string;
        toConsole?: boolean;
        includeTimestamp?: boolean;
    }): void;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, data?: any): void;
    debug(message: string, data?: any): void;
    success(message: string, data?: any): void;
    createChildLogger(logPath: string, defaultOptions?: any): (message: string, options?: any) => void;
}
export declare const logger: Logger;
export { getErrorMessage, getErrorStack };
//# sourceMappingURL=logger.d.ts.map