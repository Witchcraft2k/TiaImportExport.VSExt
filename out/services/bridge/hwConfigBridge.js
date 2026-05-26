"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HwConfigBridgeMixin = HwConfigBridgeMixin;
/**
 * Mixin for hardware-configuration related calls (import from TIA, export to TIA).
 */
function HwConfigBridgeMixin(Base) {
    return class extends Base {
        /** Import complete hardware configuration from the project */
        async importHwConfig(includeChannels = true, includeAddresses = true, includeNetworkConfig = true, includeSubnets = true, exportToXml = false, exportPath, format = 'xml') {
            return this.safeCall('Failed to import HW config', 'ImportHwConfig', { includeChannels, includeAddresses, includeNetworkConfig, includeSubnets, exportToXml, exportPath, format });
        }
        /** Import hardware configuration for a specific device */
        async importDeviceHwConfig(deviceName, includeChannels = true, includeAddresses = true, includeNetworkConfig = true, exportToXml = false, exportPath, format = 'xml') {
            return this.safeCall('Failed to import device HW config', 'ImportDeviceHwConfig', { deviceName, includeChannels, includeAddresses, includeNetworkConfig, exportToXml, exportPath, format });
        }
        /** Export a single HW Config XML/AML file to TIA Portal */
        async exportHwConfigFileToTia(xmlFilePath, overwriteExisting = false, updateExisting = true, importNetworkConfig = true, skipIfIdentical = true, showComparisonDetails = true, format = 'xml') {
            return this.safeCall('Failed to export HW Config file to TIA Portal', 'ExportHwConfigFileToTia', { xmlFilePath, overwriteExisting, updateExisting, importNetworkConfig, skipIfIdentical, showComparisonDetails, format });
        }
        /** Export HW Config XML/AML files from a folder to TIA Portal */
        async exportHwConfigFolderToTia(folderPath, overwriteExisting = false, updateExisting = true, importNetworkConfig = true, skipIfIdentical = true, showComparisonDetails = true, format = 'xml') {
            return this.safeCall('Failed to export HW Config folder to TIA Portal', 'ExportHwConfigFolderToTia', { folderPath, overwriteExisting, updateExisting, importNetworkConfig, skipIfIdentical, showComparisonDetails, format });
        }
    };
}
//# sourceMappingURL=hwConfigBridge.js.map