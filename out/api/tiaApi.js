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
exports.TiaApi = void 0;
exports.initTiaApi = initTiaApi;
exports.getTiaApi = getTiaApi;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const pathBuilder_1 = require("../services/import/pathBuilder");
const logger_1 = require("../utils/logger");
const workspace_1 = require("../utils/workspace");
const config_1 = require("../utils/config");
const compileDiagnostics_1 = require("../utils/compileDiagnostics");
const s7dclErrorParser_1 = require("../utils/s7dclErrorParser");
const s7dclPreviewMirror_1 = require("../utils/s7dclPreviewMirror");
function ok(data, message) {
    return { success: true, data, message };
}
function err(error) {
    return { success: false, error };
}
class TiaApi {
    connection;
    importService;
    constructor(connection, importService) {
        this.connection = connection;
        this.importService = importService;
    }
    // ── Connection ────────────────────────────────────────────────
    async connect() {
        if (this.connection.isConnected) {
            return ok({ projectName: this.connection.currentProjectName });
        }
        try {
            const success = await this.connection.connect();
            if (!success) {
                return err('Failed to connect to TIA Portal');
            }
            return ok({ projectName: this.connection.currentProjectName });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    async openProject(filePath) {
        if (!fs.existsSync(filePath)) {
            return err(`Project file not found: ${filePath}`);
        }
        try {
            const success = await this.connection.openProject(filePath);
            if (!success) {
                return err(`Failed to open TIA project: ${filePath}`);
            }
            return ok({ projectName: this.connection.currentProjectName }, `Opened TIA project ${this.connection.currentProjectName || filePath}`);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    async disconnect() {
        try {
            await this.connection.disconnect();
            return ok();
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    isConnected() {
        return this.connection.isConnected;
    }
    async prepareWorkspace() {
        try {
            const workspacePath = workspace_1.WorkspaceManager.getWorkspacePath();
            if (!workspacePath) {
                return err('No workspace folder is open. Open a workspace folder before calling prepare_workspace.');
            }
            await workspace_1.WorkspaceManager.initializeWorkspaceStructure({ includeTemplates: true });
            return ok({ workspacePath }, 'Workspace prepared - templates copied from Documentation/Templates.');
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    currentProject() {
        return ok({
            connected: this.connection.isConnected,
            projectName: this.connection.currentProjectName
        });
    }
    getLogs(options) {
        const entries = logger_1.Logger.getEntries(options);
        return ok({ entries, lines: entries.map(entry => entry.line) });
    }
    async ensureConnected() {
        if (!this.connection.isConnected) {
            return err('Not connected to TIA Portal. Call tia_connect first.');
        }
        try {
            const alive = await this.connection.getBridge().ping();
            if (!alive) {
                return err('TIA Portal connection is broken');
            }
            return ok();
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    async listProjects() {
        try {
            const projects = await this.connection.getProjects();
            return ok(projects.map(p => ({ name: p.name, path: p.path })));
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    async selectProject(projectName) {
        try {
            const success = await this.connection.selectProject(projectName);
            if (!success) {
                return err(`Project "${projectName}" not found or could not be selected`);
            }
            return ok({ projectName });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    getCurrentProjectName() {
        return this.connection.currentProjectName;
    }
    // ── Inspection ────────────────────────────────────────────────
    listDevices() {
        if (!this.connection.isConnected || !this.connection.currentProject) {
            return err('No project selected');
        }
        const devices = this.connection.getDevices().map(d => ({
            id: d.id,
            name: d.name,
            displayName: d.displayName,
            type: d.type,
            plcSoftware: (d.plcSoftware || []).map(p => ({ id: p.id, name: p.name }))
        }));
        return ok(devices);
    }
    findDevice(idOrName) {
        const devices = this.connection.getDevices();
        return devices.find(d => d.id === idOrName ||
            d.name === idOrName ||
            d.displayName === idOrName);
    }
    listBlocks(deviceIdOrName) {
        const device = this.findDevice(deviceIdOrName);
        if (!device) {
            return err(`Device "${deviceIdOrName}" not found`);
        }
        const blocks = [];
        for (const plc of device.plcSoftware || []) {
            for (const group of plc.blockGroups || []) {
                this.collectBlocks(group, '', blocks);
            }
        }
        return ok(blocks);
    }
    collectBlocks(group, parentPath, out) {
        const groupPath = parentPath ? `${parentPath}/${group.name}` : group.name;
        for (const b of group.blocks || []) {
            out.push({
                id: b.id,
                name: b.name,
                number: b.number,
                type: String(b.type),
                language: b.language ? String(b.language) : undefined,
                groupPath,
                isSystem: b.isSystem,
                isKnowHowProtected: b.isKnowHowProtected
            });
        }
        for (const sub of (group.subGroups || [])) {
            this.collectBlocks(sub, groupPath, out);
        }
    }
    // ── Export from TIA → local files ─────────────────────────────
    /**
     * Export a single block to local files (XML / SCL / s7dcl depending on settings).
     * `blockNameOrId` can be either the block id or the block name.
     */
    async exportBlock(deviceIdOrName, blockNameOrId) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        const device = this.findDevice(deviceIdOrName);
        if (!device) {
            return err(`Device "${deviceIdOrName}" not found`);
        }
        const blocksRes = this.listBlocks(deviceIdOrName);
        if (!blocksRes.success) {
            return blocksRes;
        }
        const block = blocksRes.data.find(b => b.id === blockNameOrId || b.name === blockNameOrId);
        if (!block) {
            return err(`Block "${blockNameOrId}" not found on device "${deviceIdOrName}"`);
        }
        const projectName = this.connection.currentProjectName;
        if (!projectName) {
            return err('No project selected');
        }
        const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
        if (!exportPath) {
            return err('No workspace folder open or export path unavailable');
        }
        try {
            const groupPath = block.groupPath || '';
            const result = await this.importService.importBlockWithPath(block.id, device.id, groupPath, exportPath);
            if (!result.success) {
                return err(result.error || 'Block export failed');
            }
            return ok(result, `Exported block "${block.name}" → ${result.filePath}`);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    /**
     * Export selected blocks, or all blocks on a device when no block list is supplied.
     * Uses the same file format settings as the UI (`tiaImport.exportFormat`,
     * `tiaImport.dbExportFormat`, SD preview mirror, etc.) via `exportBlock`.
     */
    async exportBlocks(deviceIdOrName, blockNamesOrIds) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        const blocksRes = this.listBlocks(deviceIdOrName);
        if (!blocksRes.success) {
            return blocksRes;
        }
        const requested = (blockNamesOrIds || []).map(value => value.trim()).filter(Boolean);
        const cfg = (0, config_1.getConfig)();
        const targets = requested.length > 0
            ? requested.map(blockNameOrId => {
                const block = blocksRes.data.find(b => b.id === blockNameOrId || b.name === blockNameOrId);
                return { blockNameOrId, block };
            })
            : blocksRes.data
                .filter(block => !cfg.excludeSystemBlocks || !block.isSystem)
                .map(block => ({ blockNameOrId: block.id, block }));
        const missing = targets.filter(target => !target.block).map(target => target.blockNameOrId);
        if (missing.length > 0) {
            return err(`Block(s) not found on device "${deviceIdOrName}": ${missing.join(', ')}`);
        }
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        const messages = [];
        for (const target of targets) {
            const block = target.block;
            const result = await this.exportBlock(deviceIdOrName, block.id);
            if (!result.success) {
                errorCount++;
                messages.push({
                    type: 'error',
                    itemName: block.name,
                    itemType: block.type,
                    message: result.error
                });
                continue;
            }
            const data = result.data;
            successCount += data?.successCount ?? (data?.success === true && !data.skipped ? 1 : 0);
            skippedCount += data?.skippedCount ?? (data?.skipped ? 1 : 0);
            errorCount += data?.errorCount ?? 0;
            if (data?.messages) {
                messages.push(...data.messages);
            }
        }
        const itemCount = targets.length;
        const aggregate = {
            success: errorCount === 0,
            itemCount,
            successCount,
            errorCount,
            skippedCount,
            messages
        };
        if (errorCount > 0 && successCount === 0 && skippedCount === 0) {
            return err(`Block import failed for all ${itemCount} block(s)`);
        }
        return ok(aggregate, `Imported ${successCount} block(s), skipped ${skippedCount}, errors ${errorCount}`);
    }
    /**
     * Export every block / tag table / UDT / watch table for a device.
     */
    async exportDevice(deviceIdOrName, token) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        const device = this.findDevice(deviceIdOrName);
        if (!device) {
            return err(`Device "${deviceIdOrName}" not found`);
        }
        const projectName = this.connection.currentProjectName;
        if (!projectName) {
            return err('No project selected');
        }
        const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
        if (!exportPath) {
            return err('No workspace folder open or export path unavailable');
        }
        try {
            const result = await this.importService.importDevice(device.id, exportPath, undefined, token);
            if (!result.success) {
                return err(result.error || 'Device export failed');
            }
            return ok(result, `Exported device "${device.displayName || device.name}"`);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    /**
     * Compute the device-folder path used by export operations
     * (`<exportPath>/Devices/<Category>/<DeviceName>`).
     */
    async resolveDeviceExportPath(device) {
        const projectName = this.connection.currentProjectName;
        if (!projectName) {
            return err('No project selected');
        }
        const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
        if (!exportPath) {
            return err('No workspace folder open or export path unavailable');
        }
        const deviceFolder = (0, pathBuilder_1.buildDeviceFolderPath)(device, exportPath);
        return ok({ projectName, deviceFolder });
    }
    /**
     * List Software Units (PlcUnit / PlcSafetyUnit) on a device. Returns
     * `{supported:false}` on TIA Portal runtimes that do not expose Units.
     */
    async listUnits(deviceIdOrName) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        const device = this.findDevice(deviceIdOrName);
        if (!device) {
            return err(`Device "${deviceIdOrName}" not found`);
        }
        try {
            const res = await this.importService.bridge.listUnits(device.id);
            if (!res.success) {
                return err(res.error || 'Failed to list Software Units');
            }
            return ok({ supported: res.supported !== false, units: res.units ?? [] });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    /**
     * Export every Software Unit on a device to
     * `<workspace>/TiaExport/Projects/<Proj>/Devices/<Category>/<Device>/Units/<UnitName>/`.
     */
    async exportUnits(deviceIdOrName) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        const device = this.findDevice(deviceIdOrName);
        if (!device) {
            return err(`Device "${deviceIdOrName}" not found`);
        }
        const pathRes = await this.resolveDeviceExportPath(device);
        if (!pathRes.success) {
            return pathRes;
        }
        const cfg = (0, config_1.getConfig)();
        try {
            await fs.promises.mkdir(pathRes.data.deviceFolder, { recursive: true });
            const res = await this.importService.bridge.exportUnits(device.id, pathRes.data.deviceFolder, {
                includeComments: cfg.includeComments,
                excludeSystemBlocks: cfg.excludeSystemBlocks,
                format: cfg.exportFormat,
                dbExportFormat: cfg.dbExportFormat,
                s7dclPreviewXmlEnabled: (0, s7dclPreviewMirror_1.isS7dclPreviewMirrorEnabled)(),
                generateXlsx: cfg.tagTableFormat === 'xlsx'
            });
            if (!res.success) {
                return err(res.error || 'Failed to export Software Units');
            }
            if (res.supported === false) {
                return ok(res, 'Software Units not supported on this TIA Portal runtime');
            }
            return ok(res, `Exported ${res.unitCount ?? 0} Software Unit(s) from "${device.displayName || device.name}"`);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    /**
     * Export a single named Software Unit. `kind` is optional and selects
     * between standard (`plc`) and fail-safe (`safety`) units when both
     * compositions could contain the same name.
     */
    async exportUnit(deviceIdOrName, unitName, kind) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        const device = this.findDevice(deviceIdOrName);
        if (!device) {
            return err(`Device "${deviceIdOrName}" not found`);
        }
        if (!unitName || !unitName.trim()) {
            return err('Unit name is required');
        }
        const pathRes = await this.resolveDeviceExportPath(device);
        if (!pathRes.success) {
            return pathRes;
        }
        const cfg = (0, config_1.getConfig)();
        try {
            await fs.promises.mkdir(pathRes.data.deviceFolder, { recursive: true });
            const res = await this.importService.bridge.exportUnit(device.id, unitName, kind, pathRes.data.deviceFolder, {
                includeComments: cfg.includeComments,
                excludeSystemBlocks: cfg.excludeSystemBlocks,
                format: cfg.exportFormat,
                dbExportFormat: cfg.dbExportFormat,
                s7dclPreviewXmlEnabled: (0, s7dclPreviewMirror_1.isS7dclPreviewMirrorEnabled)(),
                generateXlsx: cfg.tagTableFormat === 'xlsx'
            });
            if (!res.success) {
                return err(res.error || 'Failed to export Software Unit');
            }
            return ok(res, `Exported Software Unit "${unitName}" from "${device.displayName || device.name}"`);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    /**
     * Export hardware configuration (TIA → workspace `DeviceConfiguration/`).
     *
     * - When `deviceIdOrName` is provided: export only that device.
     * - When omitted: iterate every device in the project (PLCs, HMIs, IO_Devices…).
     *
     * Format follows the `tiaImport.hwConfigFormat` setting (`xml` per-device folder
     * or `cax` AutomationML `.aml`). Root IO devices keep the legacy flat layout
     * (`Devices/IO_Devices/<file>`); devices inside TIA folders (including IO
     * devices in folders) use `Devices/<Category>/<FolderPath>/<DeviceName>/DeviceConfiguration/<file>`.
     */
    async exportHwConfig(deviceIdOrName, opts) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        const projectName = this.connection.currentProjectName;
        if (!projectName) {
            return err('No project selected');
        }
        const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
        if (!exportPath) {
            return err('No workspace folder open or export path unavailable');
        }
        const cfg = (0, config_1.getConfig)();
        const format = opts?.format ?? cfg.hwConfigFormat ?? 'xml';
        const includeChannels = opts?.includeChannels !== false;
        const includeAddresses = opts?.includeAddresses !== false;
        const includeNetworkConfig = opts?.includeNetworkConfig !== false;
        const includeSubnets = opts?.includeSubnets !== false;
        void includeSubnets; // tracked for API symmetry; per-device call already handles network
        let targets;
        if (deviceIdOrName) {
            const d = this.findDevice(deviceIdOrName);
            if (!d) {
                return err(`Device "${deviceIdOrName}" not found`);
            }
            targets = [d];
        }
        else {
            targets = this.connection.getDevices();
            if (targets.length === 0) {
                return err('No devices in project');
            }
        }
        const bridge = this.connection.getBridge();
        const results = [];
        let exportedCount = 0;
        let failedCount = 0;
        logger_1.Logger.section(`HW CONFIG EXPORT (LM): ${deviceIdOrName ?? 'ALL DEVICES'} [format=${format}]`);
        for (const dev of targets) {
            const displayName = dev.displayName || dev.name;
            const deviceType = dev.type || 'Device';
            // Build per-device HW Config path, preserving TIA folder structure.
            // Root IO devices keep the legacy flat layout; IO devices inside
            // TIA folders use a per-device DeviceConfiguration subfolder.
            const hwConfigPath = (0, pathBuilder_1.buildDeviceHwConfigPath)(dev, exportPath);
            try {
                const r = await bridge.importDeviceHwConfig(dev.name, includeChannels, includeAddresses, includeNetworkConfig, true, hwConfigPath, format);
                if (r && r.success) {
                    exportedCount++;
                    results.push({ device: displayName, success: true, path: hwConfigPath });
                    logger_1.Logger.success(`✓ HW Config: ${displayName} → ${hwConfigPath}`);
                }
                else {
                    failedCount++;
                    const msg = (r && r.error) || 'Unknown error';
                    results.push({ device: displayName, success: false, error: msg });
                    logger_1.Logger.error(`✗ HW Config: ${displayName}: ${msg}`);
                }
            }
            catch (e) {
                failedCount++;
                const msg = e instanceof Error ? e.message : String(e);
                results.push({ device: displayName, success: false, error: msg });
                logger_1.Logger.error(`✗ HW Config: ${displayName}: ${msg}`);
            }
        }
        if (failedCount === 0) {
            return ok({ exportedCount, failedCount, results }, `Exported HW config for ${exportedCount} device(s)`);
        }
        if (exportedCount === 0) {
            return err(`HW config export failed for all ${failedCount} device(s)`);
        }
        return ok({ exportedCount, failedCount, results }, `HW config exported with errors: ${exportedCount} ok, ${failedCount} failed`);
    }
    // ── Import local files → TIA ──────────────────────────────────
    /**
     * Detect whether `inputPath` falls within a `Units/<UnitName>/` subtree
     * exported by the Software Units flow. Returns the unit name (and the
     * base path matching the unit root) so import can be routed to the
     * matching PlcUnit / PlcSafetyUnit. Returns null when the path is not
     * under a Units/ subtree.
     */
    static detectUnitContext(inputPath) {
        const normalized = inputPath.replace(/\\/g, '/');
        // Match `.../Units/<UnitName>/...` anywhere in the path.
        const m = normalized.match(/(.*\/Units\/[^/]+)(?:\/|$)/);
        if (!m) {
            return null;
        }
        const unitRoot = m[1];
        const unitName = unitRoot.substring(unitRoot.lastIndexOf('/') + 1);
        if (!unitName) {
            return null;
        }
        return { unitName, unitRoot: unitRoot.replace(/\//g, path.sep) };
    }
    /**
     * Import a single XML/SCL/s7dcl file into TIA Portal.
     *
     * When the file path is inside a `Units/<UnitName>/` subtree (created by
     * `tia_export_units` / `tia_export_unit`), the import is automatically
     * routed to the corresponding Software Unit. `unitName` / `unitKind` in
     * `opts` override the auto-detected unit.
     */
    async importFile(deviceIdOrName, filePath, opts) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        if (!fs.existsSync(filePath)) {
            return err(`File not found: ${filePath}`);
        }
        const device = this.findDevice(deviceIdOrName);
        if (!device) {
            return err(`Device "${deviceIdOrName}" not found`);
        }
        const overwrite = opts?.overwriteExisting !== false; // default true
        const compare = opts?.compareBeforeImport === true;
        const wsFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath))?.uri.fsPath;
        // Auto-detect Units/ scope unless caller forced a unit explicitly.
        let unitName = opts?.unitName;
        const unitKind = opts?.unitKind;
        if (!unitName) {
            const ctx = TiaApi.detectUnitContext(filePath);
            if (ctx) {
                unitName = ctx.unitName;
            }
        }
        try {
            const bridge = this.connection.getBridge();
            const ext = path.extname(filePath).toLowerCase();
            let result;
            if (ext === '.xlsx') {
                // XLSX tag tables are PLC-wide; unit-scoped XLSX import is not supported yet.
                result = await bridge.importXlsxFileToTia(device.id, filePath, overwrite, compare);
            }
            else if (unitName) {
                result = await bridge.importXmlFileToUnit(device.id, unitName, unitKind, filePath, overwrite, wsFolder, compare);
            }
            else {
                result = await bridge.importXmlFileToTia(device.id, filePath, overwrite, wsFolder, compare);
            }
            if (!result.success) {
                return err(result.error || `Import of "${path.basename(filePath)}" failed`);
            }
            const scopeMsg = unitName ? ` into unit "${unitName}"` : '';
            return ok(result, `Imported ${path.basename(filePath)}${scopeMsg} into ${device.displayName || device.name}`);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    /**
     * Import every supported file in a folder (recursively) into TIA Portal.
     *
     * When the folder path is inside a `Units/<UnitName>/` subtree, the
     * import is automatically routed to the matching Software Unit.
     */
    async importFolder(deviceIdOrName, folderPath, opts) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
            return err(`Folder not found: ${folderPath}`);
        }
        const device = this.findDevice(deviceIdOrName);
        if (!device) {
            return err(`Device "${deviceIdOrName}" not found`);
        }
        let unitName = opts?.unitName;
        const unitKind = opts?.unitKind;
        if (!unitName) {
            const ctx = TiaApi.detectUnitContext(folderPath);
            if (ctx) {
                unitName = ctx.unitName;
            }
        }
        try {
            const bridge = this.connection.getBridge();
            const overwrite = opts?.overwriteExisting !== false;
            const recursive = opts?.recursive !== false;
            const result = unitName
                ? await bridge.importXmlFolderToUnit(device.id, unitName, unitKind, folderPath, overwrite, recursive)
                : await bridge.importXmlFolderToTia(device.id, folderPath, overwrite, recursive);
            if (!result.success) {
                return err(result.error || 'Folder import failed');
            }
            const scopeMsg = unitName ? ` into unit "${unitName}"` : '';
            return ok(result, `Imported folder "${folderPath}"${scopeMsg} into ${device.displayName || device.name}`);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    /**
     * Import a complete Software Unit from a local workspace folder into TIA Portal.
     *
     * The folder must follow the Software Unit export layout:
     *   Units/<UnitName>/_unit.json
     *   Units/<UnitName>/Program blocks/
     *   Units/<UnitName>/PLC data types/
     *   Units/<UnitName>/PLC tags/
     *
     * `unitFolderPath` is auto-detected when omitted and the workspace contains
     * exactly one exported unit folder.
     */
    async importUnit(deviceIdOrName, unitFolderPath, opts) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        const device = this.findDevice(deviceIdOrName);
        if (!device) {
            return err(`Device "${deviceIdOrName}" not found`);
        }
        let folderPath = unitFolderPath;
        if (!folderPath) {
            const workspacePath = workspace_1.WorkspaceManager.getWorkspacePath();
            if (!workspacePath) {
                return err('No workspace folder is open');
            }
            const candidates = this.findUnitFolders(workspacePath);
            if (candidates.length === 0) {
                return err('No Software Unit folder found in workspace');
            }
            if (candidates.length > 1) {
                return err(`Multiple Software Unit folders found in workspace: ${candidates.map(c => path.basename(c)).join(', ')}. Please specify unitFolderPath.`);
            }
            folderPath = candidates[0];
        }
        if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
            return err(`Folder not found: ${folderPath}`);
        }
        const metadataPath = path.join(folderPath, '_unit.json');
        if (!fs.existsSync(metadataPath)) {
            return err(`Selected folder is not a Software Unit export: missing _unit.json`);
        }
        try {
            const bridge = this.connection.getBridge();
            const overwrite = opts?.overwriteExisting !== false;
            const compare = opts?.compareBeforeImport === true;
            const createMissing = opts?.createMissingUnit !== false;
            const deleteOrphans = opts?.deleteOrphans !== false;
            const result = await bridge.importUnitToTia(device.id, folderPath, overwrite, compare, createMissing, deleteOrphans);
            if (!result.success) {
                return err(result.error || 'Software Unit export failed');
            }
            return ok(result, `Exported Software Unit from "${folderPath}" into ${device.displayName || device.name}`);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    findUnitFolders(workspacePath) {
        const results = [];
        const exportRoot = path.join(workspacePath, 'TiaExport');
        if (!fs.existsSync(exportRoot)) {
            return results;
        }
        function scan(dir) {
            try {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (entry.name === 'Units') {
                            for (const unitEntry of fs.readdirSync(fullPath, { withFileTypes: true })) {
                                const unitPath = path.join(fullPath, unitEntry.name);
                                if (unitEntry.isDirectory() && fs.existsSync(path.join(unitPath, '_unit.json'))) {
                                    results.push(unitPath);
                                }
                            }
                        }
                        else {
                            scan(fullPath);
                        }
                    }
                }
            }
            catch {
                // ignore unreadable directories
            }
        }
        scan(exportRoot);
        return results;
    }
    /**
     * Push HW Configuration from the workspace into TIA Portal.
     *
     * `pathArg` may point at a single `.xml` / `.aml` file or at a folder
     * containing HW Config files (typically `Devices/<Cat>/<Dev>/DeviceConfiguration/`
     * or `Devices/IO_Devices/`). Folder mode walks recursively.
     */
    async importHwConfig(pathArg, opts) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        if (!fs.existsSync(pathArg)) {
            return err(`Path not found: ${pathArg}`);
        }
        const cfg = (0, config_1.getConfig)();
        const overwriteExisting = opts?.overwriteExisting === true; // default false (compare/update mode)
        const updateExisting = opts?.updateExisting !== false;
        const importNetworkConfig = opts?.importNetworkConfig !== false;
        const skipIfIdentical = opts?.skipIfIdentical !== false;
        const format = opts?.format ?? cfg.hwConfigFormat ?? 'xml';
        const showComparisonDetails = false;
        const bridge = this.connection.getBridge();
        const isDir = fs.statSync(pathArg).isDirectory();
        try {
            logger_1.Logger.section(`HW CONFIG IMPORT (LM): ${pathArg} [format=${format}]`);
            const result = isDir
                ? await bridge.exportHwConfigFolderToTia(pathArg, overwriteExisting, updateExisting, importNetworkConfig, skipIfIdentical, showComparisonDetails, format)
                : await bridge.exportHwConfigFileToTia(pathArg, overwriteExisting, updateExisting, importNetworkConfig, skipIfIdentical, showComparisonDetails, format);
            if (!result.success) {
                return err(result.error || 'HW Config import failed');
            }
            return ok(result, `HW Config imported from ${isDir ? 'folder' : 'file'} "${pathArg}"`);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    // ── Project-wide operations ───────────────────────────────────
    /**
     * Refresh the in-memory project structure from TIA Portal (re-reads devices,
     * blocks, tag tables, …). Useful after the user manually changed something
     * in TIA Portal between Copilot tool calls.
     */
    async refresh() {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        try {
            await this.connection.refreshProjectStructure();
            return ok({ deviceCount: this.connection.getDevices().length }, 'Project structure refreshed');
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    /**
     * Export the entire project — every device's program (blocks, tag tables,
     * UDTs, watch tables) plus optionally HW configuration. Equivalent of the
     * `TIA Import: Import Entire Project` command.
     */
    async exportProject(opts, token) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        const projectName = this.connection.currentProjectName;
        if (!projectName) {
            return err('No project selected');
        }
        const exportPath = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
        if (!exportPath) {
            return err('No workspace folder open or export path unavailable');
        }
        const devices = this.connection.getDevices();
        if (devices.length === 0) {
            return err('No devices in project');
        }
        const includeHw = opts?.includeHwConfig !== false;
        const results = [];
        let exportedDevices = 0;
        let failedDevices = 0;
        logger_1.Logger.section(`PROJECT EXPORT (LM): ${projectName} [${devices.length} device(s), HW=${includeHw}]`);
        for (const dev of devices) {
            if (token?.isCancellationRequested) {
                break;
            }
            const displayName = dev.displayName || dev.name;
            const entry = {
                device: displayName, type: dev.type || 'Device', programOk: false
            };
            try {
                const r = await this.importService.importDevice(dev.id, exportPath, undefined, token);
                entry.programOk = r.success === true;
                if (!entry.programOk) {
                    entry.error = r.error || 'program export failed';
                }
            }
            catch (e) {
                entry.error = e instanceof Error ? e.message : String(e);
            }
            if (includeHw) {
                try {
                    const hwRes = await this.exportHwConfig(dev.name, { format: opts?.hwConfigFormat });
                    entry.hwOk = hwRes.success;
                    if (!hwRes.success && !entry.error) {
                        entry.error = `HW: ${hwRes.error}`;
                    }
                }
                catch (e) {
                    entry.hwOk = false;
                    if (!entry.error) {
                        entry.error = `HW: ${e instanceof Error ? e.message : String(e)}`;
                    }
                }
            }
            const overallOk = entry.programOk && (!includeHw || entry.hwOk === true);
            if (overallOk) {
                exportedDevices++;
            }
            else {
                failedDevices++;
            }
            results.push(entry);
        }
        const summary = `Project export: ${exportedDevices} ok, ${failedDevices} failed (of ${devices.length})`;
        if (failedDevices === 0) {
            return ok({ deviceCount: devices.length, exportedDevices, failedDevices, results }, summary);
        }
        if (exportedDevices === 0) {
            return err(summary);
        }
        return ok({ deviceCount: devices.length, exportedDevices, failedDevices, results }, summary);
    }
    // ── Compile ───────────────────────────────────────────────────
    async compile(deviceIdOrName) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        const device = this.findDevice(deviceIdOrName);
        if (!device) {
            return err(`Device "${deviceIdOrName}" not found`);
        }
        try {
            (0, compileDiagnostics_1.clearCompileDiagnostics)();
            logger_1.Logger.section(`PLC SOFTWARE COMPILATION (LM): ${device.displayName || device.name}`);
            const bridge = this.connection.getBridge();
            const result = await bridge.compileSoftware(device.id);
            // Surface diagnostics in PROBLEMS panel as well.
            const wsPath = workspace_1.WorkspaceManager.getWorkspacePath();
            if (wsPath) {
                (0, compileDiagnostics_1.publishCompileDiagnostics)(result, device.displayName || device.name, wsPath);
            }
            return ok(result);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    // ── Cross References ─────────────────────────────────────────
    /**
     * Dump the full cross-reference table for a device's PLC software into
     * AI-friendly files: `cross-references.jsonl` (one JSON record per usage
     * location), plus optional flat `cross-references.csv` (RFC 4180,
     * sortable in pandas/Excel) and `unused-symbols.csv` (objects without
     * any references).
     *
     * Defaults to `<workspace>/TiaExport/Projects/<ProjectName>/Devices/PLCs/<Device>/CrossReferences/`.
     */
    async exportCrossReferences(deviceIdOrName, opts) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        const device = this.findDevice(deviceIdOrName);
        if (!device) {
            return err(`Device "${deviceIdOrName}" not found`);
        }
        let outputDirectory = opts?.outputDirectory;
        if (!outputDirectory) {
            const projectName = this.connection.currentProjectName;
            if (!projectName) {
                return err('No project selected');
            }
            const exportRoot = await workspace_1.WorkspaceManager.getProjectExportPath(projectName);
            if (!exportRoot) {
                return err('Workspace not initialized');
            }
            outputDirectory = path.join(exportRoot, 'Devices', 'PLCs', device.displayName || device.name, 'CrossReferences');
        }
        try {
            const bridge = this.connection.getBridge();
            const result = await bridge.exportCrossReferences(device.id, outputDirectory, opts?.includeUnused !== false, opts?.includeMarkdown !== false);
            if (!result.success) {
                return err(result.error || 'Cross-reference export failed');
            }
            const summary = `${result.symbolCount ?? 0} symbols / ${result.locationCount ?? 0} locations` +
                (typeof result.unusedCount === 'number' ? ` (${result.unusedCount} unused)` : '');
            return ok({
                device: result.device || device.name,
                outputDirectory: result.outputDirectory || outputDirectory,
                files: result.files || { jsonl: path.join(outputDirectory, 'cross-references.jsonl') },
                symbolCount: result.symbolCount ?? 0,
                locationCount: result.locationCount ?? 0,
                unusedCount: result.unusedCount ?? 0
            }, summary);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    }
    // ── Diagnostics ───────────────────────────────────────────────
    /**
     * Snapshot of current TIA-related diagnostics (compile + s7dcl/import).
     * Optional `scopeFilter` substring matches against file path.
     */
    getDiagnostics(scopeFilter) {
        const all = [
            ...(0, compileDiagnostics_1.getCompileDiagnosticsSnapshot)(),
            ...(0, s7dclErrorParser_1.getS7dclDiagnosticsSnapshot)()
        ];
        if (!scopeFilter) {
            return all;
        }
        const needle = scopeFilter.toLowerCase();
        return all.filter(d => d.file.toLowerCase().includes(needle));
    }
    // ── High-level orchestrator ───────────────────────────────────
    /**
     * One iteration of the compile-fix loop:
     *   1. (optionally) import a folder of edited files into TIA
     *   2. compile
     *   3. return diagnostics so the caller (Copilot) can edit and try again.
     *
     * Does NOT call any LM itself — keeps token usage in the caller's session.
     */
    async fixCompileErrorsStep(args) {
        const guard = await this.ensureConnected();
        if (!guard.success) {
            return guard;
        }
        let importResult;
        if (args.importFolder) {
            const r = await this.importFolder(args.deviceIdOrName, args.importFolder, {
                overwriteExisting: args.overwriteExisting !== false
            });
            if (!r.success) {
                return err(r.error);
            }
            importResult = r.data;
        }
        else if (args.importFile) {
            const r = await this.importFile(args.deviceIdOrName, args.importFile, {
                overwriteExisting: args.overwriteExisting !== false
            });
            if (!r.success) {
                return err(r.error);
            }
            importResult = r.data;
        }
        const compileRes = await this.compile(args.deviceIdOrName);
        if (!compileRes.success) {
            return err(compileRes.error);
        }
        const compile = compileRes.data;
        const diagnostics = this.getDiagnostics();
        return ok({ compile, diagnostics, importResult });
    }
}
exports.TiaApi = TiaApi;
// ── Module-level singleton wiring ─────────────────────────────────
let _api;
function initTiaApi(connection, importService) {
    _api = new TiaApi(connection, importService);
    return _api;
}
function getTiaApi() {
    if (!_api) {
        throw new Error('TiaApi not initialised - call initTiaApi() first');
    }
    return _api;
}
//# sourceMappingURL=tiaApi.js.map