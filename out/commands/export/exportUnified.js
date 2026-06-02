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
exports.exportUnifiedToTiaCommand = exportUnifiedToTiaCommand;
exports.exportProgramToTiaCommand = exportProgramToTiaCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const logger_1 = require("../../utils/logger");
const s7dclErrorParser_1 = require("../../utils/s7dclErrorParser");
const exportDialogs_1 = require("./exportDialogs");
const exportUnifiedHelpers_1 = require("./exportUnifiedHelpers");
const compileHelper_1 = require("./compileHelper");
const UNIFIED_CONFIG = {
    includeHw: true,
    uiLabel: 'Export to TIA Portal',
    dialogTitle: 'Select PLC folder for export to TIA Portal',
    logSection: 'PLC EXPORT TO TIA PORTAL',
    operationPrefix: 'Unified Export'
};
const PROGRAM_ONLY_CONFIG = {
    includeHw: false,
    uiLabel: 'Program export',
    dialogTitle: 'Select PLC folder for program export to TIA Portal',
    logSection: 'PROGRAM EXPORT TO TIA PORTAL (without HW)',
    operationPrefix: 'Program Export'
};
/**
 * Pick overwrite mode for unified export
 */
async function pickUnifiedOverwriteMode(title) {
    return await vscode.window.showQuickPick([
        { label: 'Check and overwrite differences', description: 'Compare and export only changed items (recommended)', forceOverwrite: false },
        { label: 'Overwrite all', description: 'Export all items without checking differences', forceOverwrite: true }
    ], {
        placeHolder: 'Select export mode',
        title
    });
}
/**
 * Delegate to specific single-folder command when a specific folder type is detected.
 * Returns true if delegated, false if not.
 */
async function tryDelegateToSpecificCommand(folderType, config, connectionService, uri) {
    if (folderType === 'plc' || folderType === 'unknown') {
        return false;
    }
    // For program-only mode, HW folder is not supported
    if (!config.includeHw && folderType === 'hw') {
        vscode.window.showWarningMessage('Program export: This folder contains only HW configuration. Use "Export to TIA - Program and HW".');
        return true;
    }
    logger_1.Logger.info(`Detected single folder type: ${folderType}, delegating to specific command`);
    const { exportBlockFolderToTiaCommand, exportXmlFolderToTiaCommand } = await Promise.resolve().then(() => __importStar(require('./exportFolder')));
    const { exportHwConfigFolderToTiaCommand } = await Promise.resolve().then(() => __importStar(require('../exportHwConfigToTiaCommand')));
    switch (folderType) {
        case 'blocks':
            await exportBlockFolderToTiaCommand(connectionService, uri);
            return true;
        case 'hw':
            await exportHwConfigFolderToTiaCommand(connectionService, uri);
            return true;
        case 'tags':
        case 'types':
        case 'watch':
            await exportXmlFolderToTiaCommand(connectionService, uri);
            return true;
    }
    return false;
}
/**
 * Build list of elements to export and validate at least one exists.
 */
function buildExportList(detectedFolders, includeHw) {
    const exportList = [];
    if (detectedFolders.types)
        exportList.push('Data types (UDT)');
    if (detectedFolders.blocks)
        exportList.push('Program blocks');
    if (detectedFolders.tags)
        exportList.push('Tag tables');
    if (detectedFolders.watch)
        exportList.push('Watch tables');
    if (includeHw && detectedFolders.hw)
        exportList.push('HW configuration');
    return exportList;
}
/**
 * Execute multi-folder export (UDT -> blocks -> tags -> watch -> HW)
 */
