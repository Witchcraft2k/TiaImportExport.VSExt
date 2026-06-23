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
exports.SUPPORTED_EXTENSIONS = void 0;
exports.isKnowHowProtectedPlaceholder = isKnowHowProtectedPlaceholder;
exports.isAlreadyExistsError = isAlreadyExistsError;
exports.isDependencyError = isDependencyError;
exports.sortXmlFilesForImport = sortXmlFilesForImport;
exports.getSupportedFilesInFolder = getSupportedFilesInFolder;
exports.getEmptyFoldersInDirectory = getEmptyFoldersInDirectory;
exports.detectFolderType = detectFolderType;
exports.findProgramBlocksBasePath = findProgramBlocksBasePath;
exports.detectUnitContext = detectUnitContext;
exports.logImportResultDetails = logImportResultDetails;
exports.logDeleteResults = logDeleteResults;
exports.reportExportSummary = reportExportSummary;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const logger_1 = require("../../utils/logger");
const simaticMl_1 = require("../../utils/simaticMl");
const blockDependencySorter_1 = require("./blockDependencySorter");
/** Built-in / system TIA data types that are NOT user UDTs */
const BUILTIN_TYPES = new Set([
    'bool', 'byte', 'word', 'dword', 'lword',
    'sint', 'int', 'dint', 'lint',
    'usint', 'uint', 'udint', 'ulint',
    'real', 'lreal',
    'char', 'wchar',
    's5time', 'time', 'ltime', 'date', 'ldate',
    'time_of_day', 'tod', 'ltime_of_day', 'ltod',
    'date_and_time', 'dt', 'ldt', 'dtl',
    'timer', 'counter', 'void',
    'string', 'wstring',
    'any', 'pointer', 'variant',
    'iec_timer', 'iec_counter', 'iec_scounter', 'iec_dcounter', 'iec_ucounter', 'iec_udcounter', 'iec_ltimer',
    'ton_time', 'tof_time', 'tp_time', 'tonr_time',
    'ton_ltime', 'tof_ltime', 'tp_ltime', 'tonr_ltime',
    'ctu', 'ctd', 'ctud', 'ctu_dint', 'ctd_dint', 'ctud_dint',
    'ctu_udint', 'ctd_udint', 'ctud_udint', 'ctu_lint', 'ctd_lint', 'ctud_lint',
    'ctu_ulint', 'ctd_ulint', 'ctud_ulint',
    'hw_any', 'hw_device', 'hw_dpmaster', 'hw_dpslave', 'hw_io', 'hw_iosystem',
    'hw_submodule', 'hw_module', 'hw_interface', 'hw_hsc', 'hw_pwm',
    'hw_pto', 'event_any', 'event_att', 'event_hwint',
    'port', 'rtm', 'pip', 'ob_any', 'ob_delay', 'ob_tod', 'ob_cyclic',
    'ob_att', 'ob_pcycle', 'ob_hwint', 'ob_diag', 'ob_timeerror',
    'ob_startup', 'conn_any', 'conn_prg', 'conn_ouc', 'conn_r_id',
    'db_any', 'db_www', 'db_dyn',
    'errorstruct', 'nref', 'cref', 'event_task', 'struct'
]);
/**
 * Supported file extensions for export to TIA Portal
 */
exports.SUPPORTED_EXTENSIONS = ['.xml', '.s7dcl', '.scl', '.db'];
/**
 * Check if an XML file is a know-how protected block placeholder.
 * These files are generated during import and should be skipped during export to TIA.
 */
function isKnowHowProtectedPlaceholder(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.xml') {
        return false;
    }
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return content.includes('<KnowHowProtectedBlock>');
    }
    catch {
        return false;
    }
}
/**
 * Check if error message indicates that item already exists
 */
function isAlreadyExistsError(error) {
    if (!error)
        return false;
    const lowerError = error.toLowerCase();
    return lowerError.includes('already exists') ||
        lowerError.includes('already contains') ||
        lowerError.includes('same values for the identifier');
}
/**
 * Check if error is a dependency error (e.g., Instance DB requires FB that doesn't exist)
 */
