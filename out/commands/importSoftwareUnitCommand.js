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
exports.importSoftwareUnitCommand = importSoftwareUnitCommand;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const workspace_1 = require("../utils/workspace");
const tiaApi_1 = require("../api/tiaApi");
/**
 * Import a single Software Unit (PlcUnit or PlcSafetyUnit) from TIA Portal.
 *
 * Triggered from the tree context menu on a `softwareUnit` node. Routes to
 * `TiaApi.exportUnit`, which writes the unit's blocks / UDTs / tag tables
 * under `<workspace>/TiaExport/Projects/<Proj>/Devices/<Cat>/<Device>/Units/<UnitName>/`.
 */
async function importSoftwareUnitCommand(importService, item) {
    try {
        if (!await workspace_1.WorkspaceManager.ensureWorkspace()) {
            return;
        }
        if (!await importService.ensureConnected()) {
            return;
        }
        if (!item) {
            logger_1.Logger.warn('Import software unit failed - no unit selected');
            vscode.window.showWarningMessage('Import from TiaPortal: No software unit selected');
            return;
        }
        const unit = item.metadata?.unit;
        const plcId = item.metadata?.plcId;
        if (!unit || !plcId) {
            logger_1.Logger.warn('Import software unit failed - missing unit metadata');
            vscode.window.showWarningMessage('Import from TiaPortal: Could not resolve unit metadata');
            return;
        }
        const projectName = importService.getCurrentProjectName();
        if (!projectName) {
            vscode.window.showWarningMessage('Import from TiaPortal: No project selected');
            return;
        }
        // plcId is "{deviceId}/{plcId}" - the device id is the first segment.
        const deviceId = plcId.split('/')[0] || plcId;
        logger_1.Logger.section(`IMPORT SOFTWARE UNIT: ${unit.name}`);
        logger_1.Logger.info(`Project: ${projectName}`);
        logger_1.Logger.info(`Device: ${deviceId}`);
        logger_1.Logger.info(`Unit kind: ${unit.kind}`);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Import from TiaPortal',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: `Importing software unit: ${unit.name}...` });
            logger_1.Logger.startOperation(`Import software unit: ${unit.name}`);
            const api = (0, tiaApi_1.getTiaApi)();
            const res = await api.exportUnit(deviceId, unit.name, unit.kind);
            if (res.success) {
                logger_1.Logger.success(`Software unit imported: ${unit.name}`);
                logger_1.Logger.endOperation(`Import software unit: ${unit.name}`, true);
                vscode.window.showInformationMessage(`Import from TiaPortal: Software unit "${unit.name}" imported`);
            }
            else {
                logger_1.Logger.endOperation(`Import software unit: ${unit.name}`, false);
                throw new Error(res.error || 'Software unit import failed');
            }
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Failed to import software unit', error);
        vscode.window.showErrorMessage(`Import from TiaPortal: ${message}`);
    }
}
//# sourceMappingURL=importSoftwareUnitCommand.js.map