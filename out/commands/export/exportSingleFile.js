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
exports.exportXmlToTiaCommand = exportXmlToTiaCommand;
exports.exportBlockToTiaCommand = exportBlockToTiaCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const logger_1 = require("../../utils/logger");
const s7dclErrorParser_1 = require("../../utils/s7dclErrorParser");
const s7xmlErrorParser_1 = require("../../utils/s7xmlErrorParser");
const exportUtils_1 = require("./exportUtils");
const exportDialogs_1 = require("./exportDialogs");
const compileHelper_1 = require("./compileHelper");
const XML_EXPORT_CONFIG = {
    title: 'Export to TIA Portal',
    uiLabel: 'Export to TIA Portal',
    dialogTitle: 'Select file to export to TIA Portal (XML, .s7dcl, .scl)',
    logSection: 'EXPORT TO TIA PORTAL',
    useBlocksBasePath: false,
    offerCompile: false
};
const BLOCK_EXPORT_CONFIG = {
    title: 'Export blocks to TIA',
    uiLabel: 'Export blocks to TIA',
    dialogTitle: 'Select block file to export to TIA Portal',
    logSection: 'EXPORT BLOCK TO TIA PORTAL',
    useBlocksBasePath: true,
    offerCompile: true
};
/**
 * Core logic for exporting multiple files to TIA Portal in a single batch.
 */
