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
exports.TagTableImportService = void 0;
const path = __importStar(require("path"));
const logger_1 = require("../../utils/logger");
const config_1 = require("../../utils/config");
const unitScope_1 = require("../../utils/unitScope");
/**
 * Service responsible for importing tag tables from TIA Portal to XML
 */
class TagTableImportService {
    _connectionService;
    _bridge;
    _buildDevicePlcPath;
    constructor(_connectionService, _bridge, _buildDevicePlcPath) {
        this._connectionService = _connectionService;
        this._bridge = _bridge;
        this._buildDevicePlcPath = _buildDevicePlcPath;
    }
    /**
     * Import all tag tables
     */
    async importTagTables(parentPath, exportPath) {
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
            // Add PLC tags subfolder
            const tagsPath = path.join(devicePlcPath, 'PLC tags');
            const generateXlsx = (0, config_1.getConfig)().tagTableFormat === 'xlsx';
            logger_1.Logger.info(`PLC tags format: ${generateXlsx ? 'xlsx' : 'xml'}`);
            const result = await this._bridge.exportTagTables(project.name, deviceId, plcId, tagsPath, generateXlsx);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`Tag tables import failed`, error);
            return {
                success: false,
                error: message
            };
        }
    }
    /**
     * Import tag tables from a specific group with path preservation
     */
    async importTagTablesFromGroup(parentPath, groupName, groupPath, exportPath, groupId) {
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
            // Add PLC tags subfolder with group path (route into Units/<UnitName>/ when groupId carries a unit segment)
            const tagsPath = (0, unitScope_1.resolveExportRoot)(devicePlcPath, groupId, 'PLC tags');
            const generateXlsx = (0, config_1.getConfig)().tagTableFormat === 'xlsx';
            logger_1.Logger.info(`PLC tags format: ${generateXlsx ? 'xlsx' : 'xml'}`);
            const result = await this._bridge.exportTagTablesFromGroup(project.name, deviceId, plcId, groupName, groupPath, tagsPath, generateXlsx, groupId);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`Tag tables import failed`, error);
            return {
                success: false,
                error: message
            };
        }
    }
    /**
     * Import a single tag table
     */
    async importSingleTagTable(tagTableId, parentPath, exportPath) {
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
            // Add PLC tags subfolder (route into Units/<UnitName>/ when tagTableId carries a unit segment)
            const tagsPath = (0, unitScope_1.resolveExportRoot)(devicePlcPath, tagTableId, 'PLC tags');
            const generateXlsx = (0, config_1.getConfig)().tagTableFormat === 'xlsx';
            logger_1.Logger.info(`PLC tags format: ${generateXlsx ? 'xlsx' : 'xml'}`);
            const result = await this._bridge.exportSingleTagTable(project.name, deviceId, plcId, tagTableId, tagsPath, generateXlsx);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`Tag table import failed: ${tagTableId}`, error);
            return {
                success: false,
                error: message
            };
        }
    }
}
exports.TagTableImportService = TagTableImportService;
//# sourceMappingURL=tagTableImportService.js.map