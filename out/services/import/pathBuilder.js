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
exports.getDeviceCategoryFolder = getDeviceCategoryFolder;
exports.buildDevicePlcPath = buildDevicePlcPath;
exports.buildDeviceHmiPath = buildDeviceHmiPath;
const path = __importStar(require("path"));
/**
 * Maps a TIA device type string to its on-disk category folder.
 */
function getDeviceCategoryFolder(deviceType) {
    switch (deviceType) {
        case 'PLC':
            return 'PLCs';
        case 'HMI':
            return 'HMIs';
        case 'Computer':
            return 'Computers';
        case 'DistributedIO':
        case 'Drive':
        case 'Device':
        default:
            return 'IO_Devices';
    }
}
/**
 * Build the PLC folder for a device within `exportPath`.
 *
 * Expected `parentPath` format: `deviceId/plcName`. Returns `undefined` when
 * the project, device or PLC cannot be resolved. If a device has multiple PLCs
 * the PLC name is appended to mirror TIA Portal's on-disk structure.
 */
function buildDevicePlcPath(connectionService, parentPath, exportPath) {
    const project = connectionService.currentProject;
    if (!project) {
        return undefined;
    }
    const [deviceId, plcName] = parentPath.split('/');
    const device = connectionService.getDevice(deviceId);
    if (!device) {
        return undefined;
    }
    const plc = device.plcSoftware.find(p => p.id === parentPath || p.name === plcName);
    if (!plc) {
        return undefined;
    }
    const deviceFolderName = device.displayName || device.name;
    const categoryFolder = getDeviceCategoryFolder(device.type);
    if (device.plcSoftware.length > 1) {
        return path.join(exportPath, 'Devices', categoryFolder, deviceFolderName, plc.name);
    }
    return path.join(exportPath, 'Devices', categoryFolder, deviceFolderName);
}
/**
 * Build the HMI folder for a device within `exportPath`.
 * Returns `undefined` when the project or device cannot be resolved.
 */
function buildDeviceHmiPath(connectionService, deviceId, exportPath) {
    const project = connectionService.currentProject;
    if (!project) {
        return undefined;
    }
    const device = connectionService.getDevice(deviceId);
    if (!device) {
        return undefined;
    }
    const deviceFolderName = device.displayName || device.name;
    const categoryFolder = getDeviceCategoryFolder(device.type);
    return path.join(exportPath, 'Devices', categoryFolder, deviceFolderName);
}
//# sourceMappingURL=pathBuilder.js.map