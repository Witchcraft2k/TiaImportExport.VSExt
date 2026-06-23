"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitBridgeMixin = UnitBridgeMixin;
const logger_1 = require("../../utils/logger");
/**
 * Mixin for Software Units (V18+) export. Units have their own
 * Program blocks / PLC data types / PLC tags hierarchy and are written to
 * `<deviceExportPath>/Units/<unitName>/`.
 */
function UnitBridgeMixin(Base) {
    return class extends Base {
        async listUnits(deviceId) {
            try {
                return await this.callDotNet('ListUnits', { deviceId });
            }
            catch (e) {
                return { success: false, error: e instanceof Error ? e.message : String(e) };
            }
        }
        async exportUnits(deviceId, exportPath, opts = {}) {
            logger_1.Logger.info(`[UnitBridge] ExportUnits device=${deviceId} format=${opts.format ?? 'xml'} preview=${opts.s7dclPreviewXmlEnabled ?? false}`);
            return this.safeCall('Failed to export Software Units', 'ExportUnits', {
                deviceId,
                exportPath,
                includeComments: opts.includeComments ?? true,
                excludeSystemBlocks: opts.excludeSystemBlocks ?? true,
                format: opts.format ?? 'xml',
                dbExportFormat: opts.dbExportFormat ?? 'xml',
                s7dclPreviewXmlEnabled: opts.s7dclPreviewXmlEnabled ?? false,
                generateXlsx: opts.generateXlsx ?? false
            });
        }
        async exportUnit(deviceId, unitName, kind, exportPath, opts = {}) {
            logger_1.Logger.info(`[UnitBridge] ExportUnit device=${deviceId} unit=${unitName} format=${opts.format ?? 'xml'} preview=${opts.s7dclPreviewXmlEnabled ?? false}`);
            return this.safeCall('Failed to export Software Unit', 'ExportUnit', {
                deviceId,
                unitName,
                kind,
                exportPath,
                includeComments: opts.includeComments ?? true,
                excludeSystemBlocks: opts.excludeSystemBlocks ?? true,
                format: opts.format ?? 'xml',
                dbExportFormat: opts.dbExportFormat ?? 'xml',
                s7dclPreviewXmlEnabled: opts.s7dclPreviewXmlEnabled ?? false,
                generateXlsx: opts.generateXlsx ?? false
            });
        }
    };
}
//# sourceMappingURL=unitBridge.js.map