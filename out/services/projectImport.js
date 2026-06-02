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
exports.ProjectImportService = exports.getDeviceCategoryFolder = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const tiaOpennessBridge_1 = require("./tiaOpennessBridge");
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
const blockImportService_1 = require("./import/blockImportService");
const tagTableImportService_1 = require("./import/tagTableImportService");
const udtImportService_1 = require("./import/udtImportService");
const watchTableImportService_1 = require("./import/watchTableImportService");
const hmiImportService_1 = require("./import/hmiImportService");
const importProgressEstimator_1 = require("./import/importProgressEstimator");
const pathBuilder_1 = require("./import/pathBuilder");
Object.defineProperty(exports, "getDeviceCategoryFolder", { enumerable: true, get: function () { return pathBuilder_1.getDeviceCategoryFolder; } });
const s7dclPreviewMirror_1 = require("../utils/s7dclPreviewMirror");
/**
 * Service responsible for importing TIA Portal projects to XML
 * Orchestrates the import process using specialized sub-services
 */
class ProjectImportService {
    _connectionService;
    _bridge;
    // Sub-services for specific import operations
    _blockImportService;
    _tagTableImportService;
    _udtImportService;
    _watchTableImportService;
    _hmiImportService;
    constructor(connectionService) {
        this._connectionService = connectionService;
        this._bridge = new tiaOpennessBridge_1.TiaOpennessBridge();
        // Bind path builders to the current connection service so sub-services
        // receive simple (parentPath, exportPath) callables.
        const buildPath = (parentPath, exportPath) => (0, pathBuilder_1.buildDevicePlcPath)(connectionService, parentPath, exportPath);
        const buildHmiPath = (deviceId, exportPath) => (0, pathBuilder_1.buildDeviceHmiPath)(connectionService, deviceId, exportPath);
        this._blockImportService = new blockImportService_1.BlockImportService(connectionService, this._bridge, buildPath);
        this._tagTableImportService = new tagTableImportService_1.TagTableImportService(connectionService, this._bridge, buildPath);
        this._udtImportService = new udtImportService_1.UdtImportService(connectionService, this._bridge, buildPath);
        this._watchTableImportService = new watchTableImportService_1.WatchTableImportService(connectionService, this._bridge, buildPath);
        this._hmiImportService = new hmiImportService_1.HmiImportService(connectionService, this._bridge, buildHmiPath);
    }
    /**
     * Get the current project name
     */
    getCurrentProjectName() {
        return this._connectionService.currentProjectName;
    }
    /**
     * Verify connection to TIA Portal is alive before performing operations.
     * Auto-disconnects if connection is broken.
     */
    async ensureConnected() {
        return this._connectionService.ensureConnected();
    }
    /**
     * Build the device/PLC path for export
     * Returns path like: exportPath/projectName/Devices/PLCs|HMIs|IO_Devices/deviceName/plcName
     */
    buildDevicePlcPath(parentPath, exportPath) {
        return (0, pathBuilder_1.buildDevicePlcPath)(this._connectionService, parentPath, exportPath);
    }
    /**
     * Build the device path for HMI export
     * Returns path like: exportPath/projectName/Devices/HMIs/deviceName
     */
    buildDeviceHmiPath(deviceId, exportPath) {
        return (0, pathBuilder_1.buildDeviceHmiPath)(this._connectionService, deviceId, exportPath);
    }
    // ==================== PROJECT & DEVICE EXPORT ====================
    /**
     * Import entire project to local folder structure
     */
    async importProject(exportPath, progress, cancellationToken) {
        const project = this._connectionService.currentProject;
        if (!project) {
            logger_1.Logger.error('No project selected for import');
            return {
                success: false,
                error: 'No project selected'
            };
        }
        logger_1.Logger.startOperation(`Import project: ${project.name}`);
        let timedProgress;
        try {
            // exportPath already contains project name from WorkspaceManager.getProjectExportPath()
            const projectPath = exportPath;
            const config = (0, config_1.getConfig)();
            // Create base directory structure
            progress?.('5% - Creating directory structure...', 5);
            logger_1.Logger.info('Creating directory structure...');
            await this.createDirectoryStructure(projectPath);
            // Import project info
            progress?.('15% - Importing project info...', 10);
            logger_1.Logger.info('Importing project metadata...');
            await this.exportProjectInfo(project, projectPath);
            let itemCount = 0;
            let totalUpdated = 0;
            let totalUnchanged = 0;
            let totalDeleted = 0;
            const allMessages = [];
            const devices = project.devices;
            const progressEstimate = this.createProgressEstimate(devices, config);
            if (progress) {
                timedProgress = new importProgressEstimator_1.TimedImportProgress(progress, progressEstimate, {
                    startPercent: 15,
                    spanPercent: 80
                });
                timedProgress.start('Importing project data...');
            }
            logger_1.Logger.info(`Import progress estimate: ${(0, importProgressEstimator_1.formatImportProgressEstimate)(progressEstimate)} `
                + `at ${config.importProgressItemsPerSecond} item(s)/second`);
            logger_1.Logger.section(`Importing ${devices.length} device(s)`);
            // Import each device
            for (const device of devices) {
                if (cancellationToken?.isCancellationRequested) {
                    logger_1.Logger.warn('Import cancelled by user');
                    logger_1.Logger.endOperation(`Import project: ${project.name}`, false);
                    return { success: false, error: 'Operation cancelled' };
                }
                const deviceName = device.displayName || device.name;
                timedProgress?.setMessage(`Importing device: ${deviceName}...`);
                logger_1.Logger.info(`├─ Device: ${deviceName} (${device.type})`);
                const deviceResult = await this.importDevice(device.id, exportPath, timedProgress ? (status) => timedProgress?.setMessage(status) : undefined, cancellationToken, { useTimedProgress: false });
                if (deviceResult.success) {
                    const devUpdated = deviceResult.updatedCount || 0;
                    const devUnchanged = deviceResult.unchangedCount || 0;
                    const devDeleted = deviceResult.deletedCount || 0;
                    const devTotal = deviceResult.itemCount || 0;
                    itemCount += devTotal;
                    totalUpdated += devUpdated;
                    totalUnchanged += devUnchanged;
                    totalDeleted += devDeleted;
                    if (deviceResult.messages) {
                        allMessages.push(...deviceResult.messages);
                    }
                    if (devUpdated > 0 || devDeleted > 0) {
                        const parts = [];
                        if (devUpdated > 0)
                            parts.push(`${devUpdated} updated`);
                        if (devDeleted > 0)
                            parts.push(`${devDeleted} deleted`);
                        parts.push(`${devUnchanged} unchanged`);
                        logger_1.Logger.debug(`│  └─ ${parts.join(', ')} (${devTotal} total)`);
                    }
                    else if (devTotal > 0) {
                        logger_1.Logger.debug(`│  └─ No changes (${devTotal} items)`);
                    }
                    else {
                        logger_1.Logger.debug(`│  └─ No items`);
                    }
                }
                else {
                    logger_1.Logger.warn(`│  └─ Failed to import device: ${deviceResult.error}`);
                }
            }
            timedProgress?.complete('Finalizing import...');
            progress?.('100% (done) - Finalizing import...', 5);
            if (totalUpdated > 0 || totalDeleted > 0) {
                const parts = [];
                if (totalUpdated > 0)
                    parts.push(`${totalUpdated} updated`);
                if (totalDeleted > 0)
                    parts.push(`${totalDeleted} deleted`);
                parts.push(`${totalUnchanged} unchanged`);
                logger_1.Logger.success(`Import completed: ${parts.join(', ')} (${itemCount} total)`);
            }
            else {
                logger_1.Logger.success(`Import completed: no changes (${itemCount} items checked)`);
            }
            logger_1.Logger.endOperation(`Import project: ${project.name}`, true);
            return {
                success: true,
                filePath: projectPath,
                itemCount,
                successCount: totalUpdated,
                messages: allMessages
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error('Project import failed', error);
            logger_1.Logger.endOperation(`Import project: ${project.name}`, false);
            return {
                success: false,
                error: message
            };
        }
        finally {
            timedProgress?.dispose();
        }
    }
    /**
     * Import a specific device
     */
    async importDevice(deviceId, exportPath, progress, cancellationToken, progressOptions = {}) {
        const project = this._connectionService.currentProject;
        const device = this._connectionService.getDevice(deviceId);
        if (!project || !device) {
            return {
                success: false,
                error: 'Device not found'
            };
        }
        let timedProgress;
        try {
            const config = (0, config_1.getConfig)();
            // Use displayName for folder structure (user-defined name)
            // Note: exportPath already contains project name
            const deviceFolderName = device.displayName || device.name;
            let effectiveProgress = progress;
            if (progress && progressOptions.useTimedProgress !== false) {
                const progressEstimate = this.createProgressEstimate([device], config);
                timedProgress = new importProgressEstimator_1.TimedImportProgress(progress, progressEstimate, {
                    startPercent: progressOptions.startPercent ?? 0,
                    spanPercent: progressOptions.spanPercent ?? 100
                });
                timedProgress.start(`Importing device: ${deviceFolderName}...`);
                effectiveProgress = (status) => timedProgress?.setMessage(status);
                logger_1.Logger.info(`Device import progress estimate: ${(0, importProgressEstimator_1.formatImportProgressEstimate)(progressEstimate)} `
                    + `at ${config.importProgressItemsPerSecond} item(s)/second`);
            }
            // Get device category folder (PLCs, HMIs, or IO_Devices)
            const categoryFolder = (0, pathBuilder_1.getDeviceCategoryFolder)(device.type);
            const devicePath = path.join(exportPath, 'Devices', categoryFolder, deviceFolderName);
            if (categoryFolder !== 'IO_Devices' || device.plcSoftware.length > 0) {
                await fs.promises.mkdir(devicePath, { recursive: true });
            }
            // DeviceInfo.xml export disabled - not needed
            // await this.exportDeviceInfo(device, devicePath);
            let itemCount = 0;
            let updatedCount = 0;
            let unchangedCount = 0;
            let deletedCount = 0;
            const allMessages = [];
            // Export PLC software
            for (const plc of device.plcSoftware) {
                if (cancellationToken?.isCancellationRequested) {
                    return { success: false, error: 'Operation cancelled' };
                }
                // Only add PLC subfolder if device has multiple PLCs (matching TIA Portal structure)
                const plcPath = device.plcSoftware.length > 1
                    ? path.join(devicePath, plc.name)
                    : devicePath;
                // Create PLC folder structure - only folders that exist in TIA Portal
                await this.createPlcFolderStructure(plcPath);
                // Export all PLC-related artifacts
                const plcResult = await this.exportPlcArtifacts(project.name, device.id, plc.id, plc.name, plcPath, config, effectiveProgress, cancellationToken);
                itemCount += plcResult.itemCount;
                updatedCount += plcResult.updatedCount;
                unchangedCount += plcResult.unchangedCount;
                deletedCount += plcResult.deletedCount;
                if (plcResult.messages) {
                    allMessages.push(...plcResult.messages);
                }
                // Check if operation was cancelled
                if (plcResult.cancelled) {
                    return {
                        success: false,
                        error: 'Operation cancelled',
                        itemCount,
                        messages: allMessages
                    };
                }
            }
            // Optionally dump cross references alongside the device export.
            // Prompt is per-PLC (a project may contain several) and shown
            // ONLY when we're about to run the dump for this device — it never
            // appears during plain block imports.
            if (device.plcSoftware.length > 0) {
                const xrefMode = await this.resolveCrossRefModeForDevice(device);
                if (xrefMode === 'always') {
                    await this.dumpCrossReferences(device, devicePath, effectiveProgress);
                }
            }
            timedProgress?.complete('Finalizing device import...');
            return {
                success: true,
                filePath: devicePath,
                itemCount,
                updatedCount,
                unchangedCount,
                deletedCount,
                messages: allMessages
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`Device import failed: ${deviceId}`, error);
            return {
                success: false,
                error: message
            };
        }
        finally {
            timedProgress?.dispose();
        }
    }
    createProgressEstimate(devices, config) {
        return (0, importProgressEstimator_1.estimateImportProgressForDevices)(devices, {
            exportFormat: config.exportFormat,
            dbExportFormat: config.dbExportFormat,
            excludeSystemBlocks: config.excludeSystemBlocks,
            s7dclPreviewXmlEnabled: (0, s7dclPreviewMirror_1.isS7dclPreviewMirrorEnabled)(),
            itemsPerSecond: config.importProgressItemsPerSecond
        });
    }
    // ==================== CROSS-REFERENCE EXPORT HELPERS ====================
    /**
     * Resolve the cross-reference export decision for a single PLC device,
     * honoring `tiaImport.autoExportCrossReferences`. In `'ask'` mode shows
     * a non-modal toast (matches the post-export "Compile?" prompt) with a
     * 5-second auto-dismiss. Default action when the user doesn't respond
     * is **Skip** so the rest of the import keeps running unattended.
     */
    async resolveCrossRefModeForDevice(device) {
        const setting = (0, config_1.getConfig)().autoExportCrossReferences;
        if (setting === 'always')
            return 'always';
        if (setting === 'never')
            return 'never';
        const label = device.displayName || device.name;
        const TIMEOUT_MS = 5000;
        const choice = await Promise.race([
            Promise.resolve(vscode.window.showInformationMessage(`Generate cross-references for ${label}?`, 'Generate', 'Skip')),
            new Promise(resolve => setTimeout(() => resolve(undefined), TIMEOUT_MS))
        ]);
        if (choice === 'Generate')
            return 'always';
        if (choice === undefined) {
            // Auto-dismissed — trace it so users understand why nothing was
            // written for this PLC.
            logger_1.Logger.debug(`Cross references: ${label} — prompt timed out (${TIMEOUT_MS / 1000}s), skipping`);
        }
        return 'never';
    }
    /**
     * Run the cross-reference dump for a single device with verbose
     * progress logging. Safe to call after a device import — failures are
     * downgraded to warnings (won't abort the parent operation).
     */
    async dumpCrossReferences(device, devicePath, progress) {
        const crossRefDir = path.join(devicePath, 'CrossReferences');
        const label = device.displayName || device.name;
        const startedAt = Date.now();
        try {
            progress?.(`Cross references: ${label} — preparing…`);
            logger_1.Logger.info(`├─ Cross references: ${label}`);
            logger_1.Logger.debug(`│  ├─ Output: ${crossRefDir}`);
            logger_1.Logger.debug('│  ├─ Querying CrossReferenceService (this can take a while on large PLCs)…');
            progress?.(`Cross references: ${label} — querying TIA Portal…`);
            const xrefRes = await this._bridge.exportCrossReferences(device.id, crossRefDir, 
            /* includeUnused */ true, 
            /* includeMarkdown (now CSV) */ true);
            const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
            if (xrefRes.success) {
                const symbols = xrefRes.symbolCount ?? 0;
                const locations = xrefRes.locationCount ?? 0;
                const unused = xrefRes.unusedCount ?? 0;
                progress?.(`Cross references: ${label} — ${symbols} symbols / ${locations} locations`);
                logger_1.Logger.debug(`│  ├─ Symbols with references: ${symbols}`);
                logger_1.Logger.debug(`│  ├─ Total usage locations:   ${locations}`);
                logger_1.Logger.debug(`│  ├─ Unused symbols:          ${unused}`);
                logger_1.Logger.debug(`│  ├─ Files: cross-references.jsonl, cross-references.csv, unused-symbols.csv`);
                logger_1.Logger.success(`│  └─ Cross references written in ${elapsed}s → ${crossRefDir}`);
            }
            else {
                logger_1.Logger.warn(`│  └─ Cross-reference export skipped after ${elapsed}s: ${xrefRes.error}`);
            }
        }
        catch (e) {
            const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
            const msg = e instanceof Error ? e.message : String(e);
            logger_1.Logger.warn(`│  └─ Cross-reference export failed after ${elapsed}s: ${msg}`);
        }
    }
    // ==================== BLOCK EXPORT DELEGATES ====================
    /**
     * Import a specific block
     */
    async importBlock(blockId, deviceId, exportPath) {
        return this._blockImportService.importBlock(blockId, deviceId, exportPath);
    }
    /**
     * Import a specific block with path preservation
     */
    async importBlockWithPath(blockId, parentPath, groupPath, exportPath) {
        return this._blockImportService.importBlockWithPath(blockId, parentPath, groupPath, exportPath);
    }
    /**
     * Import a block group (folder) with all its blocks
     */
    async importBlockGroup(groupId, parentPath, exportPath) {
        return this._blockImportService.importBlockGroup(groupId, parentPath, exportPath);
    }
    /**
     * Import a block group with path preservation
     */
    async importBlockGroupWithPath(groupId, parentPath, groupName, groupPath, exportPath) {
        return this._blockImportService.importBlockGroupWithPath(groupId, parentPath, groupName, groupPath, exportPath);
    }
    // ==================== TAG TABLE IMPORT DELEGATES ====================
    /**
     * Import all tag tables
     */
    async importTagTables(parentPath, exportPath) {
        return this._tagTableImportService.importTagTables(parentPath, exportPath);
    }
    /**
     * Import tag tables from a specific group with path preservation
     */
    async importTagTablesFromGroup(parentPath, groupName, groupPath, exportPath) {
        return this._tagTableImportService.importTagTablesFromGroup(parentPath, groupName, groupPath, exportPath);
    }
    /**
     * Import a single tag table
     */
    async importSingleTagTable(tagTableId, parentPath, exportPath) {
        return this._tagTableImportService.importSingleTagTable(tagTableId, parentPath, exportPath);
    }
    // ==================== UDT IMPORT DELEGATES ====================
    /**
     * Import all UDTs
     */
    async importUdts(parentPath, exportPath) {
        return this._udtImportService.importUdts(parentPath, exportPath);
    }
    /**
     * Import UDTs from a specific group with path preservation
     */
    async importUdtsFromGroup(parentPath, groupName, groupPath, exportPath) {
        return this._udtImportService.importUdtsFromGroup(parentPath, groupName, groupPath, exportPath);
    }
    /**
     * Import a single UDT
     */
    async importSingleUdt(udtId, parentPath, exportPath) {
        return this._udtImportService.importSingleUdt(udtId, parentPath, exportPath);
    }
    // ==================== WATCH TABLE IMPORT DELEGATES ====================
    /**
     * Import all watch and force tables
     */
    async importWatchTables(parentPath, exportPath) {
        return this._watchTableImportService.importWatchTables(parentPath, exportPath);
    }
    /**
     * Import watch tables from a specific group with path preservation
     */
    async importWatchTablesFromGroup(parentPath, groupName, groupPath, exportPath) {
        return this._watchTableImportService.importWatchTablesFromGroup(parentPath, groupName, groupPath, exportPath);
    }
    /**
     * Import a single watch table
     */
    async importSingleWatchTable(watchTableId, parentPath, exportPath) {
        return this._watchTableImportService.importSingleWatchTable(watchTableId, parentPath, exportPath);
    }
    // ==================== HMI IMPORT DELEGATES ====================
    /**
     * Import all HMI screens from a device
     */
    async importHmiScreens(deviceId, exportPath) {
        return this._hmiImportService.importHmiScreens(deviceId, exportPath);
    }
    /**
     * Import all HMI tags from a device
     */
    async importHmiTags(deviceId, exportPath) {
        return this._hmiImportService.importHmiTags(deviceId, exportPath);
    }
    /**
     * Import all HMI connections from a device
     */
    async importHmiConnections(deviceId, exportPath) {
        return this._hmiImportService.importHmiConnections(deviceId, exportPath);
    }
    /**
     * Import all HMI elements (screens, tags, connections) from a device
     */
    async importAllHmi(deviceId, exportPath) {
        return this._hmiImportService.importAllHmi(deviceId, exportPath);
    }
    // ==================== HELPER METHODS ====================
    /**
     * Create the base directory structure for a project import
     */
    async createDirectoryStructure(projectPath) {
        const directories = [
            'Devices/PLCs',
            'Devices/HMIs',
            'Devices/IO_Devices',
            'Devices/Computers',
            'Common data/Global libraries',
            'Languages & resources'
        ];
        for (const dir of directories) {
            await fs.promises.mkdir(path.join(projectPath, dir), { recursive: true });
        }
    }
    /**
     * Create PLC-level folder structure under given base path
     */
    async createPlcFolderStructure(plcPath) {
        const folders = [
            'Program blocks',
            'Technology objects',
            'PLC tags',
            'PLC data types',
            'Watch and force tables'
        ];
        for (const folder of folders) {
            await fs.promises.mkdir(path.join(plcPath, folder), { recursive: true });
        }
    }
    /**
     * Export all PLC-related artifacts (blocks, tags, UDTs, watch tables)
     * Returns total number of exported items and all messages
     */
    async exportPlcArtifacts(projectName, deviceId, plcId, plcName, plcPath, config, progress, cancellationToken) {
        let successCount = 0;
        let skippedCount = 0;
        let deletedCount = 0;
        let errorCount = 0;
        const allMessages = [];
        // Helper to log messages in real-time
        const logMessagesRealTime = (messages, category) => {
            if (!messages || messages.length === 0)
                return;
            for (const msg of messages) {
                const prefix = msg.itemType ? `${msg.itemType}: ${msg.itemName}` : msg.itemName;
                if (msg.type === 'error') {
                    logger_1.Logger.error(`  ✗ ${prefix} - ${msg.message}`);
                    errorCount++;
                }
                else if (msg.type === 'warning') {
                    logger_1.Logger.warn(`  ⚠ ${prefix} - ${msg.message}`);
                    successCount++; // warning = file was written/changed (e.g. new know-how protected placeholder)
                }
                else if (msg.type === 'success') {
                    logger_1.Logger.success(`  ✓ ${prefix} - ${msg.message}`);
                    successCount++;
                }
                else if (msg.type === 'deleted') {
                    logger_1.Logger.warn(`  ✗ ${prefix} - ${msg.message}`);
                    deletedCount++;
                }
                else {
                    // Info - typically "No changes"
                    logger_1.Logger.info(`  ≡ ${prefix} - ${msg.message}`);
                    skippedCount++;
                }
            }
        };
        // Import blocks
        if (cancellationToken?.isCancellationRequested) {
            return { itemCount: successCount + skippedCount + deletedCount + errorCount, updatedCount: successCount, unchangedCount: skippedCount, deletedCount, messages: allMessages, cancelled: true };
        }
        progress?.(`Importing blocks from ${plcName}...`);
        logger_1.Logger.info(`Importing blocks from ${plcName}...`);
        const blocksResult = await this._bridge.exportBlocks(projectName, deviceId, plcId, plcPath, {
            includeComments: config.includeComments,
            excludeSystemBlocks: config.excludeSystemBlocks,
            format: config.exportFormat,
            dbExportFormat: config.dbExportFormat
        });
        if (blocksResult.success) {
            if (blocksResult.messages) {
                allMessages.push(...blocksResult.messages);
                logMessagesRealTime(blocksResult.messages, 'Blocks');
            }
        }
        else {
            logger_1.Logger.error(`  ✗ Failed to import blocks: ${blocksResult.error}`);
        }
        // Import tag tables
        if (cancellationToken?.isCancellationRequested) {
            logger_1.Logger.warn('Import cancelled by user after blocks');
            return { itemCount: successCount + skippedCount + deletedCount + errorCount, updatedCount: successCount, unchangedCount: skippedCount, deletedCount, messages: allMessages, cancelled: true };
        }
        progress?.(`Importing tag tables from ${plcName}...`);
        logger_1.Logger.info(`Importing tag tables from ${plcName}...`);
        const tagsResult = await this._bridge.exportTagTables(projectName, deviceId, plcId, path.join(plcPath, 'PLC tags'), config.tagTableFormat === 'xlsx');
        if (tagsResult.success) {
            if (tagsResult.messages) {
                allMessages.push(...tagsResult.messages);
                logMessagesRealTime(tagsResult.messages, 'TagTables');
            }
        }
        else {
            logger_1.Logger.error(`  ✗ Failed to import tag tables: ${tagsResult.error}`);
        }
        // Import UDTs
        if (cancellationToken?.isCancellationRequested) {
            logger_1.Logger.warn('Import cancelled by user after tag tables');
            return { itemCount: successCount + skippedCount + deletedCount + errorCount, updatedCount: successCount, unchangedCount: skippedCount, deletedCount, messages: allMessages, cancelled: true };
        }
        progress?.(`Importing data types from ${plcName}...`);
        logger_1.Logger.info(`Importing data types from ${plcName}...`);
        const udtsResult = await this._bridge.exportUserDataTypes(projectName, deviceId, plcId, path.join(plcPath, 'PLC data types'));
        if (udtsResult.success) {
            if (udtsResult.messages) {
                allMessages.push(...udtsResult.messages);
                logMessagesRealTime(udtsResult.messages, 'UDTs');
            }
        }
        else {
            logger_1.Logger.error(`  ✗ Failed to import UDTs: ${udtsResult.error}`);
        }
        // Import watch tables
        if (cancellationToken?.isCancellationRequested) {
            logger_1.Logger.warn('Import cancelled by user after UDTs');
            return { itemCount: successCount + skippedCount + deletedCount + errorCount, updatedCount: successCount, unchangedCount: skippedCount, deletedCount, messages: allMessages, cancelled: true };
        }
        progress?.(`Importing watch tables from ${plcName}...`);
        logger_1.Logger.info(`Importing watch tables from ${plcName}...`);
        const watchResult = await this._bridge.exportWatchTables(projectName, deviceId, plcId, path.join(plcPath, 'Watch and force tables'));
        if (watchResult.success) {
            if (watchResult.messages) {
                allMessages.push(...watchResult.messages);
                logMessagesRealTime(watchResult.messages, 'WatchTables');
            }
        }
        else {
            logger_1.Logger.error(`  ✗ Failed to import watch tables: ${watchResult.error}`);
        }
        // Log summary
        const totalItemCount = successCount + skippedCount + deletedCount + errorCount;
        const summaryParts = [];
        if (successCount > 0)
            summaryParts.push(`${successCount} updated`);
        if (deletedCount > 0)
            summaryParts.push(`${deletedCount} deleted`);
        summaryParts.push(`${skippedCount} unchanged`);
        if (errorCount > 0)
            summaryParts.push(`${errorCount} errors`);
        logger_1.Logger.info(`  Summary: ${summaryParts.join(', ')}`);
        return { itemCount: totalItemCount, updatedCount: successCount, unchangedCount: skippedCount, deletedCount, messages: allMessages };
    }
    /**
     * Export project metadata to XML
     */
    async exportProjectInfo(project, projectPath) {
        const projectInfo = `<?xml version="1.0" encoding="utf-8"?>
<ProjectInfo>
    <Name>${this.escapeXml(project.name)}</Name>
    <Version>${this.escapeXml(project.version || '')}</Version>
    <Author>${this.escapeXml(project.author || '')}</Author>
    <ExportDate>${new Date().toISOString()}</ExportDate>
    <DeviceCount>${project.devices?.length || 0}</DeviceCount>
</ProjectInfo>`;
        await fs.promises.writeFile(path.join(projectPath, 'ProjectInfo.xml'), projectInfo, 'utf-8');
    }
    /**
     * Export device metadata to XML
     */
    async exportDeviceInfo(device, devicePath) {
        const deviceInfo = `<?xml version="1.0" encoding="utf-8"?>
<DeviceInfo>
    <Name>${this.escapeXml(device.name)}</Name>
    <Type>${this.escapeXml(device.type)}</Type>
    <OrderNumber>${this.escapeXml(device.orderNumber || '')}</OrderNumber>
    <FirmwareVersion>${this.escapeXml(device.firmwareVersion || '')}</FirmwareVersion>
    <IpAddress>${this.escapeXml(device.ipAddress || '')}</IpAddress>
    <ExportDate>${new Date().toISOString()}</ExportDate>
</DeviceInfo>`;
        await fs.promises.writeFile(path.join(devicePath, 'DeviceInfo.xml'), deviceInfo, 'utf-8');
    }
    /**
     * Escape special XML characters
     */
    escapeXml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    // ==================== LIBRARY (PROJECT LIBRARY > TYPES) ====================
    /**
     * Import the entire Project Library &gt; Types tree to <exportPath>/Library/Types.
     * Master copies are intentionally not exported.
     */
    async importLibraryTypes(exportPath) {
        const projectName = this.getCurrentProjectName();
        if (!projectName) {
            return { success: false, error: 'No project selected' };
        }
        const targetPath = path.join(exportPath, 'Library', 'Types');
        await fs.promises.mkdir(targetPath, { recursive: true });
        const config = (0, config_1.getConfig)();
        return this._bridge.exportLibraryTypes(projectName, targetPath, {
            format: config.exportFormat,
            dbExportFormat: config.dbExportFormat,
            includeComments: config.includeComments
        });
    }
    /**
     * Import a single library folder (recursive) by hierarchical folder path.
     * folderPath uses '/' separator, e.g. "CommL1ToL2_300_400/CommDriver".
     */
    async importLibraryFolder(folderPath, exportPath) {
        const projectName = this.getCurrentProjectName();
        if (!projectName) {
            return { success: false, error: 'No project selected' };
        }
        const targetPath = path.join(exportPath, 'Library', 'Types', folderPath.replace(/\//g, path.sep));
        await fs.promises.mkdir(targetPath, { recursive: true });
        const config = (0, config_1.getConfig)();
        return this._bridge.exportLibraryFolder(projectName, folderPath, targetPath, {
            format: config.exportFormat,
            dbExportFormat: config.dbExportFormat,
            includeComments: config.includeComments
        });
    }
    /**
     * Import a single library type by parent folder path + type name.
     */
    async importLibraryType(folderPath, typeName, exportPath) {
        const projectName = this.getCurrentProjectName();
        if (!projectName) {
            return { success: false, error: 'No project selected' };
        }
        const targetPath = folderPath
            ? path.join(exportPath, 'Library', 'Types', folderPath.replace(/\//g, path.sep))
            : path.join(exportPath, 'Library', 'Types');
        await fs.promises.mkdir(targetPath, { recursive: true });
        const config = (0, config_1.getConfig)();
        return this._bridge.exportLibraryType(projectName, folderPath, typeName, targetPath, {
            format: config.exportFormat,
            dbExportFormat: config.dbExportFormat,
            includeComments: config.includeComments
        });
    }
}
exports.ProjectImportService = ProjectImportService;
//# sourceMappingURL=projectImport.js.map