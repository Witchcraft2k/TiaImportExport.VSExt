"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportToTiaBridgeMixin = ImportToTiaBridgeMixin;
/**
 * Mixin for operations that push data *into* TIA Portal from local files:
 * XML / XLSX imports, Instance DB creation, block-group management,
 * orphaned item cleanup, and compilation.
 */
function ImportToTiaBridgeMixin(Base) {
    return class extends Base {
        /**
         * Clean export caches (IDB source and comparison debug). Call once before batch export.
         */
        async cleanExportCaches(basePath) {
            try {
                await this.callDotNet('CleanExportCaches', { basePath });
            }
            catch {
                // Ignore cleanup errors
            }
        }
        async importXmlFileToTia(deviceId, xmlFilePath, overwriteExisting = true, basePath, compareBeforeImport = false) {
            return this.safeCall('Failed to import XML file to TIA Portal', 'ImportXmlFileToTia', { deviceId, xmlFilePath, overwriteExisting, basePath, compareBeforeImport });
        }
        async importXmlFolderToTia(deviceId, folderPath, overwriteExisting = true, recursive = true) {
            return this.safeCall('Failed to import XML folder to TIA Portal', 'ImportXmlFolderToTia', { deviceId, folderPath, overwriteExisting, recursive });
        }
        /**
         * Import an XML file into a specific Software Unit (PlcUnit / PlcSafetyUnit).
         * `kind` is optional (`'plc'` or `'safety'`) — used to disambiguate when the
         * same name exists in both compositions.
         */
        async importXmlFileToUnit(deviceId, unitName, kind, xmlFilePath, overwriteExisting = true, basePath, compareBeforeImport = false, createMissingUnit = true) {
            return this.safeCall('Failed to import XML file into Software Unit', 'ImportXmlFileToUnit', { deviceId, unitName, kind, xmlFilePath, overwriteExisting, basePath, compareBeforeImport, createMissingUnit });
        }
        /**
         * Import a folder of XML / SCL / s7dcl files into a specific Software Unit.
         */
        async importXmlFolderToUnit(deviceId, unitName, kind, folderPath, overwriteExisting = true, recursive = true, createMissingUnit = true) {
            return this.safeCall('Failed to import XML folder into Software Unit', 'ImportXmlFolderToUnit', { deviceId, unitName, kind, folderPath, overwriteExisting, recursive, createMissingUnit });
        }
        /**
         * Import a complete Software Unit from a local workspace folder into TIA Portal.
         * The folder must contain `_unit.json` and the standard `Program blocks`,
         * `PLC data types`, `PLC tags` subfolders.
         */
        async importUnitToTia(deviceId, unitFolderPath, overwriteExisting = true, compareBeforeImport = false, createMissingUnit = true, deleteOrphans = true) {
            return this.safeCall('Failed to import Software Unit into TIA Portal', 'ImportUnit', { deviceId, unitFolderPath, overwriteExisting, compareBeforeImport, createMissingUnit, deleteOrphans });
        }
        async importXlsxFileToTia(deviceId, xlsxFilePath, overwriteExisting = true, compareBeforeImport = false) {
            return this.safeCall('Failed to import XLSX file to TIA Portal', 'ImportXlsxFileToTia', { deviceId, xlsxFilePath, overwriteExisting, compareBeforeImport });
        }
        async importXlsxFolderToTia(deviceId, folderPath, overwriteExisting = true, compareBeforeImport = false) {
            return this.safeCall('Failed to import XLSX folder to TIA Portal', 'ImportXlsxFolderToTia', { deviceId, folderPath, overwriteExisting, compareBeforeImport });
        }
        /**
         * Create an Instance DB in TIA Portal via CreateInstanceDB API.
         */
        async createInstanceDB(deviceId, instanceDbName, instanceOfName, blockNumber = 0, groupPath) {
            return this.safeCall('Failed to create Instance DB in TIA Portal', 'CreateInstanceDB', { deviceId, instanceDbName, instanceOfName, blockNumber, groupPath });
        }
        /** Create block groups in TIA Portal (for empty folders) */
        async createBlockGroups(deviceId, groupPaths, basePath, unitName, kind, createMissingUnit = true) {
            return this.safeCall('Failed to create block groups in TIA Portal', 'CreateBlockGroups', { deviceId, groupPaths, basePath, unitName, kind, createMissingUnit });
        }
        /** Delete orphaned block groups in TIA Portal (groups that don't exist in local files) */
        async deleteOrphanedBlockGroups(deviceId, localFolderPath, basePath, unitName, kind, createMissingUnit = true) {
            return this.safeCall('Failed to delete orphaned block groups in TIA Portal', 'DeleteOrphanedBlockGroups', { deviceId, localFolderPath, basePath, unitName, kind, createMissingUnit });
        }
        /** Delete orphaned tag tables and groups in TIA Portal */
        async deleteOrphanedTagTables(deviceId, localFolderPath) {
            return this.safeCall('Failed to delete orphaned tag tables in TIA Portal', 'DeleteOrphanedTagTables', { deviceId, localFolderPath });
        }
        /** Delete orphaned UDTs and type groups in TIA Portal */
        async deleteOrphanedTypes(deviceId, localFolderPath) {
            return this.safeCall('Failed to delete orphaned UDTs in TIA Portal', 'DeleteOrphanedTypes', { deviceId, localFolderPath });
        }
        /** Delete orphaned watch tables in TIA Portal */
        async deleteOrphanedWatchTables(deviceId, localFolderPath) {
            return this.safeCall('Failed to delete orphaned watch tables in TIA Portal', 'DeleteOrphanedWatchTables', { deviceId, localFolderPath });
        }
        /**
         * Compile PLC software for a given device in TIA Portal.
         */
        async compileSoftware(deviceId) {
            return this.safeCall('Failed to compile software', 'CompileSoftware', { deviceId });
        }
        /**
         * Dump the full cross-reference table for a PLC software into
         * AI-friendly files inside `outputDirectory`: `cross-references.jsonl`
         * (one JSON record per usage location), flat `cross-references.csv`
         * (RFC 4180, sortable in pandas/Excel) and `unused-symbols.csv`.
         */
        async exportCrossReferences(deviceId, outputDirectory, includeUnused = true, includeMarkdown = true) {
            return this.safeCall('Failed to export cross references', 'ExportCrossReferences', { deviceId, outputDirectory, includeUnused, includeMarkdown });
        }
    };
}
//# sourceMappingURL=importToTiaBridge.js.map