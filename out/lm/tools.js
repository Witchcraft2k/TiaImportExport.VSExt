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
exports.registerLanguageModelTools = registerLanguageModelTools;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
// Cap on how much we serialise back to the model — keeps tokens sane.
const MAX_INLINE_ITEMS = 200;
const MAX_DIAG_ITEMS = 100;
function jsonResult(payload) {
    let text;
    try {
        text = JSON.stringify(payload, null, 2);
    }
    catch {
        text = String(payload);
    }
    return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(text)
    ]);
}
function errorResult(message) {
    return jsonResult({ success: false, error: message });
}
function getAutoConfirmImports() {
    return vscode.workspace.getConfiguration('tiaImport').get('lmTools.autoConfirmImports') === true;
}
function getMaxFixIterations() {
    const n = vscode.workspace.getConfiguration('tiaImport').get('lmTools.maxFixIterations');
    return Math.max(1, Math.min(20, typeof n === 'number' ? n : 5));
}
// ── Tool: tia_connect ─────────────────────────────────────────────
class ConnectTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(options) {
        const res = await this.api.connect();
        if (!res.success) {
            return errorResult(res.error);
        }
        if (options.input.projectName && options.input.projectName !== this.api.getCurrentProjectName()) {
            const sel = await this.api.selectProject(options.input.projectName);
            if (!sel.success) {
                return errorResult(sel.error);
            }
        }
        return jsonResult({
            success: true,
            connected: this.api.isConnected(),
            projectName: this.api.getCurrentProjectName()
        });
    }
}
// ── Tool: tia_disconnect ─────────────────────────────────────────
class DisconnectTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(_options) {
        const res = await this.api.disconnect();
        return jsonResult(res);
    }
}
// ── Tool: tia_list_projects ──────────────────────────────────────
class ListProjectsTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(_options) {
        const res = await this.api.listProjects();
        return jsonResult(res);
    }
}
// ── Tool: tia_select_project ─────────────────────────────────────
class SelectProjectTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(options) {
        const res = await this.api.selectProject(options.input.projectName);
        return jsonResult(res);
    }
}
// ── Tool: tia_list_devices ───────────────────────────────────────
class ListDevicesTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(_options) {
        const res = this.api.listDevices();
        return jsonResult(res);
    }
}
class ListBlocksTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(options) {
        const res = this.api.listBlocks(options.input.device);
        if (!res.success) {
            return errorResult(res.error);
        }
        let blocks = res.data ?? [];
        const filter = options.input.nameFilter?.toLowerCase();
        if (filter) {
            blocks = blocks.filter(b => b.name.toLowerCase().includes(filter));
        }
        const offset = Math.max(0, options.input.offset ?? 0);
        const limit = Math.max(1, Math.min(MAX_INLINE_ITEMS, options.input.limit ?? MAX_INLINE_ITEMS));
        const total = blocks.length;
        const slice = blocks.slice(offset, offset + limit);
        return jsonResult({
            success: true,
            total,
            offset,
            limit,
            returned: slice.length,
            blocks: slice
        });
    }
}
class ExportBlockTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(options) {
        const res = await this.api.exportBlock(options.input.device, options.input.block);
        if (!res.success) {
            return errorResult(res.error);
        }
        return jsonResult({
            success: true,
            message: res.message,
            filePath: res.data?.filePath,
            itemCount: res.data?.itemCount,
            updatedCount: res.data?.updatedCount,
            unchangedCount: res.data?.unchangedCount
        });
    }
}
class ExportDeviceTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(options, token) {
        const res = await this.api.exportDevice(options.input.device, token);
        if (!res.success) {
            return errorResult(res.error);
        }
        return jsonResult({
            success: true,
            message: res.message,
            filePath: res.data?.filePath,
            itemCount: res.data?.itemCount,
            updatedCount: res.data?.updatedCount,
            unchangedCount: res.data?.unchangedCount,
            deletedCount: res.data?.deletedCount
        });
    }
}
class ListUnitsTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(options) {
        const res = await this.api.listUnits(options.input.device);
        if (!res.success) {
            return errorResult(res.error);
        }
        return jsonResult({
            success: true,
            supported: res.data?.supported ?? false,
            units: res.data?.units ?? []
        });
    }
}
class ExportUnitsTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(options) {
        const res = await this.api.exportUnits(options.input.device);
        if (!res.success) {
            return errorResult(res.error);
        }
        return jsonResult({
            success: true,
            message: res.message,
            supported: res.data?.supported ?? true,
            unitCount: res.data?.unitCount ?? 0,
            itemCount: res.data?.itemCount,
            updatedCount: res.data?.updatedCount,
            unchangedCount: res.data?.unchangedCount
        });
    }
}
class ExportUnitTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(options) {
        const res = await this.api.exportUnit(options.input.device, options.input.unitName, options.input.kind);
        if (!res.success) {
            return errorResult(res.error);
        }
        return jsonResult({
            success: true,
            message: res.message,
            path: res.data?.path,
            itemCount: res.data?.itemCount,
            updatedCount: res.data?.updatedCount,
            unchangedCount: res.data?.unchangedCount
        });
    }
}
class ExportHwConfigTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(options) {
        const res = await this.api.exportHwConfig(options.input.device, {
            includeChannels: options.input.includeChannels,
            includeAddresses: options.input.includeAddresses,
            includeNetworkConfig: options.input.includeNetworkConfig,
            includeSubnets: options.input.includeSubnets,
            format: options.input.format
        });
        if (!res.success) {
            return errorResult(res.error);
        }
        return jsonResult({
            success: true,
            message: res.message,
            exportedCount: res.data?.exportedCount,
            failedCount: res.data?.failedCount,
            results: (res.data?.results || []).slice(0, MAX_INLINE_ITEMS)
        });
    }
}
class ImportFileTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async prepareInvocation(options) {
        const overwrite = options.input.overwriteExisting !== false;
        if (overwrite && !getAutoConfirmImports()) {
            return {
                invocationMessage: `Import "${options.input.filePath}" into device "${options.input.device}" (will overwrite existing object)`,
                confirmationMessages: {
                    title: 'Confirm import to TIA Portal',
                    message: new vscode.MarkdownString(`This will **overwrite** the matching object in TIA Portal device \`${options.input.device}\` with the contents of:\n\n` +
                        `\`${options.input.filePath}\`\n\n` +
                        `To skip this confirmation in the future, enable \`tiaImport.lmTools.autoConfirmImports\`.`)
                }
            };
        }
        return {
            invocationMessage: `Import "${options.input.filePath}" into device "${options.input.device}"`
        };
    }
    async invoke(options) {
        const res = await this.api.importFile(options.input.device, options.input.filePath, {
            overwriteExisting: options.input.overwriteExisting,
            compareBeforeImport: options.input.compareBeforeImport,
            unitName: options.input.unitName,
            unitKind: options.input.unitKind
        });
        if (!res.success) {
            return errorResult(res.error);
        }
        return jsonResult({ success: true, message: res.message, result: res.data });
    }
}
class ImportFolderTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async prepareInvocation(options) {
        const overwrite = options.input.overwriteExisting !== false;
        if (overwrite && !getAutoConfirmImports()) {
            return {
                invocationMessage: `Import folder "${options.input.folderPath}" into device "${options.input.device}" (overwrites)`,
                confirmationMessages: {
                    title: 'Confirm folder import to TIA Portal',
                    message: new vscode.MarkdownString(`This will **overwrite** matching objects in TIA Portal device \`${options.input.device}\` with the contents of folder:\n\n` +
                        `\`${options.input.folderPath}\`\n\n` +
                        `Recursive: \`${options.input.recursive !== false}\`.\n\n` +
                        `To skip this confirmation in the future, enable \`tiaImport.lmTools.autoConfirmImports\`.`)
                }
            };
        }
        return {
            invocationMessage: `Import folder "${options.input.folderPath}" into device "${options.input.device}"`
        };
    }
    async invoke(options) {
        const res = await this.api.importFolder(options.input.device, options.input.folderPath, {
            overwriteExisting: options.input.overwriteExisting,
            recursive: options.input.recursive,
            unitName: options.input.unitName,
            unitKind: options.input.unitKind
        });
        if (!res.success) {
            return errorResult(res.error);
        }
        return jsonResult({ success: true, message: res.message, result: res.data });
    }
}
class ImportUnitTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async prepareInvocation(options) {
        const overwrite = options.input.overwriteExisting !== false;
        if (overwrite && !getAutoConfirmImports()) {
            return {
                invocationMessage: `Export Software Unit from "${options.input.unitFolderPath ?? 'workspace'}" into device "${options.input.device}" (overwrites)`,
                confirmationMessages: {
                    title: 'Confirm Software Unit export to TIA Portal',
                    message: new vscode.MarkdownString(`This will **overwrite** the matching Software Unit in TIA Portal device \`${options.input.device}\` with the contents of:\n\n` +
                        `\`${options.input.unitFolderPath ?? 'detected unit folder'}\`\n\n` +
                        `To skip this confirmation in the future, enable \`tiaImport.lmTools.autoConfirmImports\`.`)
                }
            };
        }
        return {
            invocationMessage: `Export Software Unit from "${options.input.unitFolderPath ?? 'workspace'}" into device "${options.input.device}"`
        };
    }
    async invoke(options) {
        const res = await this.api.importUnit(options.input.device, options.input.unitFolderPath, {
            overwriteExisting: options.input.overwriteExisting,
            compareBeforeImport: options.input.compareBeforeImport,
            createMissingUnit: options.input.createMissingUnit,
            deleteOrphans: options.input.deleteOrphans
        });
        if (!res.success) {
            return errorResult(res.error);
        }
        return jsonResult({
            success: true,
            message: res.message,
            unitName: res.data?.unitName,
            itemCount: res.data?.itemCount,
            successCount: res.data?.successCount,
            errorCount: res.data?.errorCount,
            skippedCount: res.data?.skippedCount,
            result: res.data
        });
    }
}
class ImportHwConfigTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async prepareInvocation(options) {
        const overwrite = options.input.overwriteExisting === true;
        if (overwrite && !getAutoConfirmImports()) {
            return {
                invocationMessage: `Import HW Config from "${options.input.path}" (overwrite)`,
                confirmationMessages: {
                    title: 'Confirm HW Config import to TIA Portal',
                    message: new vscode.MarkdownString(`This will **overwrite** existing devices in TIA Portal with the HW configuration in:\n\n` +
                        `\`${options.input.path}\`\n\n` +
                        `To skip this confirmation, enable \`tiaImport.lmTools.autoConfirmImports\`.`)
                }
            };
        }
        return { invocationMessage: `Import HW Config from "${options.input.path}"` };
    }
    async invoke(options) {
        const res = await this.api.importHwConfig(options.input.path, {
            overwriteExisting: options.input.overwriteExisting,
            updateExisting: options.input.updateExisting,
            importNetworkConfig: options.input.importNetworkConfig,
            skipIfIdentical: options.input.skipIfIdentical,
            format: options.input.format
        });
        if (!res.success) {
            return errorResult(res.error);
        }
        return jsonResult({ success: true, message: res.message, result: res.data });
    }
}
class ExportProjectTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(options, token) {
        const res = await this.api.exportProject({ includeHwConfig: options.input.includeHwConfig, hwConfigFormat: options.input.hwConfigFormat }, token);
        if (!res.success) {
            return errorResult(res.error);
        }
        return jsonResult({
            success: true,
            message: res.message,
            deviceCount: res.data?.deviceCount,
            exportedDevices: res.data?.exportedDevices,
            failedDevices: res.data?.failedDevices,
            results: (res.data?.results || []).slice(0, MAX_INLINE_ITEMS)
        });
    }
}
// ── Tool: tia_refresh ────────────────────────────────────────────
class RefreshTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(_options) {
        const res = await this.api.refresh();
        if (!res.success) {
            return errorResult(res.error);
        }
        return jsonResult({ success: true, message: res.message, deviceCount: res.data?.deviceCount });
    }
}
class CompileTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(options) {
        const res = await this.api.compile(options.input.device);
        if (!res.success) {
            return errorResult(res.error);
        }
        const r = res.data;
        const messages = (r.messages ?? [])
            .filter(m => m.state === 'Error' || m.state === 'Warning')
            .slice(0, 50);
        return jsonResult({
            success: r.success,
            state: r.state,
            errorCount: r.errorCount ?? 0,
            warningCount: r.warningCount ?? 0,
            messages
        });
    }
}
class ExportCrossReferencesTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(options) {
        const input = options.input;
        let device = input.device;
        if (!device) {
            const devs = this.api.listDevices();
            if (!devs.success) {
                return errorResult(devs.error);
            }
            const plcs = (devs.data ?? []).filter(d => /plc|cpu/i.test(d.type || ''));
            if (plcs.length === 0) {
                return errorResult('No PLC device found in project');
            }
            if (plcs.length > 1) {
                return errorResult(`Multiple PLCs in project — please specify 'device'. Available: ${plcs.map(p => p.name).join(', ')}`);
            }
            device = plcs[0].name;
        }
        const res = await this.api.exportCrossReferences(device, {
            outputDirectory: input.outputDirectory,
            includeUnused: input.includeUnused,
            includeMarkdown: input.includeMarkdown
        });
        if (!res.success) {
            return errorResult(res.error);
        }
        return jsonResult({ success: true, ...res.data, message: res.message });
    }
}
class GetProblemsTool {
    api;
    constructor(api) {
        this.api = api;
    }
    async invoke(options) {
        let diags = this.api.getDiagnostics(options.input.fileFilter);
        const sev = options.input.severity ?? 'all';
        if (sev !== 'all') {
            diags = diags.filter(d => d.severity === sev);
        }
        const total = diags.length;
        const limit = Math.max(1, Math.min(MAX_DIAG_ITEMS, options.input.limit ?? MAX_DIAG_ITEMS));
        return jsonResult({
            success: true,
            total,
            returned: Math.min(total, limit),
            diagnostics: diags.slice(0, limit)
        });
    }
}
/**
 * One step of the import → compile → diagnostics cycle.
 *
 * The tool intentionally performs ONE iteration so the calling Copilot model
 * (which sees the diagnostics in its turn output) can decide what to edit
 * and call us again. The `iterationsRemaining` counter helps the model
 * respect the configured limit without re-implementing it.
 */
