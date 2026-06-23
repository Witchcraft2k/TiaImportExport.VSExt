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
exports.exportUnitToTiaCommand = exportUnitToTiaCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../../utils/logger");
const exportDialogs_1 = require("./exportDialogs");
const compileHelper_1 = require("./compileHelper");
const exportUtils_1 = require("./exportUtils");
/**
 * Read the `_unit.json` metadata file inside a Software Unit folder.
 */
function readUnitMetadata(unitFolderPath) {
    const metadataPath = path.join(unitFolderPath, '_unit.json');
    if (!fs.existsSync(metadataPath)) {
        return undefined;
    }
    try {
        const content = fs.readFileSync(metadataPath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return undefined;
    }
}
/**
 * Validate that the selected folder looks like a Software Unit export:
 * contains `_unit.json` with a name and at least one of the standard subfolders.
 */
function validateUnitFolder(folderPath) {
    const metadata = readUnitMetadata(folderPath);
    if (!metadata?.name) {
        return { valid: false, reason: 'Selected folder is not a Software Unit export: missing or invalid _unit.json' };
    }
    const hasBlocks = fs.existsSync(path.join(folderPath, 'Program blocks'));
    const hasTypes = fs.existsSync(path.join(folderPath, 'PLC data types'));
    const hasTags = fs.existsSync(path.join(folderPath, 'PLC tags'));
    if (!hasBlocks && !hasTypes && !hasTags) {
        return { valid: false, reason: 'Selected folder does not contain Program blocks, PLC data types or PLC tags subfolders' };
    }
    return { valid: true, metadata };
}
/**
 * Export a complete Software Unit from a local workspace folder into TIA Portal.
 *
 * The folder must follow the layout produced by `tia-import.importSoftwareUnit`:
 *   Units/<UnitName>/_unit.json
 *   Units/<UnitName>/Program blocks/
 *   Units/<UnitName>/PLC data types/
 *   Units/<UnitName>/PLC tags/
 */
async function exportUnitToTiaCommand(connectionService, uri) {
    try {
        if (!await (0, exportDialogs_1.ensureConnection)(connectionService)) {
            return;
        }
        const folderPath = await (0, exportDialogs_1.resolveFolderPath)(uri, 'Select Software Unit folder to export to TIA Portal');
        if (!folderPath) {
            return;
        }
        const validation = validateUnitFolder(folderPath);
        if (!validation.valid) {
            vscode.window.showWarningMessage(`Export Software Unit: ${validation.reason}`);
            return;
        }
        const { metadata } = validation;
        const unitName = metadata.name;
        const devices = (0, exportDialogs_1.validateProjectPlcDevices)(connectionService);
        if (!devices) {
            return;
        }
        const selectedDevice = await (0, exportDialogs_1.pickDevice)(devices, 'Export Software Unit to TIA Portal');
        if (!selectedDevice) {
            return;
        }
        const overwriteMode = await (0, exportDialogs_1.pickOverwriteMode)('Export Software Unit to TIA Portal');
        if (!overwriteMode) {
            return;
        }
        logger_1.Logger.section('EXPORT SOFTWARE UNIT TO TIA PORTAL');
        logger_1.Logger.info(`Unit: ${unitName}`);
        logger_1.Logger.info(`Kind: ${metadata.kind ?? 'plc'}`);
        logger_1.Logger.info(`Folder: ${folderPath}`);
        logger_1.Logger.info(`Device: ${selectedDevice.label}`);
        logger_1.Logger.info(`Mode: ${overwriteMode.forceOverwrite ? 'Overwrite all' : 'Check and overwrite differences'}`);
        const exportSuccess = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Export Software Unit to TIA Portal',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: `Exporting ${unitName}...` });
            const operationLabel = `Export Software Unit: ${unitName}`;
            logger_1.Logger.startOperation(operationLabel);
            const bridge = connectionService.getBridge();
            const result = await bridge.importUnitToTia(selectedDevice.deviceId, folderPath, true, overwriteMode.compareBeforeImport, true, true);
            if (result.messages && result.messages.length > 0) {
                logger_1.Logger.logExportMessages(result.messages);
            }
            const successCount = result.successCount ?? 0;
            const errorCount = result.errorCount ?? 0;
            const skippedCount = result.skippedCount ?? 0;
            (0, exportUtils_1.reportExportSummary)(successCount, errorCount, skippedCount, operationLabel, 'Export Software Unit to TIA Portal');
            return result.success && errorCount === 0;
        });
        if (exportSuccess && await (0, compileHelper_1.shouldCompileAfterExport)()) {
            await (0, compileHelper_1.compileAndShowResults)(connectionService, selectedDevice.deviceId, selectedDevice.label);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Error exporting Software Unit to TIA Portal:', error);
        logger_1.Logger.show();
        vscode.window.showErrorMessage(`Export Software Unit to TIA Portal: ${message}`);
    }
}
//# sourceMappingURL=exportUnitToTia.js.map