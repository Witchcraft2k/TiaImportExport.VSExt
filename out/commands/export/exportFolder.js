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
exports.exportXmlFolderToTiaCommand = exportXmlFolderToTiaCommand;
exports.exportBlockFolderToTiaCommand = exportBlockFolderToTiaCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../../utils/logger");
const s7dclErrorParser_1 = require("../../utils/s7dclErrorParser");
const s7xmlErrorParser_1 = require("../../utils/s7xmlErrorParser");
const exportUtils_1 = require("./exportUtils");
const exportDialogs_1 = require("./exportDialogs");
const compileHelper_1 = require("./compileHelper");
const XML_FOLDER_CONFIG = {
    title: 'Export to TIA Portal',
    uiLabel: 'Export to TIA Portal',
    dialogTitle: 'Select folder with XML files to export to TIA Portal',
    logSection: 'EXPORT XML FOLDER TO TIA PORTAL',
    isBlocksExport: false,
    offerCompile: false
};
const BLOCK_FOLDER_CONFIG = {
    title: 'Export blocks to TIA',
    uiLabel: 'Export blocks to TIA',
    dialogTitle: 'Select folder with blocks to export to TIA Portal',
    logSection: 'EXPORT BLOCK FOLDER TO TIA PORTAL',
    isBlocksExport: true,
    offerCompile: true
};
/**
 * Check if an error message indicates a UDT/type dependency error (data type unknown)
 */
function isTypeDependencyError(error) {
    if (!error) {
        return false;
    }
    return error.includes('is unknown') && (error.includes('Data type') ||
        error.includes('Datatype') ||
        error.includes('PlcTypeComposition'));
}
/**
 * Process a list of files for import, tracking progress and results.
 * Failed UDT files due to dependency errors are retried after the first pass.
 */