function isDependencyError(error) {
    if (!error)
        return false;
    const lowerError = error.toLowerCase();
    return lowerError.includes('does not exist') ||
        lowerError.includes('block') && lowerError.includes('not exist');
}
/** Regex to extract UDT name from XML: <Name>UdtName</Name> inside <AttributeList> */
const UDT_NAME_REGEX = /<AttributeList>[\s\S]*?<Name>(.*?)<\/Name>/;
/** Regex to match quoted UDT references in Datatype attribute: Datatype="&quot;TypeName&quot;" */
const QUOTED_TYPE_REGEX = /&quot;([^&]+)&quot;/g;
/** Regex for unquoted references (fallback): Datatype="SomeType" */
const DATATYPE_ATTR_REGEX = /Datatype="([^"]*)"/g;
/**
 * Check if a type name is a built-in (non-UDT) type
 */
function isBuiltInType(typeName) {
    if (!typeName) {
        return true;
    }
    const lower = typeName.toLowerCase();
    if (BUILTIN_TYPES.has(lower)) {
        return true;
    }
    // Parameterized types like String[254]
    const bracketIdx = lower.indexOf('[');
    if (bracketIdx > 0 && BUILTIN_TYPES.has(lower.substring(0, bracketIdx))) {
        return true;
    }
    return false;
}
/**
 * Parse a UDT XML file to extract its name and dependency UDT names.
 */
function parseUdtDependencies(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Extract UDT name
        const nameMatch = content.match(UDT_NAME_REGEX);
        const typeName = nameMatch?.[1] ?? path.basename(filePath, '.xml');
        // Extract all Datatype attributes and find quoted UDT references
        const dependencies = new Set();
        let match;
        // Method 1: Find &quot;TypeName&quot; patterns in Datatype attributes (raw XML)
        const quotedRegex = new RegExp(QUOTED_TYPE_REGEX.source, 'g');
        while ((match = quotedRegex.exec(content)) !== null) {
            let refType = match[1];
            // Strip version suffix: "MyType:v1.0" -> "MyType"
            const colonIdx = refType.indexOf(':');
            if (colonIdx > 0) {
                refType = refType.substring(0, colonIdx);
            }
            if (!isBuiltInType(refType)) {
                dependencies.add(refType);
            }
        }
        // Method 2: Check for unquoted Datatype references (rare but possible)
        const datatypeRegex = new RegExp(DATATYPE_ATTR_REGEX.source, 'g');
        while ((match = datatypeRegex.exec(content)) !== null) {
            let rawValue = match[1];
            // Skip if it contains &quot; (already handled above)
            if (rawValue.includes('&quot;')) {
                continue;
            }
            // Handle "Array[...] of TypeName" 
            const ofIdx = rawValue.toLowerCase().indexOf(' of ');
            if (ofIdx >= 0) {
                rawValue = rawValue.substring(ofIdx + 4).trim();
            }
            // Skip if it's a built-in type or contains special chars
            if (!isBuiltInType(rawValue) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(rawValue)) {
                dependencies.add(rawValue);
            }
        }
        // Remove self-reference
        dependencies.delete(typeName);
        return { filePath, typeName, dependencies };
    }
    catch {
        return null;
    }
}
/**
 * Topologically sort UDT files by their dependencies.
 * Types that are referenced by other types will be imported first.
 */
