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
exports.selectProjectCommand = selectProjectCommand;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
async function selectProjectCommand(connectionService, projectTreeProvider) {
    try {
        if (!await connectionService.ensureConnected()) {
            return;
        }
        logger_1.Logger.section('SELECT PROJECT');
        logger_1.Logger.info('Fetching available projects...');
        const projects = await connectionService.getProjects();
        if (projects.length === 0) {
            logger_1.Logger.warn('No projects found in TIA Portal');
            vscode.window.showWarningMessage('TIA Import: No projects found in TIA Portal');
            return;
        }
        logger_1.Logger.list('Available projects', projects.map(p => p.name));
        const items = projects.map(p => ({
            label: p.name,
            description: p.path,
            project: p
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a TIA Portal project',
            title: 'TIA Portal Projects'
        });
        if (selected) {
            logger_1.Logger.info(`User selected: ${selected.label}`);
            await connectionService.selectProject(selected.project.id || selected.project.name);
            projectTreeProvider.refresh();
            logger_1.Logger.success(`Project "${selected.label}" loaded successfully`);
            vscode.window.showInformationMessage(`TIA Import: Selected project "${selected.label}"`);
        }
        else {
            logger_1.Logger.info('Project selection cancelled by user');
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Failed to select project', error);
        vscode.window.showErrorMessage(`TIA Import: ${message}`);
    }
}
//# sourceMappingURL=selectProjectCommand.js.map