async function processFilesForImport(files, bridge, deviceId, overwrite, basePath, compareBeforeImport, progress, token) {
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const failedDependencyFiles = []; // Files that failed due to missing type dependencies
    // Clear previous .s7dcl diagnostics at the start of a new export batch
    (0, s7dclErrorParser_1.clearS7dclDiagnostics)();
    // Clean export caches once before processing all files
    if (bridge.cleanExportCaches) {
        await bridge.cleanExportCaches(basePath);
    }
    for (let i = 0; i < files.length; i++) {
        if (token.isCancellationRequested) {
            logger_1.Logger.warn(`Export cancelled by user`);
            break;
        }
        const file = files[i];
        const fileName = file.split(/[\\/]/).pop() || file;
        const ext = path.extname(file).toLowerCase();
        const progressLabel = `[${i + 1}/${files.length}]`;
        progress.report({
            message: `(${i + 1}/${files.length}) ${fileName}`,
            increment: (1 / files.length) * 100
        });
        // Skip know-how protected block placeholders
        if ((0, exportUtils_1.isKnowHowProtectedPlaceholder)(file)) {
            skippedCount++;
            logger_1.Logger.info(`${progressLabel} 🔒 ${fileName} (know-how protected - skipped)`);
            continue;
        }
        try {
            const result = ext === '.xlsx'
                ? await bridge.importXlsxFileToTia(deviceId, file, overwrite, compareBeforeImport)
                : await bridge.importXmlFileToTia(deviceId, file, overwrite, basePath, compareBeforeImport);
            if (result.success && result.skipped) {
                skippedCount++;
                logger_1.Logger.info(`${progressLabel} ≡ ${fileName} (identical)`);
            }
            else if (result.success) {
                successCount++;
                logger_1.Logger.success(`${progressLabel} ✓ ${fileName}`);
            }
            else if ((0, exportUtils_1.isAlreadyExistsError)(result.error)) {
                skippedCount++;
                logger_1.Logger.warn(`${progressLabel} ⊘ ${fileName} (already exists)`);
            }
            else if (isTypeDependencyError(result.error)) {
                // Queue for retry - the dependency might be imported later
                failedDependencyFiles.push(file);
                logger_1.Logger.warn(`${progressLabel} ⟳ ${fileName} (missing type dependency - will retry)`);
            }
            else if ((0, exportUtils_1.isDependencyError)(result.error)) {
                skippedCount++;
                logger_1.Logger.warn(`${progressLabel} ⊘ ${fileName} (missing dependency - FB/UDT)`);
            }
            else {
                errorCount++;
                // Enhanced error logging with line number resolution
                const enhancedErrors = result.error
                    ? (ext === '.s7dcl' ? (0, s7dclErrorParser_1.enhanceS7dclErrors)(file, result.error)
                        : ext === '.xml' ? (0, s7xmlErrorParser_1.enhanceXmlErrors)(file, result.error)
                            : null)
                    : null;
                if (enhancedErrors && enhancedErrors.length > 0) {
                    logger_1.Logger.error(`${progressLabel} ✗ ${fileName}: errors found`);
                    for (const errLine of enhancedErrors) {
                        logger_1.Logger.error(errLine);
                    }
                }
                else {
                    logger_1.Logger.error(`${progressLabel} ✗ ${fileName}: ${result.error || 'Unknown error'}`);
                }
            }
        }
        catch (err) {
            errorCount++;
            const errMsg = err instanceof Error ? err.message : String(err);
            logger_1.Logger.error(`${progressLabel} ✗ ${fileName}: ${errMsg}`);
        }
    }
    // Retry files that failed due to missing type dependencies
    // After the first pass, their dependencies should now be imported
    if (failedDependencyFiles.length > 0 && !token.isCancellationRequested) {
        logger_1.Logger.info(`Retrying ${failedDependencyFiles.length} files with type dependency errors...`);
        // Multiple retry passes to handle multi-level dependencies (A -> B -> C)
        let retryQueue = [...failedDependencyFiles];
        let retryPass = 0;
        const maxRetryPasses = 5;
        while (retryQueue.length > 0 && retryPass < maxRetryPasses && !token.isCancellationRequested) {
            retryPass++;
            const stillFailing = [];
            let resolvedThisPass = 0;
            for (const file of retryQueue) {
                if (token.isCancellationRequested) {
                    break;
                }
                const fileName = file.split(/[\\/]/).pop() || file;
                const ext = path.extname(file).toLowerCase();
                try {
                    const result = ext === '.xlsx'
                        ? await bridge.importXlsxFileToTia(deviceId, file, overwrite, compareBeforeImport)
                        : await bridge.importXmlFileToTia(deviceId, file, overwrite, basePath, compareBeforeImport);
                    if (result.success && result.skipped) {
                        skippedCount++;
                        logger_1.Logger.info(`[retry:${retryPass}] ≡ ${fileName} (identical)`);
                        resolvedThisPass++;
                    }
                    else if (result.success) {
                        successCount++;
                        logger_1.Logger.success(`[retry:${retryPass}] ✓ ${fileName}`);
                        resolvedThisPass++;
                    }
                    else if (isTypeDependencyError(result.error)) {
                        stillFailing.push(file);
                    }
                    else {
                        errorCount++;
                        // Enhanced error logging with line number resolution
                        const enhancedErrors = result.error
                            ? (ext === '.s7dcl' ? (0, s7dclErrorParser_1.enhanceS7dclErrors)(file, result.error)
                                : ext === '.xml' ? (0, s7xmlErrorParser_1.enhanceXmlErrors)(file, result.error)
                                    : null)
                            : null;
                        if (enhancedErrors && enhancedErrors.length > 0) {
                            logger_1.Logger.error(`[retry:${retryPass}] ✗ ${fileName}: errors found`);
                            for (const errLine of enhancedErrors) {
                                logger_1.Logger.error(errLine);
                            }
                        }
                        else {
                            logger_1.Logger.error(`[retry:${retryPass}] ✗ ${fileName}: ${result.error || 'Unknown error'}`);
                        }
                    }
                }
                catch (err) {
                    errorCount++;
                    const errMsg = err instanceof Error ? err.message : String(err);
                    logger_1.Logger.error(`[retry:${retryPass}] ✗ ${fileName}: ${errMsg}`);
                }
            }
            retryQueue = stillFailing;
            if (resolvedThisPass === 0 && stillFailing.length > 0) {
                // No progress - remaining files have unresolvable dependencies
                logger_1.Logger.warn(`Retry pass ${retryPass}: no progress, ${stillFailing.length} files have unresolvable type dependencies`);
                break;
            }
            if (resolvedThisPass > 0) {
                logger_1.Logger.info(`Retry pass ${retryPass}: resolved ${resolvedThisPass} files, ${stillFailing.length} remaining`);
            }
        }
        // Count remaining failures
        for (const file of retryQueue) {
            errorCount++;
            const fileName = file.split(/[\\/]/).pop() || file;
            logger_1.Logger.error(`✗ ${fileName}: Unresolvable type dependency`);
        }
    }
    return { successCount, errorCount, skippedCount };
}
/**
 * Recursively find files by extension in a folder
 */
