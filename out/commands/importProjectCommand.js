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
exports.importProjectCommand = importProjectCommand;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const workspace_1 = require("../utils/workspace");
async function importProjectCommand(importService) {
    try {
        // Ensure workspace is open
        if (!await workspace_1.WorkspaceManager.ensureWorkspace()) {
            return;
        }
        // Verify connection to TIA Portal is alive
        if (!await importService.ensureConnected()) {
            return;
        }
        // Get project name from connection service
        const projectName = importService.getCurrentProjectName();
        if (!projectName) {
            logger_1.Logger.warn('No project selected for import');
            vscode.window.showWarningMessage('TIA Import: No project selected. Please connect and select a project first.');
            return;
        }
        // Get import path from workspace
        const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
        if (!exportPath) {
            logger_1.Logger.error('Could not determine import path');
            vscode.window.showErrorMessage('TIA Import: Could not determine import path.');
            return;
        }
        // Confirm import
        const confirm = await vscode.window.showInformationMessage(`Import project "${projectName}" into workspace?`, { modal: false }, 'Import', 'Cancel');
        if (confirm !== 'Import') {
            logger_1.Logger.info('Import cancelled by user');
            return;
        }
        logger_1.Logger.section(`IMPORT PROJECT: ${projectName}`);
        logger_1.Logger.info(`Import path: ${exportPath}`);
        // Perform import with progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TIA Import",
            cancellable: true
        }, async (progress, token) => {
            progress.report({ message: "Starting project import...", increment: 0 });
            let lastLoggedStatus = '';
            const result = await importService.importProject(exportPath, (status, percent) => {
                progress.report({ message: status, increment: percent });
                const stableStatus = status
                    .replace(/^\d+%(?: \([^)]*\))? - /, '')
                    .replace(/ - ETA \d+(?::\d{2}){1,2}$/, '');
                if (stableStatus !== lastLoggedStatus) {
                    logger_1.Logger.debug(`  ${stableStatus}`);
                    lastLoggedStatus = stableStatus;
                }
            }, token);
            if (result.success) {
                const updated = result.successCount || 0;
                const deleted = result.deletedCount || 0;
                const total = result.itemCount || 0;
                if (updated > 0 || deleted > 0) {
                    const parts = [];
                    if (updated > 0)
                        parts.push(`${updated} updated`);
                    if (deleted > 0)
                        parts.push(`${deleted} deleted`);
                    logger_1.Logger.success(`Project imported: ${parts.join(', ')} (${total} items checked)`);
                }
                else {
                    logger_1.Logger.success(`Project imported: no changes (${total} items checked)`);
                }
                logger_1.Logger.info(`Location: ${exportPath}`);
                logger_1.Logger.logImportSummary(result);
                vscode.window.showInformationMessage(`TIA Import: Project "${projectName}" imported successfully`, 'Show in Explorer').then(selection => {
                    if (selection === 'Show in Explorer') {
                        vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(exportPath));
                    }
                });
            }
            else {
                logger_1.Logger.logImportSummary(result);
                throw new Error(result.error);
            }
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Project import failed', error);
        vscode.window.showErrorMessage(`TIA Import: ${message}`);
    }
}
//# sourceMappingURL=importProjectCommand.js.map