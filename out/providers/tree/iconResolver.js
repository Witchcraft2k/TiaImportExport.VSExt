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
exports.resolveIcon = resolveIcon;
const vscode = __importStar(require("vscode"));
/**
 * Resolve a {@link vscode.ThemeIcon} for a given tree node context and optional
 * metadata. Centralizing icon selection makes it trivial to add new node kinds
 * or rebrand existing ones without touching the tree data provider itself.
 */
function resolveIcon(contextValue, metadata) {
    switch (contextValue) {
        case 'project':
            return new vscode.ThemeIcon('project');
        case 'deviceCategory':
        case 'deviceCategoryHwOnly':
            return resolveDeviceCategoryIcon(metadata);
        case 'deviceFolder':
            return new vscode.ThemeIcon('folder');
        case 'device':
        case 'deviceWithPlc':
        case 'deviceHwOnly':
            return resolveDeviceIcon(metadata);
        case 'plcSoftware':
            return new vscode.ThemeIcon('circuit-board');
        case 'hmiSoftware':
            return new vscode.ThemeIcon('device-desktop');
        case 'hmiScreensFolder':
        case 'hmiTagsFolder':
        case 'hmiScreenGroup':
        case 'hmiTagGroup':
        case 'hmiConnectionsFolder':
        case 'blockGroup':
        case 'tagTableGroup':
        case 'udtGroup':
        case 'watchTableGroup':
            return new vscode.ThemeIcon('folder');
        case 'libraryRoot':
            return new vscode.ThemeIcon('library');
        case 'libraryFolder':
            return resolveLibraryFolderIcon(metadata);
        case 'libraryTypeFolder':
            return resolveLibraryFolderIcon(metadata);
        case 'libraryType':
            return new vscode.ThemeIcon('symbol-class');
        case 'masterCopy':
            return resolveMasterCopyIcon(metadata);
        case 'hmiScreen':
            return new vscode.ThemeIcon('browser');
        case 'hmiTag':
            return new vscode.ThemeIcon('symbol-variable');
        case 'hmiConnection':
            return new vscode.ThemeIcon('plug');
        case 'block':
            return resolveBlockIcon(metadata);
        case 'tagTable':
            return new vscode.ThemeIcon('list-unordered');
        case 'udt':
            return new vscode.ThemeIcon('symbol-struct');
        case 'watchTable':
            return new vscode.ThemeIcon('eye');
        default:
            return new vscode.ThemeIcon('file');
    }
}
function resolveDeviceCategoryIcon(metadata) {
    const categoryType = metadata?.categoryType;
    switch (categoryType) {
        case 'PLCs':
            return new vscode.ThemeIcon('server-process');
        case 'HMIs':
            return new vscode.ThemeIcon('device-desktop');
        case 'IO_Devices':
            return new vscode.ThemeIcon('plug');
        case 'Computers':
            return new vscode.ThemeIcon('vm');
        default:
            return new vscode.ThemeIcon('folder');
    }
}
function resolveDeviceIcon(metadata) {
    const deviceType = metadata?.deviceType;
    if (deviceType === 'PLC') {
        return new vscode.ThemeIcon('server-process');
    }
    if (deviceType === 'HMI') {
        return new vscode.ThemeIcon('device-desktop');
    }
    if (deviceType === 'DistributedIO') {
        return new vscode.ThemeIcon('plug');
    }
    if (deviceType === 'Drive') {
        return new vscode.ThemeIcon('pulse');
    }
    return new vscode.ThemeIcon('server');
}
function resolveBlockIcon(metadata) {
    const blockType = metadata?.blockType;
    switch (blockType) {
        case 'OB':
            return new vscode.ThemeIcon('symbol-event');
        case 'FB':
            return new vscode.ThemeIcon('symbol-method');
        case 'FC':
            return new vscode.ThemeIcon('symbol-function');
        case 'DB':
            return new vscode.ThemeIcon('database');
        default:
            return new vscode.ThemeIcon('file-code');
    }
}
function resolveLibraryFolderIcon(metadata) {
    if (metadata?.isLibraryRoot) {
        return new vscode.ThemeIcon('library');
    }
    return new vscode.ThemeIcon('folder-library');
}
function resolveMasterCopyIcon(metadata) {
    const kind = metadata?.masterCopyKind;
    switch (kind) {
        case 'Block':
            return new vscode.ThemeIcon('symbol-method');
        case 'DataType':
            return new vscode.ThemeIcon('symbol-struct');
        case 'TagTable':
            return new vscode.ThemeIcon('list-unordered');
        case 'Tag':
            return new vscode.ThemeIcon('symbol-variable');
        case 'WatchTable':
            return new vscode.ThemeIcon('eye');
        case 'Screen':
            return new vscode.ThemeIcon('browser');
        case 'Device':
            return new vscode.ThemeIcon('server');
        case 'Subnet':
            return new vscode.ThemeIcon('plug');
        case 'Mixed':
            return new vscode.ThemeIcon('symbol-namespace');
        default:
            return new vscode.ThemeIcon('file-symlink-file');
    }
}
//# sourceMappingURL=iconResolver.js.map