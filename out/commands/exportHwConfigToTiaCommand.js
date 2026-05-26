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
exports.exportHwConfigToTiaCommand = exportHwConfigToTiaCommand;
exports.exportHwConfigFolderToTiaCommand = exportHwConfigFolderToTiaCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
/**
 * Command to export one or more HW Config XML files to TIA Portal.
 * Supports multi-select in the explorer (uris is provided when multiple resources are selected).
 */
async function exportHwConfigToTiaCommand(connectionService, uri, uris) {
    try {
        // Diagnostic: confirm what VS Code passed to the command (helps debug multi-select).
        logger_1.Logger.info(`Export HW Config invoked: uri=${uri ? path.basename(uri.fsPath) : 'undefined'}, ` +
            `uris=${uris ? `[${uris.length}] ${uris.map(u => path.basename(u.fsPath)).join(', ')}` : 'undefined'}`);
        // Check connection to TIA Portal
        if (!connectionService.isConnected) {
            const connect = await vscode.window.showWarningMessage('Export HW Config to TIA Portal: No connection to TIA Portal. Do you want to connect?', 'Connect', 'Cancel');
            if (connect === 'Connect') {
                const connected = await connectionService.connect();
                if (!connected) {
                    return;
                }
            }
            else {
                return;
            }
        }
        // Verify the connection is still alive
        if (!await connectionService.ensureConnected()) {
            return;
        }
        // Resolve list of file paths (multi-select aware)
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        let xmlFilePaths = [];
        if (uris && uris.length > 0) {
            xmlFilePaths = uris.map(u => u.fsPath);
        }
        else if (uri) {
            xmlFilePaths = [uri.fsPath];
        }
        else {
            const files = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: true,
                filters: {
                    'HW Config XML': ['xml'],
                    'AML Files': ['aml'],
                    'All Files': ['*']
                },
                title: 'Select HW Config XML file(s) to export to TIA Portal'
            });
            if (!files || files.length === 0) {
                return;
            }
            xmlFilePaths = files.map(f => f.fsPath);
        }
        // Filter out non-existent files
        xmlFilePaths = xmlFilePaths.filter(p => {
            if (!fs.existsSync(p)) {
                vscode.window.showWarningMessage(`Export HW Config: File does not exist: ${p}`);
                return false;
            }
            return true;
        });
        if (xmlFilePaths.length === 0) {
            return;
        }
        // For a single file, validate that it looks like HW Config (multi-select skips this check
        // because user explicitly chose the files).
        if (xmlFilePaths.length === 1) {
            const xmlFilePath = xmlFilePaths[0];
            const fileName = path.basename(xmlFilePath);
            const isHwConfig = fileName.includes('HwConfig') ||
                fileName.includes('DeviceConfiguration') ||
                xmlFilePath.includes('DeviceConfiguration') ||
                xmlFilePath.includes('Devices') ||
                fileName.endsWith('.aml');
            if (!isHwConfig) {
                const proceed = await vscode.window.showWarningMessage(`File "${fileName}" does not appear to be a HW Config file. Do you want to continue?`, 'Yes', 'No');
                if (proceed !== 'Yes') {
                    return;
                }
            }
        }
        // Ask about options once for the whole batch
        const options = await showHwConfigExportOptions();
        if (!options) {
            return; // User cancelled
        }
        logger_1.Logger.section(`EXPORT HW CONFIG TO TIA PORTAL`);
        logger_1.Logger.info(`Files: ${xmlFilePaths.length}`);
        logger_1.Logger.info(`Options: format=${options.format}, overwrite=${options.overwriteExisting}, update=${options.updateExisting}, network=${options.importNetworkConfig}, skipIfIdentical=${options.skipIfIdentical}`);
        let totalSuccess = 0;
        let totalFailed = 0;
        let totalSkipped = 0;
        const failedFiles = [];
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TIA Portal Export",
            cancellable: false
        }, async (progress) => {
            const bridge = connectionService.getBridge();
            const fileIncrement = 100 / xmlFilePaths.length;
            for (let i = 0; i < xmlFilePaths.length; i++) {
                const xmlFilePath = xmlFilePaths[i];
                const fileName = path.basename(xmlFilePath);
                const label = `[${i + 1}/${xmlFilePaths.length}] ${fileName}`;
                progress.report({ message: label, increment: i === 0 ? 0 : fileIncrement });
                logger_1.Logger.startOperation(`Export HW Config: ${fileName}`);
                try {
                    const result = await bridge.exportHwConfigFileToTia(xmlFilePath, options.overwriteExisting, options.updateExisting, options.importNetworkConfig, options.skipIfIdentical, options.showComparisonDetails, options.format);
                    const wasSkipped = result.skipped || false;
                    if (result.success) {
                        if (wasSkipped) {
                            totalSkipped++;
                            logger_1.Logger.info(`${label}: identical - skipped`);
                        }
                        else {
                            totalSuccess++;
                            logger_1.Logger.success(`${label}: ${result.method ?? 'OK'}${result.deviceName ? ` (${result.deviceName})` : ''}`);
                        }
                        logger_1.Logger.endOperation(`Export HW Config: ${fileName}`, true);
                    }
                    else {
                        totalFailed++;
                        failedFiles.push(`${fileName}: ${result.error || 'Unknown error'}`);
                        logger_1.Logger.error(`${label}: ${result.error}`);
                        logger_1.Logger.endOperation(`Export HW Config: ${fileName}`, false);
                    }
                    // Log per-file detailed messages
                    if (result.messages) {
                        for (const msg of result.messages) {
                            switch (msg.status) {
                                case 'Success':
                                    logger_1.Logger.success(`  ${msg.fileName}: ${msg.message}`);
                                    break;
                                case 'Warning':
                                    logger_1.Logger.warn(`  ${msg.fileName}: ${msg.message}`);
                                    break;
                                case 'Error':
                                    logger_1.Logger.error(`  ${msg.fileName}: ${msg.message}`);
                                    break;
                                default: logger_1.Logger.info(`  ${msg.fileName}: ${msg.message}`);
                            }
                        }
                    }
                }
                catch (err) {
                    totalFailed++;
                    const msg = err instanceof Error ? err.message : String(err);
                    failedFiles.push(`${fileName}: ${msg}`);
                    logger_1.Logger.error(`${label}: ${msg}`);
                    logger_1.Logger.endOperation(`Export HW Config: ${fileName}`, false);
                }
            }
        });
        // Show summary
        if (xmlFilePaths.length === 1) {
            if (totalFailed > 0) {
                vscode.window.showErrorMessage(`HW Config export failed: ${failedFiles[0]}`);
            }
            else if (totalSkipped > 0) {
                vscode.window.showInformationMessage(`HW Config: Configuration identical - update skipped`);
            }
            else {
                vscode.window.showInformationMessage(`HW Config exported to TIA Portal`);
            }
        }
        else {
            const parts = [];
            if (totalSuccess > 0)
                parts.push(`${totalSuccess} exported`);
            if (totalSkipped > 0)
                parts.push(`${totalSkipped} skipped`);
            if (totalFailed > 0)
                parts.push(`${totalFailed} failed`);
            const summary = `HW Config: ${parts.join(', ')} (${xmlFilePaths.length} total)`;
            if (totalFailed > 0) {
                vscode.window.showWarningMessage(summary, 'Show details').then(action => {
                    if (action === 'Show details') {
                        logger_1.Logger.show();
                    }
                });
            }
            else {
                vscode.window.showInformationMessage(summary);
            }
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error(`Export HW Config to TIA error: ${errorMessage}`);
        vscode.window.showErrorMessage(`HW Config export to TIA Portal error: ${errorMessage}`);
    }
}
/**
 * Command to export HW Config XML files from a folder to TIA Portal
 */
