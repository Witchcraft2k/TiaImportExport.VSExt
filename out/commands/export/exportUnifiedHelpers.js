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
exports.detectPlcFolderType = detectPlcFolderType;
exports.detectPlcFolders = detectPlcFolders;
exports.exportBlocksFolder = exportBlocksFolder;
exports.exportXmlFolder = exportXmlFolder;
exports.exportHwConfigFolder = exportHwConfigFolder;
exports.accumulateStats = accumulateStats;
exports.reportUnifiedExportSummary = reportUnifiedExportSummary;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../../utils/logger");
const s7dclErrorParser_1 = require("../../utils/s7dclErrorParser");
const s7xmlErrorParser_1 = require("../../utils/s7xmlErrorParser");
const exportUtils_1 = require("./exportUtils");
/**
 * Detect what type of folder was selected based on path
 */
function detectPlcFolderType(folderPath) {
    const normalizedPath = folderPath.toLowerCase().replace(/\\/g, '/');
    const folderName = path.basename(folderPath).toLowerCase();
    if (normalizedPath.includes('program blocks') ||
        normalizedPath.includes('program_blocks') ||
        folderName === 'program blocks') {
        return 'blocks';
    }
    if (normalizedPath.includes('plc tags') ||
        normalizedPath.includes('plc_tags') ||
        folderName === 'plc tags') {
        return 'tags';
    }
    if (normalizedPath.includes('plc data types') ||
        normalizedPath.includes('plc_data_types') ||
        folderName === 'plc data types') {
        return 'types';
    }
    if (normalizedPath.includes('watch and force tables') ||
        normalizedPath.includes('watch_and_force_tables') ||
        folderName === 'watch and force tables') {
        return 'watch';
    }
    if (normalizedPath.includes('deviceconfiguration') ||
        folderName === 'deviceconfiguration') {
        return 'hw';
    }
    // Check if it's a PLC device folder (contains multiple PLC subfolders)
    const detectedFolders = detectPlcFolders(folderPath);
    if (detectedFolders.blocks || detectedFolders.tags || detectedFolders.types ||
        detectedFolders.watch || detectedFolders.hw) {
        return 'plc';
    }
    return 'unknown';
}
/**
 * Detect available PLC folders in a device directory
 */
function detectPlcFolders(devicePath) {
    const detected = {};
    try {
        const entries = fs.readdirSync(devicePath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            const lowerName = entry.name.toLowerCase();
            const fullPath = path.join(devicePath, entry.name);
            if (lowerName === 'program blocks' || lowerName === 'program_blocks') {
                detected.blocks = fullPath;
            }
            else if (lowerName === 'plc tags' || lowerName === 'plc_tags') {
                detected.tags = fullPath;
            }
            else if (lowerName === 'plc data types' || lowerName === 'plc_data_types') {
                detected.types = fullPath;
            }
            else if (lowerName === 'watch and force tables' || lowerName === 'watch_and_force_tables') {
                detected.watch = fullPath;
            }
            else if (lowerName === 'deviceconfiguration') {
                detected.hw = fullPath;
            }
        }
    }
    catch (err) {
        logger_1.Logger.warn(`Error reading folder ${devicePath}:`, err);
    }
    return detected;
}
/**
 * Export program blocks folder to TIA
 */
