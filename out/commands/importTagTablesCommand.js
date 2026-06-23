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
exports.importTagTablesCommand = importTagTablesCommand;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const workspace_1 = require("../utils/workspace");
async function importTagTablesCommand(importService, item) {
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
            logger_1.Logger.warn('Import tag tables failed - no folder selected');
            vscode.window.showWarningMessage('Import from TiaPortal: No tag folder selected');
            return;
        }
        // Get project name and import path
        const projectName = importService.getCurrentProjectName();
        if (!projectName) {
            logger_1.Logger.warn('Import tag tables failed - no project selected');
            vscode.window.showWarningMessage('Import from TiaPortal: No project selected');
            return;
        }
        const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
        if (!exportPath) {
            logger_1.Logger.error('Could not determine import path');
            vscode.window.showErrorMessage('Import from TiaPortal: Could not determine export path.');
            return;
        }
        // Get the group path from metadata
        const groupPath = item.metadata?.groupPath || '';
        const groupName = item.metadata?.groupName || item.label?.toString() || '';
        logger_1.Logger.section(`IMPORT TAG TABLES`);
        logger_1.Logger.info(`Project: ${projectName}`);
        logger_1.Logger.info(`Group path: ${groupPath || '(root)'}`);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Import from TiaPortal",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: `Importing tag tables...` });
            logger_1.Logger.startOperation(`Import tag tables`);
            const result = await importService.importTagTablesFromGroup(item.parentId || '', groupName, groupPath, exportPath, item.id);
            if (result.success) {
                const deletedCount = result.messages?.filter(m => m.type === 'deleted').length ?? 0;
                const resultWithDeleted = { ...result, deletedCount };
                if (deletedCount > 0) {
                    logger_1.Logger.success(`Tag tables imported: ${deletedCount} deleted, ${result.skippedCount ?? 0} unchanged`);
                }
                else {
                    logger_1.Logger.success(`Tag tables imported: ${result.successCount ?? result.itemCount} tables`);
                }
                // Log detailed import messages if available
                if (result.messages && result.messages.length > 0) {
                    logger_1.Logger.logImportMessages(result.messages);
                }
                logger_1.Logger.logImportSummary(resultWithDeleted);
                logger_1.Logger.endOperation(`Import tag tables`, true);
                const countMsg = result.successCount ?? result.itemCount;
                vscode.window.showInformationMessage(`Import from TiaPortal: Tag tables imported (${countMsg} tables)`);
            }
            else {
                // Log detailed error messages if available
                if (result.messages && result.messages.length > 0) {
                    logger_1.Logger.logImportMessages(result.messages);
                }
                logger_1.Logger.logImportSummary(result);
                logger_1.Logger.endOperation(`Import tag tables`, false);
                throw new Error(result.error);
            }
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Failed to import tag tables', error);
        vscode.window.showErrorMessage(`Import from TiaPortal: ${message}`);
    }
}
//# sourceMappingURL=importTagTablesCommand.js.map