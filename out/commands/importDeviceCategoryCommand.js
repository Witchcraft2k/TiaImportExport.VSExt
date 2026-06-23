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
exports.importDeviceCategoryCommand = importDeviceCategoryCommand;
exports.importDeviceCategoryHwConfigCommand = importDeviceCategoryHwConfigCommand;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const workspace_1 = require("../utils/workspace");
const config_1 = require("../utils/config");
const projectImport_1 = require("../services/projectImport");
const pathBuilder_1 = require("../services/import/pathBuilder");
const importProgressEstimator_1 = require("../services/import/importProgressEstimator");
const s7dclPreviewMirror_1 = require("../utils/s7dclPreviewMirror");
/**
 * Import all devices in a category (PLCs, HMIs, IO_Devices, Computers)
 */
async function importDeviceCategoryCommand(importService, connectionService, item) {
    try {
        if (!await workspace_1.WorkspaceManager.ensureWorkspace()) {
            return;
        }
        // Verify connection to TIA Portal is alive
        if (!await importService.ensureConnected()) {
            return;
        }
        if (!item) {
            logger_1.Logger.warn('Import device category failed - no category selected');
            vscode.window.showWarningMessage('TIA Import: No device category selected');
            return;
        }
        const projectName = importService.getCurrentProjectName();
        if (!projectName) {
            logger_1.Logger.warn('Import device category failed - no project selected');
            vscode.window.showWarningMessage('TIA Import: No project selected');
            return;
        }
        const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
        if (!exportPath) {
            logger_1.Logger.error('Could not determine import path');
            vscode.window.showErrorMessage('TIA Import: Could not determine import path.');
            return;
        }
        const categoryName = item.id;
        const project = connectionService.currentProject;
        if (!project) {
            logger_1.Logger.warn('Import device category failed - no project loaded');
            vscode.window.showWarningMessage('TIA Import: Project is not loaded');
            return;
        }
        // Get devices in this category
        const devicesInCategory = project.devices.filter(d => (0, projectImport_1.getDeviceCategoryFolder)(d.type) === categoryName);
        if (devicesInCategory.length === 0) {
            vscode.window.showInformationMessage(`TIA Import: No devices in category ${categoryName}`);
            return;
        }
        logger_1.Logger.section(`IMPORT DEVICE CATEGORY: ${categoryName}`);
        logger_1.Logger.info(`Project: ${projectName}`);
        logger_1.Logger.info(`Devices in category: ${devicesInCategory.length}`);
        logger_1.Logger.info(`Import path: ${exportPath}`);
        let totalItemCount = 0;
        let totalUpdatedCount = 0;
        let totalDeletedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TIA Import",
            cancellable: true
        }, async (progress, token) => {
            const config = (0, config_1.getConfig)();
            const progressEstimate = (0, importProgressEstimator_1.estimateImportProgressForDevices)(devicesInCategory, {
                exportFormat: config.exportFormat,
                dbExportFormat: config.dbExportFormat,
                excludeSystemBlocks: config.excludeSystemBlocks,
                s7dclPreviewXmlEnabled: (0, s7dclPreviewMirror_1.isS7dclPreviewMirrorEnabled)(),
                itemsPerSecond: config.importProgressItemsPerSecond
            });
            const timedProgress = new importProgressEstimator_1.TimedImportProgress((message, increment) => progress.report({ message, increment }), progressEstimate, { startPercent: 0, spanPercent: 100 });
            logger_1.Logger.info(`Category import progress estimate: ${(0, importProgressEstimator_1.formatImportProgressEstimate)(progressEstimate)} `
                + `at ${config.importProgressItemsPerSecond} item(s)/second`);
            timedProgress.start(`Importing ${categoryName} devices...`);
            try {
                for (const device of devicesInCategory) {
                    if (token.isCancellationRequested) {
                        logger_1.Logger.warn('Import cancelled by user');
                        break;
                    }
                    const displayName = device.displayName || device.name;
                    timedProgress.setMessage(`Importing device: ${displayName}...`);
                    logger_1.Logger.info(`├─ Importing: ${displayName}`);
                    const result = await importService.importDevice(device.id, exportPath, (status) => timedProgress.setMessage(status), token, { useTimedProgress: false });
                    if (result.success) {
                        totalItemCount += result.itemCount || 0;
                        totalUpdatedCount += result.updatedCount || 0;
                        totalDeletedCount += result.deletedCount || 0;
                        successCount++;
                        const devUpdated = result.updatedCount || 0;
                        const devDeleted = result.deletedCount || 0;
                        const devTotal = result.itemCount || 0;
                        if (devUpdated > 0 || devDeleted > 0) {
                            const parts = [];
                            if (devUpdated > 0)
                                parts.push(`${devUpdated} updated`);
                            if (devDeleted > 0)
                                parts.push(`${devDeleted} deleted`);
                            logger_1.Logger.debug(`│  └─ ${parts.join(', ')} (${devTotal} items)`);
                        }
                        else if (devTotal > 0) {
                            logger_1.Logger.debug(`│  └─ No changes (${devTotal} items)`);
                        }
                        else {
                            logger_1.Logger.debug(`│  └─ No items`);
                        }
                    }
                    else {
                        errorCount++;
                        logger_1.Logger.warn(`│  └─ Failed: ${result.error}`);
                    }
                }
                if (!token.isCancellationRequested) {
                    timedProgress.complete('Finalizing category import...');
                }
            }
            finally {
                timedProgress.dispose();
            }
        });
        if (successCount > 0) {
            if (totalUpdatedCount > 0 || totalDeletedCount > 0) {
                const parts = [];
                if (totalUpdatedCount > 0)
                    parts.push(`${totalUpdatedCount} updated`);
                if (totalDeletedCount > 0)
                    parts.push(`${totalDeletedCount} deleted`);
                logger_1.Logger.success(`Category import completed: ${successCount} devices, ${parts.join(', ')} (${totalItemCount} items checked)`);
                vscode.window.showInformationMessage(`TIA Import: Imported ${successCount} devices from category "${categoryName}" (${parts.join(', ')}, ${totalItemCount} checked)`);
            }
            else {
                logger_1.Logger.success(`Category import completed: ${successCount} devices, no changes (${totalItemCount} items checked)`);
                vscode.window.showInformationMessage(`TIA Import: Imported ${successCount} devices from category "${categoryName}" - no changes (${totalItemCount} checked)`);
            }
        }
        if (errorCount > 0) {
            vscode.window.showWarningMessage(`TIA Import: Failed to import ${errorCount} devices`);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Failed to import device category', error);
        vscode.window.showErrorMessage(`TIA Import: ${message}`);
    }
}
/**
 * Import HW Config for all devices in a category
 */
