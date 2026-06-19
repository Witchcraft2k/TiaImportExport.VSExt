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
exports.openAutomationComparePreviewPanel = openAutomationComparePreviewPanel;
exports.openAutomationCompareWebviewForCompare = openAutomationCompareWebviewForCompare;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const logger_1 = require("../../utils/logger");
const assetRootLocator_1 = require("./preview/assetRootLocator");
const previewHtmlBuilder_1 = require("./preview/previewHtmlBuilder");
const networkXmlEditor_1 = require("./networkXmlEditor");
/**
 * Track the editor column that currently hosts ACT preview tabs so that any
 * subsequent preview lands as another tab in the same group instead of being
 * pushed into a brand-new split next to the active editor.
 */
let lastPreviewColumn;
async function openAutomationComparePreviewPanel(toolPath, filePath) {
    const assetRoot = await (0, assetRootLocator_1.findAutomationCompareAssetRoot)(toolPath);
    if (!assetRoot) {
        return {
            success: false,
            filePath,
            error: 'ACT renderer files were not found next to the configured Automation Compare Tool executable.'
        };
    }
    let content;
    try {
        content = await fs.promises.readFile(filePath, 'utf8');
    }
    catch (error) {
        return {
            success: false,
            filePath,
            assetRoot,
            error: error instanceof Error ? error.message : String(error)
        };
    }
    const filePayload = {
        fileName: path.basename(filePath),
        filePath,
        content,
        isValidFileType: true
    };
    return openPanelWithPayloads(assetRoot, filePath, filePayload, undefined, filePayload.fileName, undefined);
}
/**
 * Open the ACT renderer inside a VS Code webview panel in COMPARE mode (two
 * files side-by-side). Both file contents are inlined into the webview
 * payload — ACT's Angular app reads them through `remote.getGlobal('leftFile'
 * | 'rightFile' | 'title1' | 'title2')` and renders the graphical diff.
 */
