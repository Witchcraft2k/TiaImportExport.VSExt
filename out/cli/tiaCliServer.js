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
exports.startTiaCliServer = startTiaCliServer;
exports.isTiaCliEnabled = isTiaCliEnabled;
exports.promptEnableTiaCli = promptEnableTiaCli;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const workspace_1 = require("../utils/workspace");
const HOST = '127.0.0.1';
const STATE_RELATIVE_PATH = path.join('.tia', 'cli.json');
const COMMANDS = [
    'prepare_workspace',
    'connect',
    'disconnect',
    'current_project',
    'list_projects',
    'select_project',
    'refresh',
    'list_devices',
    'list_blocks',
    'import_blocks',
    'export_block',
    'export_device',
    'export_hw_config',
    'list_units',
    'export_units',
    'export_unit',
    'export_project',
    'import_file',
    'import_folder',
    'import_hw_config',
    'compile',
    'get_problems',
    'fix_compile_errors',
    'export_cross_references',
    'get_logs'
];
function startTiaCliServer(context, api) {
    let activeServer;
    const start = () => {
        if (activeServer) {
            return;
        }
        const token = crypto.randomBytes(32).toString('hex');
        const server = http.createServer((req, res) => {
            void handleRequest(api, token, req, res);
        });
        server.on('error', error => {
            logger_1.Logger.warn(`TIA CLI server error: ${error instanceof Error ? error.message : String(error)}`);
        });
        server.listen(0, HOST, () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                logger_1.Logger.warn('TIA CLI server started without a TCP address');
                return;
            }
            const state = {
                version: 1,
                host: HOST,
                port: address.port,
                token
            };
            writeStateFile(context, state);
            logger_1.Logger.info(`TIA CLI server listening on ${HOST}:${address.port}`);
        });
        activeServer = { server, token };
    };
    const stop = () => {
        if (!activeServer) {
            return;
        }
        const { server, token } = activeServer;
        activeServer = undefined;
        try {
            server.close();
        }
        catch {
            // ignore
        }
        removeStateFile(context, token);
        logger_1.Logger.info('TIA CLI server stopped');
    };
    const apply = () => {
        const enabled = vscode.workspace.getConfiguration('tiaImport').get('cli.enabled', false);
        if (enabled) {
            start();
        }
        else {
            stop();
        }
    };
    apply();
    const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('tiaImport.cli.enabled')) {
            apply();
        }
    });
    return new vscode.Disposable(() => {
        configWatcher.dispose();
        stop();
    });
}
function isTiaCliEnabled() {
    return vscode.workspace.getConfiguration('tiaImport').get('cli.enabled', false);
}
async function promptEnableTiaCli() {
    if (isTiaCliEnabled()) {
        vscode.window.showInformationMessage('TIA Import: CLI bridge is already enabled. The .tia/cli.json state file is being written for external scripts.');
        return true;
    }
    const enableNow = 'Enable now';
    const openSettings = 'Open Settings';
    const choice = await vscode.window.showInformationMessage('TIA Import: The CLI bridge is disabled. Enable the "tiaImport.cli.enabled" setting to allow external scripts to drive TIA Portal through localhost JSON requests.', enableNow, openSettings);
    if (choice === enableNow) {
        await vscode.workspace.getConfiguration('tiaImport').update('cli.enabled', true, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('TIA Import: CLI bridge enabled. A .tia/cli.json file will be created with the connection token.');
        return true;
    }
    if (choice === openSettings) {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'tiaImport.cli.enabled');
    }
    return false;
}
async function handleRequest(api, token, req, res) {
    try {
        if (req.method === 'GET' && req.url === '/health') {
            sendJson(res, 200, { success: true, commands: COMMANDS });
            return;
        }
        if (req.method !== 'POST' || req.url !== '/api') {
            sendJson(res, 404, { success: false, error: 'Not found' });
            return;
        }
        if (!isAuthorized(req, token)) {
            sendJson(res, 401, { success: false, error: 'Unauthorized' });
            return;
        }
        const body = await readBody(req);
        const payload = JSON.parse(body || '{}');
        const args = asRecord(payload.args);
        const result = await dispatch(api, normalizeCommand(payload.command), args);
        sendJson(res, 200, result);
    }
    catch (error) {
        sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
}
async function dispatch(api, command, args) {
    switch (command) {
        case 'prepare_workspace':
        case 'tia_prepare_workspace':
            return api.prepareWorkspace();
        case 'connect':
        case 'tia_connect':
            return api.connect();
        case 'open_project':
        case 'tia_open_project':
            if (args.filePath !== undefined) {
                return api.openProject(requiredString(args.filePath, 'filePath'));
            }
            return api.connect();
        case 'disconnect':
        case 'close_project':
        case 'tia_disconnect':
        case 'tia_close_project':
            return api.disconnect();
        case 'current_project':
        case 'tia_current_project':
            return api.currentProject();
        case 'list_projects':
        case 'tia_list_projects':
            return api.listProjects();
        case 'select_project':
        case 'tia_select_project':
            return api.selectProject(requiredString(args.projectName, 'projectName'));
        case 'refresh':
        case 'tia_refresh':
            return api.refresh();
        case 'list_devices':
        case 'tia_list_devices':
            return api.listDevices();
        case 'list_blocks':
        case 'tia_list_blocks':
            return filterBlocks(api.listBlocks(requiredString(args.device, 'device')), args);
        case 'export_block':
        case 'tia_export_block':
            return api.exportBlock(requiredString(args.device, 'device'), requiredString(args.block, 'block'));
        case 'import_blocks':
        case 'tia_import_blocks':
            return api.exportBlocks(requiredString(args.device, 'device'), optionalStringArray(args.blocks ?? args.block));
        case 'export_device':
        case 'tia_export_device':
            return api.exportDevice(requiredString(args.device, 'device'));
        case 'list_units':
        case 'tia_list_units':
            return api.listUnits(requiredString(args.device, 'device'));
        case 'export_units':
        case 'tia_export_units':
            return api.exportUnits(requiredString(args.device, 'device'));
        case 'export_unit':
        case 'tia_export_unit':
            return api.exportUnit(requiredString(args.device, 'device'), requiredString(args.unitName ?? args.unit, 'unitName'), optionalUnitKind(args.kind));
        case 'export_hw_config':
        case 'tia_export_hw_config':
            return api.exportHwConfig(optionalString(args.device), {
                includeChannels: optionalBoolean(args.includeChannels),
                includeAddresses: optionalBoolean(args.includeAddresses),
                includeNetworkConfig: optionalBoolean(args.includeNetworkConfig),
                includeSubnets: optionalBoolean(args.includeSubnets),
                format: optionalHwFormat(args.format)
            });
        case 'export_project':
        case 'import_project':
        case 'tia_export_project':
        case 'tia_import_project':
            return api.exportProject({
                includeHwConfig: optionalBoolean(args.includeHwConfig),
                hwConfigFormat: optionalHwFormat(args.hwConfigFormat ?? args.format)
            });
        case 'import_file':
        case 'tia_import_file':
            return api.importFile(requiredString(args.device, 'device'), requiredString(args.filePath, 'filePath'), {
                overwriteExisting: optionalBoolean(args.overwriteExisting),
                compareBeforeImport: optionalBoolean(args.compareBeforeImport),
                unitName: optionalString(args.unitName ?? args.unit),
                unitKind: optionalUnitKind(args.unitKind ?? args.kind)
            });
        case 'import_folder':
        case 'tia_import_folder':
            return api.importFolder(requiredString(args.device, 'device'), requiredString(args.folderPath, 'folderPath'), {
                overwriteExisting: optionalBoolean(args.overwriteExisting),
                recursive: optionalBoolean(args.recursive),
                unitName: optionalString(args.unitName ?? args.unit),
                unitKind: optionalUnitKind(args.unitKind ?? args.kind)
            });
        case 'import_hw_config':
        case 'tia_import_hw_config':
            return api.importHwConfig(requiredString(args.path ?? args.filePath ?? args.folderPath, 'path'), {
                overwriteExisting: optionalBoolean(args.overwriteExisting),
                updateExisting: optionalBoolean(args.updateExisting),
                importNetworkConfig: optionalBoolean(args.importNetworkConfig),
                skipIfIdentical: optionalBoolean(args.skipIfIdentical),
                format: optionalHwFormat(args.format)
            });
        case 'compile':
        case 'tia_compile':
            return api.compile(requiredString(args.device, 'device'));
        case 'get_problems':
        case 'tia_get_problems':
            return { success: true, data: api.getDiagnostics(optionalString(args.scopeFilter ?? args.fileFilter)) };
        case 'fix_compile_errors':
        case 'tia_fix_compile_errors':
            return api.fixCompileErrorsStep({
                deviceIdOrName: requiredString(args.device, 'device'),
                importFolder: optionalString(args.importFolder),
                importFile: optionalString(args.importFile),
                overwriteExisting: optionalBoolean(args.overwriteExisting)
            });
        case 'export_cross_references':
        case 'tia_export_cross_references':
            return api.exportCrossReferences(requiredString(args.device, 'device'), {
                outputDirectory: optionalString(args.outputDirectory),
                includeUnused: optionalBoolean(args.includeUnused),
                includeMarkdown: optionalBoolean(args.includeMarkdown)
            });
        case 'get_logs':
        case 'tia_get_logs':
            return api.getLogs({
                level: optionalLogLevel(args.level),
                limit: optionalNumber(args.limit),
                contains: optionalString(args.contains)
            });
        default:
            return { success: false, error: `Unknown TIA CLI command: ${command}` };
    }
}
function filterBlocks(result, args) {
    if (!result.success) {
        return result;
    }
    let blocks = result.data ?? [];
    const nameFilter = optionalString(args.nameFilter)?.toLowerCase();
    if (nameFilter) {
        blocks = blocks.filter(block => block.name.toLowerCase().includes(nameFilter));
    }
    const offset = Math.max(0, optionalNumber(args.offset) ?? 0);
    const limit = Math.max(1, Math.min(500, optionalNumber(args.limit) ?? 200));
    return {
        success: true,
        total: blocks.length,
        offset,
        limit,
        returned: blocks.slice(offset, offset + limit).length,
        blocks: blocks.slice(offset, offset + limit)
    };
}
function writeStateFile(context, state) {
    for (const basePath of getStateBasePaths(context)) {
        try {
            fs.mkdirSync(path.dirname(path.join(basePath, STATE_RELATIVE_PATH)), { recursive: true });
            fs.writeFileSync(path.join(basePath, STATE_RELATIVE_PATH), JSON.stringify(state, null, 2));
        }
        catch (error) {
            logger_1.Logger.warn(`Failed to write TIA CLI state file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
function removeStateFile(context, token) {
    for (const basePath of getStateBasePaths(context)) {
        const statePath = path.join(basePath, STATE_RELATIVE_PATH);
        try {
            if (!fs.existsSync(statePath)) {
                continue;
            }
            const current = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            if (current.token === token) {
                fs.rmSync(statePath, { force: true });
            }
        }
        catch {
            // Best-effort cleanup only.
        }
    }
}
function getStateBasePaths(context) {
    const bases = [context.globalStorageUri.fsPath];
    const workspacePath = workspace_1.WorkspaceManager.getWorkspacePath();
    if (workspacePath) {
        bases.unshift(workspacePath);
    }
    return bases;
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}
function sendJson(res, statusCode, payload) {
    const body = JSON.stringify(payload, null, 2);
    res.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body)
    });
    res.end(body);
}
function isAuthorized(req, token) {
    const auth = req.headers.authorization;
    if (auth === `Bearer ${token}`) {
        return true;
    }
    return req.headers['x-tia-token'] === token;
}
function normalizeCommand(command) {
    if (typeof command !== 'string' || !command.trim()) {
        return '';
    }
    return command.trim().replace(/-/g, '_');
}
function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function requiredString(value, name) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`Missing required string argument: ${name}`);
    }
    return value;
}
function optionalString(value) {
    return typeof value === 'string' && value.trim() ? value : undefined;
}
function optionalStringArray(value) {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
    }
    if (typeof value === 'string' && value.trim()) {
        return value.split(',').map(item => item.trim()).filter(Boolean);
    }
    return undefined;
}
function optionalBoolean(value) {
    return typeof value === 'boolean' ? value : undefined;
}
function optionalNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function optionalLogLevel(value) {
    return value === 'debug' || value === 'info' || value === 'warn' || value === 'error' || value === 'section' || value === 'all'
        ? value
        : undefined;
}
function optionalHwFormat(value) {
    return value === 'xml' || value === 'cax' ? value : undefined;
}
function optionalUnitKind(value) {
    if (typeof value !== 'string')
        return undefined;
    const v = value.trim().toLowerCase();
    if (v === 'plc' || v === 'standard' || v === 'normal')
        return 'plc';
    if (v === 'safety' || v === 'safe' || v === 'f' || v === 'fail-safe')
        return 'safety';
    return undefined;
}
//# sourceMappingURL=tiaCliServer.js.map