function sortUdtsByDependencies(udtFiles) {
    if (udtFiles.length <= 1) {
        return [...udtFiles];
    }
    // Parse all UDT files
    const udtInfoMap = new Map(); // typeName -> info
    const fileByName = new Map(); // typeName -> filePath
    for (const filePath of udtFiles) {
        const info = parseUdtDependencies(filePath);
        if (info) {
            udtInfoMap.set(info.typeName.toLowerCase(), info);
            fileByName.set(info.typeName.toLowerCase(), filePath);
        }
    }
    // Build adjacency list: if A depends on B, then B -> A
    const graph = new Map();
    const inDegree = new Map();
    for (const name of udtInfoMap.keys()) {
        graph.set(name, new Set());
        inDegree.set(name, 0);
    }
    for (const [typeName, info] of udtInfoMap) {
        for (const dep of info.dependencies) {
            const depLower = dep.toLowerCase();
            // Only consider dependencies that exist in our file set
            if (udtInfoMap.has(depLower) && depLower !== typeName) {
                const neighbors = graph.get(depLower);
                if (!neighbors.has(typeName)) {
                    neighbors.add(typeName);
                    inDegree.set(typeName, (inDegree.get(typeName) ?? 0) + 1);
                }
            }
        }
    }
    // Kahn's algorithm
    const queue = [];
    for (const [name, degree] of inDegree) {
        if (degree === 0) {
            queue.push(name);
        }
    }
    const sortedNames = [];
    while (queue.length > 0) {
        const current = queue.shift();
        sortedNames.push(current);
        const neighbors = graph.get(current);
        if (neighbors) {
            for (const neighbor of neighbors) {
                const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
                inDegree.set(neighbor, newDegree);
                if (newDegree === 0) {
                    queue.push(neighbor);
                }
            }
        }
    }
    // Handle cycles - add remaining in original order  
    for (const filePath of udtFiles) {
        const info = [...udtInfoMap.values()].find(i => i.filePath === filePath);
        if (info && !sortedNames.includes(info.typeName.toLowerCase())) {
            sortedNames.push(info.typeName.toLowerCase());
        }
    }
    // Convert sorted names back to file paths
    const sortedFiles = [];
    const processedFiles = new Set();
    for (const name of sortedNames) {
        const filePath = fileByName.get(name);
        if (filePath && !processedFiles.has(filePath.toLowerCase())) {
            processedFiles.add(filePath.toLowerCase());
            sortedFiles.push(filePath);
        }
    }
    // Add any files that couldn't be parsed
    for (const file of udtFiles) {
        if (!processedFiles.has(file.toLowerCase())) {
            sortedFiles.push(file);
        }
    }
    return sortedFiles;
}
/**
 * Sort XML files for import - handles dependencies.
 * UDTs are sorted by dependency (topological sort), then blocks, then Instance DBs.
 */
function sortXmlFilesForImport(files) {
    // Categorize files by type
    const udtFiles = [];
    const blockFiles = [];
    const instanceDbFiles = [];
    const otherFiles = [];
    for (const file of files) {
        const fileType = (0, simaticMl_1.detectSimaticMlFileType)(file);
        switch (fileType) {
            case 'udt':
                udtFiles.push(file);
                break;
            case 'block':
            case 'sd':
            case 'scl':
                blockFiles.push(file);
                break;
            case 'instancedb':
                instanceDbFiles.push(file);
                break;
            case 's7res':
                // Skip .s7res files - handled with .s7dcl
                break;
            default:
                otherFiles.push(file);
                break;
        }
    }
    // Sort UDTs by dependencies
    const sortedUdts = sortUdtsByDependencies(udtFiles);
    // Sort blocks + Instance DBs together by call/usage dependencies so that
    // referenced FC/FB are imported before the blocks that call them, and
    // each InstanceDB follows its parent FB.
    const combinedBlocks = [...blockFiles, ...instanceDbFiles];
    const sortedBlocks = (0, blockDependencySorter_1.sortBlocksByDependencies)(combinedBlocks);
    // Non-block, non-UDT files fall back to alphabetical order (tag tables, watch tables, etc.)
    otherFiles.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
    // Order: UDTs (dependency-sorted) -> Blocks + Instance DBs (dependency-sorted) -> Others
    const result = [...sortedUdts, ...sortedBlocks, ...otherFiles];
    // Log sorting info for UDTs if dependencies were detected
    if (udtFiles.length > 0) {
        const alpha = [...udtFiles].sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
        const reordered = sortedUdts.some((f, i) => f !== alpha[i]);
        if (reordered) {
            logger_1.Logger.info(`UDT dependency sort: ${udtFiles.length} types reordered by dependencies`);
        }
    }
    if (combinedBlocks.length > 1) {
        const alpha = [...combinedBlocks].sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
        const reordered = sortedBlocks.some((f, i) => f !== alpha[i]);
        if (reordered) {
            logger_1.Logger.info(`Block dependency sort: ${combinedBlocks.length} blocks reordered by call graph`);
        }
    }
    return result;
}
/**
 * Get all supported files (XML, SD, SCL) in a folder (optionally recursive)
 * Note: .s7res files are excluded - they are handled together with .s7dcl files
 */