async function openAutomationCompareWebviewForCompare(toolPath, input) {
    const assetRoot = await (0, assetRootLocator_1.findAutomationCompareAssetRoot)(toolPath);
    if (!assetRoot) {
        return {
            success: false,
            filePath: input.leftFilePath,
            error: 'ACT renderer files were not found next to the configured Automation Compare Tool executable.'
        };
    }
    let leftContent;
    let rightContent;
    try {
        [leftContent, rightContent] = await Promise.all([
            fs.promises.readFile(input.leftFilePath, 'utf8'),
            fs.promises.readFile(input.rightFilePath, 'utf8')
        ]);
    }
    catch (error) {
        return {
            success: false,
            filePath: input.leftFilePath,
            assetRoot,
            error: error instanceof Error ? error.message : String(error)
        };
    }
    const leftPayload = {
        fileName: path.basename(input.leftFilePath),
        filePath: input.leftFilePath,
        content: leftContent,
        isValidFileType: true
    };
    const rightPayload = {
        fileName: path.basename(input.rightFilePath),
        filePath: input.rightFilePath,
        content: rightContent,
        isValidFileType: true
    };
    return openPanelWithPayloads(assetRoot, input.leftFilePath, leftPayload, rightPayload, input.leftTitle || leftPayload.fileName, input.rightTitle || rightPayload.fileName);
}
async function openPanelWithPayloads(assetRoot, primaryFilePath, leftPayload, rightPayload, leftTitle, rightTitle) {
    const filePayload = leftPayload;
    const filePath = primaryFilePath;
    const isCompare = Boolean(rightPayload);
    const panelTitle = isCompare
        ? `ACT diff: ${leftTitle} ↔ ${rightTitle}`
        : `ACT: ${path.basename(filePath)}`;
    const targetColumn = lastPreviewColumn ?? vscode.ViewColumn.Beside;
    const panel = vscode.window.createWebviewPanel('tiaAutomationComparePreview', panelTitle, targetColumn, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(assetRoot)]
    });
    lastPreviewColumn = panel.viewColumn ?? targetColumn;
    panel.onDidChangeViewState(event => {
        if (event.webviewPanel.viewColumn) {
            lastPreviewColumn = event.webviewPanel.viewColumn;
        }
    });
    panel.onDidDispose(() => {
        // Keep the remembered column so the *next* preview still opens in the
        // same group; reset only when no preview tabs remain. There is no
        // direct VS Code API to list peer panels, so we rely on the next
        // openAutomationComparePreviewPanel call to overwrite the value.
    });
    panel.webview.onDidReceiveMessage(async (message) => {
        if (!message || typeof message !== 'object') {
            return;
        }
        if (message.type === 'viewFileInExplorer' && typeof message.filePath === 'string') {
            await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(message.filePath));
            return;
        }
        if (message.type === 'updateTitle') {
            const title = typeof message.title === 'string' && message.title.trim()
                ? message.title.trim()
                : path.basename(filePath);
            // In compare mode keep the dual-title header set by the caller;
            // only single-file previews react to ACT's runtime title updates.
            if (!isCompare) {
                panel.title = `ACT: ${title}`;
            }
            return;
        }
        if (message.type === 'removeNetwork') {
            if (isCompare) {
                // Editing only allowed in single-file preview mode.
                return;
            }
            const networkIndex = Number(message.networkIndex);
            if (!Number.isInteger(networkIndex) || networkIndex < 1) {
                return;
            }
            const confirm = await vscode.window.showWarningMessage(`Remove network ${networkIndex} from "${path.basename(filePath)}"?`, { modal: true, detail: 'This rewrites the SimaticML XML file on disk. Remaining networks are NOT renumbered.' }, 'Remove');
            if (confirm !== 'Remove') {
                return;
            }
            try {
                const currentContent = await fs.promises.readFile(filePath, 'utf8');
                const result = (0, networkXmlEditor_1.removeNetworkFromBlockXml)(currentContent, networkIndex);
                await fs.promises.writeFile(filePath, result.updatedContent, 'utf8');
                logger_1.Logger.success(`Removed network ${networkIndex} from ${filePath} (was ${result.totalNetworks} network(s), now ${result.totalNetworks - 1}).`);
                // Rebuild the webview with the updated content. We keep the
                // panel object — only its HTML is regenerated.
                filePayload.content = result.updatedContent;
                panel.webview.html = (0, previewHtmlBuilder_1.buildAutomationCompareHtml)(panel.webview, assetRoot, filePayload, rightPayload, leftTitle, rightTitle);
            }
            catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                logger_1.Logger.error(`Failed to remove network ${networkIndex} from ${filePath}: ${detail}`);
                vscode.window.showErrorMessage(`Failed to remove network ${networkIndex}: ${detail}`);
            }
            return;
        }
        if (message.type === 'clearNetworkLogic') {
            if (isCompare) {
                return;
            }
            const networkIndex = Number(message.networkIndex);
            if (!Number.isInteger(networkIndex) || networkIndex < 1) {
                return;
            }
            const confirm = await vscode.window.showWarningMessage(`Clear logic in network ${networkIndex} of "${path.basename(filePath)}"?`, { modal: true, detail: 'The network envelope (title, comment, programming language) is preserved; only its <NetworkSource> body is emptied.' }, 'Clear logic');
            if (confirm !== 'Clear logic') {
                return;
            }
            try {
                const currentContent = await fs.promises.readFile(filePath, 'utf8');
                const result = (0, networkXmlEditor_1.clearNetworkLogic)(currentContent, networkIndex);
                if (!result.changed) {
                    logger_1.Logger.info(`Network ${networkIndex} in ${filePath} already has empty logic — nothing to clear.`);
                    return;
                }
                await fs.promises.writeFile(filePath, result.updatedContent, 'utf8');
                logger_1.Logger.success(`Cleared logic in network ${networkIndex} of ${filePath}.`);
                filePayload.content = result.updatedContent;
                panel.webview.html = (0, previewHtmlBuilder_1.buildAutomationCompareHtml)(panel.webview, assetRoot, filePayload, rightPayload, leftTitle, rightTitle);
            }
            catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                logger_1.Logger.error(`Failed to clear logic in network ${networkIndex} of ${filePath}: ${detail}`);
                vscode.window.showErrorMessage(`Failed to clear logic in network ${networkIndex}: ${detail}`);
            }
            return;
        }
        if (message.type === 'openNetworkInXml') {
            const networkIndex = Number(message.networkIndex);
            if (!Number.isInteger(networkIndex) || networkIndex < 1) {
                return;
            }
            // In compare mode we open the LEFT (primary) file — the right
            // file is typically a git-revision snapshot in %TEMP%.
            const targetPath = filePath;
            try {
                const currentContent = await fs.promises.readFile(targetPath, 'utf8');
                const position = (0, networkXmlEditor_1.findCompileUnitPosition)(currentContent, networkIndex);
                const document = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
                const editor = await vscode.window.showTextDocument(document, {
                    preview: false,
                    viewColumn: vscode.ViewColumn.Beside
                });
                if (position) {
                    const line = Math.max(0, position.line - 1);
                    const col = Math.max(0, position.column - 1);
                    const target = new vscode.Position(line, col);
                    editor.selection = new vscode.Selection(target, target);
                    editor.revealRange(new vscode.Range(target, target), vscode.TextEditorRevealType.InCenter);
                }
                else {
                    logger_1.Logger.warn(`Network ${networkIndex} not found in ${targetPath}; opened file without jumping.`);
                }
            }
            catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                logger_1.Logger.error(`Failed to open network ${networkIndex} in ${targetPath}: ${detail}`);
                vscode.window.showErrorMessage(`Failed to open network ${networkIndex} in XML: ${detail}`);
            }
            return;
        }
        if (message.type === 'actLog') {
            logger_1.Logger.debug(`ACT webview: ${message.message ?? ''}`);
        }
        if (message.type === 'actError') {
            logger_1.Logger.error(`ACT webview: ${message.message ?? 'Renderer error'}`, message.detail);
        }
    });
    panel.webview.html = (0, previewHtmlBuilder_1.buildAutomationCompareHtml)(panel.webview, assetRoot, filePayload, rightPayload, leftTitle, rightTitle);
    logger_1.Logger.success(isCompare
        ? `Automation Compare Tool diff opened in VS Code panel: ${leftPayload.filePath} ↔ ${rightPayload.filePath}`
        : `Automation Compare Tool preview opened in VS Code panel: ${filePath}`);
    return {
        success: true,
        filePath,
        assetRoot
    };
}
//# sourceMappingURL=automationComparePreviewPanel.js.map