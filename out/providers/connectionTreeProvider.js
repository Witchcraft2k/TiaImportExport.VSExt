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
exports.TiaConnectionTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
const config_1 = require("../utils/config");
/**
 * Tree item for connection status
 */
class ConnectionTreeItem extends vscode.TreeItem {
    label;
    value;
    iconId;
    itemContextValue;
    command;
    constructor(label, value, iconId, itemContextValue, command) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.label = label;
        this.value = value;
        this.iconId = iconId;
        this.itemContextValue = itemContextValue;
        this.command = command;
        this.description = value;
        this.iconPath = new vscode.ThemeIcon(iconId);
        if (itemContextValue) {
            this.contextValue = itemContextValue;
        }
        if (command) {
            this.command = command;
        }
    }
}
/**
 * Tree data provider for connection status panel
 */
class TiaConnectionTreeProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    _connectionService;
    constructor(connectionService) {
        this._connectionService = connectionService;
        // Listen for connection changes
        connectionService.onConnectionChanged(() => {
            this.refresh();
        });
        connectionService.onProjectChanged(() => {
            this.refresh();
        });
    }
    /**
     * Refresh the tree view
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get tree item for display
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children of a tree item
     */
    async getChildren(element) {
        // Only show root items
        if (element) {
            return [];
        }
        const items = [];
        const config = (0, config_1.getConfig)();
        // TIA Portal version selector (always visible; version is chosen before connecting)
        items.push(new ConnectionTreeItem('TIA Portal', `V${config.tiaPortalVersion}`, 'versions', 'tiaPortalVersion', {
            command: 'tia-import.selectTiaPortalVersion',
            title: 'Select TIA Portal Version'
        }));
        // Diagnostic logging toggle (always visible; useful before connecting too)
        items.push(new ConnectionTreeItem('Log Details', config.showImportExportDetails ? 'On' : 'Off', 'output', 'showImportExportDetails', {
            command: 'tia-import.toggleShowImportExportDetails',
            title: 'Toggle Log Details'
        }));
        // CLI bridge toggle (always visible; lets users enable the localhost
        // JSON bridge without opening Settings)
        const cliEnabled = vscode.workspace
            .getConfiguration('tiaImport')
            .get('cli.enabled', false);
        items.push(new ConnectionTreeItem('CLI Bridge', cliEnabled ? 'On' : 'Off', 'terminal', 'cliEnabled', {
            command: 'tia-import.toggleCli',
            title: 'Toggle CLI Bridge'
        }));
        // Connection status
        if (this._connectionService.isConnected) {
            items.push(new ConnectionTreeItem('Status', 'Connected - Click to disconnect', 'plug', 'connectedStatus', {
                command: 'tia-import.disconnect',
                title: 'Disconnect from TIA Portal'
            }));
            // Current project
            const projectName = this._connectionService.currentProjectName;
            if (projectName) {
                items.push(new ConnectionTreeItem('Project', projectName, 'folder-opened', 'project', {
                    command: 'tia-import.selectProject',
                    title: 'Select Project'
                }));
                // Device count
                const devices = this._connectionService.getDevices();
                items.push(new ConnectionTreeItem('Devices', `${devices.length} device(s)`, 'server'));
                // Export format
                const formatLabels = {
                    'xml': 'XML (SimaticML)',
                    'sd': 'Auto (SCL→.scl, LAD/FBD→.s7dcl)'
                };
                items.push(new ConnectionTreeItem('Export Format', formatLabels[config.exportFormat] || config.exportFormat, 'file-code', 'exportFormat', {
                    command: 'tia-import.selectExportFormat',
                    title: 'Select Export Format'
                }));
                // SD → XML preview mirror toggle (only relevant when SD format is selected;
                // when blocks are already exported as XML the preview works natively).
                if (config.exportFormat === 'sd') {
                    const previewXmlEnabled = vscode.workspace
                        .getConfiguration('tiaImport')
                        .get('s7dclPreviewXml.enabled', true);
                    items.push(new ConnectionTreeItem('XML Preview Mirror', previewXmlEnabled ? 'On' : 'Off', 'preview', 's7dclPreviewXml', {
                        command: 'tia-import.toggleS7dclPreviewXml',
                        title: 'Toggle SD → XML Preview Mirror'
                    }));
                }
                // DB export format selector
                const dbFormatLabels = {
                    'xml': 'XML',
                    'db': 'Source (.db)'
                };
                items.push(new ConnectionTreeItem('Format DB', dbFormatLabels[config.dbExportFormat] || config.dbExportFormat, 'file-code', 'dbExportFormat', {
                    command: 'tia-import.toggleDbExportFormat',
                    title: 'Toggle DB Export Format'
                }));
                // PLC tag table format selector
                items.push(new ConnectionTreeItem('Format PLC Tags', config.tagTableFormat.toUpperCase(), 'table', 'tagTableXlsx', {
                    command: 'tia-import.toggleTagTableXlsx',
                    title: 'Format PLC Tags'
                }));
                // HW configuration format selector (TIA <-> workspace)
                const hwFormatLabels = {
                    'xml': 'XML',
                    'cax': 'CAx (AutomationML)'
                };
                items.push(new ConnectionTreeItem('Format HW', hwFormatLabels[config.hwConfigFormat] || config.hwConfigFormat, 'circuit-board', 'hwConfigFormat', {
                    command: 'tia-import.toggleHwConfigFormat',
                    title: 'Toggle HW Config Format'
                }));
                // Compile after export selector
                const compileLabels = {
                    'always': 'Always',
                    'ask': 'Ask',
                    'never': 'Never'
                };
                const compileSetting = config.compileAfterExport || 'ask';
                items.push(new ConnectionTreeItem('Compile after Export', compileLabels[compileSetting] || compileSetting, 'gear', 'compileAfterExport', {
                    command: 'tia-import.toggleCompileAfterExport',
                    title: 'Compile after Export'
                }));
                // Auto-export cross references (always / ask / never)
                const xrefLabels = { always: 'Always', ask: 'Ask', never: 'Never' };
                items.push(new ConnectionTreeItem('Auto Cross-Refs', xrefLabels[config.autoExportCrossReferences] || config.autoExportCrossReferences, 'references', 'autoExportCrossReferences', {
                    command: 'tia-import.toggleAutoExportCrossReferences',
                    title: 'Toggle Auto-export Cross References'
                }));
            }
            else {
                items.push(new ConnectionTreeItem('Project', 'Click to select project', 'folder', 'noProject', {
                    command: 'tia-import.selectProject',
                    title: 'Select Project'
                }));
            }
        }
        else {
            items.push(new ConnectionTreeItem('Status', 'Disconnected', 'debug-disconnect', 'disconnectedStatus'));
            items.push(new ConnectionTreeItem('Action', 'Click to connect', 'plug', 'connectAction', {
                command: 'tia-import.connect',
                title: 'Connect to TIA Portal'
            }));
        }
        return items;
    }
}
exports.TiaConnectionTreeProvider = TiaConnectionTreeProvider;
//# sourceMappingURL=connectionTreeProvider.js.map