async function getSupportedFilesInFolder(folderPath, recursive) {
    const files = [];
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);
            const ext = path.extname(entry.name).toLowerCase();
            if (entry.isFile() && exports.SUPPORTED_EXTENSIONS.includes(ext)) {
                files.push(fullPath);
            }
            else if (entry.isDirectory() && recursive) {
                const subFiles = await getSupportedFilesInFolder(fullPath, recursive);
                files.push(...subFiles);
            }
        }
    }
    catch (err) {
        logger_1.Logger.error(`Error reading folder ${folderPath}:`, err);
    }
    return sortXmlFilesForImport(files);
}
/**
 * Get all empty folders (folders without supported files) in a directory recursively
 * Returns full paths to empty folders
 */
async function getEmptyFoldersInDirectory(folderPath) {
    const emptyFolders = [];
    function processDir(dirPath) {
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            let hasSupportedFiles = false;
            let hasSubdirsWithFiles = false;
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (exports.SUPPORTED_EXTENSIONS.includes(ext)) {
                        hasSupportedFiles = true;
                    }
                }
                else if (entry.isDirectory()) {
                    const subdirHasFiles = processDir(fullPath);
                    if (subdirHasFiles) {
                        hasSubdirsWithFiles = true;
                    }
                }
            }
            if (!hasSupportedFiles && !hasSubdirsWithFiles) {
                emptyFolders.push(dirPath);
            }
            return hasSupportedFiles || hasSubdirsWithFiles;
        }
        catch (err) {
            logger_1.Logger.warn(`Error reading folder ${dirPath}:`, err);
            return false;
        }
    }
    processDir(folderPath);
    return emptyFolders;
}
/**
 * Detect folder type from path
 * Returns: 'blocks' | 'tags' | 'types' | 'watch' | 'unknown'
 */
function detectFolderType(folderPath) {
    const normalizedPath = folderPath.toLowerCase().replace(/\\/g, '/');
    if (normalizedPath.includes('plc tags') ||
        normalizedPath.includes('plc_tags') ||
        normalizedPath.includes('/plctags')) {
        return 'tags';
    }
    if (normalizedPath.includes('plc data types') ||
        normalizedPath.includes('plc_data_types') ||
        normalizedPath.includes('/plcdatatypes') ||
        normalizedPath.includes('plc types') ||
        normalizedPath.includes('plc_types') ||
        normalizedPath.includes('/plctypes')) {
        return 'types';
    }
    if (normalizedPath.includes('watch and force tables') ||
        normalizedPath.includes('watch_and_force_tables') ||
        normalizedPath.includes('/watchandforcetables')) {
        return 'watch';
    }
    if (normalizedPath.includes('program blocks') ||
        normalizedPath.includes('program_blocks') ||
        normalizedPath.includes('/programblocks')) {
        return 'blocks';
    }
    return 'unknown';
}
/**
 * Find the "Program blocks" folder in the path and return it as base path
 * This ensures proper folder structure in TIA Portal
 */
