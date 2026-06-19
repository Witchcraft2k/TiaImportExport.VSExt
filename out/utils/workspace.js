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
exports.WorkspaceManager = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Workspace utilities for TIA Portal Import
 */
class WorkspaceManager {
    static _extensionPath = '';
    /**
     * Set the extension installation path (needed for accessing templates)
     */
    static setExtensionPath(extensionPath) {
        WorkspaceManager._extensionPath = extensionPath;
    }
    /**
     * Check if a workspace folder is open
     */
    static hasWorkspace() {
        return vscode.workspace.workspaceFolders !== undefined &&
            vscode.workspace.workspaceFolders.length > 0;
    }
    /**
     * Get the workspace root path
     */
    static getWorkspacePath() {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }
    /**
     * Get the TIA export directory path (creates if not exists)
     */
    static async getTiaExportPath() {
        const workspacePath = this.getWorkspacePath();
        if (!workspacePath) {
            return undefined;
        }
        const config = vscode.workspace.getConfiguration('tiaImport');
        let exportFolder = config.get('exportFolderName') || 'TiaExport';
        const exportPath = path.join(workspacePath, exportFolder);
        // Create directory if it doesn't exist
        if (!fs.existsSync(exportPath)) {
            await fs.promises.mkdir(exportPath, { recursive: true });
        }
        return exportPath;
    }
    /**
     * Ensure workspace is open, show error if not
     * @returns true if workspace is available, false otherwise
     */
    static async ensureWorkspace() {
        if (this.hasWorkspace()) {
            return true;
        }
        const action = await vscode.window.showErrorMessage('TIA Import: No workspace folder is open. Please open a folder to use as the TIA Portal import location.', 'Open Folder', 'Cancel');
        if (action === 'Open Folder') {
            await vscode.commands.executeCommand('vscode.openFolder');
        }
        return false;
    }
    /**
     * Initialize workspace structure for TIA imports
     */
    static async initializeWorkspaceStructure(options = {}) {
        const exportPath = await this.getTiaExportPath();
        if (!exportPath) {
            return;
        }
        const workspacePath = this.getWorkspacePath();
        if (!workspacePath) {
            return;
        }
        // Create standard subdirectories
        const subdirs = [
            'Projects',
            '.tia-cache'
        ];
        for (const subdir of subdirs) {
            const dirPath = path.join(exportPath, subdir);
            if (!fs.existsSync(dirPath)) {
                await fs.promises.mkdir(dirPath, { recursive: true });
            }
        }
        // Template files (.github copilot instructions, Tools/ scripts, AGENTS.md, etc.)
        // are only copied when explicitly requested via the Init Workspace button
        // or the prepare_workspace API — not on every TIA connect.
        if (options.includeTemplates) {
            await this.copyTemplateFile('.gitignore', workspacePath);
            await this.copyTemplateFile('CLAUDE.md', workspacePath);
            await this.copyTemplateFile('AGENTS.md', workspacePath);
            await this.copyTemplateDir('.github', workspacePath);
            await this.copyTemplateDir('Tools', workspacePath);
            await this.copyTemplateDir('UserFiles', workspacePath);
        }
        // UserFiles is a runtime output folder. Ensure it exists even if
        // the template directory is missing (e.g. empty dir not packed in VSIX).
        const userFilesPath = path.join(workspacePath, 'UserFiles');
        if (!fs.existsSync(userFilesPath)) {
            await fs.promises.mkdir(userFilesPath, { recursive: true });
        }
    }
    /**
     * Copy a template file from Documentation/Templates/ to target directory.
     * Only copies if the target file does not already exist.
     * @param relativePath - relative path within the template directory (e.g. '.gitignore')
     * @param targetBase - base directory where the file should be placed
     */
    static async copyTemplateFile(relativePath, targetBase) {
        const targetPath = path.join(targetBase, relativePath);
        if (fs.existsSync(targetPath)) {
            return;
        }
        const templatePath = path.join(WorkspaceManager._extensionPath, 'Documentation', 'Templates', relativePath);
        if (!fs.existsSync(templatePath)) {
            return;
        }
        // Ensure target directory exists
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
            await fs.promises.mkdir(targetDir, { recursive: true });
        }
        await fs.promises.copyFile(templatePath, targetPath);
    }
    /**
     * Recursively copy a template directory from Documentation/Templates/ to target directory.
     * Only copies files that do not already exist at the target location.
     * @param relativeDirPath - relative directory path within the template directory (e.g. '.github')
     * @param targetBase - base directory where the folder should be placed
     */
    static async copyTemplateDir(relativeDirPath, targetBase) {
        const templateDir = path.join(WorkspaceManager._extensionPath, 'Documentation', 'Templates', relativeDirPath);
        if (!fs.existsSync(templateDir)) {
            return;
        }
        // Ensure target directory exists (even if template dir is empty)
        const targetDir = path.join(targetBase, relativeDirPath);
        if (!fs.existsSync(targetDir)) {
            await fs.promises.mkdir(targetDir, { recursive: true });
        }
        const entries = await fs.promises.readdir(templateDir, { withFileTypes: true });
        for (const entry of entries) {
            const relPath = path.join(relativeDirPath, entry.name);
            if (entry.isDirectory()) {
                await this.copyTemplateDir(relPath, targetBase);
            }
            else {
                await this.copyTemplateFile(relPath, targetBase);
            }
        }
    }
    /**
     * Get project export path
     */
    static async getProjectExportPath(projectName) {
        const exportPath = await this.getTiaExportPath();
        if (!exportPath) {
            return undefined;
        }
        const projectPath = path.join(exportPath, 'Projects', projectName);
        if (!fs.existsSync(projectPath)) {
            await fs.promises.mkdir(projectPath, { recursive: true });
        }
        return projectPath;
    }
}
exports.WorkspaceManager = WorkspaceManager;
//# sourceMappingURL=workspace.js.map