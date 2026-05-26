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
exports.importHwConfigCommand = importHwConfigCommand;
exports.importDeviceHwConfigCommand = importDeviceHwConfigCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const projectImport_1 = require("../services/projectImport");
const logger_1 = require("../utils/logger");
const workspace_1 = require("../utils/workspace");
const config_1 = require("../utils/config");
/**
 * Import HW Config from TIA Portal for the entire project
 * Iterates all devices and imports each one's HW config with proper folder structure.
 */
async function importHwConfigCommand(connectionService, item) {
    try {
        // Ensure workspace is open
        if (!await workspace_1.WorkspaceManager.ensureWorkspace()) {
            return;
        }
        // Verify connection to TIA Portal is alive
        if (!await connectionService.ensureConnected()) {
            return;
        }
        const projectName = connectionService.currentProjectName;
        if (!projectName) {
            logger_1.Logger.warn('Import HW Config failed - no project selected');
            vscode.window.showWarningMessage('TIA Import: No project selected');
            return;
        }
        const project = connectionService.currentProject;
        if (!project || !project.devices || project.devices.length === 0) {
            logger_1.Logger.warn('Import HW Config failed - no devices in project');
            vscode.window.showWarningMessage('TIA Import: No devices in the project');
            return;
        }
        // Ask user for options
        const options = await showHwConfigOptionsDialog();
        if (!options) {
            return; // User cancelled
        }
        const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
        if (!exportPath) {
            logger_1.Logger.error('Could not determine export path');
            vscode.window.showErrorMessage('TIA Import: Could not determine export path.');
            return;
        }
        const allDevices = project.devices;
        logger_1.Logger.section(`IMPORT HW CONFIG: ${projectName}`);
        logger_1.Logger.info(`Devices: ${allDevices.length}`);
        logger_1.Logger.info(`Options: format=${options.format}, channels=${options.includeChannels}, addresses=${options.includeAddresses}, network=${options.includeNetworkConfig}`);
        let successCount = 0;
        let errorCount = 0;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TIA Import HW Config",
            cancellable: true
        }, async (progress, token) => {
            logger_1.Logger.startOperation(`Import HW Config`);
            const bridge = connectionService.getBridge();
            const deviceIncrement = 100 / allDevices.length;
            for (let i = 0; i < allDevices.length; i++) {
                if (token.isCancellationRequested) {
                    logger_1.Logger.warn('Import cancelled by user');
                    break;
                }
                const device = allDevices[i];
                const displayName = device.displayName || device.name;
                const deviceType = device.type || 'Device';
                const categoryFolder = (0, projectImport_1.getDeviceCategoryFolder)(deviceType);
                // IO_Devices: flat layout (XML directly in IO_Devices/). Other categories: per-device DeviceConfiguration subfolder.
                const hwConfigPath = categoryFolder === 'IO_Devices'
                    ? path.join(exportPath, 'Devices', categoryFolder)
                    : path.join(exportPath, 'Devices', categoryFolder, displayName, 'DeviceConfiguration');
                const progressLabel = `[${i + 1}/${allDevices.length}]`;
                progress.report({
                    message: `${progressLabel} ${displayName}`,
                    increment: deviceIncrement
                });
                logger_1.Logger.info(`${progressLabel} Importing HW Config: ${displayName}`);
                try {
                    const result = await bridge.importDeviceHwConfig(device.name, // Use technical device name for API lookup
                    options.includeChannels, options.includeAddresses, options.includeNetworkConfig, true, // exportToXml - always export
                    hwConfigPath, options.format);
                    if (result.success) {
                        successCount++;
                        logger_1.Logger.success(`${progressLabel} ✓ ${displayName}`);
                    }
                    else {
                        errorCount++;
                        logger_1.Logger.error(`${progressLabel} ✗ ${displayName}: ${result.error || 'Unknown error'}`);
                    }
                }
                catch (err) {
                    errorCount++;
                    logger_1.Logger.error(`${progressLabel} ✗ ${displayName}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            if (errorCount === 0) {
                logger_1.Logger.success(`HW Config imported: ${successCount} devices`);
                logger_1.Logger.endOperation(`Import HW Config`, true);
            }
            else {
                logger_1.Logger.warn(`HW Config import completed with errors: ${successCount} success, ${errorCount} errors`);
                logger_1.Logger.endOperation(`Import HW Config`, errorCount === 0);
            }
        });
        // Show result after progress closes
        if (successCount > 0 && errorCount === 0) {
            const hwBasePath = path.join(exportPath, 'Devices');
            const openFolder = await vscode.window.showInformationMessage(`TIA Import: HW configuration imported (${successCount} devices)`, 'Open folder');
            if (openFolder) {
                const uri = vscode.Uri.file(hwBasePath);
                await vscode.commands.executeCommand('revealFileInOS', uri);
            }
        }
        else if (successCount > 0) {
            vscode.window.showWarningMessage(`TIA Import: HW Config: ${successCount} success, ${errorCount} errors. Check Output.`);
        }
        else if (errorCount > 0) {
            vscode.window.showErrorMessage(`TIA Import: HW Config import failed (${errorCount} errors). Check Output.`);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Failed to import HW config', error);
        vscode.window.showErrorMessage(`TIA Import: ${message}`);
    }
}
/**
 * Import HW Config for a specific device
 */
async function importDeviceHwConfigCommand(connectionService, item) {
    try {
        // Ensure workspace is open
        if (!await workspace_1.WorkspaceManager.ensureWorkspace()) {
            return;
        }
        // Verify connection to TIA Portal is alive
        if (!await connectionService.ensureConnected()) {
            return;
        }
        if (!item) {
            logger_1.Logger.warn('Import device HW config failed - no device selected');
            vscode.window.showWarningMessage('TIA Import: No device selected');
            return;
        }
        const projectName = connectionService.currentProjectName;
        if (!projectName) {
            logger_1.Logger.warn('Import device HW config failed - no project selected');
            vscode.window.showWarningMessage('TIA Import: No project selected');
            return;
        }
        // Ask user for options
        const options = await showHwConfigOptionsDialog();
        if (!options) {
            return; // User cancelled
        }
        const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
        if (!exportPath) {
            logger_1.Logger.error('Could not determine export path');
            vscode.window.showErrorMessage('TIA Import: Could not determine export path.');
            return;
        }
        // Use technicalName from metadata for API lookup, label for display
        const deviceId = item.metadata?.technicalName || item.id;
        const displayName = item.label?.toString() || item.id;
        const deviceType = item.metadata?.deviceType || 'Device';
        // Get device category folder (PLCs, HMIs, or IO_Devices)
        const categoryFolder = (0, projectImport_1.getDeviceCategoryFolder)(deviceType);
        // IO_Devices: flat layout (XML directly in IO_Devices/). Other categories: per-device DeviceConfiguration subfolder.
        const hwConfigPath = categoryFolder === 'IO_Devices'
            ? path.join(exportPath, 'Devices', categoryFolder)
            : path.join(exportPath, 'Devices', categoryFolder, displayName, 'DeviceConfiguration');
        logger_1.Logger.section(`IMPORT DEVICE HW CONFIG: ${displayName}`);
        logger_1.Logger.info(`Device ID: ${deviceId}`);
        logger_1.Logger.info(`Export path: ${hwConfigPath}`);
        let importSuccess = false;
        let importError;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TIA Import",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: `Importing device HW configuration: ${displayName}...` });
            logger_1.Logger.startOperation(`Import Device HW Config: ${displayName}`);
            const bridge = connectionService.getBridge();
            const result = await bridge.importDeviceHwConfig(deviceId, // Use technical device ID for lookup
            options.includeChannels, options.includeAddresses, options.includeNetworkConfig, true, // exportToXml - always export
            hwConfigPath, options.format);
            if (result.success) {
                logger_1.Logger.success(`Device HW Config imported: ${displayName}`);
                logger_1.Logger.info(`Saved to: ${hwConfigPath}`);
                logger_1.Logger.endOperation(`Import Device HW Config: ${displayName}`, true);
                importSuccess = true;
            }
            else {
                logger_1.Logger.endOperation(`Import Device HW Config: ${displayName}`, false);
                importError = result.error || 'Unknown error';
            }
        });
        // Show result after progress closes
        if (importSuccess) {
            const openFolder = await vscode.window.showInformationMessage(`TIA Import: Device HW configuration "${displayName}" imported`, 'Open folder');
            if (openFolder) {
                const uri = vscode.Uri.file(hwConfigPath);
                await vscode.commands.executeCommand('revealFileInOS', uri);
            }
        }
        else {
            throw new Error(importError);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Failed to import device HW config', error);
        vscode.window.showErrorMessage(`TIA Import: ${message}`);
    }
}
/**
 * Show dialog for HW Config import options
 */
async function showHwConfigOptionsDialog() {
    const items = [
        { label: '$(check) I/O channels', description: 'Import input/output channel information', picked: true },
        { label: '$(check) Addresses', description: 'Import I/O module addresses', picked: true },
        { label: '$(check) Network configuration', description: 'Import network interfaces and IP addresses', picked: true },
        { label: '$(check) Subnets', description: 'Import subnet information', picked: true },
    ];
    const selected = await vscode.window.showQuickPick(items, {
        title: 'HW configuration import options',
        placeHolder: 'Select items to import',
        canPickMany: true
    });
    if (!selected) {
        return undefined;
    }
    // Format comes from global setting (Connection view -> Format HW). User can
    // change it once via the connection tree instead of being prompted every time.
    const format = (0, config_1.getConfig)().hwConfigFormat;
    return {
        includeChannels: selected.some(s => s.label.includes('I/O channels')),
        includeAddresses: selected.some(s => s.label.includes('Addresses')),
        includeNetworkConfig: selected.some(s => s.label.includes('Network')),
        includeSubnets: selected.some(s => s.label.includes('Subnets')),
        format
    };
}
//# sourceMappingURL=importHwConfigCommand.js.map