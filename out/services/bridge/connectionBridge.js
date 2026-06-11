"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionBridgeMixin = ConnectionBridgeMixin;
const logger_1 = require("../../utils/logger");
/**
 * Mixin that adds TIA Portal connection / project management calls to the
 * bridge (connect, disconnect, ping, list projects, select project,
 * fetch project structure).
 */
function ConnectionBridgeMixin(Base) {
    return class extends Base {
        /**
         * Ping TIA Portal to verify connection is alive.
         * Returns true if connection is healthy, false otherwise.
         * Uses a 5-second timeout.
         */
        async ping() {
            try {
                const result = await this.callDotNet('Ping', {}, 5000);
                return result?.success === true;
            }
            catch (error) {
                logger_1.Logger.warn('Bridge: Ping failed - connection may be broken', error);
                return false;
            }
        }
        /**
         * Connect to TIA Portal
         */
        async connect() {
            return this.safeCall('Failed to connect', 'Connect');
        }
        /**
         * Disconnect from TIA Portal
         */
        async disconnect() {
            try {
                await this.callDotNet('Disconnect');
            }
            catch (error) {
                logger_1.Logger.error('Bridge: Failed to disconnect', error);
            }
        }
        /**
         * Detach from TIA Portal without closing it.
         *
         * Used when VS Code is shutting down but the user should be left with
         * TIA Portal still running (e.g. TIA was started by VS Code via the
         * project file dialog). Unlike `disconnect`, this never calls
         * `TiaPortal.Dispose()` on the .NET side.
         */
        async detach() {
            try {
                await this.callDotNet('Detach', {}, 5000);
            }
            catch (error) {
                logger_1.Logger.warn('Bridge: Failed to detach cleanly (ignored during shutdown)', error);
            }
        }
        /**
         * Get list of open projects
         */
        async getProjects() {
            return this.safeCall('Failed to get projects', 'GetProjects');
        }
        /**
         * Open a TIA project by file path without showing a project picker.
         */
        async openProject(filePath) {
            return this.safeCall('Failed to open project', 'OpenProject', { filePath });
        }
        /**
         * Select a project
         */
        async selectProject(projectName) {
            return this.safeCall('Failed to select project', 'SelectProject', { projectName });
        }
        /**
         * Get project structure
         */
        async getProjectStructure(projectName) {
            return this.safeCall('Failed to get project structure', 'GetProjectStructure', { projectName });
        }
    };
}
//# sourceMappingURL=connectionBridge.js.map