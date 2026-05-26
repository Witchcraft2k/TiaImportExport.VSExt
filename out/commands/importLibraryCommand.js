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
exports.importLibraryCommand = importLibraryCommand;
exports.importLibraryFolderCommand = importLibraryFolderCommand;
exports.importLibraryTypeCommand = importLibraryTypeCommand;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const workspace_1 = require("../utils/workspace");
function reportResult(projectName, exportPath, result) {
    if (result.success) {
        const total = result.itemCount ?? result.successCount ?? 0;
        logger_1.Logger.success(`Library import completed: ${total} type(s) exported`);
        logger_1.Logger.info(`Location: ${exportPath}`);
        vscode.window.showInformationMessage(`TIA Import: Library types imported from "${projectName}"`, 'Show in Explorer').then(selection => {
            if (selection === 'Show in Explorer') {
                vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(exportPath));
            }
        });
    }
    else {
        throw new Error(result.error || 'Library import failed');
    }
}
async function preflight(importService) {
    if (!await workspace_1.WorkspaceManager.ensureWorkspace())
        return undefined;
    if (!await importService.ensureConnected())
        return undefined;
    const projectName = importService.getCurrentProjectName();
    if (!projectName) {
        logger_1.Logger.warn('No project selected for library import');
        vscode.window.showWarningMessage('TIA Import: No project selected. Please connect and select a project first.');
        return undefined;
    }
    const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
    if (!exportPath) {
        logger_1.Logger.error('Could not determine import path');
        vscode.window.showErrorMessage('TIA Import: Could not determine import path.');
        return undefined;
    }
    return { projectName, exportPath };
}
/**
 * Import the entire Project Library &gt; Types tree (no master copies).
 */
async function importLibraryCommand(importService) {
    try {
        const ctx = await preflight(importService);
        if (!ctx)
            return;
        const { projectName, exportPath } = ctx;
        const confirm = await vscode.window.showInformationMessage(`Import library types from "${projectName}" into workspace?`, { modal: false }, 'Import', 'Cancel');
        if (confirm !== 'Import') {
            logger_1.Logger.info('Library import cancelled by user');
            return;
        }
        logger_1.Logger.section(`IMPORT LIBRARY TYPES: ${projectName}`);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'TIA Import: Library types',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Exporting library types...' });
            const result = await importService.importLibraryTypes(exportPath);
            logger_1.Logger.logImportSummary(result);
            reportResult(projectName, exportPath, result);
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Library import failed', error);
        vscode.window.showErrorMessage(`TIA Import: ${message}`);
    }
}
/**
 * Strip the "Library/Types" prefix from a tree-item id and return a
 * '/'-separated folder path inside the type tree.
 */
function folderPathFromId(id) {
    if (!id)
        return '';
    const normalized = id.replace(/\\/g, '/');
    const prefix = 'Library/Types/';
    if (normalized.startsWith(prefix))
        return normalized.substring(prefix.length);
    if (normalized.startsWith('Library/Types'))
        return '';
    return normalized;
}
/**
 * Import a single library folder selected from the tree (recursive).
 */
async function importLibraryFolderCommand(importService, item) {
    try {
        if (!item) {
            vscode.window.showWarningMessage('TIA Import: No library folder selected.');
            return;
        }
        const ctx = await preflight(importService);
        if (!ctx)
            return;
        const { projectName, exportPath } = ctx;
        const folderPath = item.metadata?.folderPath ?? folderPathFromId(item.id);
        logger_1.Logger.section(`IMPORT LIBRARY FOLDER: ${folderPath || '<root>'}`);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `TIA Import: ${folderPath || 'Library types'}`,
            cancellable: false
        }, async () => {
            const result = folderPath
                ? await importService.importLibraryFolder(folderPath, exportPath)
                : await importService.importLibraryTypes(exportPath);
            logger_1.Logger.logImportSummary(result);
            reportResult(projectName, exportPath, result);
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Library folder import failed', error);
        vscode.window.showErrorMessage(`TIA Import: ${message}`);
    }
}
/**
 * Import a single library type selected from the tree.
 */
async function importLibraryTypeCommand(importService, item) {
    try {
        if (!item) {
            vscode.window.showWarningMessage('TIA Import: No library type selected.');
            return;
        }
        const ctx = await preflight(importService);
        if (!ctx)
            return;
        const { projectName, exportPath } = ctx;
        // Type leaf id format: "Library/Types/<folder>/<typeName>"
        // We need typeName + parent folder path.
        let typeName = item.metadata?.typeName ?? '';
        let folderPath = item.metadata?.folderPath ?? '';
        if (!typeName) {
            const fp = folderPathFromId(item.id);
            const segments = fp.split('/').filter(Boolean);
            typeName = segments.pop() ?? '';
            folderPath = segments.join('/');
        }
        if (!typeName) {
            vscode.window.showWarningMessage('TIA Import: Cannot resolve library type name.');
            return;
        }
        logger_1.Logger.section(`IMPORT LIBRARY TYPE: ${folderPath ? folderPath + '/' : ''}${typeName}`);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `TIA Import: ${typeName}`,
            cancellable: false
        }, async () => {
            const result = await importService.importLibraryType(folderPath, typeName, exportPath);
            logger_1.Logger.logImportSummary(result);
            reportResult(projectName, exportPath, result);
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Library type import failed', error);
        vscode.window.showErrorMessage(`TIA Import: ${message}`);
    }
}
//# sourceMappingURL=importLibraryCommand.js.map