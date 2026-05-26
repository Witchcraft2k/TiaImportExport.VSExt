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
exports.TiaConnectionService = void 0;
const vscode = __importStar(require("vscode"));
const tiaOpennessBridge_1 = require("./tiaOpennessBridge");
const logger_1 = require("../utils/logger");
/**
 * Service responsible for managing connection to TIA Portal
 */
class TiaConnectionService {
    _isConnected = false;
    _currentProject = null;
    _projects = [];
    _bridge;
    _onConnectionChanged = new vscode.EventEmitter();
    onConnectionChanged = this._onConnectionChanged.event;
    _onProjectChanged = new vscode.EventEmitter();
    onProjectChanged = this._onProjectChanged.event;
    constructor() {
        this._bridge = new tiaOpennessBridge_1.TiaOpennessBridge();
    }
    /**
     * Whether currently connected to TIA Portal
     */
    get isConnected() {
        return this._isConnected;
    }
    /**
     * Current selected project
     */
    get currentProject() {
        return this._currentProject;
    }
    /**
     * Current project name (shorthand)
     */
    get currentProjectName() {
        return this._currentProject?.name;
    }
    /**
     * Get the TIA Openness bridge for direct access
     */
    getBridge() {
        return this._bridge;
    }
    /**
     * Verify the connection to TIA Portal is still alive.
     * If the connection is broken, automatically disconnects and notifies the user.
     * @returns true if connected and healthy, false if not connected or connection is broken
     */
    async ensureConnected() {
        if (!this._isConnected) {
            logger_1.Logger.warn('Not connected to TIA Portal');
            vscode.window.showWarningMessage('TIA Portal: No connection. Connect to TIA Portal first.');
            return false;
        }
        try {
            const alive = await this._bridge.ping();
            if (!alive) {
                logger_1.Logger.error('Connection to TIA Portal is broken - auto-disconnecting');
                await this.forceDisconnect();
                vscode.window.showErrorMessage('TIA Portal: Connection was lost. Disconnected automatically. Please reconnect.');
                return false;
            }
            return true;
        }
        catch (error) {
            logger_1.Logger.error('Failed to verify TIA Portal connection - auto-disconnecting', error);
            await this.forceDisconnect();
            vscode.window.showErrorMessage('TIA Portal: Could not verify connection (timeout). Disconnected automatically.');
            return false;
        }
    }
    /**
     * Force disconnect without confirmation - used when connection is detected as broken
     */
    async forceDisconnect() {
        try {
            await this._bridge.disconnect();
        }
        catch {
            // Ignore errors during force disconnect
        }
        this._isConnected = false;
        this._currentProject = null;
        this._projects = [];
        this._onConnectionChanged.fire(false);
        this._onProjectChanged.fire(null);
    }
    /**
     * Connect to TIA Portal
     * - If TIA Portal is running with projects, attaches to it
     * - If TIA Portal is not running, opens file dialog to select project file
     */
    async connect() {
        logger_1.Logger.startOperation('Connect to TIA Portal');
        try {
            logger_1.Logger.info('Searching for running TIA Portal instances...');
            const result = await this._bridge.connect();
            // User cancelled the file dialog
            if (result.cancelled) {
                logger_1.Logger.info('Connection cancelled by user');
                logger_1.Logger.endOperation('Connect to TIA Portal', false);
                return false;
            }
            if (result.success) {
                this._isConnected = true;
                this._projects = result.projects || [];
                logger_1.Logger.success('Connection established');
                if (result.dialogForegroundMode) {
                    logger_1.Logger.info(`Project dialog foreground mode: ${result.dialogForegroundMode}`);
                }
                // Check if project was auto-selected (from file dialog or single running project)
                if (result.autoSelectedProject) {
                    logger_1.Logger.info(`Project auto-selected: ${result.autoSelectedProject}`);
                    await this.selectProject(result.autoSelectedProject);
                }
                else if (result.requiresProjectSelection) {
                    // Multiple projects in running TIA Portal - user needs to choose
                    logger_1.Logger.list('Projects found - please select one', this._projects.map(p => p.name));
                }
                else if (this._projects.length === 1) {
                    // If exactly one project is available, select it immediately.
                    const singleProject = this._projects[0];
                    const singleProjectRef = singleProject.id || singleProject.name;
                    logger_1.Logger.info(`Single project detected. Auto-selecting: ${singleProject.name}`);
                    await this.selectProject(singleProjectRef);
                }
                else {
                    logger_1.Logger.list('Projects found', this._projects.map(p => p.name));
                }
                this._onConnectionChanged.fire(true);
                logger_1.Logger.endOperation('Connect to TIA Portal', true);
                return true;
            }
            else {
                logger_1.Logger.error('Failed to connect to TIA Portal', result.error);
                logger_1.Logger.endOperation('Connect to TIA Portal', false);
                return false;
            }
        }
        catch (error) {
            logger_1.Logger.error('Exception while connecting to TIA Portal', error);
            logger_1.Logger.endOperation('Connect to TIA Portal', false);
            return false;
        }
    }
    /**
     * Disconnect from TIA Portal
     */
    async disconnect() {
        logger_1.Logger.startOperation('Disconnect from TIA Portal');
        try {
            await this._bridge.disconnect();
            this._isConnected = false;
            this._currentProject = null;
            this._projects = [];
            this._onConnectionChanged.fire(false);
            this._onProjectChanged.fire(null);
            logger_1.Logger.success('Disconnected from TIA Portal');
            logger_1.Logger.endOperation('Disconnect from TIA Portal', true);
        }
        catch (error) {
            logger_1.Logger.error('Exception while disconnecting from TIA Portal', error);
            logger_1.Logger.endOperation('Disconnect from TIA Portal', false);
        }
    }
    /**
     * Detach from TIA Portal without closing it.
     *
     * Called on extension deactivation so that when VS Code started TIA
     * Portal (via the project file dialog) the user is not surprised by
     * TIA Portal shutting down along with the editor. The underlying
     * .NET `TiaPortal` instance is released without calling `Dispose()`
     * so the process keeps running.
     */
    async detach() {
        if (!this._isConnected) {
            return;
        }
        try {
            await this._bridge.detach();
        }
        catch (error) {
            logger_1.Logger.warn('Exception while detaching from TIA Portal (ignored)', error);
        }
        finally {
            this._isConnected = false;
            this._currentProject = null;
            this._projects = [];
            this._onConnectionChanged.fire(false);
            this._onProjectChanged.fire(null);
        }
    }
    /**
     * Get list of open projects in TIA Portal
     */
    async getProjects() {
        if (!this._isConnected) {
            logger_1.Logger.warn('Cannot get projects - not connected');
            return [];
        }
        try {
            logger_1.Logger.debug('Fetching project list from TIA Portal...');
            const result = await this._bridge.getProjects();
            this._projects = result.projects || [];
            logger_1.Logger.debug(`Found ${this._projects.length} project(s)`);
            return this._projects;
        }
        catch (error) {
            logger_1.Logger.error('Failed to get projects', error);
            return [];
        }
    }
    /**
     * Select a project to work with
     */
    async selectProject(projectName) {
        if (!this._isConnected) {
            logger_1.Logger.warn('Cannot select project - not connected');
            return false;
        }
        logger_1.Logger.section(`Selecting project: ${projectName}`);
        try {
            const result = await this._bridge.selectProject(projectName);
            if (result.success && result.project) {
                this._currentProject = result.project;
                this._onProjectChanged.fire(this._currentProject);
                // Log project structure
                logger_1.Logger.success(`Project selected: ${projectName}`);
                logger_1.Logger.info(`  Version: ${result.project.version || 'unknown'}`);
                logger_1.Logger.info(`  Devices: ${result.project.devices.length}`);
                for (const device of result.project.devices) {
                    logger_1.Logger.debug(`    ├─ ${device.displayName || device.name} (${device.type})`);
                    for (const plc of device.plcSoftware) {
                        const blockCount = plc.blockGroups.reduce((sum, g) => sum + g.blocks.length, 0);
                        const tagCount = plc.tagTables.length;
                        logger_1.Logger.debug(`    │  └─ ${plc.name}: ${blockCount} blocks, ${tagCount} tag tables`);
                    }
                }
                return true;
            }
            logger_1.Logger.warn(`Project "${projectName}" not found or could not be selected`);
            return false;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to select project: ${projectName}`, error);
            return false;
        }
    }
    /**
     * Refresh project structure from TIA Portal
     */
    async refreshProjectStructure() {
        if (!this._isConnected || !this._currentProject) {
            return;
        }
        try {
            const projectRef = this._currentProject.id || this._currentProject.name;
            const result = await this._bridge.getProjectStructure(projectRef);
            if (result.success && result.project) {
                this._currentProject = result.project;
                this._onProjectChanged.fire(this._currentProject);
            }
        }
        catch (error) {
            logger_1.Logger.error('Failed to refresh project structure', error);
            throw error;
        }
    }
    /**
     * Get devices in current project
     */
    getDevices() {
        return this._currentProject?.devices || [];
    }
    /**
     * Get a specific device by ID
     */
    getDevice(deviceId) {
        return this._currentProject?.devices.find(d => d.id === deviceId);
    }
    /**
     * Get all blocks from a device
     */
    getBlocks(deviceId) {
        const device = this.getDevice(deviceId);
        if (!device) {
            return [];
        }
        const blocks = [];
        for (const plc of device.plcSoftware) {
            for (const group of plc.blockGroups) {
                blocks.push(...this.collectBlocks(group));
            }
        }
        return blocks;
    }
    collectBlocks(group) {
        const blocks = [...group.blocks];
        for (const subgroup of group.subGroups || []) {
            blocks.push(...this.collectBlocks(subgroup));
        }
        return blocks;
    }
    /**
     * Dispose resources
     */
    dispose() {
        this._onConnectionChanged.dispose();
        this._onProjectChanged.dispose();
    }
}
exports.TiaConnectionService = TiaConnectionService;
//# sourceMappingURL=tiaConnection.js.map