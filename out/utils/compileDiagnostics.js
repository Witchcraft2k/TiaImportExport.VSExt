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
exports.initCompileDiagnostics = initCompileDiagnostics;
exports.clearCompileDiagnostics = clearCompileDiagnostics;
exports.getCompileDiagnosticsSnapshot = getCompileDiagnosticsSnapshot;
exports.publishCompileDiagnostics = publishCompileDiagnostics;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("./logger");
// ── Diagnostic collection for TIA compile errors ─────────────────────
let compileDiagnosticCollection;
/**
 * Initialize the compile diagnostic collection. Call once during extension activation.
 */
function initCompileDiagnostics(context) {
    compileDiagnosticCollection = vscode.languages.createDiagnosticCollection('tia-compile');
    context.subscriptions.push(compileDiagnosticCollection);
}
/**
 * Clear all TIA compile diagnostics.
 */
function clearCompileDiagnostics() {
    compileDiagnosticCollection?.clear();
}
/**
 * Snapshot of all current TIA compile diagnostics for consumption by
 * Language Model Tools / programmatic callers.
 */
function getCompileDiagnosticsSnapshot() {
    const out = [];
    if (!compileDiagnosticCollection) {
        return out;
    }
    compileDiagnosticCollection.forEach((uri, diags) => {
        for (const d of diags) {
            out.push({
                file: uri.fsPath,
                line: d.range.start.line + 1,
                column: d.range.start.character + 1,
                severity: d.severity === vscode.DiagnosticSeverity.Error ? 'error' :
                    d.severity === vscode.DiagnosticSeverity.Warning ? 'warning' :
                        d.severity === vscode.DiagnosticSeverity.Information ? 'information' : 'hint',
                message: d.message,
                source: d.source
            });
        }
    });
    return out;
}
// ── File extensions to search for when matching block names ──────────
const BLOCK_FILE_EXTENSIONS = ['.xml', '.scl', '.s7dcl'];
/**
 * Process compile results and populate the PROBLEMS panel with diagnostics.
 *
 * Uses the hierarchical structure of compiler messages to reconstruct
 * block file paths and map errors to exported files in the workspace.
 *
 * @param result - Compile result from TIA Portal
 * @param deviceLabel - Device name (e.g., "PLC1")
 * @param workspacePath - Workspace root path
 */
function publishCompileDiagnostics(result, deviceLabel, workspacePath) {
    if (!compileDiagnosticCollection) {
        return;
    }
    // Clear previous compile diagnostics
    compileDiagnosticCollection.clear();
    if (!result.messages || result.messages.length === 0) {
        return;
    }
    // Parse the hierarchical messages to extract errors with context
    const errors = parseCompileErrors(result.messages, deviceLabel);
    logger_1.Logger.debug(`Compile diagnostics: parsed ${errors.length} error(s) from ${result.messages.length} messages`);
    if (errors.length === 0) {
        return;
    }
    // Group errors by their resolved file URI
    const diagnosticMap = new Map();
    for (const error of errors) {
        logger_1.Logger.debug(`Compile diagnostic: looking for block "${error.blockName}" in ${error.groupPath.join('/')}`);
        const filePath = findBlockFile(error, workspacePath);
        if (filePath) {
            const fileUri = filePath;
            if (!diagnosticMap.has(fileUri)) {
                diagnosticMap.set(fileUri, []);
            }
            diagnosticMap.get(fileUri).push(createDiagnostic(error, filePath));
            logger_1.Logger.debug(`  → mapped to: ${filePath}`);
        }
        else {
            // File not found on disk — log as info so users can see it
            logger_1.Logger.info(`Compile diagnostic: could not find file for block "${error.blockName}" (path: ${error.groupPath.join('/')})`);
        }
    }
    // Publish to PROBLEMS panel
    for (const [filePath, diagnostics] of diagnosticMap) {
        compileDiagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
    }
    const fileCount = diagnosticMap.size;
    const errorCount = errors.length;
    if (fileCount > 0) {
        logger_1.Logger.info(`Compile diagnostics: ${errorCount} issue(s) mapped to ${fileCount} file(s) in PROBLEMS panel`);
    }
    else if (errors.length > 0) {
        logger_1.Logger.info(`Compile diagnostics: ${errors.length} issue(s) found but no matching files on disk`);
    }
}
/**
 * Parse the flat list of hierarchical compiler messages to extract errors/warnings
 * with their full context (block name, group path, network).
 *
 * Container messages have the node name in `path` (with empty `description`),
 * while leaf error messages have the error text in `description` and
 * context (e.g., "Network 1") in `path`.
 *
 * Typical structure:
 * - depth 0: path="PLC1", description="" (container)
 * - depth 1: path="Program blocks", description="" (container)
 * - depth 2+: path="GroupName", description="" (containers)
 * - leaf-1: path="SimProcess_1 (FB4)", description="" (block container)
 * - leaf: description="Semicolon missing.", path="Network 1" (actual error)
 */