function findFilesByExtension(folderPath, extension) {
    const results = [];
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);
            if (entry.isDirectory()) {
                results.push(...findFilesByExtension(fullPath, extension));
            }
            else if (entry.isFile() && path.extname(entry.name).toLowerCase() === extension) {
                results.push(fullPath);
            }
        }
    }
    catch (err) {
        logger_1.Logger.warn(`Error reading folder ${folderPath}:`, err);
    }
    return results;
}
/**
 * Delete orphaned elements for generic XML folder export (tags, types, watch tables).
 */
async function deleteOrphanedForGenericFolder(bridge, deviceId, folderPath, forceOverwrite, cancelled) {
    if (cancelled || forceOverwrite) {
        return;
    }
    try {
        const folderType = (0, exportUtils_1.detectFolderType)(folderPath);
        let deleteResult = null;
        if (folderType === 'tags') {
            deleteResult = await bridge.deleteOrphanedTagTables(deviceId, folderPath);
        }
        else if (folderType === 'types') {
            deleteResult = await bridge.deleteOrphanedTypes(deviceId, folderPath);
        }
        else if (folderType === 'watch') {
            deleteResult = await bridge.deleteOrphanedWatchTables(deviceId, folderPath);
        }
        if (deleteResult) {
            (0, exportUtils_1.logDeleteResults)(deleteResult, folderType);
        }
    }
    catch (err) {
        logger_1.Logger.warn(`Error deleting unused elements:`, err);
    }
}
/**
 * Delete orphaned blocks and groups for block folder export.
 */
async function deleteOrphanedBlocks(bridge, deviceId, folderPath, basePath, cancelled) {
    if (cancelled) {
        return;
    }
    try {
        const deleteResult = await bridge.deleteOrphanedBlockGroups(deviceId, folderPath, basePath);
        (0, exportUtils_1.logDeleteResults)(deleteResult, 'blocks');
    }
    catch (err) {
        logger_1.Logger.warn(`Error while deleting unused items:`, err);
    }
}
/**
 * Create empty folders in TIA Portal for block exports.
 */
async function createEmptyBlockGroups(bridge, deviceId, folderPath, basePath) {
    const emptyFolders = await (0, exportUtils_1.getEmptyFoldersInDirectory)(folderPath);
    if (emptyFolders.length === 0) {
        return 0;
    }
    logger_1.Logger.info(`Creating empty folders: ${emptyFolders.length}`);
    try {
        const createResult = await bridge.createBlockGroups(deviceId, emptyFolders, basePath);
        if (createResult.success && (createResult.groupsCount ?? 0) > 0) {
            logger_1.Logger.success(`Created ${createResult.groupsCount} empty folders in TIA Portal before importing blocks`);
        }
        if (createResult.errors && createResult.errors.length > 0) {
            for (const err of createResult.errors) {
                logger_1.Logger.warn(`Error creating folder: ${err}`);
            }
        }
    }
    catch (err) {
        logger_1.Logger.warn(`Error creating empty folders:`, err);
    }
    return emptyFolders.length;
}
/**
 * Core logic for exporting multiple folders to TIA Portal sequentially.
 */
