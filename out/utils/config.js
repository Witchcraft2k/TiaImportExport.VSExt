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
exports.getConfig = getConfig;
exports.getWorkspacePath = getWorkspacePath;
const vscode = __importStar(require("vscode"));
function getConfig() {
    const config = vscode.workspace.getConfiguration('tiaImport');
    const version = config.get('tiaPortalVersion') || 21;
    const customPath = config.get('tiaPortalPath') || '';
    const defaultPath = `C:\\Program Files\\Siemens\\Automation\\Portal V${version}`;
    return {
        tiaPortalVersion: version,
        tiaPortalPath: customPath || defaultPath,
        exportFolderName: config.get('exportFolderName') || 'TiaExport',
        autoConnect: config.get('autoConnect') || false,
        includeComments: config.get('includeComments') ?? true,
        exportFormat: config.get('exportFormat') || 'xml',
        dbExportFormat: config.get('dbExportFormat') || 'db',
        tagTableFormat: config.get('tagTableFormat') || 'xml',
        hwConfigFormat: config.get('hwConfigFormat') || 'xml',
        showImportExportDetails: config.get('showImportExportDetails') ?? false,
        preserveTimestamps: config.get('preserveTimestamps') ?? true,
        excludeSystemBlocks: config.get('excludeSystemBlocks') ?? true,
        dotnetPath: config.get('dotnetPath') || '',
        importProgressItemsPerSecond: normalizePositiveNumber(config.get('importProgress.itemsPerSecond'), 1),
        automationCompareTool: {
            path: config.get('automationCompareTool.path') || '',
            autoDetect: config.get('automationCompareTool.autoDetect') ?? true,
            argumentsTemplate: config.get('automationCompareTool.argumentsTemplate') || '${file}',
            compareArgumentsTemplate: config.get('automationCompareTool.compareArgumentsTemplate')
                || '"${file1}" "${file2}" --title1 "${title1}" --title2 "${title2}"',
            embedMode: config.get('automationCompareTool.embedMode') || 'native',
            embedTimeoutMs: config.get('automationCompareTool.embedTimeoutMs') || 10000
        },
        compileAfterExport: config.get('compileAfterExport') || 'ask',
        autoExportCrossReferences: normalizeAutoCrossRef(config.get('autoExportCrossReferences'))
    };
}
function normalizePositiveNumber(raw, fallback) {
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : fallback;
}
/**
 * Backwards-compat: the setting was originally a boolean. Map legacy
 * `true` → `'always'`, `false` → `'never'`. New values pass through.
 */
function normalizeAutoCrossRef(raw) {
    if (raw === true)
        return 'always';
    if (raw === false || raw === undefined || raw === null)
        return 'never';
    if (raw === 'always' || raw === 'ask' || raw === 'never')
        return raw;
    return 'never';
}
function getWorkspacePath() {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
//# sourceMappingURL=config.js.map