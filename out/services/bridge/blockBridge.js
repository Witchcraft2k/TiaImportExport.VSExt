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
exports.BlockBridgeMixin = BlockBridgeMixin;
const fs = __importStar(require("fs"));
const logger_1 = require("../../utils/logger");
const s7dclPreviewMirror_1 = require("../../utils/s7dclPreviewMirror");
/**
 * Mixin that adds PLC program block export calls (ExportBlock*, ExportBlockGroup*).
 */
function BlockBridgeMixin(Base) {
    return class extends Base {
        /** Export all blocks from a PLC */
        async exportBlocks(projectName, deviceId, plcId, exportPath, options = {}) {
            const result = await this.safeCall('Failed to import blocks', 'ExportBlocks', { projectName, deviceId, plcId, exportPath, ...options });
            await this.mirrorXmlPreview(exportPath, options, mirroredPath => this.safeCall('Failed to mirror XML preview for blocks', 'ExportBlocks', { projectName, deviceId, plcId, exportPath: mirroredPath, ...options, format: 'xml' }));
            return result;
        }
        /** Export a single block */
        async exportBlock(projectName, deviceId, blockId, exportPath, options = {}) {
            const result = await this.safeCall('Failed to import block', 'ExportBlock', { projectName, deviceId, blockId, exportPath, ...options });
            await this.mirrorXmlPreview(exportPath, options, mirroredPath => this.safeCall('Failed to mirror XML preview for block', 'ExportBlock', { projectName, deviceId, blockId, exportPath: mirroredPath, ...options, format: 'xml' }));
            return result;
        }
        /** Export a single block with path preservation */
        async exportBlockWithPath(projectName, deviceId, blockId, groupPath, exportPath, options = {}) {
            const result = await this.safeCall('Failed to import block with path', 'ExportBlockWithPath', { projectName, deviceId, blockId, groupPath, exportPath, ...options });
            await this.mirrorXmlPreview(exportPath, options, mirroredPath => this.safeCall('Failed to mirror XML preview for block (with path)', 'ExportBlockWithPath', { projectName, deviceId, blockId, groupPath, exportPath: mirroredPath, ...options, format: 'xml' }));
            return result;
        }
        /** Export a block group (folder) with all blocks */
        async exportBlockGroup(projectName, deviceId, plcId, groupId, exportPath, options = {}) {
            const result = await this.safeCall('Failed to import block group', 'ExportBlockGroup', { projectName, deviceId, plcId, groupId, exportPath, ...options });
            await this.mirrorXmlPreview(exportPath, options, mirroredPath => this.safeCall('Failed to mirror XML preview for block group', 'ExportBlockGroup', { projectName, deviceId, plcId, groupId, exportPath: mirroredPath, ...options, format: 'xml' }));
            return result;
        }
        /** Export a block group with path preservation */
        async exportBlockGroupWithPath(projectName, deviceId, plcId, groupId, groupName, groupPath, exportPath, options = {}) {
            const result = await this.safeCall('Failed to import block group with path', 'ExportBlockGroupWithPath', { projectName, deviceId, plcId, groupId, groupName, groupPath, exportPath, ...options });
            await this.mirrorXmlPreview(exportPath, options, mirroredPath => this.safeCall('Failed to mirror XML preview for block group (with path)', 'ExportBlockGroupWithPath', { projectName, deviceId, plcId, groupId, groupName, groupPath, exportPath: mirroredPath, ...options, format: 'xml' }));
            return result;
        }
        /**
         * When the user requested SD format and the preview-mirror feature is
         * enabled, re-run the same export call into a parallel `.tiaPreview/`
         * tree using XML format. Failures are logged and never surfaced to the
         * caller — preview is best-effort.
         *
         * NOTE: marked `public` to satisfy the TS4094 mixin constraint; treat
         * as internal — call only from sibling export methods on this mixin.
         */
        async mirrorXmlPreview(exportPath, options, runMirrorCall) {
            if (options.format !== 'sd') {
                return;
            }
            if (!(0, s7dclPreviewMirror_1.isS7dclPreviewMirrorEnabled)()) {
                return;
            }
            const mirrored = (0, s7dclPreviewMirror_1.getMirrorExportPath)(exportPath);
            if (!mirrored) {
                return;
            }
            try {
                fs.mkdirSync(mirrored, { recursive: true });
                const result = await runMirrorCall(mirrored);
                if (!result?.success) {
                    logger_1.Logger.warn('SD → XML preview mirror reported failure', result?.error);
                }
            }
            catch (error) {
                logger_1.Logger.warn('SD → XML preview mirror skipped due to error', error);
            }
        }
    };
}
//# sourceMappingURL=blockBridge.js.map