async function exportMultipleFoldersCore(connectionService, config, uris) {
    try {
        if (!await (0, exportDialogs_1.ensureConnection)(connectionService)) {
            return;
        }
        const folderPaths = uris.map(u => u.fsPath);
        const devices = (0, exportDialogs_1.validateProjectDevices)(connectionService);
        if (!devices) {
            return;
        }
        const selectedDevice = await (0, exportDialogs_1.pickDevice)(devices, config.title);
        if (!selectedDevice) {
            return;
        }
        const overwriteMode = await (0, exportDialogs_1.pickOverwriteMode)(config.title);
        if (!overwriteMode) {
            return;
        }
        logger_1.Logger.section(config.logSection);
        logger_1.Logger.info(`Folders: ${folderPaths.length} selected`);
        for (const fp of folderPaths) {
            logger_1.Logger.info(`  • ${path.basename(fp)}`);
        }
        logger_1.Logger.info(`Device: ${selectedDevice.label}`);
        logger_1.Logger.info(`Mode: ${overwriteMode.forceOverwrite ? 'Overwrite all' : 'Check and overwrite differences'}`);
        const exportSuccess = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: config.title,
            cancellable: true
        }, async (progress, token) => {
            let totalSuccess = 0;
            let totalErrors = 0;
            let totalSkipped = 0;
            for (let folderIdx = 0; folderIdx < folderPaths.length; folderIdx++) {
                if (token.isCancellationRequested) {
                    logger_1.Logger.warn(`Export cancelled by user`);
                    break;
                }
                const folderPath = folderPaths[folderIdx];
                const folderName = path.basename(folderPath);
                const folderLabel = `[${folderIdx + 1}/${folderPaths.length}]`;
                logger_1.Logger.info(``);
                logger_1.Logger.info(`${folderLabel} 📁 ${folderName}`);
                const operationLabel = `${config.logSection}: ${folderPath}`;
                logger_1.Logger.startOperation(operationLabel);
                const bridge = connectionService.getBridge();
                // Determine base path
                const basePath = config.isBlocksExport
                    ? (0, exportUtils_1.findProgramBlocksBasePath)(folderPath)
                    : vscode.workspace.getWorkspaceFolder(vscode.Uri.file(folderPath))?.uri.fsPath;
                // Create empty folders for block exports
                let emptyFolderCount = 0;
                if (config.isBlocksExport) {
                    emptyFolderCount = await createEmptyBlockGroups(bridge, selectedDevice.deviceId, folderPath, basePath);
                }
                // Get list of supported files
                const supportedFiles = await (0, exportUtils_1.getSupportedFilesInFolder)(folderPath, true);
                if (!config.isBlocksExport && (0, exportUtils_1.detectFolderType)(folderPath) === 'tags') {
                    supportedFiles.push(...findFilesByExtension(folderPath, '.xlsx'));
                }
                if (supportedFiles.length === 0) {
                    if (config.isBlocksExport && emptyFolderCount > 0) {
                        logger_1.Logger.success(`  Export: created ${emptyFolderCount} empty folders`);
                    }
                    else {
                        logger_1.Logger.warn(`  No supported files found`);
                    }
                    logger_1.Logger.endOperation(operationLabel, true);
                    continue;
                }
                // Log file counts
                if (config.isBlocksExport) {
                    const xmlCount = supportedFiles.filter(f => f.toLowerCase().endsWith('.xml')).length;
                    const sclCount = supportedFiles.filter(f => f.toLowerCase().endsWith('.scl')).length;
                    const sdCount = supportedFiles.filter(f => f.toLowerCase().endsWith('.s7dcl')).length;
                    const dbCount = supportedFiles.filter(f => f.toLowerCase().endsWith('.db')).length;
                    logger_1.Logger.info(`  Found: ${xmlCount} XML, ${sclCount} SCL, ${sdCount} SD (.s7dcl), ${dbCount} DB (.db)`);
                }
                else {
                    logger_1.Logger.info(`  Found ${supportedFiles.length} files`);
                }
                progress.report({ message: `${folderLabel} ${folderName}` });
                // Process files
                const { successCount, errorCount, skippedCount } = await processFilesForImport(supportedFiles, bridge, selectedDevice.deviceId, true, basePath, overwriteMode.compareBeforeImport, progress, token);
                totalSuccess += successCount;
                totalErrors += errorCount;
                totalSkipped += skippedCount;
                // Delete orphaned elements
                if (config.isBlocksExport) {
                    await deleteOrphanedBlocks(bridge, selectedDevice.deviceId, folderPath, basePath, token.isCancellationRequested);
                }
                else {
                    await deleteOrphanedForGenericFolder(bridge, selectedDevice.deviceId, folderPath, overwriteMode.forceOverwrite, token.isCancellationRequested);
                }
                logger_1.Logger.endOperation(operationLabel, errorCount === 0);
            }
            // Final summary
            const allLabel = `${config.logSection}: ${folderPaths.length} folders`;
            (0, exportUtils_1.reportExportSummary)(totalSuccess, totalErrors, totalSkipped, allLabel, config.uiLabel);
            return totalErrors === 0 && totalSuccess > 0 && !token.isCancellationRequested;
        });
        // Compile after successful export (only for block folder exports)
        if (exportSuccess && config.offerCompile && await (0, compileHelper_1.shouldCompileAfterExport)()) {
            await (0, compileHelper_1.compileAndShowResults)(connectionService, selectedDevice.deviceId, selectedDevice.label);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error(`Error exporting folders to TIA Portal:`, error);
        logger_1.Logger.show();
        vscode.window.showErrorMessage(`${config.uiLabel}: ${message}`);
    }
}
/**
 * Core logic for exporting a folder to TIA Portal.
 * Used by both exportXmlFolderToTiaCommand and exportBlockFolderToTiaCommand.
 */