async function importDeviceCategoryHwConfigCommand(connectionService, item) {
    try {
        if (!await workspace_1.WorkspaceManager.ensureWorkspace()) {
            return;
        }
        // Verify connection to TIA Portal is alive
        if (!await connectionService.ensureConnected()) {
            return;
        }
        if (!item) {
            logger_1.Logger.warn('Import device category HW config failed - no category selected');
            vscode.window.showWarningMessage('TIA Import: No device category selected');
            return;
        }
        const projectName = connectionService.currentProjectName;
        if (!projectName) {
            logger_1.Logger.warn('Import device category HW config failed - no project selected');
            vscode.window.showWarningMessage('TIA Import: No project selected');
            return;
        }
        const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
        if (!exportPath) {
            logger_1.Logger.error('Could not determine export path');
            vscode.window.showErrorMessage('TIA Import: Could not determine export path.');
            return;
        }
        const categoryName = item.id;
        const project = connectionService.currentProject;
        if (!project) {
            logger_1.Logger.warn('Import device category HW config failed - no project loaded');
            vscode.window.showWarningMessage('TIA Import: Project is not loaded');
            return;
        }
        // Get devices in this category
        const devicesInCategory = project.devices.filter(d => (0, projectImport_1.getDeviceCategoryFolder)(d.type) === categoryName);
        if (devicesInCategory.length === 0) {
            vscode.window.showInformationMessage(`TIA Import: No devices in category ${categoryName}`);
            return;
        }
        logger_1.Logger.section(`IMPORT DEVICE CATEGORY HW CONFIG: ${categoryName}`);
        logger_1.Logger.info(`Project: ${projectName}`);
        logger_1.Logger.info(`Devices in category: ${devicesInCategory.length}`);
        let successCount = 0;
        let errorCount = 0;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TIA Import HW Config",
            cancellable: true
        }, async (progress, token) => {
            const config = (0, config_1.getConfig)();
            const progressEstimate = (0, importProgressEstimator_1.estimateHwConfigImportProgressForDevices)(devicesInCategory, {
                itemsPerSecond: config.importProgressItemsPerSecond
            });
            const timedProgress = new importProgressEstimator_1.TimedImportProgress((message, increment) => progress.report({ message, increment }), progressEstimate, { startPercent: 0, spanPercent: 100 });
            logger_1.Logger.info(`Category HW Config import progress estimate: ${(0, importProgressEstimator_1.formatHwConfigProgressEstimate)(progressEstimate)} `
                + `at ${config.importProgressItemsPerSecond} item(s)/second`);
            const bridge = connectionService.getBridge();
            timedProgress.start(`Importing HW Config for ${categoryName} devices...`);
            try {
                for (const device of devicesInCategory) {
                    if (token.isCancellationRequested) {
                        logger_1.Logger.warn('Import cancelled by user');
                        break;
                    }
                    const displayName = device.displayName || device.name;
                    timedProgress.setMessage(`Importing HW Config: ${displayName}...`);
                    logger_1.Logger.info(`├─ Importing HW Config: ${displayName}`);
                    // Build per-device HW Config path, preserving TIA folder structure.
                    // Root IO devices keep the legacy flat layout; IO devices inside
                    // TIA folders use a per-device DeviceConfiguration subfolder.
                    const hwConfigPath = (0, pathBuilder_1.buildDeviceHwConfigPath)(device, exportPath);
                    const result = await bridge.importDeviceHwConfig(device.name, // Use technical device name for API lookup
                    true, // includeChannels
                    true, // includeAddresses
                    true, // includeNetworkConfig
                    true, // exportToXml
                    hwConfigPath, config.hwConfigFormat);
                    if (result.success) {
                        successCount++;
                        logger_1.Logger.debug(`│  └─ HW Config imported`);
                    }
                    else {
                        errorCount++;
                        logger_1.Logger.warn(`│  └─ Failed: ${result.error}`);
                    }
                }
                if (!token.isCancellationRequested) {
                    timedProgress.complete('Finalizing category HW Config import...');
                }
            }
            finally {
                timedProgress.dispose();
            }
        });
        if (successCount > 0) {
            logger_1.Logger.success(`Category HW Config import completed: ${successCount} devices`);
            vscode.window.showInformationMessage(`TIA Import: Imported HW Config for ${successCount} devices from category "${categoryName}"`);
        }
        if (errorCount > 0) {
            vscode.window.showWarningMessage(`TIA Import: Failed to import HW Config for ${errorCount} devices`);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Failed to import device category HW config', error);
        vscode.window.showErrorMessage(`TIA Import: ${message}`);
    }
}
//# sourceMappingURL=importDeviceCategoryCommand.js.map