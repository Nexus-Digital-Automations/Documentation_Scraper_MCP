import { Page } from 'puppeteer';
import { PageInteractionConfig } from '../config.js';
/**
 * Advanced interaction handler for SPAs and complex web applications
 * Provides comprehensive interaction capabilities for dynamic content loading
 */
export declare class InteractionHandler {
    private config;
    private logger;
    private executionContext;
    constructor(config: PageInteractionConfig);
    /**
     * Execute load wait conditions after initial page load
     * Implements sophisticated wait strategies for SPA content loading
     *
     * @param page - Puppeteer page instance
     * @returns Promise<boolean> - True if all conditions satisfied successfully
     */
    executeLoadWaitConditions(page: Page): Promise<boolean>;
    /**
     * Execute post-click wait conditions
     * Handles state verification after user interactions
     *
     * @param page - Puppeteer page instance
     * @returns Promise<boolean> - True if all conditions satisfied successfully
     */
    executePostClickWaitConditions(page: Page): Promise<boolean>;
    /**
     * Execute custom interaction sequence by name
     * Supports complex multi-step interactions defined in configuration
     *
     * @param page - Puppeteer page instance
     * @param sequenceName - Name of the interaction sequence to execute
     * @returns Promise<boolean> - True if sequence executed successfully
     */
    executeCustomSequence(page: Page, sequenceName: string): Promise<boolean>;
    /**
     * Execute a single interaction step with comprehensive action support
     * Handles all interaction types with proper validation and error handling
     *
     * @param page - Puppeteer page instance
     * @param step - Interaction step to execute
     * @param contextId - Unique identifier for execution context
     * @returns Promise<boolean> - True if step executed successfully
     */
    private executeInteractionStep;
    /**
     * Execute scroll action with direction and distance control
     * Supports multiple scroll directions with precise distance control
     *
     * @param page - Puppeteer page instance
     * @param direction - Scroll direction (up, down, left, right)
     * @param distance - Distance to scroll in pixels
     */
    private executeScrollAction;
    /**
     * Validate JavaScript function safety for waitForFunction
     * Prevents execution of potentially dangerous JavaScript code
     *
     * @param functionCode - JavaScript function code to validate
     * @returns boolean - True if function is safe to execute
     */
    private isJavaScriptFunctionSafe;
    /**
     * Get execution context for debugging and monitoring
     * Provides insights into step execution history and failures
     *
     * @returns Map<string, any> - Execution context data
     */
    getExecutionContext(): Map<string, any>;
    /**
     * Clear execution context to prevent memory leaks
     * Should be called after processing is complete
     */
    clearExecutionContext(): void;
    /**
     * Get interaction handler statistics for monitoring
     * Provides insights into interaction execution performance
     *
     * @returns Object with interaction statistics
     */
    getInteractionStats(): object;
}
//# sourceMappingURL=interactionHandler.d.ts.map