function parseCompileErrors(messages, deviceName) {
    const errors = [];
    // Build a hierarchy tracker: for each depth, track the identifying label.
    // Container messages use `path` for the node name; leaf errors use `description`.
    const breadcrumbs = [];
    for (const msg of messages) {
        // Determine the identifying label for this message:
        // - Container nodes: description is empty, path holds the name
        // - Leaf errors: description holds the error text, path holds context (e.g., "Network 1")
        const isLeafError = msg.description.trim().length > 0;
        const label = isLeafError ? msg.description : (msg.path || '');
        // Update breadcrumbs for current depth
        breadcrumbs.length = msg.depth;
        breadcrumbs[msg.depth] = label;
        // Skip non-error/warning messages
        if (msg.state !== 'Error' && msg.state !== 'Warning') {
            continue;
        }
        // Skip container messages (empty description = just an aggregator node)
        if (!isLeafError) {
            continue;
        }
        // Skip compile summary messages like "Compiling finished (errors: 1; warnings: 0)"
        if (isCompileSummaryMessage(msg.description)) {
            continue;
        }
        // Try to find the block context from the breadcrumbs
        const context = extractBlockContext(breadcrumbs, msg.depth, deviceName);
        if (!context) {
            continue;
        }
        errors.push({
            description: msg.description,
            severity: msg.state === 'Error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
            blockName: context.blockName,
            blockType: context.blockType,
            groupPath: context.groupPath,
            network: msg.path || undefined,
            deviceName: deviceName
        });
    }
    return errors;
}
/**
 * Check if a message is a compile summary (not an actual error detail).
 */
function isCompileSummaryMessage(description) {
    return /^Compiling finished/i.test(description);
}
/**
 * Extract block name and group path from the breadcrumb trail.
 *
 * Expected breadcrumb structure (example):
 *   [0] "PLC1"                  ← device
 *   [1] "Program blocks"        ← top-level section
 *   [2] "10_Process"            ← group
 *   [3] "10.1_Process1"         ← subgroup
 *   [4] "SimProcess_1 (FB4)"   ← block (parent of error)
 *   [5] "Semicolon missing."   ← actual error (current message)
 *
 * The block is at depth-1 relative to the error message.
 * The group path starts after the "Program blocks" entry.
 */
