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
exports.exportXlsxToTiaCommand = exportXlsxToTiaCommand;
exports.exportXlsxFolderToTiaCommand = exportXlsxFolderToTiaCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../../utils/logger");
const exportUtils_1 = require("./exportUtils");
const exportDialogs_1 = require("./exportDialogs");
/**
 * Command to export a single XLSX tag table file to TIA Portal.
 * Converts XLSX → XML (Simatic ML) → imports into TIA Portal.
 */
async function exportXlsxToTiaCommand(connectionService, uri, uris) {
    try {
        if (!await (0, exportDialogs_1.ensureConnection)(connectionService)) {
            return;
        }
        // Resolve file paths
        let filePaths;
        if (uris && uris.length > 0) {
            filePaths = uris.map(u => u.fsPath).filter(f => path.extname(f).toLowerCase() === '.xlsx');
        }
        else if (uri) {
            filePaths = [uri.fsPath];
        }
        else {
            const files = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: true,
                filters: {
                    'Excel Tag Tables': ['xlsx'],
                    'All Files': ['*']
                },
                title: 'Select XLSX tag table files for export to TIA Portal'
            });
            if (!files || files.length === 0) {
                return;
            }
            filePaths = files.map(f => f.fsPath);
        }
        if (filePaths.length === 0) {
            vscode.window.showWarningMessage('XLSX export to TIA: No XLSX files found');
            return;
        }
        const devices = (0, exportDialogs_1.validateProjectPlcDevices)(connectionService);
        if (!devices) {
            return;
        }
        const selectedDevice = await (0, exportDialogs_1.pickDevice)(devices, 'XLSX export to TIA Portal');
        if (!selectedDevice) {
            return;
        }
        const overwriteMode = await (0, exportDialogs_1.pickOverwriteMode)('XLSX export to TIA Portal');
        if (!overwriteMode) {
            return;
        }
        logger_1.Logger.section('EXPORT XLSX TAG TABLES TO TIA PORTAL');
        logger_1.Logger.info(`Files: ${filePaths.length}`);
        logger_1.Logger.info(`Device: ${selectedDevice.label}`);
        logger_1.Logger.info(`Mode: ${overwriteMode.forceOverwrite ? 'Overwrite All' : 'Check and Overwrite Differences'}`);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'XLSX export to TIA Portal',
            cancellable: filePaths.length > 1
        }, async (progress, token) => {
            logger_1.Logger.startOperation(`Export XLSX to TIA: ${filePaths.length} file(s)`);
            const bridge = connectionService.getBridge();
            let successCount = 0;
            let errorCount = 0;
            for (let i = 0; i < filePaths.length; i++) {
                if (token.isCancellationRequested) {
                    logger_1.Logger.warn('Export cancelled by user');
                    break;
                }
                const filePath = filePaths[i];
                const fileName = path.basename(filePath);
                const progressLabel = filePaths.length > 1 ? `[${i + 1}/${filePaths.length}]` : '';
                progress.report({
                    message: `${filePaths.length > 1 ? `(${i + 1}/${filePaths.length}) ` : ''}${fileName}`,
                    increment: (1 / filePaths.length) * 100
                });
                try {
                    const result = await bridge.importXlsxFileToTia(selectedDevice.deviceId, filePath, overwriteMode.forceOverwrite, overwriteMode.compareBeforeImport);
                    if (result.success) {
                        successCount++;
                        logger_1.Logger.success(`${progressLabel} ✓ ${fileName} → imported to TIA Portal`);
                        (0, exportUtils_1.logImportResultDetails)(result);
                    }
                    else {
                        errorCount++;
                        logger_1.Logger.error(`${progressLabel} ✗ ${fileName}: ${result.error || 'Unknown error'}`);
                    }
                    // Log detailed messages
                    if (result.messages && result.messages.length > 0) {
                        for (const msg of result.messages) {
                            const prefix = msg.itemType ? `${msg.itemType}: ${msg.itemName}` : msg.itemName;
                            if (msg.type === 'error') {
                                logger_1.Logger.error(`  ${prefix} - ${msg.message}`);
                            }
                            else if (msg.type === 'success') {
                                logger_1.Logger.success(`  ${prefix} - ${msg.message}`);
                            }
                            else {
                                logger_1.Logger.info(`  ${prefix} - ${msg.message}`);
                            }
                        }
                    }
                }
                catch (err) {
                    errorCount++;
                    logger_1.Logger.error(`${progressLabel} ✗ ${fileName}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            (0, exportUtils_1.reportExportSummary)(successCount, errorCount, 0, `Export XLSX to TIA: ${filePaths.length} file(s)`, 'XLSX export to TIA');
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Export XLSX to TIA failed:', error);
        logger_1.Logger.show();
        vscode.window.showErrorMessage(`XLSX export to TIA: ${message}`);
    }
}
/**
 * Command to export all XLSX tag table files from a folder to TIA Portal
 */
async function exportXlsxFolderToTiaCommand(connectionService, uri) {
    try {
        if (!await (0, exportDialogs_1.ensureConnection)(connectionService)) {
            return;
        }
        let folderPath;
        if (uri) {
            folderPath = uri.fsPath;
        }
        else {
            const folders = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: 'Select folder with XLSX tag files for export to TIA Portal'
            });
            if (!folders || folders.length === 0) {
                return;
            }
            folderPath = folders[0].fsPath;
        }
        const devices = (0, exportDialogs_1.validateProjectPlcDevices)(connectionService);
        if (!devices) {
            return;
        }
        const selectedDevice = await (0, exportDialogs_1.pickDevice)(devices, 'XLSX export to TIA Portal (folder)');
        if (!selectedDevice) {
            return;
        }
        const overwriteMode = await (0, exportDialogs_1.pickOverwriteMode)('XLSX export to TIA Portal (folder)');
        if (!overwriteMode) {
            return;
        }
        logger_1.Logger.section('EXPORT XLSX FOLDER TO TIA PORTAL');
        logger_1.Logger.info(`Folder: ${folderPath}`);
        logger_1.Logger.info(`Device: ${selectedDevice.label}`);
        logger_1.Logger.info(`Mode: ${overwriteMode.forceOverwrite ? 'Overwrite All' : 'Check and Overwrite Differences'}`);
        // Find all XLSX files in folder
        const xlsxFiles = findXlsxFiles(folderPath);
        if (xlsxFiles.length === 0) {
            vscode.window.showWarningMessage('XLSX export to TIA: No XLSX files found in folder');
            return;
        }
        logger_1.Logger.info(`Files: ${xlsxFiles.length}`);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'XLSX export to TIA Portal',
            cancellable: true
        }, async (progress, token) => {
            logger_1.Logger.startOperation(`Export XLSX folder to TIA: ${folderPath}`);
            const bridge = connectionService.getBridge();
            let successCount = 0;
            let errorCount = 0;
            for (let i = 0; i < xlsxFiles.length; i++) {
                if (token.isCancellationRequested) {
                    logger_1.Logger.warn('Export cancelled by user');
                    break;
                }
                const filePath = xlsxFiles[i];
                const fileName = path.basename(filePath);
                progress.report({
                    message: `[${i + 1}/${xlsxFiles.length}] ${fileName}`,
                    increment: (1 / xlsxFiles.length) * 100
                });
                try {
                    const result = await bridge.importXlsxFileToTia(selectedDevice.deviceId, filePath, overwriteMode.forceOverwrite, overwriteMode.compareBeforeImport);
                    if (result.success) {
                        successCount++;
                        logger_1.Logger.success(`[${i + 1}/${xlsxFiles.length}] ✓ ${fileName}`);
                    }
                    else {
                        errorCount++;
                        logger_1.Logger.error(`[${i + 1}/${xlsxFiles.length}] ✗ ${fileName}: ${result.error || 'Unknown error'}`);
                    }
                    // Log detailed messages
                    if (result.messages && result.messages.length > 0) {
                        for (const msg of result.messages) {
                            const prefix = msg.itemType ? `${msg.itemType}: ${msg.itemName}` : msg.itemName;
                            if (msg.type === 'error') {
                                logger_1.Logger.error(`  ${prefix} - ${msg.message}`);
                            }
                            else if (msg.type === 'success') {
                                logger_1.Logger.success(`  ${prefix} - ${msg.message}`);
                            }
                            else {
                                logger_1.Logger.info(`  ${prefix} - ${msg.message}`);
                            }
                        }
                    }
                }
                catch (err) {
                    errorCount++;
                    logger_1.Logger.error(`[${i + 1}/${xlsxFiles.length}] ✗ ${fileName}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            (0, exportUtils_1.reportExportSummary)(successCount, errorCount, 0, `Export XLSX folder to TIA: ${xlsxFiles.length} file(s)`, 'XLSX export to TIA');
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Export XLSX folder to TIA failed:', error);
        logger_1.Logger.show();
        vscode.window.showErrorMessage(`XLSX export to TIA: ${message}`);
    }
}
/**
 * Recursively find all .xlsx files in a directory
 */
function findXlsxFiles(dirPath) {
    const results = [];
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                results.push(...findXlsxFiles(fullPath));
            }
            else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.xlsx') {
                results.push(fullPath);
            }
        }
    }
    catch { }
    return results;
}
//# sourceMappingURL=exportXlsxToTia.js.map