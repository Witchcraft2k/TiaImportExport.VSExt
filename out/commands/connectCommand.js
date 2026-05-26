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
exports.connectCommand = connectCommand;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const workspace_1 = require("../utils/workspace");
async function connectCommand(connectionService, projectTreeProvider, connectionTreeProvider) {
    try {
        // Ensure workspace is open
        if (!await workspace_1.WorkspaceManager.ensureWorkspace()) {
            return;
        }
        logger_1.Logger.section('CONNECT TO TIA PORTAL');
        logger_1.Logger.info('Starting connection process...');
        logger_1.Logger.info('If TIA Portal is running, will attach to it.');
        logger_1.Logger.info('Otherwise, a file dialog will open to select project file.');
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TIA Import",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: "Connecting to TIA Portal..." });
            const connected = await connectionService.connect();
            if (connected) {
                progress.report({ message: "Preparing workspace..." });
                // Initialize workspace structure (templates + TiaExport folder) on first connection
                await workspace_1.WorkspaceManager.initializeWorkspaceStructure();
                progress.report({ message: "Loading projects..." });
                // Refresh tree views
                connectionTreeProvider.refresh();
                projectTreeProvider.refresh();
                const exportPath = await workspace_1.WorkspaceManager.getTiaExportPath();
                const projectName = connectionService.currentProjectName;
                if (projectName) {
                    logger_1.Logger.success(`Connected to project: ${projectName}`);
                    logger_1.Logger.info(`Import path: ${exportPath}`);
                    vscode.window.showInformationMessage(`TIA Import: Connected to "${projectName}". Data will be saved in: ${exportPath}`);
                }
                else {
                    logger_1.Logger.success('Connected! Please select a project from the list.');
                    vscode.window.showInformationMessage('TIA Import: Connected. Please select a project from the TIA Explorer.');
                }
            }
            else {
                // Connection was cancelled or failed
                logger_1.Logger.info('Connection process ended');
            }
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Connection failed', error);
        vscode.window.showErrorMessage(`TIA Import: ${message}`);
    }
}
//# sourceMappingURL=connectCommand.js.map