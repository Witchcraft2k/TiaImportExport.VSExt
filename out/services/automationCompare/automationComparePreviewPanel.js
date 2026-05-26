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
/**
 * Track the editor column that currently hosts ACT preview tabs so that any
 * subsequent preview lands as another tab in the same group instead of being
 * pushed into a brand-new split next to the active editor.
 */
let lastPreviewColumn;
async function openAutomationComparePreviewPanel(toolPath, filePath) {
    const assetRoot = await findAutomationCompareAssetRoot(toolPath);
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
    const assetRoot = await findAutomationCompareAssetRoot(toolPath);
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
        if (message.type === 'actLog') {
            logger_1.Logger.debug(`ACT webview: ${message.message ?? ''}`);
        }
        if (message.type === 'actError') {
            logger_1.Logger.error(`ACT webview: ${message.message ?? 'Renderer error'}`, message.detail);
        }
    });
    panel.webview.html = buildAutomationCompareHtml(panel.webview, assetRoot, filePayload, rightPayload, leftTitle, rightTitle);
    logger_1.Logger.success(isCompare
        ? `Automation Compare Tool diff opened in VS Code panel: ${leftPayload.filePath} ↔ ${rightPayload.filePath}`
        : `Automation Compare Tool preview opened in VS Code panel: ${filePath}`);
    return {
        success: true,
        filePath,
        assetRoot
    };
}
async function findAutomationCompareAssetRoot(toolPath) {
    const executableDir = path.dirname(toolPath);
    const directCandidate = path.join(executableDir, 'resources', 'app', 'dist', 'ACT');
    if (await isDirectoryWithActBundle(directCandidate)) {
        return directCandidate;
    }
    const versionedCandidate = await findVersionedAssetRoot(executableDir);
    if (versionedCandidate) {
        return versionedCandidate;
    }
    const parentVersionedCandidate = await findVersionedAssetRoot(path.dirname(executableDir));
    if (parentVersionedCandidate) {
        return parentVersionedCandidate;
    }
    return undefined;
}
async function findVersionedAssetRoot(root) {
    let entries;
    try {
        entries = await fs.promises.readdir(root, { withFileTypes: true });
    }
    catch {
        return undefined;
    }
    const appDirectories = entries
        .filter(entry => entry.isDirectory() && /^app-/i.test(entry.name))
        .map(entry => entry.name)
        .sort((left, right) => right.localeCompare(left, undefined, { numeric: true, sensitivity: 'base' }));
    for (const directory of appDirectories) {
        const candidate = path.join(root, directory, 'resources', 'app', 'dist', 'ACT');
        if (await isDirectoryWithActBundle(candidate)) {
            return candidate;
        }
    }
    return undefined;
}
async function isDirectoryWithActBundle(directory) {
    try {
        const stats = await fs.promises.stat(directory);
        if (!stats.isDirectory()) {
            return false;
        }
        await Promise.all([
            fs.promises.access(path.join(directory, 'index.html'), fs.constants.R_OK),
            fs.promises.access(path.join(directory, 'main.js'), fs.constants.R_OK),
            fs.promises.access(path.join(directory, 'polyfills.js'), fs.constants.R_OK),
            fs.promises.access(path.join(directory, 'styles.css'), fs.constants.R_OK)
        ]);
        return true;
    }
    catch {
        return false;
    }
}
function buildAutomationCompareHtml(webview, assetRoot, filePayload, rightPayload, leftTitle, rightTitle) {
    const nonce = createNonce();
    const baseUri = withTrailingSlash(webview.asWebviewUri(vscode.Uri.file(assetRoot)).toString());
    const stylesUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetRoot, 'styles.css')));
    const polyfillsUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetRoot, 'polyfills.js')));
    const mainUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetRoot, 'main.js')));
    const faviconUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetRoot, 'favicon.ico')));
    const assetBaseUri = withTrailingSlash(webview.asWebviewUri(vscode.Uri.file(path.join(assetRoot, 'assets'))).toString());
    const leftPayloadJson = safeScriptJson(filePayload);
    const rightPayloadJson = safeScriptJson(rightPayload ?? null);
    const leftTitleJson = safeScriptJson(leftTitle);
    const rightTitleJson = safeScriptJson(rightTitle ?? null);
    const bodyClass = hasFailSafeLogicPayload(filePayload, rightPayload)
        ? ' class="act-preview-fail-safe-logic"'
        : '';
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-eval'; connect-src ${webview.cspSource};">
  <base href="./">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="${faviconUri}">
  <link rel="stylesheet" href="${stylesUri}">
  <style nonce="${nonce}">
    :root {
      --act-preview-bg: var(--vscode-editor-background, #1e1e1e);
      --act-preview-fg: var(--vscode-editor-foreground, #cccccc);
      --act-preview-muted-fg: var(--vscode-descriptionForeground, #8c8c8c);
      --act-preview-panel-bg: var(--vscode-sideBar-background, var(--vscode-editor-background, #252526));
      --act-preview-toolbar-bg: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-sideBar-background, var(--vscode-editor-background, #252526)));
      --act-preview-input-bg: var(--vscode-input-background, var(--vscode-editor-background, #1e1e1e));
      --act-preview-input-fg: var(--vscode-input-foreground, var(--vscode-editor-foreground, #cccccc));
      --act-preview-button-bg: var(--vscode-button-background, var(--vscode-button-secondaryBackground, var(--vscode-editorWidget-background, #0e639c)));
      --act-preview-button-fg: var(--vscode-button-foreground, var(--vscode-button-secondaryForeground, #ffffff));
      --act-preview-button-hover-bg: var(--vscode-button-hoverBackground, var(--vscode-button-secondaryHoverBackground, var(--act-preview-button-bg)));
      --act-preview-border: var(--vscode-panel-border, var(--vscode-editorWidget-border, rgba(127, 127, 127, 0.35)));
      --act-preview-focus-border: var(--vscode-focusBorder, rgba(127, 127, 127, 0.55));
      --act-preview-error: var(--vscode-errorForeground, #f14c4c);
      --act-document-bg: var(--vscode-editor-background, #1e1e1e);
      --act-document-surface: var(--vscode-editorWidget-background, var(--vscode-editor-background, #252526));
      --act-document-fg: var(--vscode-editor-foreground, #cccccc);
      --act-document-muted-fg: var(--vscode-descriptionForeground, #8c8c8c);
      --act-document-border: var(--vscode-panel-border, var(--vscode-editorWidget-border, rgba(127, 127, 127, 0.35)));
      --act-document-header-bg: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-sideBar-background, var(--act-document-surface)));
      --act-document-header-fg: var(--vscode-foreground, var(--act-document-fg));
      --act-fail-safe-logic-line: var(--vscode-charts-yellow, #ffcc00);
      /* ACT Angular components use these CSS custom properties — point them at VS Code theme colors. */
      --font-color: var(--act-document-fg);
      --background-color: var(--act-document-bg);
      --body-background-color: var(--act-document-bg);
      --separator-color: var(--act-document-border);
      --default-color: var(--vscode-list-activeSelectionBackground, var(--act-document-surface));
      color-scheme: light dark;
    }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: var(--act-preview-bg) !important; color: var(--act-preview-fg) !important; font-family: var(--vscode-font-family, Segoe UI, Arial, sans-serif) !important; }
    app-root { display: block; width: 100%; height: 100%; overflow: auto; background: var(--act-preview-bg) !important; color: var(--act-preview-fg) !important; }
    app-root * { scrollbar-color: var(--vscode-scrollbarSlider-background, rgba(127, 127, 127, 0.4)) transparent; }
    app-root status-bar,
    app-root [class*="status-bar"],
    app-root [class*="split-gutter"],
    app-root as-split-gutter,
    app-root .as-split-gutter { background-color: var(--act-preview-toolbar-bg) !important; color: var(--act-preview-fg) !important; border-color: var(--act-preview-border) !important; }
    app-root status-bar .status-title,
    app-root [class*="status-title"] { color: var(--act-preview-muted-fg) !important; }
    app-root app-codeblock-export-view-frame,
    app-root app-codeblock-view,
    app-root app-codeblock-export-view,
    app-root app-datablock-view,
    app-root app-tag-table-view,
    app-root app-udt-view,
    app-root blockinterface-view,
    app-root codeblock-content-view,
    app-root codeblock-attributelist-view,
    app-root network-view,
    app-root overview-container,
    app-root status-container,
    app-root side-panel-split,
    app-root side-panel-view-selection,
    app-root settings-selection,
    app-root table-container,
    app-root .group,
    app-root .content-view,
    app-root .block-interface,
    app-root .attributes { background-color: var(--act-document-bg) !important; color: var(--act-document-fg) !important; }
    /* ACT renders headings, columns, rows, cells, sections etc. as Angular CSS classes / IDs with hard-coded light backgrounds. */
    app-root .heading,
    app-root .column,
    app-root .parent,
    app-root .group,
    app-root .multilingual-row,
    app-root .cell,
    app-root .container,
    app-root .table-container,
    app-root .section,
    app-root section,
    app-root #overview-container,
    app-root #side-panel-split,
    app-root #side-panel-view-selection,
    app-root #status-container,
    app-root #overview-selection,
    app-root #settings-selection { background-color: var(--act-document-bg) !important; color: var(--act-document-fg) !important; border-color: var(--act-document-border) !important; }
    app-root .heading { background: var(--act-document-header-bg) !important; color: var(--act-document-header-fg) !important; }
    app-root .section-info { color: var(--act-document-fg) !important; }
    app-root .as-split-gutter,
    app-root as-split-gutter { background-color: var(--act-preview-toolbar-bg) !important; }
    app-root #side-panel-view-selection .active,
    app-root .active { background-color: var(--vscode-list-activeSelectionBackground, var(--act-preview-button-bg)) !important; color: var(--vscode-list-activeSelectionForeground, var(--act-preview-button-fg)) !important; }
    /* ACT bottom tabs (Overview / Options) and similar segmented controls. */
    app-root .tab { background-color: var(--act-preview-toolbar-bg) !important; border: 1px solid var(--act-document-border) !important; }
    app-root .tab button { background-color: transparent !important; color: var(--act-preview-fg) !important; }
    app-root .tab button:hover { background-color: var(--vscode-list-hoverBackground, var(--act-preview-button-hover-bg)) !important; color: var(--vscode-list-hoverForeground, var(--act-preview-fg)) !important; }
    app-root .tab button.active { background-color: var(--vscode-list-activeSelectionBackground, var(--act-preview-button-bg)) !important; color: var(--vscode-list-activeSelectionForeground, var(--act-preview-button-fg)) !important; }
    app-root .tabcontent { background-color: var(--act-document-bg) !important; color: var(--act-document-fg) !important; border-color: var(--act-document-border) !important; }
    /* Generic table cells (Interface columns, attributes table). */
    app-root table { border-collapse: collapse !important; }
    app-root th,
    app-root td { background: var(--act-document-bg) !important; color: var(--act-document-fg) !important; border: 1px solid var(--act-document-border) !important; }
    app-root th { background: var(--act-document-header-bg) !important; color: var(--act-document-header-fg) !important; font-weight: 600 !important; }
    /* default-background sits inside cells; give it a faint surface tint so structure is visible without washing out text. */
    app-root .default-background { background-color: var(--act-document-surface) !important; color: var(--act-document-fg) !important; }
    /* ACT inlines style="background-color: rgb(217,217,217)" on alternating overview rows — beat it with !important. */
    app-root .overview-node,
    app-root .overview-node[id^="overview-"],
    app-root [id^="overview-interface-"],
    app-root [id^="overview-network-"] { background-color: var(--act-document-bg) !important; color: var(--act-document-fg) !important; }
    app-root .overview-node.title,
    app-root #overview-title,
    app-root #options-title { background-color: var(--act-document-header-bg) !important; color: var(--act-document-header-fg) !important; font-weight: 600 !important; }
    /* Sidebar entries (Input / Output / Network 1-N / Attributes etc.) — boost specificity beyond ACTs scoped .disabled rule (0,2,0). */
    body app-root .disabled,
    body app-root [class*="disabled"],
    body .disabled,
    body [class*="disabled"] { color: var(--vscode-foreground, var(--act-document-fg)) !important; opacity: 1 !important; }
    /* network-view + LAD background area around the function block (block itself stays white — TIA native rendering). */
    app-root network-view,
    app-root .network-view,
    app-root [class*="network-view"],
    app-root [class*="network"][class*="container"],
    app-root [class*="network-content"],
    app-root [class*="lad-content"],
    app-root [class*="fbd-content"],
    app-root .nw-content,
    app-root .network-body,
    app-root .network-comment-row,
    app-root lad-network,
    app-root fbd-network,
    app-root app-network,
    app-root app-codeblock-export-view-frame,
    app-root app-codeblock-content {
      background-color: var(--act-document-bg) !important;
      color: var(--act-document-fg) !important;
    }
    /* Long input operand labels are right-anchored at x=155 and extend leftward — pad the LAD/FBD canvas
       and allow horizontal scrolling so they are not clipped by the network container. */
    app-root lad-network,
    app-root fbd-network,
    app-root app-network,
    app-root app-codeblock-content,
    app-root [class*="lad-content"],
    app-root [class*="fbd-content"] {
      display: block !important;
      overflow: visible !important;
    }
    /* The actual diagram is inside <svg class="network-body"> — give it a left margin so right-anchored
       input labels (which extend into negative SVG x-coordinates) are no longer clipped. */
    app-root svg.network-body {
      display: block !important;
      margin-left: 260px !important;
      overflow: visible !important;
    }
    /* Parents of network-body must not clip the overflowing labels. */
    app-root network-view,
    app-root .network-view,
    app-root .network,
    app-root #content-item,
    app-root #network-list,
    app-root [class*="network-content"] {
      overflow: visible !important;
    }
    /* The outer scroll container can still scroll horizontally if everything is wider than the panel. */
    app-root #overview-container ~ *,
    app-root .as-split-area { overflow-x: auto !important; }
    app-root lad-network svg,
    app-root fbd-network svg,
    app-root app-network svg,
    app-root app-codeblock-content svg { overflow: visible !important; }
    /* LAD/FBD diagrams render labels as SVG <text> with hardcoded black fill and white rect backgrounds.
       Force light fill and transparent rect backgrounds so the diagram is readable on the dark surface. */
    app-root lad-network svg,
    app-root fbd-network svg,
    app-root app-network svg,
    app-root app-codeblock-content svg { background: transparent !important; }
    app-root lad-network text,
    app-root fbd-network text,
    app-root app-network text,
    app-root app-codeblock-content text,
    app-root lad-network tspan,
    app-root fbd-network tspan,
    app-root app-network tspan,
    app-root app-codeblock-content tspan { fill: var(--act-document-fg) !important; }
    /* SVG strokes for wires/box outlines — keep them visible on dark bg. */
    app-root lad-network path,
    app-root fbd-network path,
    app-root app-network path,
    app-root app-codeblock-content path,
    app-root lad-network line,
    app-root fbd-network line,
    app-root app-network line,
    app-root app-codeblock-content line,
    app-root lad-network polyline,
    app-root fbd-network polyline,
    app-root app-network polyline,
    app-root app-codeblock-content polyline { stroke: var(--act-document-fg) !important; }
    /* Block bodies inside LAD/FBD use white <rect> fills — switch to a slightly lighter surface so the box is visible against the dark canvas while text stays readable. */
    app-root lad-network rect[fill="white"],
    app-root lad-network rect[fill="#fff"],
    app-root lad-network rect[fill="#ffffff"],
    app-root fbd-network rect[fill="white"],
    app-root fbd-network rect[fill="#fff"],
    app-root fbd-network rect[fill="#ffffff"],
    app-root app-network rect[fill="white"],
    app-root app-network rect[fill="#fff"],
    app-root app-network rect[fill="#ffffff"],
    app-root app-codeblock-content rect[fill="white"],
    app-root app-codeblock-content rect[fill="#fff"],
    app-root app-codeblock-content rect[fill="#ffffff"] { fill: var(--act-document-bg) !important; stroke: var(--act-document-fg) !important; }
    /* Catch-all for the box body: ACT also paints block backgrounds with light gray (#d9d9d9, #dfe0e8, #e6e6e6, #f0f0f0).
       Use a visibly lighter surface than the canvas + a clear stroke so block outlines stand out on the dark background. */
    app-root lad-network rect, app-root fbd-network rect, app-root app-network rect, app-root app-codeblock-content rect,
    app-root lad-network polygon, app-root fbd-network polygon, app-root app-network polygon, app-root app-codeblock-content polygon {
      fill: var(--vscode-input-background, #3c3c3c) !important;
      stroke: var(--vscode-foreground, #e0e0e0) !important;
      stroke-width: 2px !important;
    }
    body.act-preview-fail-safe-logic app-root lad-network path,
    body.act-preview-fail-safe-logic app-root fbd-network path,
    body.act-preview-fail-safe-logic app-root app-network path,
    body.act-preview-fail-safe-logic app-root app-codeblock-content path,
    body.act-preview-fail-safe-logic app-root lad-network line,
    body.act-preview-fail-safe-logic app-root fbd-network line,
    body.act-preview-fail-safe-logic app-root app-network line,
    body.act-preview-fail-safe-logic app-root app-codeblock-content line,
    body.act-preview-fail-safe-logic app-root lad-network polyline,
    body.act-preview-fail-safe-logic app-root fbd-network polyline,
    body.act-preview-fail-safe-logic app-root app-network polyline,
    body.act-preview-fail-safe-logic app-root app-codeblock-content polyline,
    body.act-preview-fail-safe-logic app-root lad-network rect,
    body.act-preview-fail-safe-logic app-root fbd-network rect,
    body.act-preview-fail-safe-logic app-root app-network rect,
    body.act-preview-fail-safe-logic app-root app-codeblock-content rect,
    body.act-preview-fail-safe-logic app-root lad-network polygon,
    body.act-preview-fail-safe-logic app-root fbd-network polygon,
    body.act-preview-fail-safe-logic app-root app-network polygon,
    body.act-preview-fail-safe-logic app-root app-codeblock-content polygon {
      stroke: var(--act-fail-safe-logic-line) !important;
      stroke-opacity: 1 !important;
    }
    /* Inline-style fills (TIA renders e.g. style="fill: rgb(255, 255, 255)" on shapes). */
    app-root lad-network [style*="fill: rgb(255"],
    app-root lad-network [style*="fill:#fff"],
    app-root lad-network [style*="fill: white"],
    app-root fbd-network [style*="fill: rgb(255"],
    app-root fbd-network [style*="fill:#fff"],
    app-root fbd-network [style*="fill: white"],
    app-root app-network [style*="fill: rgb(255"],
    app-root app-network [style*="fill:#fff"],
    app-root app-network [style*="fill: white"],
    app-root app-codeblock-content [style*="fill: rgb(255"],
    app-root app-codeblock-content [style*="fill:#fff"],
    app-root app-codeblock-content [style*="fill: white"] { fill: var(--act-document-surface) !important; }
    app-root network-title,
    app-root .network-title,
    app-root network-comment,
    app-root .network-comment { color: var(--act-document-fg) !important; }
    app-root #compare-configuration-title,
    app-root #single-instance-settings-title,
    app-root #ui-settings-title,
    app-root #options-title,
    app-root .general-settings-title,
    app-root .close-last-tab,
    app-root ul,
    app-root li { color: var(--act-document-fg) !important; }
    app-root .disclaimer,
    app-root .disclaimer-text,
    app-root [class*="disclaimer"] { color: var(--act-document-muted-fg) !important; }
    app-root .error-message { color: var(--act-preview-error) !important; }
    app-root app-codeblock-export-view-frame,
    app-root app-codeblock-view,
    app-root app-codeblock-export-view,
    app-root app-datablock-view,
    app-root app-tag-table-view,
    app-root app-udt-view { display: block; min-height: 100%; }
    app-root fieldset { background-color: var(--act-document-surface) !important; color: var(--act-document-fg) !important; border-color: var(--act-document-border) !important; box-shadow: none !important; }
    app-root fieldset legend,
    app-root fieldset label,
    app-root fieldset li,
    app-root fieldset ul,
    app-root .file-info,
    app-root tbody,
    app-root tbody td { color: var(--act-document-fg) !important; }
    app-root thead,
    app-root thead th { background-color: var(--act-document-header-bg) !important; color: var(--act-document-header-fg) !important; border-color: var(--act-document-border) !important; }
    app-root .disclaimer,
    app-root fieldset [class*="description"],
    app-root fieldset [class*="hint"] { color: var(--act-document-muted-fg) !important; }
    app-root input,
    app-root select,
    app-root textarea,
    app-root .file-text-field,
    app-root .dropdown-menu { background-color: var(--act-preview-input-bg) !important; color: var(--act-preview-input-fg) !important; border-color: var(--vscode-input-border, var(--act-preview-border)) !important; }
    app-root input:focus,
    app-root select:focus,
    app-root textarea:focus { outline: 1px solid var(--act-preview-focus-border) !important; outline-offset: -1px; }
    app-root button,
    app-root input[type="button"],
    app-root .file-browse-button { background-color: var(--act-preview-button-bg) !important; color: var(--act-preview-button-fg) !important; border-color: var(--act-preview-button-bg) !important; }
    app-root button:hover,
    app-root input[type="button"]:hover,
    app-root .file-browse-button:hover { background-color: var(--act-preview-button-hover-bg) !important; }
    app-root button:disabled,
    app-root input[type="button"]:disabled { opacity: 0.55; }
    app-root .error-message,
    app-root [class*="error"] { color: var(--act-preview-error) !important; }
    body.vscode-dark app-root status-bar img[src*="folder.png"],
    body.vscode-high-contrast app-root status-bar img[src*="folder.png"] { filter: invert(1) brightness(1.4); }
    #act-preview-status { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; background: var(--act-preview-bg); color: var(--act-preview-fg); font-family: var(--vscode-font-family, Segoe UI, Arial, sans-serif); }
    #act-preview-status.ready { display: none; }
    #act-preview-status .box { max-width: 760px; width: 100%; border: 1px solid var(--act-preview-border); border-radius: 6px; padding: 18px 20px; background: var(--act-preview-panel-bg); color: var(--act-preview-fg); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); }
    #act-preview-status .title { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
    #act-preview-status .detail { font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
  </style>
</head>
<body${bodyClass}>
  <div id="act-preview-status">
    <div class="box">
      <div class="title">Loading SIMATIC Automation Compare Tool preview...</div>
      <div class="detail">${escapeHtml(filePayload.filePath)}</div>
    </div>
  </div>
  <app-root></app-root>
  <script nonce="${nonce}">
    (() => {
      const vscode = acquireVsCodeApi();
      const actBaseHref = ${safeScriptJson(baseUri)};
      const actAssetBaseHref = ${safeScriptJson(assetBaseUri)};
      const statusElement = document.getElementById('act-preview-status');
      const statusTitle = statusElement?.querySelector('.title');
      const statusDetail = statusElement?.querySelector('.detail');
      const globals = {
        leftFile: ${leftPayloadJson},
        rightFile: ${rightPayloadJson},
        title1: ${leftTitleJson},
        title2: ${rightTitleJson}
      };
      const listeners = new Map();

      function getListeners(channel) {
        if (!listeners.has(channel)) {
          listeners.set(channel, []);
        }
        return listeners.get(channel);
      }

      function post(type, payload) {
        vscode.postMessage(Object.assign({ type }, payload || {}));
      }
      window.__tiaPostActMessage = post;

      function toActAssetUrl(value) {
        if (typeof value !== 'string') {
          return value;
        }
        let relativePath = value;
        if (relativePath.startsWith('./assets/')) {
          relativePath = relativePath.slice(2);
        }
        if (!relativePath.startsWith('assets/')) {
          return value;
        }
        return actAssetBaseHref + relativePath.slice('assets/'.length).split('/').map(encodeURIComponent).join('/');
      }

      const originalSetAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name, value) {
        const lowerName = String(name).toLowerCase();
        if ((lowerName === 'src' || lowerName === 'href') && typeof value === 'string') {
          return originalSetAttribute.call(this, name, toActAssetUrl(value));
        }
        return originalSetAttribute.call(this, name, value);
      };

      const imageSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      if (imageSrcDescriptor?.set && imageSrcDescriptor?.get) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
          configurable: true,
          enumerable: imageSrcDescriptor.enumerable,
          get() { return imageSrcDescriptor.get.call(this); },
          set(value) { imageSrcDescriptor.set.call(this, toActAssetUrl(value)); }
        });
      }

      if (typeof window.fetch === 'function') {
        const originalFetch = window.fetch.bind(window);
        window.fetch = (input, init) => originalFetch(typeof input === 'string' ? toActAssetUrl(input) : input, init);
      }

      const originalXhrOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        return originalXhrOpen.call(this, method, typeof url === 'string' ? toActAssetUrl(url) : url, ...args);
      };

      function rewriteActAssetAttributes(root) {
        const elements = [];
        if (root instanceof Element) {
          elements.push(root);
        }
        if (root?.querySelectorAll) {
          elements.push(...root.querySelectorAll('[src], [href]'));
        }
        for (const element of elements) {
          for (const attributeName of ['src', 'href']) {
            const value = element.getAttribute?.(attributeName);
            const nextValue = toActAssetUrl(value);
            if (typeof nextValue === 'string' && value !== nextValue) {
              originalSetAttribute.call(element, attributeName, nextValue);
            }
          }
        }
      }

      const assetObserver = new MutationObserver(records => {
        for (const record of records) {
          if (record.type === 'attributes') {
            rewriteActAssetAttributes(record.target);
          }
          for (const node of record.addedNodes) {
            rewriteActAssetAttributes(node);
          }
        }
      });
      assetObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href'] });

      function setStatus(title, detail) {
        if (statusTitle) statusTitle.textContent = title;
        if (statusDetail) statusDetail.textContent = detail || '';
      }

      function reportError(title, detail) {
        setStatus(title, detail);
        post('actError', { message: title, detail });
      }

      window.addEventListener('error', event => {
        const detail = event.error?.stack || event.message || String(event.error || 'Unknown script error');
        reportError('ACT preview failed while loading.', detail);
      });

      window.addEventListener('unhandledrejection', event => {
        const reason = event.reason;
        const detail = reason?.stack || reason?.message || String(reason || 'Unknown promise rejection');
        reportError('ACT preview failed while loading.', detail);
      });

      const originalConsoleError = console.error.bind(console);
      console.error = (...args) => {
        originalConsoleError(...args);
        post('actError', { message: 'ACT console error', detail: args.map(value => String(value)).join(' ') });
      };

      // Expand truncated LAD/FBD operand labels: ACT shortens names like "#ManMsgL1ToL2.oCountMsgToRun" to
      // "#ManMs…gToRun" inside <tspan>, but keeps the full name in a child <title> element. Walk the SVG
      // and replace the visible text nodes with the full title text.
      function expandActOperandLabels(root) {
        const scope = root && root.querySelectorAll ? root : document;
        const tspans = scope.querySelectorAll('tspan > title');
        for (const titleEl of tspans) {
          const tspan = titleEl.parentNode;
          if (!tspan) continue;
          const full = (titleEl.textContent || '').trim();
          if (!full || full === '...' || full === '…') continue;
          for (const node of Array.from(tspan.childNodes)) {
            if (node.nodeType === 3 /* TEXT_NODE */) {
              const visible = (node.nodeValue || '').trim();
              if (visible !== full) {
                node.nodeValue = full;
              }
            }
          }
        }
      }
      const operandLabelObserver = new MutationObserver(() => {
        try { expandActOperandLabels(document.body); } catch (e) { /* swallow */ }
      });
      function startOperandLabelExpander() {
        try {
          expandActOperandLabels(document.body);
          operandLabelObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
        } catch (e) { /* ignore */ }
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startOperandLabelExpander, { once: true });
      } else {
        startOperandLabelExpander();
      }

      function normalizeHistoryUrl(url) {
        if (url === undefined || url === null) {
          return url;
        }
        const value = String(url);
        if (!value.startsWith(actBaseHref)) {
          return url;
        }
        const hashIndex = value.indexOf('#');
        const hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
        return window.location.pathname + window.location.search + hash;
      }

      function wrapHistoryMethod(target, methodName, stage) {
        const current = target && target[methodName];
        if (typeof current !== 'function' || current.__tiaActHistoryWrapped) {
          return false;
        }
        const wrapped = function(state, title, url) {
          if (arguments.length < 3) {
            return current.call(this, state, title);
          }
          return current.call(this, state, title, normalizeHistoryUrl(url));
        };
        Object.defineProperty(wrapped, '__tiaActHistoryWrapped', { value: true });
        try {
          target[methodName] = wrapped;
          return true;
        } catch (error) {
          post('actError', { message: 'ACT history patch failed', detail: stage + ': ' + methodName + ': ' + String(error) });
          return false;
        }
      }

      function installHistoryPatch(stage) {
        const patched = [
          wrapHistoryMethod(History.prototype, 'replaceState', stage),
          wrapHistoryMethod(History.prototype, 'pushState', stage),
          wrapHistoryMethod(history, 'replaceState', stage),
          wrapHistoryMethod(history, 'pushState', stage)
        ];
        post('actLog', { message: 'ACT history patch ' + stage + ': ' + patched.filter(Boolean).length + ' method(s) wrapped' });
      }

      window.__tiaInstallActHistoryPatch = installHistoryPatch;
      installHistoryPatch('before-polyfills');

      const ipcRenderer = {
        on(channel, listener) {
          getListeners(channel).push(listener);
        },
        once(channel, listener) {
          const wrapped = (...args) => {
            const channelListeners = getListeners(channel);
            const index = channelListeners.indexOf(wrapped);
            if (index >= 0) {
              channelListeners.splice(index, 1);
            }
            listener(...args);
          };
          getListeners(channel).push(wrapped);
        },
        send(channel, ...args) {
          if (channel === 'updateGlobalFiles') {
            const payload = args[0] || {};
            if (payload.leftFile !== undefined) globals.leftFile = payload.leftFile;
            if (payload.rightFile !== undefined) globals.rightFile = payload.rightFile;
            if (payload.file !== undefined) globals.leftFile = payload.file;
            const title = payload.file?.fileName || payload.leftFile?.fileName || globals.leftFile?.fileName;
            post('updateTitle', { title });
            return;
          }
          if (channel === 'viewFileInExplorer') {
            post('viewFileInExplorer', { filePath: args[0] });
            return;
          }
          if (channel === 'change-ui-culture') {
            const culture = args[0];
            for (const listener of getListeners('updateCultureChange')) {
              listener({}, culture);
            }
            return;
          }
          post('actLog', { message: 'ignored IPC send: ' + channel });
        },
        sendSync(channel) {
          if (channel === 'getCulture') {
            return 'enUS';
          }
          if (channel === 'load-persistent-setting') {
            return null;
          }
          if (channel === 'selectFilesToCompare') {
            return null;
          }
          return null;
        },
        listeners(channel) {
          return getListeners(channel);
        }
      };

      const remote = {
        getGlobal(name) {
          return globals[name];
        },
        app: {
          isPackaged: true,
          getPath() { return ''; }
        },
        getCurrentWindow() {
          return {
            close() {},
            getBounds() { return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }; }
          };
        },
        webContents: {
          fromId() { return { send() {}, printToPDF: async () => new Uint8Array() }; }
        },
        dialog: { showSaveDialogSync() { return undefined; } },
        Menu: class {},
        MenuItem: class {}
      };

      window.process = window.process || { type: 'renderer', platform: 'win32' };
      window.require = moduleName => {
        if (moduleName === 'electron') {
          return { ipcRenderer };
        }
        if (moduleName === '@electron/remote') {
          return remote;
        }
        throw new Error('Unsupported ACT webview module: ' + moduleName);
      };

      window.addEventListener('dragover', event => event.preventDefault());
      window.addEventListener('drop', event => event.preventDefault());

      const root = document.querySelector('app-root');
      function hasRenderedContent() {
        if (!root) return false;
        if ((root.textContent || '').trim().length > 0) return true;
        return Boolean(root.querySelector('fieldset, status-bar, table, svg, canvas, app-home-view-container, app-codeblock-view, app-codeblock-export-view, app-datablock-view, app-tag-table-view, app-udt-view'));
      }
      if (root) {
        const observer = new MutationObserver(() => {
          if (hasRenderedContent()) {
            statusElement?.classList.add('ready');
            post('actLog', { message: 'ACT renderer mounted' });
            observer.disconnect();
          }
        });
        observer.observe(root, { childList: true, subtree: true, characterData: true });
        window.setTimeout(() => {
          if (!statusElement?.classList.contains('ready')) {
            post('actLog', { message: 'ACT renderer has not mounted after 8 seconds' });
            setStatus('ACT preview is still blank.', 'The VS Code panel loaded, but the ACT renderer did not mount. Open TIA Import logs for the captured startup messages.');
          }
        }, 8000);
      }
    })();
  </script>
  <script nonce="${nonce}" type="module">
    try {
      await import(${safeScriptJson(polyfillsUri.toString())});
      window.__tiaInstallActHistoryPatch?.('after-polyfills');
      await import(${safeScriptJson(mainUri.toString())});
    } catch (error) {
      const detail = error?.stack || error?.message || String(error || 'Unknown module loading error');
      window.__tiaPostActMessage?.('actError', { message: 'ACT module loading failed', detail });
      const statusElement = document.getElementById('act-preview-status');
      const statusTitle = statusElement?.querySelector('.title');
      const statusDetail = statusElement?.querySelector('.detail');
      if (statusTitle) statusTitle.textContent = 'ACT preview failed while loading modules.';
      if (statusDetail) statusDetail.textContent = detail;
    }
  </script>
</body>
</html>`;
}
function withTrailingSlash(value) {
    return value.endsWith('/') ? value : `${value}/`;
}
function safeScriptJson(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function hasFailSafeLogicPayload(leftPayload, rightPayload) {
    return isFailSafeLadOrFbdContent(leftPayload.content)
        || Boolean(rightPayload && isFailSafeLadOrFbdContent(rightPayload.content));
}
function isFailSafeLadOrFbdContent(content) {
    const failSafeLogicLanguage = 'F[_\\-\\s]?(?:LAD|FBD)(?:[_\\-\\s]?LIB)?';
    return new RegExp(`(?:<ProgrammingLanguage>\\s*${failSafeLogicLanguage}\\s*<\\/ProgrammingLanguage>`
        + `|\\bProgrammingLanguage\\s*=\\s*["']${failSafeLogicLanguage}["']`
        + `|\\bS7_Language\\s*:=\\s*["']${failSafeLogicLanguage}["'])`, 'i').test(content);
}
function createNonce() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let index = 0; index < 32; index++) {
        nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return nonce;
}
//# sourceMappingURL=automationComparePreviewPanel.js.map