class FixCompileErrorsTool {
    api;
    static iterationCounters = new WeakMap();
    constructor(api) {
        this.api = api;
    }
    async prepareInvocation(options) {
        const overwrite = options.input.overwriteExisting !== false;
        const willImport = !!(options.input.importFolder || options.input.importFile);
        if (willImport && overwrite && !getAutoConfirmImports()) {
            const what = options.input.importFolder
                ? `folder \`${options.input.importFolder}\``
                : `file \`${options.input.importFile}\``;
            return {
                invocationMessage: `Import & compile fix step on "${options.input.device}"`,
                confirmationMessages: {
                    title: 'Confirm import + compile step',
                    message: new vscode.MarkdownString(`This will **overwrite** objects on TIA Portal device \`${options.input.device}\` with ${what}, then run a compilation.\n\n` +
                        `To skip this confirmation in the future, enable \`tiaImport.lmTools.autoConfirmImports\`.`)
                }
            };
        }
        return {
            invocationMessage: `Compile fix step on "${options.input.device}"`
        };
    }
    async invoke(options) {
        const max = Math.min(getMaxFixIterations(), options.input.maxIterations ?? Number.MAX_SAFE_INTEGER);
        // Use the chatRequestId (or a fresh object key) to track iterations within a single chat turn / session.
        const key = options.chatRequestId
            ? { id: options.chatRequestId }
            : options;
        const used = (FixCompileErrorsTool.iterationCounters.get(key) ?? 0) + 1;
        FixCompileErrorsTool.iterationCounters.set(key, used);
        if (used > max) {
            logger_1.Logger.warn(`tia_fix_compile_errors aborted: iteration ${used} exceeds limit ${max}`);
            return jsonResult({
                success: false,
                error: `Iteration limit reached (${max}). Increase tiaImport.lmTools.maxFixIterations to continue.`,
                iterationsUsed: used,
                iterationsRemaining: 0
            });
        }
        const stepRes = await this.api.fixCompileErrorsStep({
            deviceIdOrName: options.input.device,
            importFolder: options.input.importFolder,
            importFile: options.input.importFile,
            overwriteExisting: options.input.overwriteExisting
        });
        if (!stepRes.success) {
            return errorResult(stepRes.error);
        }
        const { compile, diagnostics, importResult } = stepRes.data;
        const errorMessages = (compile.messages ?? [])
            .filter(m => m.state === 'Error' || m.state === 'Warning')
            .slice(0, 50);
        return jsonResult({
            success: compile.success,
            iterationsUsed: used,
            iterationsRemaining: Math.max(0, max - used),
            compile: {
                success: compile.success,
                state: compile.state,
                errorCount: compile.errorCount ?? 0,
                warningCount: compile.warningCount ?? 0,
                messages: errorMessages
            },
            importResult: importResult ? {
                itemCount: importResult.itemCount,
                updatedCount: importResult.updatedCount,
                unchangedCount: importResult.unchangedCount,
                deletedCount: importResult.deletedCount
            } : undefined,
            diagnostics: diagnostics.slice(0, MAX_DIAG_ITEMS),
            diagnosticsTotal: diagnostics.length,
            hint: compile.success
                ? 'Compilation succeeded - no further iterations needed.'
                : 'Compilation still has errors. Read `diagnostics`, edit the matching files in the workspace, then call this tool again.'
        });
    }
}
// ── Registration ─────────────────────────────────────────────────
function registerLanguageModelTools(context, api) {
    const subs = [
        vscode.lm.registerTool('tia_connect', new ConnectTool(api)),
        vscode.lm.registerTool('tia_disconnect', new DisconnectTool(api)),
        vscode.lm.registerTool('tia_list_projects', new ListProjectsTool(api)),
        vscode.lm.registerTool('tia_select_project', new SelectProjectTool(api)),
        vscode.lm.registerTool('tia_list_devices', new ListDevicesTool(api)),
        vscode.lm.registerTool('tia_list_blocks', new ListBlocksTool(api)),
        vscode.lm.registerTool('tia_export_block', new ExportBlockTool(api)),
        vscode.lm.registerTool('tia_export_device', new ExportDeviceTool(api)),
        vscode.lm.registerTool('tia_list_units', new ListUnitsTool(api)),
        vscode.lm.registerTool('tia_export_units', new ExportUnitsTool(api)),
        vscode.lm.registerTool('tia_export_unit', new ExportUnitTool(api)),
        vscode.lm.registerTool('tia_export_hw_config', new ExportHwConfigTool(api)),
        vscode.lm.registerTool('tia_import_file', new ImportFileTool(api)),
        vscode.lm.registerTool('tia_import_folder', new ImportFolderTool(api)),
        vscode.lm.registerTool('tia_import_unit', new ImportUnitTool(api)),
        vscode.lm.registerTool('tia_import_hw_config', new ImportHwConfigTool(api)),
        vscode.lm.registerTool('tia_export_project', new ExportProjectTool(api)),
        vscode.lm.registerTool('tia_refresh', new RefreshTool(api)),
        vscode.lm.registerTool('tia_compile', new CompileTool(api)),
        vscode.lm.registerTool('tia_get_problems', new GetProblemsTool(api)),
        vscode.lm.registerTool('tia_fix_compile_errors', new FixCompileErrorsTool(api)),
        vscode.lm.registerTool('tia_export_cross_references', new ExportCrossReferencesTool(api))
    ];
    for (const s of subs) {
        context.subscriptions.push(s);
    }
    logger_1.Logger.info(`Registered ${subs.length} TIA Language Model tool(s)`);
}
//# sourceMappingURL=tools.js.map