async function exportBlocksFolder(connectionService, folderPath, deviceId, forceOverwrite, progress, token) {
    const stats = { successCount: 0, errorCount: 0, skippedCount: 0 };
    const basePath = (0, exportUtils_1.findProgramBlocksBasePath)(folderPath);
    const bridge = connectionService.getBridge();
    const files = await (0, exportUtils_1.getSupportedFilesInFolder)(folderPath, true);
    if (files.length === 0) {
        logger_1.Logger.info(`  Program blocks: no files to export`);
        return stats;
    }
    logger_1.Logger.info(`  Program blocks: ${files.length} files`);
    const blockIncrement = files.length > 0 ? (100 / files.length) : 0;
    for (let i = 0; i < files.length; i++) {
        if (token.isCancellationRequested)
            break;
        const file = files[i];
        const fileName = path.basename(file);
        const progressLabel = `[${i + 1}/${files.length}]`;
        progress.report({ message: `Blocks: ${fileName}`, increment: blockIncrement });
        // Skip know-how protected block placeholders
        if ((0, exportUtils_1.isKnowHowProtectedPlaceholder)(file)) {
            stats.skippedCount++;
            logger_1.Logger.info(`    ${progressLabel} \ud83d\udd12 ${fileName} (know-how protected - skipped)`);
            continue;
        }
        try {
            const result = await bridge.importXmlFileToTia(deviceId, file, true, basePath, !forceOverwrite);
            if (result.success && result.skipped) {
                stats.skippedCount++;
                logger_1.Logger.info(`    ${progressLabel} ≡ ${fileName} (identical)`);
            }
            else if (result.success) {
                stats.successCount++;
                logger_1.Logger.success(`    ${progressLabel} ✓ ${fileName}`);
            }
            else if ((0, exportUtils_1.isAlreadyExistsError)(result.error) || (0, exportUtils_1.isDependencyError)(result.error)) {
                stats.skippedCount++;
                logger_1.Logger.warn(`    ${progressLabel} ⊘ ${fileName} (skipped)`);
            }
            else {
                stats.errorCount++;
                // Enhanced error logging with line number resolution + PROBLEMS panel
                const ext = path.extname(file).toLowerCase();
                const enhancedErrors = result.error
                    ? (ext === '.s7dcl' ? (0, s7dclErrorParser_1.enhanceS7dclErrors)(file, result.error)
                        : ext === '.xml' ? (0, s7xmlErrorParser_1.enhanceXmlErrors)(file, result.error)
                            : null)
                    : null;
                if (enhancedErrors && enhancedErrors.length > 0) {
                    logger_1.Logger.error(`    ${progressLabel} ✗ ${fileName}: ${result.error || 'Unknown error'}`);
                }
                else {
                    logger_1.Logger.error(`    ${progressLabel} ✗ ${fileName}: ${result.error || 'Unknown error'}`);
                }
            }
        }
        catch (err) {
            stats.errorCount++;
            logger_1.Logger.error(`    ${progressLabel} ✗ ${fileName}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return stats;
}
/**
 * Export XML folder (tags, types, watch tables) to TIA
 */
async function exportXmlFolder(connectionService, folderPath, folderType, deviceId, forceOverwrite, progress, token) {
    const stats = { successCount: 0, errorCount: 0, skippedCount: 0 };
    const bridge = connectionService.getBridge();
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(folderPath));
    const basePath = workspaceFolder?.uri.fsPath;
    const normalizedFolderType = folderType.trim().toLowerCase();
    const files = await (0, exportUtils_1.getSupportedFilesInFolder)(folderPath, true);
    if (normalizedFolderType === 'tags') {
        const xlsxFiles = findFilesByExtension(folderPath, '.xlsx');
        files.push(...xlsxFiles);
    }
    if (files.length === 0) {
        logger_1.Logger.info(`  ${folderType}: no files to export`);
        return stats;
    }
    logger_1.Logger.info(`  ${folderType}: ${files.length} files`);
    const xmlIncrement = files.length > 0 ? (100 / files.length) : 0;
    for (let i = 0; i < files.length; i++) {
        if (token.isCancellationRequested)
            break;
        const file = files[i];
        const fileName = path.basename(file);
        const extension = path.extname(file).toLowerCase();
        const progressLabel = `[${i + 1}/${files.length}]`;
        progress.report({ message: `${folderType}: ${fileName}`, increment: xmlIncrement });
        try {
            const result = extension === '.xlsx'
                ? await bridge.importXlsxFileToTia(deviceId, file, true, !forceOverwrite)
                : await bridge.importXmlFileToTia(deviceId, file, true, basePath, !forceOverwrite);
            if (result.success && result.skipped) {
                stats.skippedCount++;
                logger_1.Logger.info(`    ${progressLabel} ≡ ${fileName} (identical)`);
            }
            else if (result.success) {
                stats.successCount++;
                logger_1.Logger.success(`    ${progressLabel} ✓ ${fileName}`);
            }
            else if ((0, exportUtils_1.isAlreadyExistsError)(result.error)) {
                stats.skippedCount++;
                logger_1.Logger.warn(`    ${progressLabel} ⊘ ${fileName} (already exists)`);
            }
            else {
                stats.errorCount++;
                // Enhanced error logging with line number resolution + PROBLEMS panel
                const ext = path.extname(file).toLowerCase();
                if (result.error && ext !== '.xlsx') {
                    if (ext === '.s7dcl') {
                        (0, s7dclErrorParser_1.enhanceS7dclErrors)(file, result.error);
                    }
                    else if (ext === '.xml') {
                        (0, s7xmlErrorParser_1.enhanceXmlErrors)(file, result.error);
                    }
                }
                logger_1.Logger.error(`    ${progressLabel} ✗ ${fileName}: ${result.error || 'Unknown error'}`);
            }
        }
        catch (err) {
            stats.errorCount++;
            logger_1.Logger.error(`    ${progressLabel} ✗ ${fileName}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return stats;
}
function findFilesByExtension(folderPath, extension) {
    const files = [];
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);
            if (entry.isDirectory()) {
                files.push(...findFilesByExtension(fullPath, extension));
                continue;
            }
            if (entry.isFile() && path.extname(entry.name).toLowerCase() === extension) {
                files.push(fullPath);
            }
        }
    }
    catch (err) {
        logger_1.Logger.warn(`Error reading folder ${folderPath}:`, err);
    }
    return files;
}
/**
 * Export HW configuration folder to TIA
 */