function extractBlockContext(breadcrumbs, errorDepth, deviceName) {
    // Need at least the block level (parent of error)
    if (errorDepth < 1) {
        return undefined;
    }
    // The block should be in the breadcrumb just above the error
    const blockEntry = breadcrumbs[errorDepth - 1];
    if (!blockEntry) {
        return undefined;
    }
    // Extract block name and type from entries like "SimProcess_1 (FB4)" or "MyBlock (OB1)"
    const parsed = parseBlockNameEntry(blockEntry);
    if (!parsed) {
        return undefined;
    }
    // Build group path from breadcrumbs between "Program blocks" and the block entry
    const groupPath = [];
    let foundProgramBlocks = false;
    for (let i = 0; i < errorDepth - 1; i++) {
        const crumb = breadcrumbs[i];
        if (!crumb) {
            continue;
        }
        if (foundProgramBlocks) {
            groupPath.push(crumb);
        }
        else if (/^Program\s*blocks$/i.test(crumb)) {
            groupPath.push(crumb);
            foundProgramBlocks = true;
        }
    }
    // If the error is not under "Program blocks" and it has no block type (e.g., FB4, OB1),
    // it's a general/system message (like "General warnings") — skip it
    if (!foundProgramBlocks && !parsed.type) {
        return undefined;
    }
    // If we didn't find "Program blocks" but have a typed block, use raw breadcrumbs (skip device)
    if (!foundProgramBlocks) {
        for (let i = 1; i < errorDepth - 1; i++) {
            const crumb = breadcrumbs[i];
            if (crumb) {
                groupPath.push(crumb);
            }
        }
    }
    return {
        blockName: parsed.name,
        blockType: parsed.type,
        groupPath
    };
}
/**
 * Parse a block name entry like "SimProcess_1 (FB4)" into name and type.
 * Also handles entries without type: "MyBlock" or entries like "01_CyclicOB_100ms (OB131)".
 */
function parseBlockNameEntry(entry) {
    if (!entry || entry.trim().length === 0) {
        return undefined;
    }
    // Match: "BlockName (Type)" where Type is like FB4, OB1, DB107, FC10
    const match = entry.match(/^(.+?)\s+\(([A-Z]+\d+)\)\s*$/i);
    if (match) {
        return { name: match[1].trim(), type: match[2] };
    }
    // No type info — use the entry as-is (it might be a block name without type)
    return { name: entry.trim() };
}
/**
 * Find the exported file on disk matching a compile error's block context.
 *
 * Searches in: <workspace>/TiaExport/Projects/<*>/Devices/<*>/<DeviceName>/<GroupPath>/<BlockName>.<ext>
 * Falls back to glob search if exact path doesn't match.
 */
function findBlockFile(error, workspacePath) {
    // Strategy 1: Try to find by group path + block name
    if (error.groupPath.length > 0) {
        const result = findByGroupPath(error, workspacePath);
        if (result) {
            return result;
        }
    }
    // Strategy 2: Recursive search in TiaExport for the block file by name
    return findByBlockName(error.blockName, error.deviceName, workspacePath);
}
/**
 * Strategy 1: Find file using the full group path.
 * Searches: TiaExport/Projects/{proj}/Devices/{cat}/DeviceName/{groupPath}/{blockName}.ext
 */
function findByGroupPath(error, workspacePath) {
    const exportRoot = getExportRoot(workspacePath);
    if (!exportRoot) {
        return undefined;
    }
    const projectsDir = path.join(exportRoot, 'Projects');
    if (!fs.existsSync(projectsDir)) {
        return undefined;
    }
    try {
        // Iterate project folders
        const projects = fs.readdirSync(projectsDir, { withFileTypes: true })
            .filter(d => d.isDirectory());
        for (const proj of projects) {
            const devicesDir = path.join(projectsDir, proj.name, 'Devices');
            if (!fs.existsSync(devicesDir)) {
                continue;
            }
            // Search in all device category folders (PLCs, HMIs, etc.)
            const categories = fs.readdirSync(devicesDir, { withFileTypes: true })
                .filter(d => d.isDirectory());
            for (const cat of categories) {
                // Look for device folder matching deviceName
                const deviceDir = path.join(devicesDir, cat.name, error.deviceName);
                if (!fs.existsSync(deviceDir)) {
                    continue;
                }
                // Build the expected path using the group path
                const groupDir = path.join(deviceDir, ...error.groupPath);
                if (!fs.existsSync(groupDir)) {
                    continue;
                }
                // Try each extension
                for (const ext of BLOCK_FILE_EXTENSIONS) {
                    const filePath = path.join(groupDir, error.blockName + ext);
                    if (fs.existsSync(filePath)) {
                        return filePath;
                    }
                }
            }
        }
    }
    catch {
        // Ignore file system errors
    }
    return undefined;
}
/**
 * Strategy 2: Search recursively by block name within the device folder.
 */