async function exportMultipleFilesCore(connectionService, config, uris) {
    try {
        if (!await (0, exportDialogs_1.ensureConnection)(connectionService)) {
            return;
        }
        // Clear previous .s7dcl diagnostics
        (0, s7dclErrorParser_1.clearS7dclDiagnostics)();
        // Filter to supported files only
        const filePaths = uris
            .map(u => u.fsPath)
            .filter(f => exportUtils_1.SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()));
        if (filePaths.length === 0) {
            vscode.window.showWarningMessage(`${config.uiLabel}: No supported files in selection. Supported: ${exportUtils_1.SUPPORTED_EXTENSIONS.join(', ')}`);
            return;
        }
        const devices = (0, exportDialogs_1.validateProjectPlcDevices)(connectionService);
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
        logger_1.Logger.info(`Files: ${filePaths.length} selected`);
        logger_1.Logger.info(`Device: ${selectedDevice.label}`);
        logger_1.Logger.info(`Mode: ${overwriteMode.forceOverwrite ? 'Overwrite All' : 'Check and Overwrite Differences'}`);
        const exportSuccess = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: config.title,
            cancellable: true
        }, async (progress, token) => {
            const operationLabel = `${config.logSection}: ${filePaths.length} files`;
            logger_1.Logger.startOperation(operationLabel);
            const bridge = connectionService.getBridge();
            let successCount = 0;
            let errorCount = 0;
            let skippedCount = 0;
            // Clean export caches once before processing all files
            if (bridge.cleanExportCaches) {
                const firstBasePath = config.useBlocksBasePath
                    ? (0, exportUtils_1.findProgramBlocksBasePath)(filePaths[0])
                    : vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePaths[0]))?.uri.fsPath;
                await bridge.cleanExportCaches(firstBasePath);
            }
            for (let i = 0; i < filePaths.length; i++) {
                if (token.isCancellationRequested) {
                    logger_1.Logger.warn(`Export cancelled by user`);
                    break;
                }
                const filePath = filePaths[i];
                const fileName = path.basename(filePath);
                const progressLabel = `[${i + 1}/${filePaths.length}]`;
                progress.report({
                    message: `(${i + 1}/${filePaths.length}) ${fileName}`,
                    increment: (1 / filePaths.length) * 100
                });
                // Skip know-how protected block placeholders
                if ((0, exportUtils_1.isKnowHowProtectedPlaceholder)(filePath)) {
                    skippedCount++;
                    logger_1.Logger.info(`${progressLabel} \ud83d\udd12 ${fileName} (know-how protected - skipped)`);
                    continue;
                }
                const unitCtx = (0, exportUtils_1.detectUnitContext)(filePath);
                const basePath = config.useBlocksBasePath
                    ? (0, exportUtils_1.findProgramBlocksBasePath)(filePath)
                    : (unitCtx?.unitRoot ?? vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath))?.uri.fsPath);
                try {
                    const result = unitCtx
                        ? await bridge.importXmlFileToUnit(selectedDevice.deviceId, unitCtx.unitName, undefined, filePath, true, basePath, overwriteMode.compareBeforeImport, true)
                        : await bridge.importXmlFileToTia(selectedDevice.deviceId, filePath, true, basePath, overwriteMode.compareBeforeImport);
                    if (result.success && result.skipped) {
                        skippedCount++;
                        logger_1.Logger.info(`${progressLabel} \u2261 ${fileName} (identical)`);
                    }
                    else if (result.success) {
                        successCount++;
                        logger_1.Logger.success(`${progressLabel} \u2713 ${fileName}`);
                    }
                    else {
                        errorCount++;
                        // Enhanced error logging with line number resolution
                        const ext = path.extname(filePath).toLowerCase();
                        const enhancedErrors = result.error
                            ? (ext === '.s7dcl' ? (0, s7dclErrorParser_1.enhanceS7dclErrors)(filePath, result.error)
                                : ext === '.xml' ? (0, s7xmlErrorParser_1.enhanceXmlErrors)(filePath, result.error)
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
                    logger_1.Logger.error(`${progressLabel} \u2717 ${fileName}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            (0, exportUtils_1.reportExportSummary)(successCount, errorCount, skippedCount, operationLabel, config.uiLabel);
            return errorCount === 0 && successCount > 0;
        });
        // Compile after successful export (only for block exports)
        if (exportSuccess && config.offerCompile && await (0, compileHelper_1.shouldCompileAfterExport)()) {
            await (0, compileHelper_1.compileAndShowResults)(connectionService, selectedDevice.deviceId, selectedDevice.label);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error(`${config.uiLabel} failed:`, error);
        logger_1.Logger.show();
        vscode.window.showErrorMessage(`${config.uiLabel}: ${message}`);
    }
}
/**
 * Core logic for exporting a single file to TIA Portal.
 * Used by both exportXmlToTiaCommand and exportBlockToTiaCommand.
 */
async function exportSingleFileCore(connectionService, config, uri) {
    try {
        if (!await (0, exportDialogs_1.ensureConnection)(connectionService)) {
            return;
        }
        // Clear previous .s7dcl diagnostics
        (0, s7dclErrorParser_1.clearS7dclDiagnostics)();
        const filePath = await (0, exportDialogs_1.resolveFilePath)(uri, config.dialogTitle);
        if (!filePath) {
            return;
        }
        const devices = (0, exportDialogs_1.validateProjectPlcDevices)(connectionService);
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
        const ext = path.extname(filePath).toLowerCase();
        const fileType = ext === '.xml' ? 'XML' : ext === '.scl' ? 'SCL' : 'SD';
        // Check for know-how protected block placeholder
        if ((0, exportUtils_1.isKnowHowProtectedPlaceholder)(filePath)) {
            logger_1.Logger.section(config.logSection);
            logger_1.Logger.info(`File: ${filePath}`);
            logger_1.Logger.warn(`Know-how protected block placeholder - skipping export to TIA Portal`);
            vscode.window.showWarningMessage(`${config.uiLabel}: "${path.basename(filePath)}" is a know-how protected block placeholder - cannot be exported to TIA Portal`);
            return;
        }
        logger_1.Logger.section(config.logSection);
        logger_1.Logger.info(`File: ${filePath}`);
        if (config.useBlocksBasePath) {
            logger_1.Logger.info(`Type: ${fileType}`);
        }
        logger_1.Logger.info(`Device: ${selectedDevice.label}`);
        logger_1.Logger.info(`Mode: ${overwriteMode.forceOverwrite ? 'Overwrite All' : 'Check and Overwrite Differences'}`);
        // Determine Software Unit scope and base path
        const unitCtx = (0, exportUtils_1.detectUnitContext)(filePath);
        const basePath = config.useBlocksBasePath
            ? (0, exportUtils_1.findProgramBlocksBasePath)(filePath)
            : (unitCtx?.unitRoot ?? vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath))?.uri.fsPath);
        if (basePath) {
            logger_1.Logger.info(`Base path: ${basePath}`);
        }
        if (unitCtx) {
            logger_1.Logger.info(`Software Unit scope: ${unitCtx.unitName}`);
        }
        const singleExportSuccess = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: config.title,
            cancellable: false
        }, async (progress) => {
            const typeLabel = config.useBlocksBasePath ? `block (${fileType})` : 'file';
            progress.report({ message: `Exporting ${typeLabel} to ${selectedDevice.label}...` });
            logger_1.Logger.startOperation(`${config.logSection}: ${filePath}`);
            const bridge = connectionService.getBridge();
            const result = unitCtx
                ? await bridge.importXmlFileToUnit(selectedDevice.deviceId, unitCtx.unitName, undefined, filePath, true, basePath, overwriteMode.compareBeforeImport, true)
                : await bridge.importXmlFileToTia(selectedDevice.deviceId, filePath, true, basePath, overwriteMode.compareBeforeImport);
            const relPath = vscode.workspace.asRelativePath(filePath);
            if (result.success && result.skipped) {
                logger_1.Logger.success(`${config.useBlocksBasePath ? 'Block' : 'File'} identical - skipped`);
                logger_1.Logger.endOperation(`${config.logSection}: ${filePath}`, true);
                vscode.window.showInformationMessage(`${config.uiLabel}: "${relPath}" is identical - skipped`);
            }
            else if (result.success) {
                logger_1.Logger.success(`${config.useBlocksBasePath ? 'Block' : 'File'} imported to TIA Portal`);
                (0, exportUtils_1.logImportResultDetails)(result);
                logger_1.Logger.endOperation(`${config.logSection}: ${filePath}`, true);
                vscode.window.showInformationMessage(`${config.uiLabel}: "${relPath}" successfully imported to ${selectedDevice.label}`);
            }
            else {
                logger_1.Logger.error(`${config.uiLabel} failed`);
                if (result.error) {
                    // Enhanced error logging with line number resolution
                    const ext = path.extname(filePath).toLowerCase();
                    const enhancedErrors = ext === '.s7dcl' ? (0, s7dclErrorParser_1.enhanceS7dclErrors)(filePath, result.error)
                        : ext === '.xml' ? (0, s7xmlErrorParser_1.enhanceXmlErrors)(filePath, result.error)
                            : null;
                    if (enhancedErrors && enhancedErrors.length > 0) {
                        logger_1.Logger.error(`Errors found:`);
                        for (const errLine of enhancedErrors) {
                            logger_1.Logger.error(errLine);
                        }
                    }
                    else {
                        logger_1.Logger.error(`Error: ${result.error}`);
                    }
                }
                (0, exportUtils_1.logImportResultDetails)(result);
                logger_1.Logger.show();
                logger_1.Logger.endOperation(`${config.logSection}: ${filePath}`, false);
                vscode.window.showErrorMessage(`${config.uiLabel}: ${result.error || 'Unknown error'}`);
            }
            return result.success === true;
        });
        // Compile after successful export (only for block exports)
        if (singleExportSuccess && config.offerCompile && await (0, compileHelper_1.shouldCompileAfterExport)()) {
            await (0, compileHelper_1.compileAndShowResults)(connectionService, selectedDevice.deviceId, selectedDevice.label);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error(`${config.uiLabel} failed:`, error);
        logger_1.Logger.show();
        vscode.window.showErrorMessage(`${config.uiLabel}: ${message}`);
    }
}
/**
 * Command to export a single XML file to TIA Portal
 */
async function exportXmlToTiaCommand(connectionService, uri, uris) {
    if (uris && uris.length > 1) {
        return exportMultipleFilesCore(connectionService, XML_EXPORT_CONFIG, uris);
    }
    return exportSingleFileCore(connectionService, XML_EXPORT_CONFIG, uri);
}
/**
 * Command to export a single block file (XML, SCL, or SD) to TIA Portal
 * This is context-menu command for "Program blocks" folder files
 */
async function exportBlockToTiaCommand(connectionService, uri, uris) {
    if (uris && uris.length > 1) {
        return exportMultipleFilesCore(connectionService, BLOCK_EXPORT_CONFIG, uris);
    }
    return exportSingleFileCore(connectionService, BLOCK_EXPORT_CONFIG, uri);
}
//# sourceMappingURL=exportSingleFile.js.map