async function exportHwConfigFolderToTiaCommand(connectionService, uri) {
    try {
        // Check connection to TIA Portal
        if (!connectionService.isConnected) {
            const connect = await vscode.window.showWarningMessage('HW Config export to TIA Portal: No connection to TIA Portal. Do you want to connect?', 'Connect', 'Cancel');
            if (connect === 'Connect') {
                const connected = await connectionService.connect();
                if (!connected) {
                    return;
                }
            }
            else {
                return;
            }
        }
        // Verify the connection is still alive
        if (!await connectionService.ensureConnected()) {
            return;
        }
        // Get folder path
        let folderPath;
        if (uri) {
            folderPath = uri.fsPath;
        }
        else {
            const folders = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: 'Select folder with HW Config XML files to export to TIA Portal'
            });
            if (!folders || folders.length === 0) {
                return;
            }
            folderPath = folders[0].fsPath;
        }
        // Ask about options
        const options = await showHwConfigExportOptions();
        if (!options) {
            return; // User cancelled
        }
        logger_1.Logger.section(`EXPORT HW CONFIG FOLDER TO TIA PORTAL`);
        logger_1.Logger.info(`Folder: ${folderPath}`);
        logger_1.Logger.info(`Options: format=${options.format}, overwrite=${options.overwriteExisting}, update=${options.updateExisting}, network=${options.importNetworkConfig}, skipIfIdentical=${options.skipIfIdentical}`);
        let exportSuccess = false;
        let exportError = '';
        let exportSuccessCount = 0;
        let exportErrorCount = 0;
        let exportSkippedCount = 0;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TIA Portal Export",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: `Exporting HW Config to TIA Portal...` });
            logger_1.Logger.startOperation(`Export HW Config Folder`);
            const bridge = connectionService.getBridge();
            const result = await bridge.exportHwConfigFolderToTia(folderPath, options.overwriteExisting, options.updateExisting, options.importNetworkConfig, options.skipIfIdentical, options.showComparisonDetails, options.format);
            exportSuccess = result.success;
            exportError = result.error || '';
            exportSuccessCount = result.successCount || 0;
            exportErrorCount = result.errorCount || 0;
            exportSkippedCount = result.skippedCount || 0;
            if (result.success) {
                logger_1.Logger.success(`HW Config folder exported: ${result.successCount || 0} devices`);
                logger_1.Logger.endOperation(`Export HW Config Folder`, true);
            }
            else {
                logger_1.Logger.error(`Export failed: ${result.error}`);
                logger_1.Logger.endOperation(`Export HW Config Folder`, false);
            }
            // Log messages
            if (result.messages) {
                for (const msg of result.messages) {
                    switch (msg.status) {
                        case 'Success':
                            logger_1.Logger.success(`  ${msg.fileName}: ${msg.message}`);
                            break;
                        case 'Warning':
                            logger_1.Logger.warn(`  ${msg.fileName}: ${msg.message}`);
                            break;
                        case 'Error':
                            logger_1.Logger.error(`  ${msg.fileName}: ${msg.message}`);
                            break;
                        default:
                            logger_1.Logger.info(`  ${msg.fileName}: ${msg.message}`);
                    }
                }
            }
        });
        // Show result after progress closes
        if (exportSuccess) {
            let message = `HW Config: ${exportSuccessCount} devices exported`;
            if (exportErrorCount > 0) {
                message += `, ${exportErrorCount} errors`;
            }
            if (exportSkippedCount > 0) {
                message += `, ${exportSkippedCount} skipped`;
            }
            if (exportErrorCount > 0) {
                vscode.window.showWarningMessage(message);
            }
            else {
                vscode.window.showInformationMessage(message);
            }
        }
        else {
            vscode.window.showErrorMessage(`HW Config export failed: ${exportError}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error(`Export HW Config folder to TIA error: ${errorMessage}`);
        vscode.window.showErrorMessage(`HW Config export to TIA Portal failed: ${errorMessage}`);
    }
}
/**
 * Show dialog to select HW Config export options
 */
async function showHwConfigExportOptions() {
    // Format comes from global setting (Connection view -> Format HW).
    const format = (0, config_1.getConfig)().hwConfigFormat;
    // Ask about update/create behavior
    const updateOption = await vscode.window.showQuickPick([
        {
            label: '$(sync) Update existing (compare before updating)',
            description: 'Compare configuration and update only differences (recommended)',
            value: 'update'
        },
        {
            label: '$(add) Create new',
            description: 'Create new devices (may overwrite existing if names conflict)',
            value: 'create'
        },
        {
            label: '$(debug-step-over) Skip existing',
            description: 'Import only if the device does not exist in TIA Portal',
            value: 'skip'
        }
    ], {
        placeHolder: 'Select import mode for HW Config',
        title: 'HW Config Export to TIA Portal'
    });
    if (!updateOption) {
        return undefined;
    }
    // For update mode, ask about comparison behavior
    let skipIfIdentical = true;
    let showComparisonDetails = true;
    if (updateOption.value === 'update') {
        const comparisonOption = await vscode.window.showQuickPick([
            {
                label: '$(check) Compare and skip identical',
                description: 'Do not update if the configuration is identical (recommended)',
                value: 'compare'
            },
            {
                label: '$(refresh) Always update',
                description: 'Update even if the configuration is identical',
                value: 'always'
            }
        ], {
            placeHolder: 'How to handle identical configurations?',
            title: 'HW Config Export to TIA Portal'
        });
        if (!comparisonOption) {
            return undefined;
        }
        skipIfIdentical = comparisonOption.value === 'compare';
    }
    // Ask about network configuration
    const networkOption = await vscode.window.showQuickPick([
        {
            label: '$(globe) Import network configuration',
            description: 'Import IP addresses, PROFINET, etc.',
            value: true
        },
        {
            label: '$(circle-slash) Skip network configuration',
            description: 'Do not change network settings in TIA Portal',
            value: false
        }
    ], {
        placeHolder: 'Do you want to import network configuration?',
        title: 'HW Config Export to TIA Portal'
    });
    if (!networkOption) {
        return undefined;
    }
    return {
        overwriteExisting: updateOption.value === 'create',
        updateExisting: updateOption.value === 'update',
        importNetworkConfig: networkOption.value,
        skipIfIdentical: skipIfIdentical,
        showComparisonDetails: showComparisonDetails,
        format
    };
}
//# sourceMappingURL=exportHwConfigToTiaCommand.js.map