function findByBlockName(blockName, deviceName, workspacePath) {
    const exportRoot = getExportRoot(workspacePath);
    if (!exportRoot) {
        return undefined;
    }
    const projectsDir = path.join(exportRoot, 'Projects');
    if (!fs.existsSync(projectsDir)) {
        return undefined;
    }
    try {
        const projects = fs.readdirSync(projectsDir, { withFileTypes: true })
            .filter(d => d.isDirectory());
        for (const proj of projects) {
            const devicesDir = path.join(projectsDir, proj.name, 'Devices');
            if (!fs.existsSync(devicesDir)) {
                continue;
            }
            const categories = fs.readdirSync(devicesDir, { withFileTypes: true })
                .filter(d => d.isDirectory());
            for (const cat of categories) {
                const deviceDir = path.join(devicesDir, cat.name, deviceName);
                if (!fs.existsSync(deviceDir)) {
                    continue;
                }
                // Search recursively for the block file
                const found = searchFileRecursive(deviceDir, blockName);
                if (found) {
                    return found;
                }
            }
        }
    }
    catch {
        // Ignore file system errors
    }
    return undefined;
}
/**
 * Recursively search a directory for a file matching the block name.
 */
function searchFileRecursive(dir, blockName) {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        // Check files first
        for (const entry of entries) {
            if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                const nameWithoutExt = path.basename(entry.name, path.extname(entry.name));
                if (BLOCK_FILE_EXTENSIONS.includes(ext) && nameWithoutExt === blockName) {
                    return path.join(dir, entry.name);
                }
            }
        }
        // Then recurse into subdirectories
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const found = searchFileRecursive(path.join(dir, entry.name), blockName);
                if (found) {
                    return found;
                }
            }
        }
    }
    catch {
        // Ignore access errors
    }
    return undefined;
}
/**
 * Get the TiaExport root directory path from config.
 */
function getExportRoot(workspacePath) {
    const config = vscode.workspace.getConfiguration('tiaImport');
    const exportFolder = config.get('exportFolderName') || 'TiaExport';
    const exportRoot = path.join(workspacePath, exportFolder);
    return fs.existsSync(exportRoot) ? exportRoot : undefined;
}
/**
 * Create a VS Code Diagnostic from a parsed compile error.
 *
 * Resolves the location in the file:
 * - For SCL blocks: the path field is a direct line number (e.g., "70")
 * - For LAD/FBD/STL blocks: the path field is "Network N" → resolved to the line of that network
 */
function createDiagnostic(error, filePath) {
    // Try to resolve line number from network/line info
    let line = 0; // default: top of file
    let isDirectLine = false;
    // Strategy 1: Check if path is a direct line number (SCL blocks return just a number)
    const directLine = parseDirectLineNumber(error.network);
    if (directLine !== undefined) {
        // SCL line numbers are relative to the BEGIN keyword, not the file start
        const beginLine = findBeginLine(filePath);
        line = Math.max(beginLine + directLine, 0); // Convert to 0-based absolute line
        isDirectLine = true;
    }
    else {
        // Strategy 2: Resolve "Network N" to a line in the file
        const networkNumber = parseNetworkNumber(error.network);
        if (networkNumber !== undefined) {
            const resolvedLine = resolveNetworkLine(filePath, networkNumber);
            if (resolvedLine !== undefined) {
                line = resolvedLine;
            }
        }
    }
    const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
    // Build descriptive message with all available context
    const parts = [];
    parts.push(error.description);
    if (error.network) {
        if (isDirectLine) {
            parts.push(`[Line ${error.network}]`);
        }
        else {
            parts.push(`[${error.network}]`);
        }
    }
    if (error.blockType) {
        parts.push(`(${error.blockType})`);
    }
    const message = parts.join(' — ');
    const diagnostic = new vscode.Diagnostic(range, message, error.severity);
    diagnostic.source = 'TIA Compile';
    return diagnostic;
}
// ── Network line resolution ──────────────────────────────────────────
/**
 * Extract the network number from a path string like "Network 1" or "Network 12".
 * Returns 1-based network number or undefined if not a network reference.
 */
