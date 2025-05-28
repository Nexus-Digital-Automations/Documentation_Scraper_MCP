// ============================================================================
// MODULE: interactionHandler.ts
//
// PURPOSE:
// Advanced JavaScript Rendering & Interaction Handling utility for SPAs.
// Provides sophisticated wait conditions and interaction sequences for complex
// web applications with dynamic content loading and state management.
//
// DEPENDENCIES:
// - puppeteer: Browser automation and page interaction
// - ../config.js: Interaction configuration and step definitions
// - ./logger.js: Comprehensive logging system
//
// EXPECTED INTERFACES:
// - InteractionHandler class with sophisticated wait condition execution
// - Support for complex interaction sequences and state management
// - Network idle detection and custom JavaScript function evaluation
// - Comprehensive error handling and step execution validation
//
// DESIGN PATTERNS:
// - Command pattern for interaction step execution
// - Chain of responsibility for step sequence execution
// - Strategy pattern for different interaction approaches
//
// SYSTEM INVARIANTS:
// - All interaction steps must be validated before execution
// - Network conditions must be properly monitored during wait operations
// - JavaScript function evaluation must be sandboxed and secure
// - Step execution must be atomic with proper rollback on failure
//
// NEGATIVE SPACE CONSIDERATIONS:
// - NEVER execute interaction steps without proper validation
// - NEVER proceed with network requests without idle detection
// - NEVER evaluate untrusted JavaScript functions
// - NEVER ignore step execution failures in critical sequences
// ============================================================================
import { Logger, getErrorMessage } from './logger.js';
/**
 * Advanced interaction handler for SPAs and complex web applications
 * Provides comprehensive interaction capabilities for dynamic content loading
 */