function findProgramBlocksBasePath(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const programBlocksMatch = normalizedPath.match(/(.+\/Program[_ ]?blocks)/i);
    if (programBlocksMatch) {
        return programBlocksMatch[1].replace(/\//g, path.sep);
    }
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    return workspaceFolder?.uri.fsPath;
}
/**
 * Detect whether `inputPath` falls within a `Units/<UnitName>/` subtree
 * exported by the Software Units flow. Returns the unit name (and the
 * base path matching the unit root) so export can be routed to the
 * matching PlcUnit / PlcSafetyUnit. Returns null when the path is not
 * under a Units/ subtree.
 */
function detectUnitContext(inputPath) {
    const normalized = inputPath.replace(/\\/g, '/');
    // Match `.../Units/<UnitName>/...` anywhere in the path.
    const m = normalized.match(/(.*\/Units\/[^/]+)(?:\/|$)/);
    if (!m) {
        return null;
    }
    const unitRoot = m[1];
    const unitName = unitRoot.substring(unitRoot.lastIndexOf('/') + 1);
    if (!unitName) {
        return null;
    }
    return { unitName, unitRoot: unitRoot.replace(/\//g, path.sep) };
}
/**
 * Log import result details (messages and summary)
 */
function logImportResultDetails(result) {
    if (result.messages && result.messages.length > 0) {
        logger_1.Logger.logExportMessages(result.messages);
    }
    logger_1.Logger.logExportSummary(result);
}
/**
 * Log and report delete results for orphaned items
 */
function logDeleteResults(deleteResult, itemType) {
    if (deleteResult.deletedTables && deleteResult.deletedTables.length > 0) {
        logger_1.Logger.success(`Deleted ${deleteResult.deletedTables.length} ${itemType} tables`);
        for (const deleted of deleteResult.deletedTables) {
            logger_1.Logger.info(`  ✗ Deleted table: ${deleted}`);
        }
    }
    if (deleteResult.deletedTypes && deleteResult.deletedTypes.length > 0) {
        logger_1.Logger.success(`Deleted ${deleteResult.deletedTypes.length} ${itemType} types`);
        for (const deleted of deleteResult.deletedTypes) {
            logger_1.Logger.info(`  ✗ Deleted UDT: ${deleted}`);
        }
    }
    if (deleteResult.deletedBlocks && deleteResult.deletedBlocks.length > 0) {
        logger_1.Logger.success(`Deleted ${deleteResult.deletedBlocks.length} blocks`);
        for (const deleted of deleteResult.deletedBlocks) {
            logger_1.Logger.info(`  ✗ Deleted block: ${deleted}`);
        }
    }
    if (deleteResult.deletedGroups && deleteResult.deletedGroups.length > 0) {
        logger_1.Logger.success(`Deleted ${deleteResult.deletedGroups.length} folders`);
        for (const deleted of deleteResult.deletedGroups) {
            logger_1.Logger.info(`  ✗ Deleted folder: ${deleted}`);
        }
    }
    const totalDeleted = (deleteResult.deletedTables?.length ?? 0) +
        (deleteResult.deletedTypes?.length ?? 0) +
        (deleteResult.deletedBlocks?.length ?? 0) +
        (deleteResult.deletedGroups?.length ?? 0);
    if (totalDeleted === 0) {
        logger_1.Logger.info(`No unused elements to delete in TIA Portal for this folder`);
    }
    if (deleteResult.errors && deleteResult.errors.length > 0) {
        for (const err of deleteResult.errors) {
            logger_1.Logger.warn(`Error deleting element: ${err}`);
        }
    }
}
/**
 * Report export summary in UI and logger
 */
function reportExportSummary(successCount, errorCount, skippedCount, operationLabel, uiLabel) {
    const summary = `${successCount} success, ${errorCount} errors, ${skippedCount} skipped`;
    if (errorCount === 0) {
        logger_1.Logger.success(`Export completed: ${summary}`);
        logger_1.Logger.endOperation(operationLabel, true);
        vscode.window.showInformationMessage(`${uiLabel}: Folder imported successfully (${summary})`);
    }
    else if (successCount > 0) {
        logger_1.Logger.warn(`Export completed with errors: ${summary}`);
        logger_1.Logger.info(`💡 Open Problems panel (Ctrl+Shift+M) to navigate directly to error lines`);
        logger_1.Logger.show();
        logger_1.Logger.endOperation(operationLabel, false);
        // Auto-open Problems panel so user can click errors to navigate to file:line
        vscode.commands.executeCommand('workbench.actions.view.problems');
        vscode.window.showWarningMessage(`${uiLabel}: Import completed with errors (${summary}). See Problems panel (Ctrl+Shift+M) to navigate to errors.`);
    }
    else {
        logger_1.Logger.error(`Export failed: ${summary}`);
        logger_1.Logger.info(`💡 Open Problems panel (Ctrl+Shift+M) to navigate directly to error lines`);
        logger_1.Logger.show();
        logger_1.Logger.endOperation(operationLabel, false);
        // Auto-open Problems panel so user can click errors to navigate to file:line
        vscode.commands.executeCommand('workbench.actions.view.problems');
        vscode.window.showErrorMessage(`${uiLabel}: Import failed (${summary}). See Problems panel (Ctrl+Shift+M) to navigate to errors.`);
    }
}
//# sourceMappingURL=exportUtils.js.map