async function executeMultiFolderExport(connectionService, detectedFolders, deviceId, forceOverwrite, includeHw, progress, token) {
    const totalStats = { successCount: 0, errorCount: 0, skippedCount: 0 };
    // 1. UDTs first (dependencies)
    if (detectedFolders.types && !token.isCancellationRequested) {
        logger_1.Logger.info(`Export: PLC data types`);
        (0, exportUnifiedHelpers_1.accumulateStats)(totalStats, await (0, exportUnifiedHelpers_1.exportXmlFolder)(connectionService, detectedFolders.types, 'UDT', deviceId, forceOverwrite, progress, token));
    }
    // 2. Program blocks (for unified: after UDT; for program: after tags)
    if (includeHw) {
        // Unified order: UDT -> blocks -> tags -> watch -> HW
        if (detectedFolders.blocks && !token.isCancellationRequested) {
            logger_1.Logger.info(`Export: Program blocks`);
            (0, exportUnifiedHelpers_1.accumulateStats)(totalStats, await (0, exportUnifiedHelpers_1.exportBlocksFolder)(connectionService, detectedFolders.blocks, deviceId, forceOverwrite, progress, token));
        }
        if (detectedFolders.tags && !token.isCancellationRequested) {
            logger_1.Logger.info(`Export: PLC tags`);
            (0, exportUnifiedHelpers_1.accumulateStats)(totalStats, await (0, exportUnifiedHelpers_1.exportXmlFolder)(connectionService, detectedFolders.tags, 'Tags', deviceId, forceOverwrite, progress, token));
        }
    }
    else {
        // Program-only order: UDT -> tags -> blocks -> watch
        if (detectedFolders.tags && !token.isCancellationRequested) {
            logger_1.Logger.info(`Export: PLC tags`);
            (0, exportUnifiedHelpers_1.accumulateStats)(totalStats, await (0, exportUnifiedHelpers_1.exportXmlFolder)(connectionService, detectedFolders.tags, 'Tags', deviceId, forceOverwrite, progress, token));
        }
        if (detectedFolders.blocks && !token.isCancellationRequested) {
            logger_1.Logger.info(`Export: Program blocks`);
            (0, exportUnifiedHelpers_1.accumulateStats)(totalStats, await (0, exportUnifiedHelpers_1.exportBlocksFolder)(connectionService, detectedFolders.blocks, deviceId, forceOverwrite, progress, token));
        }
    }
    // Watch tables
    if (detectedFolders.watch && !token.isCancellationRequested) {
        logger_1.Logger.info(`Export: Watch and force tables`);
        (0, exportUnifiedHelpers_1.accumulateStats)(totalStats, await (0, exportUnifiedHelpers_1.exportXmlFolder)(connectionService, detectedFolders.watch, 'Watch', deviceId, forceOverwrite, progress, token));
    }
    // HW Config (only for unified)
    if (includeHw && detectedFolders.hw && !token.isCancellationRequested) {
        logger_1.Logger.info(`Export: DeviceConfiguration`);
        (0, exportUnifiedHelpers_1.accumulateStats)(totalStats, await (0, exportUnifiedHelpers_1.exportHwConfigFolder)(connectionService, detectedFolders.hw, progress));
    }
    return totalStats;
}
/**
 * Core logic for unified/program export of multiple folders.
 */