async function exportHwConfigFolder(connectionService, folderPath, progress) {
    const stats = { successCount: 0, errorCount: 0, skippedCount: 0 };
    const bridge = connectionService.getBridge();
    const files = await (0, exportUtils_1.getSupportedFilesInFolder)(folderPath, true);
    if (files.length === 0) {
        logger_1.Logger.info(`  HW Config: no files to export`);
        return stats;
    }
    logger_1.Logger.info(`  HW Config: ${files.length} files`);
    progress.report({ message: 'HW Config...' });
    try {
        const result = await bridge.exportHwConfigFolderToTia(folderPath, false, // overwriteExisting
        true, // updateExisting
        true, // importNetworkConfig
        true, // skipIfIdentical
        false // showComparisonDetails
        );
        if (result.success) {
            stats.successCount = result.successCount || 1;
            stats.skippedCount = result.skippedCount || 0;
            stats.errorCount = result.errorCount || 0;
            if (result.messages) {
                for (const msg of result.messages) {
                    if (msg.status === 'Success') {
                        logger_1.Logger.success(`    ✓ ${msg.fileName}: ${msg.message}`);
                    }
                    else if (msg.status === 'Warning') {
                        logger_1.Logger.warn(`    ⚠ ${msg.fileName}: ${msg.message}`);
                    }
                    else if (msg.status === 'Error') {
                        logger_1.Logger.error(`    ✗ ${msg.fileName}: ${msg.message}`);
                    }
                }
            }
        }
        else {
            stats.errorCount = 1;
            logger_1.Logger.error(`    ✗ HW Config: ${result.error || 'Unknown error'}`);
        }
    }
    catch (err) {
        stats.errorCount = 1;
        logger_1.Logger.error(`    ✗ HW Config: ${err instanceof Error ? err.message : String(err)}`);
    }
    return stats;
}
/**
 * Accumulate stats from a sub-export into total stats
 */
function accumulateStats(total, partial) {
    total.successCount += partial.successCount;
    total.errorCount += partial.errorCount;
    total.skippedCount += partial.skippedCount;
}
/**
 * Report unified/program export summary
 */
function reportUnifiedExportSummary(stats, folderName, operationLabel, uiLabel, cancelled) {
    const summary = `${stats.successCount} success, ${stats.errorCount} errors, ${stats.skippedCount} skipped`;
    if (cancelled) {
        logger_1.Logger.warn(`Export cancelled by user`);
        logger_1.Logger.endOperation(operationLabel, false);
        return;
    }
    if (stats.errorCount === 0) {
        logger_1.Logger.success(`Export completed: ${summary}`);
        logger_1.Logger.endOperation(operationLabel, true);
        vscode.window.showInformationMessage(`${uiLabel}: ${folderName} - completed successfully (${summary})`);
    }
    else if (stats.successCount > 0) {
        logger_1.Logger.warn(`Export completed with errors: ${summary}`);
        logger_1.Logger.show();
        logger_1.Logger.endOperation(operationLabel, false);
        vscode.window.showWarningMessage(`${uiLabel}: ${folderName} - with errors (${summary}). Details in Output.`);
    }
    else {
        logger_1.Logger.error(`Export failed: ${summary}`);
        logger_1.Logger.show();
        logger_1.Logger.endOperation(operationLabel, false);
        vscode.window.showErrorMessage(`${uiLabel}: ${folderName} - failed (${summary}). Details in Output.`);
    }
}
//# sourceMappingURL=exportUnifiedHelpers.js.map