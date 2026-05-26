"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlcDataBridgeMixin = PlcDataBridgeMixin;
/**
 * Mixin for "PLC data" exports: tag tables, user data types (UDTs) and
 * watch/force tables, including per-group variants.
 */
function PlcDataBridgeMixin(Base) {
    return class extends Base {
        // ----- Tag tables -----
        async exportTagTables(projectName, deviceId, plcId, exportPath, generateXlsx = false) {
            return this.safeCall('Failed to import tag tables', 'ExportTagTables', { projectName, deviceId, plcId, exportPath, generateXlsx });
        }
        async exportTagTablesFromGroup(projectName, deviceId, plcId, groupName, groupPath, exportPath, generateXlsx = false) {
            return this.safeCall('Failed to import tag tables from group', 'ExportTagTablesFromGroup', { projectName, deviceId, plcId, groupName, groupPath, exportPath, generateXlsx });
        }
        async exportSingleTagTable(projectName, deviceId, plcId, tagTableId, exportPath, generateXlsx = false) {
            return this.safeCall('Failed to import tag table', 'ExportSingleTagTable', { projectName, deviceId, plcId, tagTableId, exportPath, generateXlsx });
        }
        // ----- UDTs -----
        async exportUserDataTypes(projectName, deviceId, plcId, exportPath) {
            return this.safeCall('Failed to import UDTs', 'ExportUserDataTypes', { projectName, deviceId, plcId, exportPath });
        }
        async exportUdtsFromGroup(projectName, deviceId, plcId, groupName, groupPath, exportPath) {
            return this.safeCall('Failed to import UDTs from group', 'ExportUdtsFromGroup', { projectName, deviceId, plcId, groupName, groupPath, exportPath });
        }
        async exportSingleUdt(projectName, deviceId, plcId, udtId, exportPath) {
            return this.safeCall('Failed to import UDT', 'ExportSingleUdt', { projectName, deviceId, plcId, udtId, exportPath });
        }
        // ----- Watch / Force tables -----
        async exportWatchTables(projectName, deviceId, plcId, exportPath) {
            return this.safeCall('Failed to import watch tables', 'ExportWatchTables', { projectName, deviceId, plcId, exportPath });
        }
        async exportWatchTablesFromGroup(projectName, deviceId, plcId, groupName, groupPath, exportPath) {
            return this.safeCall('Failed to import watch tables from group', 'ExportWatchTablesFromGroup', { projectName, deviceId, plcId, groupName, groupPath, exportPath });
        }
        async exportSingleWatchTable(projectName, deviceId, plcId, watchTableId, exportPath) {
            return this.safeCall('Failed to import watch table', 'ExportSingleWatchTable', { projectName, deviceId, plcId, watchTableId, exportPath });
        }
    };
}
//# sourceMappingURL=plcDataBridge.js.map