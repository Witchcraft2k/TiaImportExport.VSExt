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
exports.registerUtilityCommands = registerUtilityCommands;
const vscode = __importStar(require("vscode"));
const commandContext_1 = require("../commandContext");
const logger_1 = require("../../utils/logger");
const workspace_1 = require("../../utils/workspace");
/**
 * Miscellaneous utility commands (settings, logs, workspace prep, format
 * toggles). Grouped together because none of them warrant their own module.
 */
function registerUtilityCommands(ctx) {
    const { connectionTreeProvider } = ctx;
    (0, commandContext_1.register)(ctx, 'tia-import.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'tiaImport');
    });
    (0, commandContext_1.register)(ctx, 'tia-import.showLogs', () => {
        logger_1.Logger.show();
        logger_1.Logger.info('Output panel opened by user');
    });
    (0, commandContext_1.register)(ctx, 'tia-import.prepareWorkspace', async () => {
        if (!await workspace_1.WorkspaceManager.ensureWorkspace()) {
            return;
        }
        await workspace_1.WorkspaceManager.initializeWorkspaceStructure({ includeTemplates: true });
        logger_1.Logger.success('Workspace prepared: templates and export folder created');
        vscode.window.showInformationMessage('TIA Import: Workspace prepared — .github/ templates and TiaExport/ folder created.');
    });
    (0, commandContext_1.register)(ctx, 'tia-import.selectExportFormat', async () => {
        const currentFormat = vscode.workspace.getConfiguration('tiaImport').get('exportFormat') || 'xml';
        const options = [
            {
                label: 'XML (SimaticML)',
                description: 'xml',
                detail: 'Standard TIA Portal XML export format',
                picked: currentFormat === 'xml'
            },
            {
                label: 'Auto (SD)',
                description: 'sd',
                detail: 'Auto-selects format: SCL blocks → .scl, LAD/FBD blocks → .s7dcl/.s7res',
                picked: currentFormat === 'sd'
            }
        ];
        const selected = await vscode.window.showQuickPick(options, {
            title: 'Select Export Format',
            placeHolder: `Current: ${currentFormat}`
        });
        if (selected && selected.description) {
            await vscode.workspace.getConfiguration('tiaImport').update('exportFormat', selected.description, vscode.ConfigurationTarget.Global);
            connectionTreeProvider.refresh();
            vscode.window.showInformationMessage(`Export format changed to: ${selected.label}`);
        }
    });
    (0, commandContext_1.register)(ctx, 'tia-import.toggleDbExportFormat', async () => {
        const current = vscode.workspace.getConfiguration('tiaImport').get('dbExportFormat') || 'xml';
        const newValue = current === 'xml' ? 'db' : 'xml';
        await vscode.workspace.getConfiguration('tiaImport').update('dbExportFormat', newValue, vscode.ConfigurationTarget.Global);
        connectionTreeProvider.refresh();
        const labels = { xml: 'XML', db: 'Source (.db)' };
        vscode.window.showInformationMessage(`Format DB: ${labels[newValue] || newValue}`);
    });
    (0, commandContext_1.register)(ctx, 'tia-import.toggleTagTableXlsx', async () => {
        const current = vscode.workspace.getConfiguration('tiaImport').get('tagTableFormat') || 'xml';
        const newValue = current === 'xml' ? 'xlsx' : 'xml';
        await vscode.workspace.getConfiguration('tiaImport').update('tagTableFormat', newValue, vscode.ConfigurationTarget.Global);
        connectionTreeProvider.refresh();
        const labels = { xml: 'XML', xlsx: 'Excel (.xlsx)' };
        vscode.window.showInformationMessage(`Format Tag Tables: ${labels[newValue] || newValue}`);
    });
    (0, commandContext_1.register)(ctx, 'tia-import.toggleHwConfigFormat', async () => {
        const current = vscode.workspace.getConfiguration('tiaImport').get('hwConfigFormat') || 'xml';
        const newValue = current === 'xml' ? 'cax' : 'xml';
        await vscode.workspace.getConfiguration('tiaImport').update('hwConfigFormat', newValue, vscode.ConfigurationTarget.Global);
        connectionTreeProvider.refresh();
        const labels = { xml: 'XML', cax: 'CAx (AutomationML)' };
        vscode.window.showInformationMessage(`Format HW: ${labels[newValue] || newValue}`);
    });
    (0, commandContext_1.register)(ctx, 'tia-import.toggleS7dclPreviewXml', async () => {
        const cfg = vscode.workspace.getConfiguration('tiaImport');
        const current = cfg.get('s7dclPreviewXml.enabled', true);
        const newValue = !current;
        await cfg.update('s7dclPreviewXml.enabled', newValue, vscode.ConfigurationTarget.Global);
        connectionTreeProvider.refresh();
        vscode.window.showInformationMessage(`SD → XML Preview Mirror: ${newValue ? 'On' : 'Off'}`);
    });
    (0, commandContext_1.register)(ctx, 'tia-import.toggleCompileAfterExport', async () => {
        const current = vscode.workspace.getConfiguration('tiaImport').get('compileAfterExport') || 'ask';
        const cycle = { ask: 'always', always: 'never', never: 'ask' };
        const newValue = cycle[current] || 'ask';
        await vscode.workspace.getConfiguration('tiaImport').update('compileAfterExport', newValue, vscode.ConfigurationTarget.Global);
        connectionTreeProvider.refresh();
        const labels = { always: 'Always', ask: 'Ask', never: 'Never' };
        vscode.window.showInformationMessage(`Compile after Export: ${labels[newValue] || newValue}`);
    });
    (0, commandContext_1.register)(ctx, 'tia-import.toggleShowImportExportDetails', async () => {
        const current = vscode.workspace.getConfiguration('tiaImport').get('showImportExportDetails') ?? false;
        const newValue = !current;
        await vscode.workspace.getConfiguration('tiaImport').update('showImportExportDetails', newValue, vscode.ConfigurationTarget.Global);
        connectionTreeProvider.refresh();
        vscode.window.showInformationMessage(`Log Details: ${newValue ? 'On' : 'Off'}`);
    });
    (0, commandContext_1.register)(ctx, 'tia-import.toggleCli', async () => {
        const cfg = vscode.workspace.getConfiguration('tiaImport');
        const inspection = cfg.inspect('cli.enabled');
        const current = inspection?.workspaceValue ?? inspection?.globalValue ?? inspection?.defaultValue ?? false;
        const newValue = !current;
        // Toggle at the same level where the setting is currently defined.
        // Workspace settings override user settings, so if the workspace has
        // it set we must flip it there for the effective value to change.
        let target = vscode.ConfigurationTarget.Global;
        if (inspection?.workspaceValue !== undefined) {
            target = vscode.ConfigurationTarget.Workspace;
        }
        try {
            await cfg.update('cli.enabled', newValue, target);
        }
        catch {
            // If updating at workspace level fails (e.g. no workspace open),
            // fall back to global settings.
            await cfg.update('cli.enabled', newValue, vscode.ConfigurationTarget.Global);
        }
        connectionTreeProvider.refresh();
        vscode.window.showInformationMessage(newValue
            ? 'TIA Import: CLI bridge enabled. A .tia/cli.json file will be created with the connection token.'
            : 'TIA Import: CLI bridge disabled.');
    });
    (0, commandContext_1.register)(ctx, 'tia-import.toggleAutoExportCrossReferences', async () => {
        const current = vscode.workspace.getConfiguration('tiaImport').get('autoExportCrossReferences') || 'ask';
        const cycle = { ask: 'always', always: 'never', never: 'ask' };
        const newValue = cycle[current] || 'ask';
        await vscode.workspace.getConfiguration('tiaImport').update('autoExportCrossReferences', newValue, vscode.ConfigurationTarget.Global);
        connectionTreeProvider.refresh();
        const labels = { always: 'Always', ask: 'Ask', never: 'Never' };
        vscode.window.showInformationMessage(`Auto-export Cross References: ${labels[newValue] || newValue}`);
    });
    (0, commandContext_1.register)(ctx, 'tia-import.selectTiaPortalVersion', async () => {
        const cfg = vscode.workspace.getConfiguration('tiaImport');
        const current = cfg.get('tiaPortalVersion') || 21;
        const options = [18, 19, 20, 21].map(v => ({
            label: `TIA Portal V${v}`,
            description: String(v),
            detail: v === current ? 'Currently selected' : undefined,
            picked: v === current
        }));
        const selected = await vscode.window.showQuickPick(options, {
            title: 'Select TIA Portal Version',
            placeHolder: `Current: V${current}`
        });
        if (selected && selected.description) {
            const newVersion = parseInt(selected.description, 10);
            if (newVersion === current) {
                return;
            }
            await cfg.update('tiaPortalVersion', newVersion, vscode.ConfigurationTarget.Global);
            connectionTreeProvider.refresh();
            // The configuration-change listener in extension.ts will offer the reload prompt.
        }
    });
}
//# sourceMappingURL=utilityCommands.js.map