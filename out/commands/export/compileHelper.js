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
exports.getCompileAfterExportSetting = getCompileAfterExportSetting;
exports.shouldCompileAfterExport = shouldCompileAfterExport;
exports.compileAndShowResults = compileAndShowResults;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../../utils/logger");
const workspace_1 = require("../../utils/workspace");
const compileDiagnostics_1 = require("../../utils/compileDiagnostics");
/**
 * Check if compile-after-export setting is enabled.
 * Returns: 'always' | 'ask' | 'never'
 */
function getCompileAfterExportSetting() {
    const config = vscode.workspace.getConfiguration('tiaImport');
    return config.get('compileAfterExport') || 'ask';
}
/**
 * Ask the user whether to compile after export, respecting the setting.
 * Returns true if compilation should proceed.
 */
async function shouldCompileAfterExport() {
    const setting = getCompileAfterExportSetting();
    if (setting === 'always') {
        return true;
    }
    if (setting === 'never') {
        return false;
    }
    // 'ask' mode - prompt user
    const result = await vscode.window.showInformationMessage('Export completed. Compile PLC software in TIA Portal?', 'Compile', 'Skip');
    return result === 'Compile';
}
/**
 * Execute PLC software compilation and display results in OUTPUT panel.
 * @param connectionService - TIA connection service
 * @param deviceId - Device identifier (display name or technical name)
 * @param deviceLabel - Human-readable device label for messages
 */
async function compileAndShowResults(connectionService, deviceId, deviceLabel) {
    const bridge = connectionService.getBridge();
    // Clear previous compile diagnostics before new compilation
    (0, compileDiagnostics_1.clearCompileDiagnostics)();
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Compiling: ${deviceLabel}`,
        cancellable: false
    }, async (progress) => {
        progress.report({ message: 'Compilation in progress...' });
        logger_1.Logger.section('PLC SOFTWARE COMPILATION');
        logger_1.Logger.info(`Device: ${deviceLabel}`);
        logger_1.Logger.startOperation(`Compile: ${deviceLabel}`);
        const result = await bridge.compileSoftware(deviceId);
        // Log detailed results
        logCompileResults(result, deviceLabel);
        // Publish compile errors/warnings to the PROBLEMS panel
        const workspacePath = workspace_1.WorkspaceManager.getWorkspacePath();
        if (workspacePath) {
            (0, compileDiagnostics_1.publishCompileDiagnostics)(result, deviceLabel, workspacePath);
        }
        logger_1.Logger.endOperation(`Compile: ${deviceLabel}`, result.success);
        // Show summary notification
        if (result.success) {
            const warnText = result.warningCount ? ` (${result.warningCount} warning(s))` : '';
            if (result.warningCount && result.warningCount > 0) {
                vscode.window.showWarningMessage(`Compilation successful with warnings: ${deviceLabel}${warnText}`);
            }
            else {
                vscode.window.showInformationMessage(`Compilation successful: ${deviceLabel}${warnText}`);
            }
        }
        else {
            logger_1.Logger.show();
            vscode.window.showErrorMessage(`Compilation failed: ${deviceLabel} — ${result.errorCount} error(s), ${result.warningCount ?? 0} warning(s). Details in Output.`);
        }
    });
}
/**
 * Log compilation results to the OUTPUT panel with proper formatting.
 */
function logCompileResults(result, deviceLabel) {
    if (!result.success && result.error && !result.messages?.length) {
        logger_1.Logger.error(`Compilation error: ${result.error}`);
        return;
    }
    logger_1.Logger.info(`State: ${result.state ?? 'Unknown'}`);
    logger_1.Logger.info(`Errors: ${result.errorCount ?? 0}, Warnings: ${result.warningCount ?? 0}`);
    if (result.messages && result.messages.length > 0) {
        logger_1.Logger.info('');
        logger_1.Logger.info('Compilation messages:');
        for (const msg of result.messages) {
            logCompilerMessage(msg);
        }
    }
    logger_1.Logger.info('');
    if (result.success) {
        const warnText = result.warningCount ? ` with ${result.warningCount} warning(s)` : '';
        logger_1.Logger.success(`Compilation of ${deviceLabel} completed successfully${warnText}`);
    }
    else {
        logger_1.Logger.error(`Compilation of ${deviceLabel} failed: ${result.errorCount} error(s), ${result.warningCount ?? 0} warning(s)`);
    }
}
/**
 * Log a single compiler message with indentation based on depth.
 */
function logCompilerMessage(msg) {
    const indent = '  '.repeat(msg.depth);
    const stateIcon = getStateIcon(msg.state);
    const pathInfo = msg.path ? ` [${msg.path}]` : '';
    const counters = (msg.errorCount > 0 || msg.warningCount > 0)
        ? ` (E:${msg.errorCount} W:${msg.warningCount})`
        : '';
    const line = `${indent}${stateIcon} ${msg.description}${pathInfo}${counters}`;
    switch (msg.state) {
        case 'Error':
            logger_1.Logger.error(line);
            break;
        case 'Warning':
            logger_1.Logger.warn(line);
            break;
        case 'Success':
            logger_1.Logger.success(line);
            break;
        default:
            logger_1.Logger.info(line);
            break;
    }
}
/**
 * Get icon for compiler result state
 */
function getStateIcon(state) {
    switch (state) {
        case 'Success': return '✓';
        case 'Information': return 'ℹ';
        case 'Warning': return '⚠';
        case 'Error': return '✗';
        default: return '•';
    }
}
//# sourceMappingURL=compileHelper.js.map