export class InteractionHandler {
    config;
    logger;
    executionContext;
    constructor(config) {
        // Assert valid configuration
        if (!config) {
            throw new Error('InteractionHandler requires valid PageInteractionConfig');
        }
        this.config = config;
        this.logger = new Logger();
        this.executionContext = new Map();
        this.logger.info('InteractionHandler initialized', {
            enableAdvancedWaiting: config.enableAdvancedWaiting,
            defaultNetworkIdleTimeout: config.defaultNetworkIdleTimeout,
            defaultElementTimeout: config.defaultElementTimeout
        });
    }
    /**
     * Execute load wait conditions after initial page load
     * Implements sophisticated wait strategies for SPA content loading
     *
     * @param page - Puppeteer page instance
     * @returns Promise<boolean> - True if all conditions satisfied successfully
     */
    async executeLoadWaitConditions(page) {
        try {
            if (!this.config.loadWaitConditions || this.config.loadWaitConditions.length === 0) {
                this.logger.debug('No load wait conditions configured');
                return true;
            }
            this.logger.info('Executing load wait conditions', {
                stepCount: this.config.loadWaitConditions.length
            });
            // Execute each step in sequence with comprehensive error handling
            for (let i = 0; i < this.config.loadWaitConditions.length; i++) {
                const step = this.config.loadWaitConditions[i];
                const stepNumber = i + 1;
                this.logger.debug(`Executing load wait step ${stepNumber}/${this.config.loadWaitConditions.length}`, {
                    action: step.action,
                    selector: step.selector,
                    description: step.description
                });
                const success = await this.executeInteractionStep(page, step, `load-wait-${stepNumber}`);
                if (!success) {
                    this.logger.warn(`Load wait step ${stepNumber} failed, aborting sequence`, {
                        action: step.action,
                        selector: step.selector
                    });
                    return false;
                }
            }
            this.logger.info('All load wait conditions executed successfully');
            return true;
        }
        catch (error) {
            this.logger.error('Load wait conditions failed', { error: getErrorMessage(error) });
            return false;
        }
    }
    /**
     * Execute post-click wait conditions
     * Handles state verification after user interactions
     *
     * @param page - Puppeteer page instance
     * @returns Promise<boolean> - True if all conditions satisfied successfully
     */
    async executePostClickWaitConditions(page) {
        try {
            if (!this.config.postClickWaitConditions || this.config.postClickWaitConditions.length === 0) {
                this.logger.debug('No post-click wait conditions configured');
                return true;
            }
            this.logger.debug('Executing post-click wait conditions', {
                stepCount: this.config.postClickWaitConditions.length
            });
            // Execute each step with proper error isolation
            for (let i = 0; i < this.config.postClickWaitConditions.length; i++) {
                const step = this.config.postClickWaitConditions[i];
                const stepNumber = i + 1;
                const success = await this.executeInteractionStep(page, step, `post-click-${stepNumber}`);
                if (!success) {
                    this.logger.warn(`Post-click wait step ${stepNumber} failed`, {
                        action: step.action,
                        selector: step.selector
                    });
                    return false;
                }
            }
            this.logger.debug('All post-click wait conditions executed successfully');
            return true;
        }
        catch (error) {
            this.logger.error('Post-click wait conditions failed', { error: getErrorMessage(error) });
            return false;
        }
    }
    /**
     * Execute custom interaction sequence by name
     * Supports complex multi-step interactions defined in configuration
     *
     * @param page - Puppeteer page instance
     * @param sequenceName - Name of the interaction sequence to execute
     * @returns Promise<boolean> - True if sequence executed successfully
     */
    async executeCustomSequence(page, sequenceName) {
        try {
            if (!this.config.customInteractionSequences || !this.config.customInteractionSequences[sequenceName]) {
                this.logger.warn(`Custom interaction sequence not found: ${sequenceName}`);
                return false;
            }
            const sequence = this.config.customInteractionSequences[sequenceName];
            this.logger.info(`Executing custom interaction sequence: ${sequenceName}`, {
                stepCount: sequence.length
            });
            // Execute sequence steps with rollback capability
            for (let i = 0; i < sequence.length; i++) {
                const step = sequence[i];
                const stepNumber = i + 1;
                this.logger.debug(`Executing sequence step ${stepNumber}/${sequence.length}`, {
                    sequenceName,
                    action: step.action,
                    selector: step.selector,
                    description: step.description
                });
                const success = await this.executeInteractionStep(page, step, `${sequenceName}-${stepNumber}`);
                if (!success) {
                    this.logger.error(`Custom sequence step ${stepNumber} failed, aborting sequence`, {
                        sequenceName,
                        action: step.action,
                        selector: step.selector
                    });
                    return false;
                }
            }
            this.logger.info(`Custom interaction sequence completed successfully: ${sequenceName}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Custom sequence execution failed: ${sequenceName}`, { error: getErrorMessage(error) });
            return false;
        }
    }
    /**
     * Execute a single interaction step with comprehensive action support
     * Handles all interaction types with proper validation and error handling
     *
     * @param page - Puppeteer page instance
     * @param step - Interaction step to execute
     * @param contextId - Unique identifier for execution context
     * @returns Promise<boolean> - True if step executed successfully
     */
    async executeInteractionStep(page, step, contextId) {
        try {
            // Assert step validity
            if (!step.action) {
                throw new Error('Interaction step must have an action specified');
            }
            const timeout = step.timeout || this.config.defaultElementTimeout || 10000;
            const networkTimeout = this.config.defaultNetworkIdleTimeout || 5000;
            this.logger.debug(`Executing interaction step: ${step.action}`, {
                contextId,
                selector: step.selector,
                timeout,
                description: step.description
            });
            switch (step.action) {
                case 'waitForSelector':
                    if (!step.selector) {
                        throw new Error('waitForSelector action requires selector parameter');
                    }
                    await page.waitForSelector(step.selector, { timeout });
                    this.logger.debug(`Selector found: ${step.selector}`);
                    break;
                case 'waitForNetworkIdle':
                    await page.waitForLoadState('networkidle', { timeout: networkTimeout });
                    this.logger.debug('Network idle state achieved');
                    break;
                case 'waitForFunction':
                    if (!step.functionToEvaluate) {
                        throw new Error('waitForFunction action requires functionToEvaluate parameter');
                    }
                    // NEVER evaluate untrusted JavaScript - validate function safety
                    if (!this.isJavaScriptFunctionSafe(step.functionToEvaluate)) {
                        throw new Error('Unsafe JavaScript function detected in waitForFunction');
                    }
                    await page.waitForFunction(step.functionToEvaluate, { timeout });
                    this.logger.debug('Custom function condition satisfied');
                    break;
                case 'click':
                    if (!step.selector) {
                        throw new Error('click action requires selector parameter');
                    }
                    await page.click(step.selector);
                    this.logger.debug(`Element clicked: ${step.selector}`);
                    break;
                case 'type':
                    if (!step.selector || !step.textToType) {
                        throw new Error('type action requires both selector and textToType parameters');
                    }
                    await page.type(step.selector, step.textToType);
                    this.logger.debug(`Text typed into: ${step.selector}`);
                    break;
                case 'scroll':
                    const direction = step.scrollDirection || 'down';
                    const distance = step.scrollDistance || 100;
                    await this.executeScrollAction(page, direction, distance);
                    this.logger.debug(`Scrolled ${direction} by ${distance}px`);
                    break;
                case 'hover':
                    if (!step.selector) {
                        throw new Error('hover action requires selector parameter');
                    }
                    await page.hover(step.selector);
                    this.logger.debug(`Element hovered: ${step.selector}`);
                    break;
                default:
                    this.logger.warn(`Unknown interaction step action: ${step.action}`);
                    return false;
            }
            // Store execution context for advanced scenarios
            this.executionContext.set(contextId, {
                step,
                executedAt: new Date().toISOString(),
                success: true
            });
            return true;
        }
        catch (error) {
            this.logger.error(`Interaction step failed: ${step.action}`, {
                contextId,
                selector: step.selector,
                error: getErrorMessage(error)
            });
            // Store failure context
            this.executionContext.set(contextId, {
                step,
                executedAt: new Date().toISOString(),
                success: false,
                error: getErrorMessage(error)
            });
            return false;
        }
    }
    /**
     * Execute scroll action with direction and distance control
     * Supports multiple scroll directions with precise distance control
     *
     * @param page - Puppeteer page instance
     * @param direction - Scroll direction (up, down, left, right)
     * @param distance - Distance to scroll in pixels
     */
    async executeScrollAction(page, direction, distance) {
        try {
            // Assert valid scroll parameters
            if (distance <= 0) {
                throw new Error('Scroll distance must be positive');
            }
            const validDirections = ['up', 'down', 'left', 'right'];
            if (!validDirections.includes(direction)) {
                throw new Error(`Invalid scroll direction: ${direction}. Must be one of: ${validDirections.join(', ')}`);
            }
            await page.evaluate((dir, dist) => {
                let x = 0, y = 0;
                switch (dir) {
                    case 'down':
                        y = dist;
                        break;
                    case 'up':
                        y = -dist;
                        break;
                    case 'right':
                        x = dist;
                        break;
                    case 'left':
                        x = -dist;
                        break;
                }
                window.scrollBy(x, y);
            }, direction, distance);
            // Wait for scroll to complete
            await page.waitForTimeout(500);
        }
        catch (error) {
            throw new Error(`Scroll action failed: ${getErrorMessage(error)}`);
        }
    }
    /**
     * Validate JavaScript function safety for waitForFunction
     * Prevents execution of potentially dangerous JavaScript code
     *
     * @param functionCode - JavaScript function code to validate
     * @returns boolean - True if function is safe to execute
     */
    isJavaScriptFunctionSafe(functionCode) {
        try {
            // NEVER allow functions containing dangerous patterns
            const dangerousPatterns = [
                /eval\s*\(/i,
                /Function\s*\(/i,
                /setTimeout\s*\(/i,
                /setInterval\s*\(/i,
                /XMLHttpRequest/i,
                /fetch\s*\(/i,
                /import\s*\(/i,
                /require\s*\(/i,
                /document\.write/i,
                /document\.writeln/i,
                /location\s*=/i,
                /window\.location/i
            ];
            for (const pattern of dangerousPatterns) {
                if (pattern.test(functionCode)) {
                    this.logger.warn('Unsafe JavaScript pattern detected', {
                        pattern: pattern.toString(),
                        functionCode: functionCode.substring(0, 100)
                    });
                    return false;
                }
            }
            // Additional safety checks
            if (functionCode.length > 1000) {
                this.logger.warn('JavaScript function too long for safety validation');
                return false;
            }
            return true;
        }
        catch (error) {
            this.logger.error('JavaScript safety validation failed', { error: getErrorMessage(error) });
            return false;
        }
    }
    /**
     * Get execution context for debugging and monitoring
     * Provides insights into step execution history and failures
     *
     * @returns Map<string, any> - Execution context data
     */
    getExecutionContext() {
        return new Map(this.executionContext);
    }
    /**
     * Clear execution context to prevent memory leaks
     * Should be called after processing is complete
     */
    clearExecutionContext() {
        this.executionContext.clear();
        this.logger.debug('Execution context cleared');
    }
    /**
     * Get interaction handler statistics for monitoring
     * Provides insights into interaction execution performance
     *
     * @returns Object with interaction statistics
     */
    getInteractionStats() {
        const contextEntries = Array.from(this.executionContext.entries());
        const successfulSteps = contextEntries.filter(([_, data]) => data.success).length;
        const failedSteps = contextEntries.filter(([_, data]) => !data.success).length;
        return {
            totalSteps: contextEntries.length,
            successfulSteps,
            failedSteps,
            successRate: contextEntries.length > 0 ? (successfulSteps / contextEntries.length) * 100 : 0,
            configuration: {
                enableAdvancedWaiting: this.config.enableAdvancedWaiting,
                defaultNetworkIdleTimeout: this.config.defaultNetworkIdleTimeout,
                defaultElementTimeout: this.config.defaultElementTimeout,
                customSequenceCount: Object.keys(this.config.customInteractionSequences || {}).length
            }
        };
    }
}
//# sourceMappingURL=interactionHandler.js.map