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
exports.importBlockCommand = importBlockCommand;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const workspace_1 = require("../utils/workspace");
async function importBlockCommand(importService, item) {
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
            logger_1.Logger.warn('Import block failed - no block selected');
            vscode.window.showWarningMessage('Import from TiaPortal: No block selected');
            return;
        }
        // Get project name and import path
        const projectName = importService.getCurrentProjectName();
        if (!projectName) {
            logger_1.Logger.warn('Import block failed - no project selected');
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
        logger_1.Logger.section(`IMPORT BLOCK: ${item.label}`);
        logger_1.Logger.info(`Project: ${projectName}`);
        logger_1.Logger.info(`Block ID: ${item.id}`);
        logger_1.Logger.info(`Group path: ${groupPath || '(root)'}`);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Import from TiaPortal",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: `Importing block: ${item.label}...` });
            logger_1.Logger.startOperation(`Import block: ${item.label}`);
            const result = await importService.importBlockWithPath(item.id, item.parentId || '', groupPath, exportPath);
            if (result.success) {
                logger_1.Logger.success(`Block imported to: ${result.filePath}`);
                // Log detailed import messages if available
                if (result.messages && result.messages.length > 0) {
                    logger_1.Logger.logImportMessages(result.messages);
                }
                logger_1.Logger.logImportSummary(result);
                logger_1.Logger.endOperation(`Import block: ${item.label}`, true);
                // Open the imported file
                if (result.filePath) {
                    logger_1.Logger.info('Opening imported file in editor...');
                    const doc = await vscode.workspace.openTextDocument(result.filePath);
                    await vscode.window.showTextDocument(doc);
                }
                vscode.window.showInformationMessage(`Import from TiaPortal: Block "${item.label}" imported successfully`);
            }
            else {
                // Log detailed error messages if available
                if (result.messages && result.messages.length > 0) {
                    logger_1.Logger.logImportMessages(result.messages);
                }
                logger_1.Logger.logImportSummary(result);
                logger_1.Logger.endOperation(`Import block: ${item.label}`, false);
                throw new Error(result.error);
            }
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Import from TiaPortal: ${message}`);
    }
}
//# sourceMappingURL=importBlockCommand.js.map