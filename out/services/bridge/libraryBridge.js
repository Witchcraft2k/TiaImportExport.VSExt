"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibraryBridgeMixin = LibraryBridgeMixin;
/**
 * Mixin that adds project library type export calls.
 * Master copies are intentionally not exposed here.
 *
 * Format selection mirrors block / UDT export — see {@link ExportOptions}.
 * For project-library types, only "xml" and "sd" (V20+) have a native
 * representation; "scl" / "db" gracefully fall back to XML on the .NET side.
 */
function LibraryBridgeMixin(Base) {
    return class extends Base {
        /** Export all library types under Project Library &gt; Types. */
        async exportLibraryTypes(projectName, exportPath, options = {}) {
            return this.safeCall('Failed to import library types', 'ExportLibraryTypes', { projectName, exportPath, ...options });
        }
        /** Export a single library folder (recursive) by hierarchical path. */
        async exportLibraryFolder(projectName, folderPath, exportPath, options = {}) {
            return this.safeCall('Failed to import library folder', 'ExportLibraryFolder', { projectName, folderPath, exportPath, ...options });
        }
        /** Export a single library type by parent folder path + type name. */
        async exportLibraryType(projectName, folderPath, typeName, exportPath, options = {}) {
            return this.safeCall('Failed to import library type', 'ExportLibraryType', { projectName, folderPath, typeName, exportPath, ...options });
        }
    };
}
//# sourceMappingURL=libraryBridge.js.map