function parseNetworkNumber(networkPath) {
    if (!networkPath) {
        return undefined;
    }
    const match = networkPath.match(/^Network\s+(\d+)$/i);
    return match ? parseInt(match[1], 10) : undefined;
}
/**
 * Check if the path is a direct line number (SCL blocks return just a number like "70").
 * Returns the 1-based line number or undefined.
 */
function parseDirectLineNumber(networkPath) {
    if (!networkPath) {
        return undefined;
    }
    const match = networkPath.match(/^(\d+)$/);
    return match ? parseInt(match[1], 10) : undefined;
}
/**
 * Find the 0-based line number of the first `BEGIN` keyword in an SCL file.
 * SCL line numbers from TIA compiler are relative to BEGIN.
 * Returns 0 if BEGIN is not found (fallback to file start).
 */
function findBeginLine(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            if (/^\s*BEGIN\b/i.test(lines[i])) {
                return i;
            }
        }
    }
    catch {
        // ignore
    }
    return 0;
}
/**
 * Resolve a network number (1-based) to a line number (0-based) in the exported file.
 * Supports XML (.xml), S7DCL (.s7dcl), and SCL (.scl) formats.
 */
function resolveNetworkLine(filePath, networkNumber) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        const content = fs.readFileSync(filePath, 'utf-8');
        switch (ext) {
            case '.xml':
                return resolveNetworkLineXml(content, networkNumber);
            case '.s7dcl':
                return resolveNetworkLineS7dcl(content, networkNumber);
            case '.scl':
                return resolveNetworkLineScl(content, networkNumber);
            default:
                return undefined;
        }
    }
    catch {
        return undefined;
    }
}
/**
 * Find the line of the Nth network in a SimaticML XML file.
 *
 * Networks are represented as `<SW.Blocks.CompileUnit` elements.
 * The Nth occurrence corresponds to Network N.
 * Returns 0-based line number.
 */
function resolveNetworkLineXml(content, networkNumber) {
    const lines = content.split(/\r?\n/);
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
        // Match <SW.Blocks.CompileUnit (with possible attributes)
        if (/^\s*<SW\.Blocks\.CompileUnit[\s>]/i.test(lines[i])) {
            count++;
            if (count === networkNumber) {
                return i; // 0-based line number
            }
        }
    }
    return undefined;
}
/**
 * Find the line of the Nth network in a S7DCL file.
 *
 * Networks are marked with the `NETWORK` keyword on its own line.
 * Returns 0-based line number.
 */
function resolveNetworkLineS7dcl(content, networkNumber) {
    const lines = content.split(/\r?\n/);
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*NETWORK\s*$/i.test(lines[i])) {
            count++;
            if (count === networkNumber) {
                return i; // 0-based line number
            }
        }
    }
    return undefined;
}
/**
 * Find the line of the Nth network in an SCL file.
 *
 * SCL files exported in SD format may contain REGION markers or
 * NETWORK comments. Falls back to line 0 if no markers found.
 * Returns 0-based line number.
 */
function resolveNetworkLineScl(content, networkNumber) {
    const lines = content.split(/\r?\n/);
    let count = 0;
    // Strategy 1: Look for REGION markers (common in SCL exports)
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*REGION\b/i.test(lines[i]) || /^\s*NETWORK\s*$/i.test(lines[i])) {
            count++;
            if (count === networkNumber) {
                return i;
            }
        }
    }
    // Strategy 2: In pure SCL blocks there's usually just one "network"
    // Network 1 = start of code (after VAR sections)
    if (networkNumber === 1) {
        for (let i = 0; i < lines.length; i++) {
            if (/^\s*BEGIN\b/i.test(lines[i])) {
                return i;
            }
        }
    }
    return undefined;
}
//# sourceMappingURL=compileDiagnostics.js.map