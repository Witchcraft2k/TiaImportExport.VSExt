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
exports.WatchTableImportService = void 0;
const path = __importStar(require("path"));
const logger_1 = require("../../utils/logger");
/**
 * Service responsible for importing watch and force tables from TIA Portal to XML
 */
class WatchTableImportService {
    _connectionService;
    _bridge;
    _buildDevicePlcPath;
    constructor(_connectionService, _bridge, _buildDevicePlcPath) {
        this._connectionService = _connectionService;
        this._bridge = _bridge;
        this._buildDevicePlcPath = _buildDevicePlcPath;
    }
    /**
     * Import all watch and force tables
     */
    async importWatchTables(parentPath, exportPath) {
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
            // Add Watch and force tables subfolder
            const watchPath = path.join(devicePlcPath, 'Watch and force tables');
            const result = await this._bridge.exportWatchTables(project.name, deviceId, plcId, watchPath);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`Watch tables import failed`, error);
            return {
                success: false,
                error: message
            };
        }
    }
    /**
     * Import watch tables from a specific group with path preservation
     */
    async importWatchTablesFromGroup(parentPath, groupName, groupPath, exportPath) {
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
            // Add Watch and force tables subfolder with group path
            const watchPath = path.join(devicePlcPath, 'Watch and force tables');
            const result = await this._bridge.exportWatchTablesFromGroup(project.name, deviceId, plcId, groupName, groupPath, watchPath);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`Watch tables import failed`, error);
            return {
                success: false,
                error: message
            };
        }
    }
    /**
     * Import a single watch table
     */
    async importSingleWatchTable(watchTableId, parentPath, exportPath) {
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
            // Add Watch and force tables subfolder
            const watchPath = path.join(devicePlcPath, 'Watch and force tables');
            const result = await this._bridge.exportSingleWatchTable(project.name, deviceId, plcId, watchTableId, watchPath);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`Watch table import failed: ${watchTableId}`, error);
            return {
                success: false,
                error: message
            };
        }
    }
}
exports.WatchTableImportService = WatchTableImportService;
//# sourceMappingURL=watchTableImportService.js.map