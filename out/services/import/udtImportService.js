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
exports.UdtImportService = void 0;
const path = __importStar(require("path"));
const logger_1 = require("../../utils/logger");
/**
 * Service responsible for importing UDTs (User Data Types) from TIA Portal to XML
 */
class UdtImportService {
    _connectionService;
    _bridge;
    _buildDevicePlcPath;
    constructor(_connectionService, _bridge, _buildDevicePlcPath) {
        this._connectionService = _connectionService;
        this._bridge = _bridge;
        this._buildDevicePlcPath = _buildDevicePlcPath;
    }
    /**
     * Import all UDTs
     */
    async importUdts(parentPath, exportPath) {
        const project = this._connectionService.currentProject;
        if (!project) {
            return {
                success: false,
                error: 'No project selected'
            };
        }
        try {
            // parentPath format: deviceId/plcId
            const parts = parentPath.split('/');
            const deviceId = parts[0];
            const plcId = parts[1];
            // Build full device/PLC path
            const devicePlcPath = this._buildDevicePlcPath(parentPath, exportPath);
            if (!devicePlcPath) {
                return {
                    success: false,
                    error: 'Could not find device/PLC path'
                };
            }
            // Add PLC data types subfolder
            const udtPath = path.join(devicePlcPath, 'PLC data types');
            const result = await this._bridge.exportUserDataTypes(project.name, deviceId, plcId, udtPath);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`UDTs import failed`, error);
            return {
                success: false,
                error: message
            };
        }
    }
    /**
     * Import UDTs from a specific group with path preservation
     */
    async importUdtsFromGroup(parentPath, groupName, groupPath, exportPath) {
        const project = this._connectionService.currentProject;
        if (!project) {
            return {
                success: false,
                error: 'No project selected'
            };
        }
        try {
            // parentPath format: deviceId/plcId
            const parts = parentPath.split('/');
            const deviceId = parts[0];
            const plcId = parts[1];
            // Build full device/PLC path
            const devicePlcPath = this._buildDevicePlcPath(parentPath, exportPath);
            if (!devicePlcPath) {
                return {
                    success: false,
                    error: 'Could not find device/PLC path'
                };
            }
            // Add PLC data types subfolder with group path
            const udtPath = path.join(devicePlcPath, 'PLC data types');
            const result = await this._bridge.exportUdtsFromGroup(project.name, deviceId, plcId, groupName, groupPath, udtPath);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`UDTs import failed`, error);
            return {
                success: false,
                error: message
            };
        }
    }
    /**
     * Import a single UDT
     */
    async importSingleUdt(udtId, parentPath, exportPath) {
        const project = this._connectionService.currentProject;
        if (!project) {
            return {
                success: false,
                error: 'No project selected'
            };
        }
        try {
            // parentPath format: deviceId/plcId
            const parts = parentPath.split('/');
            const deviceId = parts[0];
            const plcId = parts[1];
            // Build full device/PLC path
            const devicePlcPath = this._buildDevicePlcPath(parentPath, exportPath);
            if (!devicePlcPath) {
                return {
                    success: false,
                    error: 'Could not find device/PLC path'
                };
            }
            // Add PLC data types subfolder
            const udtPath = path.join(devicePlcPath, 'PLC data types');
            const result = await this._bridge.exportSingleUdt(project.name, deviceId, plcId, udtId, udtPath);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`UDT import failed: ${udtId}`, error);
            return {
                success: false,
                error: message
            };
        }
    }
}
exports.UdtImportService = UdtImportService;
//# sourceMappingURL=udtImportService.js.map