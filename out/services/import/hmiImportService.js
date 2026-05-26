"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HmiImportService = void 0;
const logger_1 = require("../../utils/logger");
const config_1 = require("../../utils/config");
/**
 * Service responsible for importing HMI elements from TIA Portal to XML
 */
class HmiImportService {
    _connectionService;
    _bridge;
    _buildDeviceHmiPath;
    constructor(_connectionService, _bridge, _buildDeviceHmiPath) {
        this._connectionService = _connectionService;
        this._bridge = _bridge;
        this._buildDeviceHmiPath = _buildDeviceHmiPath;
    }
    /**
     * Import all HMI screens from a device
     */
    async importHmiScreens(deviceId, exportPath) {
        const project = this._connectionService.currentProject;
        if (!project) {
            return {
                success: false,
                error: 'No project selected'
            };
        }
        try {
            const config = (0, config_1.getConfig)();
            // Build device path
            const devicePath = this._buildDeviceHmiPath(deviceId, exportPath);
            if (!devicePath) {
                return {
                    success: false,
                    error: 'Could not determine device path'
                };
            }
            const result = await this._bridge.exportHmiScreens(project.name, deviceId, devicePath, {
                overwriteExisting: true
            });
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`HMI screens import failed: ${deviceId}`, error);
            return {
                success: false,
                error: message
            };
        }
    }
    /**
     * Import all HMI tags from a device
     */
    async importHmiTags(deviceId, exportPath) {
        const project = this._connectionService.currentProject;
        if (!project) {
            return {
                success: false,
                error: 'No project selected'
            };
        }
        try {
            const config = (0, config_1.getConfig)();
            // Build device path
            const devicePath = this._buildDeviceHmiPath(deviceId, exportPath);
            if (!devicePath) {
                return {
                    success: false,
                    error: 'Could not determine device path'
                };
            }
            const result = await this._bridge.exportHmiTags(project.name, deviceId, devicePath, {
                overwriteExisting: true
            });
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`HMI tags import failed: ${deviceId}`, error);
            return {
                success: false,
                error: message
            };
        }
    }
    /**
     * Import all HMI connections from a device
     */
    async importHmiConnections(deviceId, exportPath) {
        const project = this._connectionService.currentProject;
        if (!project) {
            return {
                success: false,
                error: 'No project selected'
            };
        }
        try {
            const config = (0, config_1.getConfig)();
            // Build device path
            const devicePath = this._buildDeviceHmiPath(deviceId, exportPath);
            if (!devicePath) {
                return {
                    success: false,
                    error: 'Could not determine device path'
                };
            }
            const result = await this._bridge.exportHmiConnections(project.name, deviceId, devicePath, {
                overwriteExisting: true
            });
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`HMI connections import failed: ${deviceId}`, error);
            return {
                success: false,
                error: message
            };
        }
    }
    /**
     * Import all HMI elements (screens, tags, connections) from a device
     */
    async importAllHmi(deviceId, exportPath) {
        const project = this._connectionService.currentProject;
        if (!project) {
            return {
                success: false,
                error: 'No project selected'
            };
        }
        try {
            const config = (0, config_1.getConfig)();
            // Build device path
            const devicePath = this._buildDeviceHmiPath(deviceId, exportPath);
            if (!devicePath) {
                return {
                    success: false,
                    error: 'Could not determine device path'
                };
            }
            const result = await this._bridge.exportAllHmi(project.name, deviceId, devicePath, {
                overwriteExisting: true
            });
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.Logger.error(`All HMI import failed: ${deviceId}`, error);
            return {
                success: false,
                error: message
            };
        }
    }
}
exports.HmiImportService = HmiImportService;
//# sourceMappingURL=hmiImportService.js.map