async function exportUnifiedMultiCore(connectionService, config, uris) {
    try {
        if (!await (0, exportDialogs_1.ensureConnection)(connectionService)) {
            return;
        }
        const folderPaths = uris.map(u => u.fsPath);
        const devices = (0, exportDialogs_1.validateProjectPlcDevices)(connectionService);
        if (!devices) {
            return;
        }
        const selectedDevice = await (0, exportDialogs_1.pickDevice)(devices, config.uiLabel);
        if (!selectedDevice) {
            return;
        }
        const overwriteMode = await pickUnifiedOverwriteMode(config.uiLabel);
        if (!overwriteMode) {
            return;
        }
        // Clear previous diagnostics before starting new export
        (0, s7dclErrorParser_1.clearS7dclDiagnostics)();
        logger_1.Logger.section(config.logSection);
        logger_1.Logger.info(`Folders: ${folderPaths.length} selected`);
        for (const fp of folderPaths) {
            logger_1.Logger.info(`  \u2022 ${path.basename(fp)}`);
        }
        logger_1.Logger.info(`Device: ${selectedDevice.label}`);
        logger_1.Logger.info(`Mode: ${overwriteMode.forceOverwrite ? 'Overwrite all' : 'Check differences'}`);
        const exportSuccess = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: config.uiLabel,
            cancellable: true
        }, async (progress, token) => {
            let grandTotalStats = { successCount: 0, errorCount: 0, skippedCount: 0 };
            for (let folderIdx = 0; folderIdx < folderPaths.length; folderIdx++) {
                if (token.isCancellationRequested) {
                    logger_1.Logger.warn(`Export cancelled by user`);
                    break;
                }
                const folderPath = folderPaths[folderIdx];
                const folderName = path.basename(folderPath);
                const folderLabel = `[${folderIdx + 1}/${folderPaths.length}]`;
                logger_1.Logger.info(``);
                logger_1.Logger.info(`${folderLabel} \ud83d\udcc1 ${folderName}`);
                // Detect folder type and structure
                const folderType = (0, exportUnifiedHelpers_1.detectPlcFolderType)(folderPath);
                const detectedFolders = folderType === 'plc' ? (0, exportUnifiedHelpers_1.detectPlcFolders)(folderPath) : {};
                const exportList = buildExportList(detectedFolders, config.includeHw);
                if (exportList.length === 0) {
                    logger_1.Logger.warn(`  No recognizable folders to export`);
                    continue;
                }
                logger_1.Logger.info(`  Items: ${exportList.join(', ')}`);
                const operationLabel = `${config.operationPrefix}: ${folderPath}`;
                logger_1.Logger.startOperation(operationLabel);
                progress.report({ message: `${folderLabel} ${folderName}` });
                const totalStats = await executeMultiFolderExport(connectionService, detectedFolders, selectedDevice.deviceId, overwriteMode.forceOverwrite, config.includeHw, progress, token);
                (0, exportUnifiedHelpers_1.accumulateStats)(grandTotalStats, totalStats);
                logger_1.Logger.endOperation(operationLabel, totalStats.errorCount === 0);
            }
            const allFolderNames = folderPaths.map(fp => path.basename(fp)).join(', ');
            (0, exportUnifiedHelpers_1.reportUnifiedExportSummary)(grandTotalStats, allFolderNames, `${config.operationPrefix}: ${folderPaths.length} folders`, config.uiLabel, token.isCancellationRequested);
            return grandTotalStats.errorCount === 0 && grandTotalStats.successCount > 0 && !token.isCancellationRequested;
        });
        // Compile after successful export (only for software, not HW-only)
        if (exportSuccess && await (0, compileHelper_1.shouldCompileAfterExport)()) {
            await (0, compileHelper_1.compileAndShowResults)(connectionService, selectedDevice.deviceId, selectedDevice.label);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error(`Export to TIA Portal error:`, error);
        logger_1.Logger.show();
        vscode.window.showErrorMessage(`${config.uiLabel}: ${message}`);
    }
}
/**
 * Core logic for unified/program export commands.
 */
