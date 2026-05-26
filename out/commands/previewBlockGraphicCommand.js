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
exports.previewBlockWithAutomationCompareCommand = previewBlockWithAutomationCompareCommand;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const automationCompareService_1 = require("../services/automationCompare/automationCompareService");
const logger_1 = require("../utils/logger");
const s7dclPreviewMirror_1 = require("../utils/s7dclPreviewMirror");
async function previewBlockWithAutomationCompareCommand(uri, uris) {
    const targetUri = resolveTargetUri(uri, uris);
    if (!targetUri) {
        vscode.window.showWarningMessage('Automation Compare preview: Select a local XML file first.');
        return;
    }
    if (targetUri.scheme !== 'file') {
        vscode.window.showWarningMessage('Automation Compare preview: Only local files are supported.');
        return;
    }
    let previewPath = targetUri.fsPath;
    if (previewPath.toLowerCase().endsWith('.s7dcl')) {
        const s7dclPath = previewPath;
        const mirrored = (0, s7dclPreviewMirror_1.findPreviewXmlForS7dcl)(s7dclPath);
        if (!mirrored) {
            const action = await vscode.window.showWarningMessage('LAD/FBD Preview: No cached XML preview was found for this .s7dcl file.\n\n' +
                'Re-export the block from TIA Portal with SD format while ' +
                '"tiaImport.s7dclPreviewXml.enabled" is on, or switch the export format to XML.', 'Open Settings');
            if (action === 'Open Settings') {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'tiaImport.s7dclPreviewXml');
            }
            return;
        }
        const staleness = (0, s7dclPreviewMirror_1.detectPreviewStaleness)(s7dclPath, mirrored);
        if (staleness.stale) {
            const sourceName = staleness.newerSourcePath
                ? path.basename(staleness.newerSourcePath)
                : path.basename(s7dclPath);
            logger_1.Logger.warn(`LAD/FBD Preview blocked: source "${sourceName}" is newer than cached XML mirror.`, {
                s7dcl: s7dclPath,
                xml: mirrored,
                sourceMtimeMs: staleness.sourceMtimeMs,
                xmlMtimeMs: staleness.xmlMtimeMs
            });
            const message = `LAD/FBD Preview: "${sourceName}" has been modified after the XML preview ` +
                'was generated. The cached mirror is out of date and would not reflect your ' +
                'current changes.\n\n' +
                'Re-export the block from TIA Portal (or import it back and re-export) to ' +
                'refresh the preview.';
            const choice = await vscode.window.showWarningMessage(message, { modal: true }, 'Show Logs', 'Open Stale XML Anyway');
            if (choice === 'Show Logs') {
                logger_1.Logger.show();
                return;
            }
            if (choice !== 'Open Stale XML Anyway') {
                return;
            }
            // User explicitly opted in — fall through and open the stale XML.
        }
        previewPath = mirrored;
    }
    const service = new automationCompareService_1.AutomationCompareService();
    const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Automation Compare preview',
        cancellable: false
    }, async (progress) => {
        progress.report({ message: `Opening ${path.basename(previewPath)}...` });
        return service.openPreview(previewPath);
    });
    if (result.success) {
        if (result.fallbackUsed) {
            // External ACT was launched (native webview unavailable) — keep the
            // notice so the user knows a separate window appeared.
            vscode.window.showInformationMessage(`Automation Compare Tool started externally for ${path.basename(result.filePath)}.`);
        }
        else {
            // Native webview already shows the block — no extra toast needed.
            logger_1.Logger.info(`Automation Compare preview opened: ${result.filePath}`);
        }
        return;
    }
    logger_1.Logger.warn('Automation Compare preview failed', result.error);
    const actions = ['Open Settings', 'Show Logs'];
    const selected = await vscode.window.showErrorMessage(`Automation Compare preview: ${result.error || 'Failed to start Automation Compare Tool.'}`, ...actions);
    if (selected === 'Open Settings') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'tiaImport.automationCompareTool');
    }
    else if (selected === 'Show Logs') {
        logger_1.Logger.show();
    }
}
function resolveTargetUri(uri, uris) {
    if (uris && uris.length > 0) {
        return uris[0];
    }
    return uri;
}
//# sourceMappingURL=previewBlockGraphicCommand.js.map