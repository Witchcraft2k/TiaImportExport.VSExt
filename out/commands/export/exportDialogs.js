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
exports.ensureConnection = ensureConnection;
exports.validateProjectDevices = validateProjectDevices;
exports.isPlcDevice = isPlcDevice;
exports.validateProjectPlcDevices = validateProjectPlcDevices;
exports.pickDevice = pickDevice;
exports.pickOverwriteMode = pickOverwriteMode;
exports.pickSingleFile = pickSingleFile;
exports.pickFolder = pickFolder;
exports.resolveFilePath = resolveFilePath;
exports.resolveFolderPath = resolveFolderPath;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const exportUtils_1 = require("./exportUtils");
/**
 * Ensure connection to TIA Portal, prompting user if not connected.
 * Also verifies the connection is alive by pinging (5s timeout).
 * Returns true if connected, false if user cancelled or connection is broken.
 */
async function ensureConnection(connectionService) {
    if (!connectionService.isConnected) {
        const connect = await vscode.window.showWarningMessage('Export to TIA Portal: No connection to TIA Portal. Do you want to connect?', 'Connect', 'Cancel');
        if (connect === 'Connect') {
            return await connectionService.connect();
        }
        return false;
    }
    // Verify the connection is still alive
    return await connectionService.ensureConnected();
}
/**
 * Validate that the project has devices available.
 * Returns the devices array or undefined if none.
 */
function validateProjectDevices(connectionService) {
    const project = connectionService.currentProject;
    if (!project || !project.devices || project.devices.length === 0) {
        vscode.window.showWarningMessage('Export to TIA Portal: No devices in TIA Portal project');
        return undefined;
    }
    return project.devices;
}
/**
 * Returns true when a device has PLC software and can be used as a target
 * for PLC artifacts such as blocks, UDTs, tags and watch tables.
 */
function isPlcDevice(device) {
    return Array.isArray(device.plcSoftware) && device.plcSoftware.length > 0;
}
/**
 * Validate that the project has PLC devices available for PLC artifact export.
 * Returns only PLC-capable devices, excluding HMI and hardware-only devices.
 */
function validateProjectPlcDevices(connectionService) {
    const devices = validateProjectDevices(connectionService);
    if (!devices) {
        return undefined;
    }
    const plcDevices = devices.filter(isPlcDevice);
    if (plcDevices.length === 0) {
        vscode.window.showWarningMessage('Export to TIA Portal: No PLC devices in TIA Portal project');
        return undefined;
    }
    return plcDevices;
}
/**
 * Show device picker and return selected device info.
 */
async function pickDevice(devices, title) {
    const deviceItems = devices.map(d => ({
        label: d.displayName || d.name,
        description: d.type || d.orderNumber || '',
        device: d
    }));
    const selected = await vscode.window.showQuickPick(deviceItems, {
        placeHolder: 'Select target device',
        title
    });
    if (!selected) {
        return undefined;
    }
    return {
        label: selected.label,
        device: selected.device,
        deviceId: selected.device.displayName || selected.device.name
    };
}
/**
 * Show overwrite mode picker.
 */
async function pickOverwriteMode(title) {
    const selected = await vscode.window.showQuickPick([
        { label: 'Overwrite All', description: 'Export files without checking differences', forceOverwrite: true },
        { label: 'Check and Overwrite Differences', description: 'Compare content and export only changed files', forceOverwrite: false }
    ], {
        placeHolder: 'Select export mode',
        title
    });
    if (!selected) {
        return undefined;
    }
    return {
        label: selected.label,
        forceOverwrite: selected.forceOverwrite,
        compareBeforeImport: !selected.forceOverwrite
    };
}
/**
 * Show file open dialog for selecting a single supported file.
 */
async function pickSingleFile(title) {
    const files = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: false,
        filters: {
            'TIA Portal Files': ['xml', 's7dcl', 'scl'],
            'XML Files': ['xml'],
            'SD Files': ['s7dcl'],
            'SCL Files': ['scl']
        },
        title
    });
    if (!files || files.length === 0) {
        return undefined;
    }
    return files[0].fsPath;
}
/**
 * Show folder open dialog for selecting a folder.
 */
async function pickFolder(title) {
    const folders = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title
    });
    if (!folders || folders.length === 0) {
        return undefined;
    }
    return folders[0].fsPath;
}
/**
 * Resolve file path from URI or show file picker.
 * Returns undefined if user cancelled or file has unsupported extension.
 */
async function resolveFilePath(uri, dialogTitle) {
    let filePath;
    if (uri) {
        filePath = uri.fsPath;
    }
    else {
        const picked = await pickSingleFile(dialogTitle);
        if (!picked) {
            return undefined;
        }
        filePath = picked;
    }
    const ext = path.extname(filePath).toLowerCase();
    if (!exportUtils_1.SUPPORTED_EXTENSIONS.includes(ext)) {
        vscode.window.showWarningMessage(`Export to TIA Portal: Unsupported file format. Supported: ${exportUtils_1.SUPPORTED_EXTENSIONS.join(', ')}`);
        return undefined;
    }
    return filePath;
}
/**
 * Resolve folder path from URI or show folder picker.
 */
async function resolveFolderPath(uri, dialogTitle) {
    if (uri) {
        return uri.fsPath;
    }
    return await pickFolder(dialogTitle);
}
//# sourceMappingURL=exportDialogs.js.map