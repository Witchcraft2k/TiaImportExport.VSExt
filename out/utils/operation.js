"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOperation = runOperation;
const logger_1 = require("./logger");
/**
 * Wraps a workflow with consistent `Logger.startOperation` / `endOperation`
 * bookkeeping so individual commands and services stop repeating the pattern
 * by hand.
 *
 * @example
 *     return runOperation({ name: `Import block: ${blockId}` }, async () => {
 *         const result = await bridge.exportBlock(...);
 *         return result;
 *     });
 */
async function runOperation(options, fn) {
    logger_1.Logger.startOperation(options.name);
    try {
        const result = await fn();
        // Success is determined by the caller's own result shape; we can only
        // report that the operation itself did not throw.
        logger_1.Logger.endOperation(options.name, true);
        return result;
    }
    catch (error) {
        logger_1.Logger.error(`${options.name} failed`, error);
        logger_1.Logger.endOperation(options.name, false);
        if (options.onError) {
            return options.onError(error);
        }
        throw error;
    }
}
//# sourceMappingURL=operation.js.map