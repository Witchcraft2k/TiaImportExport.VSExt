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
exports.locateAutomationCompareTool = locateAutomationCompareTool;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const EXE_NAME_CANDIDATES = [
    'ACTool.exe',
    'AutomationCompareTool.exe',
    'SIMATICAutomationCompareTool.exe',
    'Siemens.Automation.CompareTool.exe',
    'SiemensAutomationCompareTool.exe'
];
const EXE_NAME_HINTS = [
    /^actool\.exe$/i,
    /automation.*compare.*tool.*\.exe/i,
    /simatic.*automation.*compare.*\.exe/i,
    /compare.*tool.*\.exe/i
];
async function locateAutomationCompareTool(config) {
    const searchedPaths = [];
    if (config.path.trim()) {
        const configuredPath = config.path.trim();
        searchedPaths.push(configuredPath);
        if (await isExecutableFile(configuredPath)) {
            return { success: true, searchedPaths, location: { filePath: configuredPath, source: 'settings' } };
        }
        return {
            success: false,
            searchedPaths,
            error: `Configured Automation Compare Tool path does not exist or is not an EXE: ${configuredPath}`
        };
    }
    if (!config.autoDetect) {
        return {
            success: false,
            searchedPaths,
            error: 'Automation Compare Tool path is not configured and auto-detection is disabled.'
        };
    }
    const knownPath = await findInKnownPaths(searchedPaths);
    if (knownPath) {
        return { success: true, searchedPaths, location: { filePath: knownPath, source: 'known-path' } };
    }
    const scannedPath = await scanLikelyRoots(searchedPaths);
    if (scannedPath) {
        return { success: true, searchedPaths, location: { filePath: scannedPath, source: 'scan' } };
    }
    const registryPath = await findFromRegistry(searchedPaths);
    if (registryPath) {
        return { success: true, searchedPaths, location: { filePath: registryPath, source: 'registry' } };
    }
    return {
        success: false,
        searchedPaths,
        error: 'SIMATIC Automation Compare Tool was not found. Configure tiaImport.automationCompareTool.path.'
    };
}
async function findInKnownPaths(searchedPaths) {
    for (const root of getLikelyInstallRoots()) {
        for (const executableName of EXE_NAME_CANDIDATES) {
            const candidatePath = path.join(root, executableName);
            searchedPaths.push(candidatePath);
            if (await isExecutableFile(candidatePath)) {
                return candidatePath;
            }
        }
    }
    return undefined;
}
async function scanLikelyRoots(searchedPaths) {
    for (const root of getLikelyScanRoots()) {
        if (!fs.existsSync(root)) {
            continue;
        }
        searchedPaths.push(root);
        const found = await findExecutableBelow(root, 5);
        if (found) {
            return found;
        }
    }
    return undefined;
}
async function findFromRegistry(searchedPaths) {
    const registryRoots = [
        'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
        'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
    ];
    for (const registryRoot of registryRoots) {
        searchedPaths.push(registryRoot);
        try {
            const { stdout } = await execFileAsync('reg.exe', ['query', registryRoot, '/s', '/f', 'Automation Compare Tool'], { windowsHide: true, timeout: 5000 });
            const registryCandidates = extractRegistryCandidates(stdout);
            for (const candidatePath of registryCandidates) {
                searchedPaths.push(candidatePath);
                if (await isExecutableFile(candidatePath)) {
                    return candidatePath;
                }
                if (fs.existsSync(candidatePath)) {
                    for (const executableName of EXE_NAME_CANDIDATES) {
                        const nestedCandidate = path.join(candidatePath, executableName);
                        searchedPaths.push(nestedCandidate);
                        if (await isExecutableFile(nestedCandidate)) {
                            return nestedCandidate;
                        }
                    }
                }
            }
        }
        catch {
            continue;
        }
    }
    return undefined;
}
function getLikelyInstallRoots() {
    const roots = [];
    for (const basePath of getProgramFilesRoots()) {
        roots.push(path.join(basePath, 'Siemens', 'Automation', 'Automation Compare Tool'), path.join(basePath, 'Siemens', 'Automation', 'SIMATIC Automation Compare Tool'), path.join(basePath, 'Siemens', 'Automation', 'SIMATIC Automation Compare'), path.join(basePath, 'Siemens', 'SIMATIC Automation Compare Tool'));
    }
    return uniqueExistingOrder(roots);
}
function getLikelyScanRoots() {
    const roots = [];
    for (const basePath of getProgramFilesRoots()) {
        roots.push(path.join(basePath, 'Siemens'));
    }
    return uniqueExistingOrder(roots);
}
function getProgramFilesRoots() {
    return uniqueExistingOrder([
        process.env.ProgramFiles || '',
        process.env['ProgramFiles(x86)'] || '',
        'C:\\Program Files',
        'C:\\Program Files (x86)'
    ].filter(Boolean));
}
function uniqueExistingOrder(values) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
        const key = value.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            result.push(value);
        }
    }
    return result;
}
async function findExecutableBelow(root, maxDepth) {
    if (maxDepth < 0) {
        return undefined;
    }
    let entries;
    try {
        entries = await fs.promises.readdir(root, { withFileTypes: true });
    }
    catch {
        return undefined;
    }
    for (const entry of entries) {
        if (entry.isFile() && EXE_NAME_HINTS.some(pattern => pattern.test(entry.name))) {
            return path.join(root, entry.name);
        }
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const lowerName = entry.name.toLowerCase();
        if (!lowerName.includes('compare') && !lowerName.includes('automation') && maxDepth <= 2) {
            continue;
        }
        const found = await findExecutableBelow(path.join(root, entry.name), maxDepth - 1);
        if (found) {
            return found;
        }
    }
    return undefined;
}
function extractRegistryCandidates(stdout) {
    const candidates = [];
    for (const rawLine of stdout.split(/\r?\n/)) {
        const line = rawLine.trim();
        const valueMatch = line.match(/^(InstallLocation|DisplayIcon)\s+REG_\w+\s+(.+)$/i);
        if (!valueMatch) {
            continue;
        }
        const candidate = valueMatch[2].trim().replace(/^"|"$/g, '').replace(/,\d+$/, '');
        if (candidate) {
            candidates.push(candidate);
        }
    }
    return uniqueExistingOrder(candidates);
}
async function isExecutableFile(filePath) {
    if (path.extname(filePath).toLowerCase() !== '.exe') {
        return false;
    }
    try {
        const stats = await fs.promises.stat(filePath);
        return stats.isFile();
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=automationCompareToolLocator.js.map