async function exportFolderCore(connectionService, config, uri) {
    try {
        if (!await (0, exportDialogs_1.ensureConnection)(connectionService)) {
            return;
        }
        const folderPath = await (0, exportDialogs_1.resolveFolderPath)(uri, config.dialogTitle);
        if (!folderPath) {
            return;
        }
        const devices = (0, exportDialogs_1.validateProjectDevices)(connectionService);
        if (!devices) {
            return;
        }
        const selectedDevice = await (0, exportDialogs_1.pickDevice)(devices, config.title);
        if (!selectedDevice) {
            return;
        }
        const overwriteMode = await (0, exportDialogs_1.pickOverwriteMode)(config.title);
        if (!overwriteMode) {
            return;
        }
        logger_1.Logger.section(config.logSection);
        logger_1.Logger.info(`Folder: ${folderPath}`);
        logger_1.Logger.info(`Device: ${selectedDevice.label}`);
        logger_1.Logger.info(`Mode: ${overwriteMode.forceOverwrite ? 'Overwrite all' : 'Check and overwrite differences'}`);
        // Determine base path
        const basePath = config.isBlocksExport
            ? (0, exportUtils_1.findProgramBlocksBasePath)(folderPath)
            : vscode.workspace.getWorkspaceFolder(vscode.Uri.file(folderPath))?.uri.fsPath;
        if (basePath) {
            logger_1.Logger.info(`Base path: ${basePath}`);
        }
        const exportSuccess = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: config.title,
            cancellable: true
        }, async (progress, token) => {
            const operationLabel = `${config.logSection}: ${folderPath}`;
            logger_1.Logger.startOperation(operationLabel);
            const bridge = connectionService.getBridge();
            // Create empty folders for block exports
            let emptyFolderCount = 0;
            if (config.isBlocksExport) {
                emptyFolderCount = await createEmptyBlockGroups(bridge, selectedDevice.deviceId, folderPath, basePath);
            }
            // Get list of supported files
            const supportedFiles = await (0, exportUtils_1.getSupportedFilesInFolder)(folderPath, true);
            if (!config.isBlocksExport && (0, exportUtils_1.detectFolderType)(folderPath) === 'tags') {
                supportedFiles.push(...findFilesByExtension(folderPath, '.xlsx'));
            }
            if (supportedFiles.length === 0) {
                if (config.isBlocksExport && emptyFolderCount > 0) {
                    logger_1.Logger.success(`Export completed: created ${emptyFolderCount} empty folders`);
                    vscode.window.showInformationMessage(`${config.uiLabel}: Created ${emptyFolderCount} empty folders in TIA Portal (no block files found)`);
                }
                else {
                    const allowedFormats = (0, exportUtils_1.detectFolderType)(folderPath) === 'tags'
                        ? 'XML, XLSX, .s7dcl, .scl, .db'
                        : 'XML, .s7dcl, .scl, .db';
                    logger_1.Logger.warn(`No supported files (${allowedFormats}) found in folder`);
                    vscode.window.showWarningMessage(`${config.uiLabel}: No supported files found in folder`);
                }
                return false;
            }
            // Log file counts for block exports
            if (config.isBlocksExport) {
                const xmlCount = supportedFiles.filter(f => f.toLowerCase().endsWith('.xml')).length;
                const sclCount = supportedFiles.filter(f => f.toLowerCase().endsWith('.scl')).length;
                const sdCount = supportedFiles.filter(f => f.toLowerCase().endsWith('.s7dcl')).length;
                const dbCount = supportedFiles.filter(f => f.toLowerCase().endsWith('.db')).length;
                logger_1.Logger.info(`Found: ${xmlCount} XML, ${sclCount} SCL, ${sdCount} SD (.s7dcl), ${dbCount} DB (.db)`);
            }
            else {
                logger_1.Logger.info(`Found ${supportedFiles.length} files to export`);
            }
            // Process files
            const { successCount, errorCount, skippedCount } = await processFilesForImport(supportedFiles, bridge, selectedDevice.deviceId, true, basePath, overwriteMode.compareBeforeImport, progress, token);
            // Delete orphaned elements
            if (config.isBlocksExport) {
                await deleteOrphanedBlocks(bridge, selectedDevice.deviceId, folderPath, basePath, token.isCancellationRequested);
            }
            else {
                await deleteOrphanedForGenericFolder(bridge, selectedDevice.deviceId, folderPath, overwriteMode.forceOverwrite, token.isCancellationRequested);
            }
            // Report summary
            (0, exportUtils_1.reportExportSummary)(successCount, errorCount, skippedCount, operationLabel, config.uiLabel);
            return errorCount === 0 && successCount > 0 && !token.isCancellationRequested;
        });
        // Compile after successful export (only for block folder exports)
        if (exportSuccess && config.offerCompile && await (0, compileHelper_1.shouldCompileAfterExport)()) {
            await (0, compileHelper_1.compileAndShowResults)(connectionService, selectedDevice.deviceId, selectedDevice.label);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error(`Error exporting folder to TIA Portal:`, error);
        logger_1.Logger.show();
        vscode.window.showErrorMessage(`${config.uiLabel}: ${message}`);
    }
}
/**
 * Command to export XML files from folder to TIA Portal
 */
async function exportXmlFolderToTiaCommand(connectionService, uri, uris) {
    if (uris && uris.length > 1) {
        return exportMultipleFoldersCore(connectionService, XML_FOLDER_CONFIG, uris);
    }
    return exportFolderCore(connectionService, XML_FOLDER_CONFIG, uri);
}
/**
 * Command to export block files from folder to TIA Portal
 * This is context-menu command for "Program blocks" folders
 */
async function exportBlockFolderToTiaCommand(connectionService, uri, uris) {
    if (uris && uris.length > 1) {
        return exportMultipleFoldersCore(connectionService, BLOCK_FOLDER_CONFIG, uris);
    }
    return exportFolderCore(connectionService, BLOCK_FOLDER_CONFIG, uri);
}
//# sourceMappingURL=exportFolder.js.map