async function exportUnifiedCore(connectionService, config, uri) {
    try {
        if (!await (0, exportDialogs_1.ensureConnection)(connectionService)) {
            return;
        }
        const folderPath = await (0, exportDialogs_1.resolveFolderPath)(uri, config.dialogTitle);
        if (!folderPath) {
            return;
        }
        // Detect folder type
        const folderType = (0, exportUnifiedHelpers_1.detectPlcFolderType)(folderPath);
        const detectedFolders = folderType === 'plc' ? (0, exportUnifiedHelpers_1.detectPlcFolders)(folderPath) : {};
        // Delegate to specific command for single folder types
        if (folderType !== 'plc' && folderType !== 'unknown') {
            if (await tryDelegateToSpecificCommand(folderType, config, connectionService, uri)) {
                return;
            }
        }
        // For PLC device folder, ask user for device
        const devices = (0, exportDialogs_1.validateProjectPlcDevices)(connectionService);
        if (!devices) {
            return;
        }
        const selectedDevice = await (0, exportDialogs_1.pickDevice)(devices, config.uiLabel);
        if (!selectedDevice) {
            return;
        }
        const overwriteMode = await pickUnifiedOverwriteMode(config.uiLabel);
        if (!overwriteMode) {
            return;
        }
        const folderName = path.basename(folderPath);
        // Validate that there are folders to export
        const exportList = buildExportList(detectedFolders, config.includeHw);
        if (exportList.length === 0) {
            const expectedFolders = config.includeHw
                ? '"Program blocks", "PLC tags", "PLC data types", "Watch and force tables", "DeviceConfiguration"'
                : '"Program blocks", "PLC tags", "PLC data types", "Watch and force tables"';
            vscode.window.showWarningMessage(`${config.uiLabel}: No recognizable folders found in ${folderName}. Expected: ${expectedFolders}`);
            return;
        }
        // Clear previous diagnostics before starting new export
        (0, s7dclErrorParser_1.clearS7dclDiagnostics)();
        logger_1.Logger.section(config.logSection);
        logger_1.Logger.info(`Folder: ${folderPath}`);
        logger_1.Logger.info(`Device: ${selectedDevice.label}`);
        logger_1.Logger.info(`Mode: ${overwriteMode.forceOverwrite ? 'Overwrite all' : 'Check differences'}`);
        logger_1.Logger.info(`Items: ${exportList.join(', ')}`);
        const exportSuccess = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${config.uiLabel}: ${folderName}`,
            cancellable: true
        }, async (progress, token) => {
            const operationLabel = `${config.operationPrefix}: ${folderPath}`;
            logger_1.Logger.startOperation(operationLabel);
            const totalStats = await executeMultiFolderExport(connectionService, detectedFolders, selectedDevice.deviceId, overwriteMode.forceOverwrite, config.includeHw, progress, token);
            (0, exportUnifiedHelpers_1.reportUnifiedExportSummary)(totalStats, folderName, operationLabel, config.uiLabel, token.isCancellationRequested);
            return totalStats.errorCount === 0 && totalStats.successCount > 0 && !token.isCancellationRequested;
        });
        // Compile after successful export (only for software, not HW-only)
        if (exportSuccess && await (0, compileHelper_1.shouldCompileAfterExport)()) {
            await (0, compileHelper_1.compileAndShowResults)(connectionService, selectedDevice.deviceId, selectedDevice.label);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error(`Export to TIA Portal error:`, error);
        logger_1.Logger.show();
        vscode.window.showErrorMessage(`${config.uiLabel}: ${message}`);
    }
}
/**
 * Unified export command - automatically detects folder type and exports appropriately.
 * For PLC device folders, exports: Program blocks, PLC tags, PLC data types, Watch tables, HW Config
 */
async function exportUnifiedToTiaCommand(connectionService, uri, uris) {
    if (uris && uris.length > 1) {
        return exportUnifiedMultiCore(connectionService, UNIFIED_CONFIG, uris);
    }
    return exportUnifiedCore(connectionService, UNIFIED_CONFIG, uri);
}
/**
 * Export command for program only (without HW Config).
 * Exports: Program blocks, PLC tags, PLC data types, Watch tables
 */
async function exportProgramToTiaCommand(connectionService, uri, uris) {
    if (uris && uris.length > 1) {
        return exportUnifiedMultiCore(connectionService, PROGRAM_ONLY_CONFIG, uris);
    }
    return exportUnifiedCore(connectionService, PROGRAM_ONLY_CONFIG, uri);
}
//# sourceMappingURL=exportUnified.js.map