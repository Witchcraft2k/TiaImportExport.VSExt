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
exports.projectTreeProvider = exports.projectImportService = exports.tiaConnectionService = void 0;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const tiaConnection_1 = require("./services/tiaConnection");
const projectImport_1 = require("./services/projectImport");
const projectTreeProvider_1 = require("./providers/projectTreeProvider");
const connectionTreeProvider_1 = require("./providers/connectionTreeProvider");
const tiaOpennessBridge_1 = require("./services/tiaOpennessBridge");
const commands_1 = require("./commands");
const logger_1 = require("./utils/logger");
const statusBar_1 = require("./utils/statusBar");
const workspace_1 = require("./utils/workspace");
const s7dclErrorParser_1 = require("./utils/s7dclErrorParser");
const compileDiagnostics_1 = require("./utils/compileDiagnostics");
const nativeModuleChecker_1 = require("./utils/nativeModuleChecker");
const tiaApi_1 = require("./api/tiaApi");
const tools_1 = require("./lm/tools");
const chatParticipant_1 = require("./lm/chatParticipant");
const tiaCliServer_1 = require("./cli/tiaCliServer");
const config_1 = require("./utils/config");
let tiaConnectionService;
let projectImportService;
let projectTreeProvider;
let connectionTreeProvider;
let statusBarManager;
async function activate(context) {
    logger_1.Logger.section('TIA PORTAL IMPORT - ACTIVATION');
    const extensionVersion = context.extension.packageJSON?.version ?? 'unknown';
    const tiaConfig = (0, config_1.getConfig)();
    logger_1.Logger.info(`Extension version: ${extensionVersion}`);
    logger_1.Logger.info(`TIA Portal version: V${tiaConfig.tiaPortalVersion}`);
    logger_1.Logger.info(`VS Code version: ${vscode.version}`);
    logger_1.Logger.info(`Platform: ${process.platform}`);
    logger_1.Logger.info(`Extension path: ${context.extensionPath}`);
    // Set extension path for TiaOpennessBridge before any initialization
    tiaOpennessBridge_1.TiaOpennessBridge.setExtensionPath(context.extensionPath);
    workspace_1.WorkspaceManager.setExtensionPath(context.extensionPath);
    // Check and auto-repair native modules (edge-js / electron-edge-js)
    // This runs in background - does not block activation
    nativeModuleChecker_1.NativeModuleChecker.ensureNativeModules(context.extensionPath).then(ready => {
        if (!ready) {
            logger_1.Logger.warn('Native modules are not ready - TIA Portal connection will not work until fixed');
        }
    });
    // Initialize diagnostic collections
    (0, s7dclErrorParser_1.initS7dclDiagnostics)(context);
    (0, compileDiagnostics_1.initCompileDiagnostics)(context);
    try {
        // Check if workspace is available
        if (!workspace_1.WorkspaceManager.hasWorkspace()) {
            logger_1.Logger.warn('No workspace folder open - some features will be limited');
            logger_1.Logger.info('Open a folder to enable full functionality');
        }
        else {
            logger_1.Logger.success(`Workspace ready: ${workspace_1.WorkspaceManager.getWorkspacePath()}`);
        }
        // Initialize services
        logger_1.Logger.info('Initializing services...');
        exports.tiaConnectionService = tiaConnectionService = new tiaConnection_1.TiaConnectionService();
        exports.projectImportService = projectImportService = new projectImport_1.ProjectImportService(tiaConnectionService);
        logger_1.Logger.debug('  ├─ TiaConnectionService');
        logger_1.Logger.debug('  └─ ProjectImportService');
        // Initialize tree providers
        logger_1.Logger.info('Initializing UI components...');
        exports.projectTreeProvider = projectTreeProvider = new projectTreeProvider_1.TiaProjectTreeProvider(tiaConnectionService);
        connectionTreeProvider = new connectionTreeProvider_1.TiaConnectionTreeProvider(tiaConnectionService);
        logger_1.Logger.debug('  ├─ ProjectTreeProvider');
        logger_1.Logger.debug('  └─ ConnectionTreeProvider');
        // Initialize status bar
        statusBarManager = new statusBar_1.StatusBarManager(tiaConnectionService);
        logger_1.Logger.debug('  └─ StatusBarManager');
        // Register tree views
        const projectTreeView = vscode.window.createTreeView('tiaProjectExplorer', {
            treeDataProvider: projectTreeProvider,
            showCollapseAll: true
        });
        const connectionTreeView = vscode.window.createTreeView('tiaConnection', {
            treeDataProvider: connectionTreeProvider
        });
        // Register commands
        (0, commands_1.registerCommands)(context, tiaConnectionService, projectImportService, projectTreeProvider, connectionTreeProvider);
        logger_1.Logger.info('Commands registered');
        // Initialise headless API + Language Model Tools + chat participant
        try {
            const api = (0, tiaApi_1.initTiaApi)(tiaConnectionService, projectImportService);
            (0, tools_1.registerLanguageModelTools)(context, api);
            (0, chatParticipant_1.registerChatParticipant)(context);
            context.subscriptions.push((0, tiaCliServer_1.startTiaCliServer)(context, api));
            context.subscriptions.push(vscode.commands.registerCommand('tia-import.startCli', async () => {
                const enabled = await (0, tiaCliServer_1.promptEnableTiaCli)();
                return { success: enabled };
            }));
        }
        catch (lmErr) {
            logger_1.Logger.warn('Failed to register Language Model integration (non-fatal)', lmErr);
        }
        // Auto-connect if configured and workspace is available
        const config = vscode.workspace.getConfiguration('tiaImport');
        if (config.get('autoConnect') && workspace_1.WorkspaceManager.hasWorkspace()) {
            logger_1.Logger.info('Auto-connect enabled - connecting to TIA Portal...');
            vscode.commands.executeCommand('tia-import.connect');
        }
        // Listen for TIA Portal version changes - requires reload
        const configWatcher = vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('tiaImport.tiaPortalVersion')) {
                const newConfig = (0, config_1.getConfig)();
                logger_1.Logger.info(`TIA Portal version changed to V${newConfig.tiaPortalVersion}`);
                // Auto-reset tiaPortalPath so getConfig()'s default kicks in for the
                // newly selected version (avoids users staying pinned to a stale path
                // like "...\Portal V21" after switching to V19).
                const cfg = vscode.workspace.getConfiguration('tiaImport');
                const customPath = cfg.get('tiaPortalPath') || '';
                const looksAutoDefault = /\\Program Files\\Siemens\\Automation\\Portal V\d+\\?$/i.test(customPath);
                if (customPath && looksAutoDefault) {
                    await cfg.update('tiaPortalPath', '', vscode.ConfigurationTarget.Global);
                    logger_1.Logger.info('Cleared tiaPortalPath — will auto-default to the installation folder of the selected version.');
                }
                const action = await vscode.window.showWarningMessage(`TIA Portal version changed to V${newConfig.tiaPortalVersion}. A window reload is required to apply this change.`, 'Reload Window');
                if (action === 'Reload Window') {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            }
        });
        // Add disposables
        context.subscriptions.push(projectTreeView, connectionTreeView, statusBarManager, configWatcher);
        logger_1.Logger.success('Extension activated successfully');
        logger_1.Logger.info('Use "TIA Import: Show Logs" to view this output');
    }
    catch (error) {
        logger_1.Logger.error('Failed to activate TIA Portal Import extension', error);
        vscode.window.showErrorMessage(`TIA Import: Failed to activate extension: ${error}`);
    }
}
function deactivate() {
    logger_1.Logger.info('TIA Portal Import extension is deactivating...');
    if (tiaConnectionService) {
        // Detach from TIA Portal instead of disconnecting, so that any TIA
        // Portal instance that was started by VS Code (via the project file
        // dialog) stays running after VS Code closes. The user can continue
        // working in TIA Portal and close it manually when done.
        tiaConnectionService.detach();
    }
    logger_1.Logger.info('TIA Portal Import extension deactivated');
}
//# sourceMappingURL=extension.js.map