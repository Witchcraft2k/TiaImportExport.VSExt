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
exports.importTagTableCommand = importTagTableCommand;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const workspace_1 = require("../utils/workspace");
async function importTagTableCommand(importService, item) {
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
            logger_1.Logger.warn('Import tag table failed - no item selected');
            vscode.window.showWarningMessage('Import from TiaPortal: No tag table selected');
            return;
        }
        // Get project name and import path
        const projectName = importService.getCurrentProjectName();
        if (!projectName) {
            logger_1.Logger.warn('Import tag table failed - no project selected');
            vscode.window.showWarningMessage('Import from TiaPortal: No project selected');
            return;
        }
        const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
        if (!exportPath) {
            logger_1.Logger.error('Could not determine import path');
            vscode.window.showErrorMessage('Import from TiaPortal: Could not determine export path.');
            return;
        }
        logger_1.Logger.section(`IMPORT TAG TABLE: ${item.label}`);
        logger_1.Logger.info(`Project: ${projectName}`);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Import from TiaPortal",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: `Importing ${item.label}...` });
            logger_1.Logger.startOperation(`Import tag table: ${item.label}`);
            const result = await importService.importSingleTagTable(item.id, item.parentId || '', exportPath);
            if (result.success) {
                logger_1.Logger.success(`Tag table imported: ${item.label}`);
                // Log detailed import messages if available
                if (result.messages && result.messages.length > 0) {
                    logger_1.Logger.logImportMessages(result.messages);
                }
                logger_1.Logger.logImportSummary(result);
                logger_1.Logger.endOperation(`Import tag table: ${item.label}`, true);
                vscode.window.showInformationMessage(`Import from TiaPortal: Tag table "${item.label}" imported`);
            }
            else {
                // Log detailed error messages if available
                if (result.messages && result.messages.length > 0) {
                    logger_1.Logger.logImportMessages(result.messages);
                }
                logger_1.Logger.logImportSummary(result);
                logger_1.Logger.endOperation(`Import tag table: ${item.label}`, false);
                throw new Error(result.error);
            }
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Failed to import tag table', error);
        vscode.window.showErrorMessage(`Import from TiaPortal: ${message}`);
    }
}
//# sourceMappingURL=importTagTableCommand.js.map