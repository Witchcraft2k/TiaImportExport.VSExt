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
exports.BlockImportService = void 0;
const path = __importStar(require("path"));
const logger_1 = require("../../utils/logger");
const config_1 = require("../../utils/config");
/**
 * Service responsible for importing blocks from TIA Portal to XML
 */
class BlockImportService {
    _connectionService;
    _bridge;
    _buildDevicePlcPath;
    constructor(_connectionService, _bridge, _buildDevicePlcPath) {
        this._connectionService = _connectionService;
        this._bridge = _bridge;
        this._buildDevicePlcPath = _buildDevicePlcPath;
    }
    /**
     * Import a specific block
     */
    async importBlock(blockId, deviceId, exportPath) {
        const project = this._connectionService.currentProject;
        if (!project) {
            return {
                success: false,
                error: 'No project selected'
            };
        }
        try {
            const config = (0, config_1.getConfig)();
            const result = await this._bridge.exportBlock(project.name, deviceId, blockId, exportPath, {
                includeComments: config.includeComments,
                format: config.exportFormat,
                dbExportFormat: config.dbExportFormat,
                overwriteExisting: true // Always get latest version from TIA Portal
            });
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`Block import failed: ${blockId}`, error);
            return {
                success: false,
                error: message
            };
        }
    }
    /**
     * Import a specific block with path preservation
     */
    async importBlockWithPath(blockId, parentPath, groupPath, exportPath) {
        const project = this._connectionService.currentProject;
        if (!project) {
            return {
                success: false,
                error: 'No project selected'
            };
        }
        try {
            const config = (0, config_1.getConfig)();
            // Build full device/PLC path
            const devicePlcPath = this._buildDevicePlcPath(parentPath, exportPath);
            if (!devicePlcPath) {
                return {
                    success: false,
                    error: 'Could not find device/PLC path'
                };
            }
            // Add Program blocks subfolder
            const blocksPath = path.join(devicePlcPath, 'Program blocks');
            // Extract deviceId for bridge call
            const [deviceId] = parentPath.split('/');
            const result = await this._bridge.exportBlockWithPath(project.name, deviceId, blockId, groupPath, blocksPath, {
                includeComments: config.includeComments,
                format: config.exportFormat,
                dbExportFormat: config.dbExportFormat,
                overwriteExisting: true // Always get latest version from TIA Portal
            });
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`Block import failed: ${blockId}`, error);
            return {
                success: false,
                error: message
            };
        }
    }
    /**
     * Import a block group (folder) with all its blocks
     */
    async importBlockGroup(groupId, parentPath, exportPath) {
        const project = this._connectionService.currentProject;
        if (!project) {
            return {
                success: false,
                error: 'No project selected'
            };
        }
        try {
            const config = (0, config_1.getConfig)();
            const [deviceId, plcId] = parentPath.split('/');
            const result = await this._bridge.exportBlockGroup(project.name, deviceId, plcId, groupId, exportPath, {
                includeComments: config.includeComments,
                excludeSystemBlocks: config.excludeSystemBlocks,
                format: config.exportFormat,
                dbExportFormat: config.dbExportFormat,
                overwriteExisting: true // Always get latest version from TIA Portal
            });
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`Block group import failed: ${groupId}`, error);
            return {
                success: false,
                error: message
            };
        }
    }
    /**
     * Import a block group with path preservation
     */
    async importBlockGroupWithPath(groupId, parentPath, groupName, groupPath, exportPath) {
        const project = this._connectionService.currentProject;
        if (!project) {
            return {
                success: false,
                error: 'No project selected'
            };
        }
        try {
            const config = (0, config_1.getConfig)();
            const [deviceId, plcId] = parentPath.split('/');
            // Build full device/PLC path
            const devicePlcPath = this._buildDevicePlcPath(parentPath, exportPath);
            if (!devicePlcPath) {
                return {
                    success: false,
                    error: 'Could not find device/PLC path'
                };
            }
            // Add Program blocks subfolder
            const blocksPath = path.join(devicePlcPath, 'Program blocks');
            const result = await this._bridge.exportBlockGroupWithPath(project.name, deviceId, plcId, groupId, groupName, groupPath, blocksPath, {
                includeComments: config.includeComments,
                excludeSystemBlocks: config.excludeSystemBlocks,
                format: config.exportFormat,
                dbExportFormat: config.dbExportFormat,
                overwriteExisting: true // Always get latest version from TIA Portal
            });
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`Block group import failed: ${groupId}`, error);
            return {
                success: false,
                error: message
            };
        }
    }
}
exports.BlockImportService = BlockImportService;
//# sourceMappingURL=blockImportService.js.map