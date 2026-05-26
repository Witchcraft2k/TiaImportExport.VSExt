"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
const vscode = __importStar(require("vscode"));
const config_1 = require("./config");
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class LoggerService {
    outputChannel;
    logLevel = LogLevel.DEBUG; // Show all logs by default
    showOnError = true;
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('TIA Portal Import', { log: true });
    }
    setLogLevel(level) {
        this.logLevel = level;
    }
    setShowOnError(show) {
        this.showOnError = show;
    }
    formatSection(title) {
        const line = '─'.repeat(60);
        return `\n${line}\n  ${title}\n${line}`;
    }
    /**
     * Log a section header for better readability
     */
    section(title) {
        this.outputChannel.info(this.formatSection(title));
    }
    /**
     * Log debug message
     */
    debug(message, data) {
        if (this.logLevel <= LogLevel.DEBUG) {
            this.outputChannel.debug(this.fixFilePathLinks(message));
            if (data !== undefined) {
                this.outputChannel.debug(`  └─ ${this.fixFilePathLinks(this.formatData(data))}`);
            }
        }
    }
    /**
     * Log info message
     */
    info(message, data) {
        if (this.logLevel <= LogLevel.INFO) {
            this.outputChannel.info(this.fixFilePathLinks(message));
            if (data !== undefined) {
                this.outputChannel.info(`  └─ ${this.fixFilePathLinks(this.formatData(data))}`);
            }
        }
    }
    /**
     * Log success message
     */
    success(message, data) {
        if (this.logLevel <= LogLevel.INFO) {
            this.outputChannel.info(`✓ OK  ${this.fixFilePathLinks(message)}`);
            if (data !== undefined) {
                this.outputChannel.info(`  └─ ${this.fixFilePathLinks(this.formatData(data))}`);
            }
        }
    }
    /**
     * Log warning message
     */
    warn(message, data) {
        if (this.logLevel <= LogLevel.WARN) {
            this.outputChannel.warn(this.fixFilePathLinks(message));
            if (data !== undefined) {
                this.outputChannel.warn(`  └─ ${this.fixFilePathLinks(this.formatData(data))}`);
            }
        }
    }
    /**
     * Log error message and optionally show output channel
     */
    error(message, error) {
        if (this.logLevel <= LogLevel.ERROR) {
            this.outputChannel.error(this.fixFilePathLinks(message));
            if (error) {
                if (error instanceof Error) {
                    this.outputChannel.error(`  ├─ Message: ${this.fixFilePathLinks(error.message)}`);
                    if (error.stack) {
                        const stackLines = error.stack.split('\n').slice(1, 4);
                        stackLines.forEach((line, i) => {
                            const prefix = i === stackLines.length - 1 ? '└─' : '├─';
                            this.outputChannel.error(`  ${prefix} ${line.trim()}`);
                        });
                    }
                }
                else {
                    this.outputChannel.error(`  └─ Details: ${this.fixFilePathLinks(this.formatData(error))}`);
                }
            }
            // Auto-show output on error
            if (this.showOnError) {
                this.outputChannel.show(true); // true = preserve focus
            }
        }
    }
    /**
     * Log operation start
     */
    startOperation(operation) {
        this.outputChannel.info('');
        this.outputChannel.info(`[START] ▶ ${this.fixFilePathLinks(operation)}`);
    }
    /**
     * Log operation end
     */
    endOperation(operation, success, duration) {
        const status = success ? '✓' : '✗';
        const durationStr = duration ? ` (${duration}ms)` : '';
        this.outputChannel.info(`[END  ] ${status} ${this.fixFilePathLinks(operation)}${durationStr}`);
    }
    /**
     * Log a list of items
     */
    list(title, items) {
        this.outputChannel.info(title);
        items.forEach((item, i) => {
            const prefix = i === items.length - 1 ? '└─' : '├─';
            this.outputChannel.info(`  ${prefix} ${item}`);
        });
    }
    /**
     * Log export messages from TIA Portal with detailed formatting
     */
    logExportMessages(messages) {
        this.logMessages(messages, 'Export');
    }
    /**
     * Log import messages from TIA Portal with detailed formatting
     */
    logImportMessages(messages) {
        this.logMessages(messages, 'Import');
    }
    /**
     * Format a file path for display in the output channel.
     * Wraps paths containing spaces in double quotes so VS Code can detect them as clickable links.
     */
    formatFilePath(filePath) {
        if (filePath.includes(' ')) {
            return vscode.Uri.file(filePath).toString();
        }
        return filePath;
    }
    /**
     * Fix file path links in text for VS Code output channel.
     * VS Code output channel only detects paths with spaces as clickable links
     * when they are workspace-relative. For external paths, we convert to file:// URIs
     * which VS Code always detects as clickable links.
     */
    fixFilePathLinks(text) {
        // Step 1: Handle single-quoted Windows paths (from TIA Portal API error messages)
        // e.g. "Importing from file 'e:\...\Program blocks\...\file.s7dcl'..."
        text = text.replace(/'([a-zA-Z]:\\[^'\r\n]+)'/g, (_match, filePath) => {
            if (filePath.includes(' ')) {
                return vscode.Uri.file(filePath).toString();
            }
            return _match;
        });
        // Step 2: Handle double-quoted Windows paths 
        text = text.replace(/"([a-zA-Z]:\\[^"\r\n]+)"/g, (_match, filePath) => {
            if (filePath.includes(' ')) {
                return vscode.Uri.file(filePath).toString();
            }
            return _match;
        });
        // Step 3: Handle unquoted Windows paths with spaces
        // Match drive letter path not preceded by a quote, greedily consume valid path chars
        // ending at a non-whitespace, non-punctuation character
        text = text.replace(/(?<!['"\/])([a-zA-Z]:\\(?:[^\r\n'"]*[^\r\n\s'".,;:!?]))/g, (_match, filePath) => {
            if (filePath.includes(' ')) {
                return vscode.Uri.file(filePath).toString();
            }
            return _match;
        });
        return text;
    }
    /**
     * Log messages with detailed formatting
     */
    logMessages(messages, operationType) {
        if (!messages || messages.length === 0) {
            return;
        }
        if (!(0, config_1.getConfig)().showImportExportDetails) {
            return;
        }
        this.outputChannel.info('');
        this.outputChannel.info(`─────────────── ${operationType} Details ───────────────`);
        for (const msg of messages) {
            const icon = this.getMessageIcon(msg.type);
            // Simple clean format: icon ItemType: ItemName - Message
            const mainLine = `${icon} ${msg.itemType}: ${msg.itemName}`;
            // Use appropriate log level based on message type
            if (msg.type.toLowerCase() === 'error') {
                this.outputChannel.error(mainLine);
                if (msg.message) {
                    this.outputChannel.error(`  └─ ${this.fixFilePathLinks(msg.message)}`);
                }
                if (msg.details) {
                    const detailLines = msg.details.split('\n').filter(l => l.trim());
                    detailLines.forEach((line) => {
                        this.outputChannel.error(`     ${this.fixFilePathLinks(line.trim())}`);
                    });
                }
                if (msg.filePath) {
                    this.outputChannel.error(`  └─ File: ${this.formatFilePath(msg.filePath)}`);
                }
            }
            else if (msg.type.toLowerCase() === 'warning') {
                this.outputChannel.warn(mainLine);
                if (msg.message) {
                    this.outputChannel.warn(`  └─ ${this.fixFilePathLinks(msg.message)}`);
                }
                if (msg.filePath) {
                    this.outputChannel.warn(`  └─ File: ${this.formatFilePath(msg.filePath)}`);
                }
            }
            else if (msg.type.toLowerCase() === 'success') {
                // For success, show message on same line if it's short
                const successLine = msg.message ? `${mainLine} - ${msg.message}` : mainLine;
                this.outputChannel.info(successLine);
                if (msg.filePath) {
                    this.outputChannel.info(`  └─ ${this.formatFilePath(msg.filePath)}`);
                }
            }
            else if (msg.type.toLowerCase() === 'deleted') {
                const deletedLine = msg.message ? `${mainLine} - ${msg.message}` : mainLine;
                this.outputChannel.warn(deletedLine);
            }
            else {
                // Info - typically "No changes" - compact format
                const infoLine = msg.message ? `${mainLine} - ${msg.message}` : mainLine;
                this.outputChannel.info(infoLine);
            }
        }
        this.outputChannel.info(`───────────────────────────────────────────────`);
    }
    /**
     * Get icon for message type
     */
    getMessageIcon(type) {
        switch (type.toLowerCase()) {
            case 'success': return '✓';
            case 'error': return '✗';
            case 'warning': return '⚠';
            case 'deleted': return '✗';
            case 'info': return 'ℹ';
            default: return '•';
        }
    }
    /**
     * Log export summary
     */
    logExportSummary(result) {
        this.logSummary(result, 'Export');
    }
    /**
     * Log import summary
     */
    logImportSummary(result) {
        this.logSummary(result, 'Import');
    }
    /**
     * Log operation summary
     */
    logSummary(result, operationType) {
        const parts = [];
        if (result.successCount !== undefined && result.successCount > 0) {
            parts.push(`${result.successCount} ${operationType.toLowerCase()}ed`);
        }
        if (result.deletedCount !== undefined && result.deletedCount > 0) {
            parts.push(`${result.deletedCount} deleted`);
        }
        if (result.errorCount !== undefined && result.errorCount > 0) {
            parts.push(`${result.errorCount} errors`);
        }
        if (result.skippedCount !== undefined && result.skippedCount > 0) {
            parts.push(`${result.skippedCount} skipped`);
        }
        if (result.warningCount !== undefined && result.warningCount > 0) {
            parts.push(`${result.warningCount} warnings`);
        }
        if (parts.length > 0) {
            const summary = parts.join(', ');
            const hasErrors = (result.errorCount ?? 0) > 0;
            if (hasErrors) {
                this.warn(`${operationType} summary: ${summary}`);
            }
            else {
                this.success(`${operationType} summary: ${summary}`);
            }
        }
    }
    /**
     * Format data for display
     */
    formatData(data) {
        if (typeof data === 'string') {
            return data;
        }
        if (typeof data === 'object') {
            try {
                return JSON.stringify(data, null, 0);
            }
            catch {
                return String(data);
            }
        }
        return String(data);
    }
    /**
     * Show the output channel
     */
    show() {
        this.outputChannel.show();
    }
    /**
     * Clear the output channel
     */
    clear() {
        this.outputChannel.clear();
    }
    /**
     * Dispose the output channel
     */
    dispose() {
        this.outputChannel.dispose();
    }
}
// Singleton instance
exports.Logger = new LoggerService();
//# sourceMappingURL=logger.js.map