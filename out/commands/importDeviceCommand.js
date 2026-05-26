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
exports.importDeviceCommand = importDeviceCommand;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const workspace_1 = require("../utils/workspace");
async function importDeviceCommand(importService, item) {
    try {
        // Ensure workspace is open
        if (!await workspace_1.WorkspaceManager.ensureWorkspace()) {
            return;
        }
        // Verify connection to TIA Portal is alive
        if (!await importService.ensureConnected()) {
            return;
        }
        if (!item) {
            logger_1.Logger.warn('Import device failed - no device selected');
            vscode.window.showWarningMessage('TIA Import: No device selected');
            return;
        }
        // Get project name and import path
        const projectName = importService.getCurrentProjectName();
        if (!projectName) {
            logger_1.Logger.warn('Import device failed - no project selected');
            vscode.window.showWarningMessage('TIA Import: No project selected');
            return;
        }
        const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
        if (!exportPath) {
            logger_1.Logger.error('Could not determine import path');
            vscode.window.showErrorMessage('TIA Import: Could not determine import path.');
            return;
        }
        logger_1.Logger.section(`IMPORT DEVICE: ${item.label}`);
        logger_1.Logger.info(`Project: ${projectName}`);
        logger_1.Logger.info(`Import path: ${exportPath}`);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TIA Import",
            cancellable: true
        }, async (progress, token) => {
            progress.report({ message: `Importing device: ${item.label}...` });
            logger_1.Logger.startOperation(`Import device: ${item.label}`);
            let lastLoggedStatus = '';
            const result = await importService.importDevice(item.id, exportPath, (status, percent) => {
                progress.report({ message: status, increment: percent });
                const stableStatus = status
                    .replace(/^\d+(?:\.\d+)?%(?: \([^)]*\))? - /, '')
                    .replace(/ - ETA \d+(?::\d{2}){1,2}$/, '');
                if (stableStatus !== lastLoggedStatus) {
                    logger_1.Logger.debug(`  ${stableStatus}`);
                    lastLoggedStatus = stableStatus;
                }
            }, token);
            if (result.success) {
                const updated = result.updatedCount || 0;
                const deleted = result.deletedCount || 0;
                const total = result.itemCount || 0;
                if (updated > 0 || deleted > 0) {
                    const parts = [];
                    if (updated > 0)
                        parts.push(`${updated} updated`);
                    if (deleted > 0)
                        parts.push(`${deleted} deleted`);
                    logger_1.Logger.success(`Device imported: ${parts.join(', ')} (${total} items checked)`);
                }
                else {
                    logger_1.Logger.success(`Device imported: no changes (${total} items checked)`);
                }
                // Log detailed import messages if available
                if (result.messages && result.messages.length > 0) {
                    logger_1.Logger.logImportMessages(result.messages);
                }
                logger_1.Logger.logImportSummary(result);
                logger_1.Logger.endOperation(`Import device: ${item.label}`, true);
                vscode.window.showInformationMessage(`TIA Import: Device "${item.label}" imported successfully`);
            }
            else {
                // Log detailed error messages if available
                if (result.messages && result.messages.length > 0) {
                    logger_1.Logger.logImportMessages(result.messages);
                }
                logger_1.Logger.logImportSummary(result);
                logger_1.Logger.endOperation(`Import device: ${item.label}`, false);
                throw new Error(result.error);
            }
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Failed to import device', error);
        vscode.window.showErrorMessage(`TIA Import: ${message}`);
    }
}
//# sourceMappingURL=importDeviceCommand.js.map