"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HmiBridgeMixin = HmiBridgeMixin;
/**
 * Mixin that adds HMI export calls (screens, tags, connections, all-in-one).
 */
function HmiBridgeMixin(Base) {
    return class extends Base {
        /** Export all HMI screens from a device */
        async exportHmiScreens(projectName, deviceId, exportPath, options = {}) {
            return this.safeCall('Failed to import HMI screens', 'ExportHmiScreens', { projectName, deviceId, exportPath, ...options });
        }
        /** Export all HMI tags from a device */
        async exportHmiTags(projectName, deviceId, exportPath, options = {}) {
            return this.safeCall('Failed to import HMI tags', 'ExportHmiTags', { projectName, deviceId, exportPath, ...options });
        }
        /** Export all HMI connections from a device */
        async exportHmiConnections(projectName, deviceId, exportPath, options = {}) {
            return this.safeCall('Failed to import HMI connections', 'ExportHmiConnections', { projectName, deviceId, exportPath, ...options });
        }
        /** Export all HMI elements (screens, tags, connections) from a device */
        async exportAllHmi(projectName, deviceId, exportPath, options = {}) {
            return this.safeCall('Failed to import all HMI elements', 'ExportAllHmi', { projectName, deviceId, exportPath, ...options });
        }
    };
}
//# sourceMappingURL=hmiBridge.js.map