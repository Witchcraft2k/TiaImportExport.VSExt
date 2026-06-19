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
exports.buildAutomationCompareHtml = buildAutomationCompareHtml;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const previewStyles_1 = require("./previewStyles");
const previewClientScript_1 = require("./previewClientScript");
const previewHtmlHelpers_1 = require("./previewHtmlHelpers");
/**
 * Assemble the full HTML document loaded into the ACT preview webview. Themes
 * and shims are injected from `previewStyles` / `previewClientScript`; the file
 * payloads are inlined so ACT's Angular app reads them through
 * `remote.getGlobal('leftFile' | 'rightFile' | 'title1' | 'title2')`.
 */
function buildAutomationCompareHtml(webview, assetRoot, filePayload, rightPayload, leftTitle, rightTitle) {
    const nonce = (0, previewHtmlHelpers_1.createNonce)();
    const baseUri = (0, previewHtmlHelpers_1.withTrailingSlash)(webview.asWebviewUri(vscode.Uri.file(assetRoot)).toString());
    const stylesUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetRoot, 'styles.css')));
    const polyfillsUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetRoot, 'polyfills.js')));
    const mainUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetRoot, 'main.js')));
    const faviconUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetRoot, 'favicon.ico')));
    const assetBaseUri = (0, previewHtmlHelpers_1.withTrailingSlash)(webview.asWebviewUri(vscode.Uri.file(path.join(assetRoot, 'assets'))).toString());
    const leftPayloadJson = (0, previewHtmlHelpers_1.safeScriptJson)(filePayload);
    const rightPayloadJson = (0, previewHtmlHelpers_1.safeScriptJson)(rightPayload ?? null);
    const leftTitleJson = (0, previewHtmlHelpers_1.safeScriptJson)(leftTitle);
    const rightTitleJson = (0, previewHtmlHelpers_1.safeScriptJson)(rightTitle ?? null);
    const bodyClass = (0, previewHtmlHelpers_1.hasFailSafeLogicPayload)(filePayload, rightPayload)
        ? ' class="act-preview-fail-safe-logic"'
        : '';
    const runtimeScript = (0, previewClientScript_1.buildActRuntimeScript)({
        baseHrefJson: (0, previewHtmlHelpers_1.safeScriptJson)(baseUri),
        assetBaseHrefJson: (0, previewHtmlHelpers_1.safeScriptJson)(assetBaseUri),
        leftFileJson: leftPayloadJson,
        rightFileJson: rightPayloadJson,
        title1Json: leftTitleJson,
        title2Json: rightTitleJson,
        editingEnabledJson: (0, previewHtmlHelpers_1.safeScriptJson)(rightPayload === undefined)
    });
    const moduleBootstrap = (0, previewClientScript_1.buildActModuleBootstrap)({
        polyfillsImportJson: (0, previewHtmlHelpers_1.safeScriptJson)(polyfillsUri.toString()),
        mainImportJson: (0, previewHtmlHelpers_1.safeScriptJson)(mainUri.toString())
    });
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-eval'; connect-src ${webview.cspSource};">
  <base href="./">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="${faviconUri}">
  <link rel="stylesheet" href="${stylesUri}">
  <style nonce="${nonce}">${previewStyles_1.PREVIEW_STYLES}</style>
</head>
<body${bodyClass}>
  <div id="act-preview-status">
    <div class="box">
      <div class="title">Loading SIMATIC Automation Compare Tool preview...</div>
      <div class="detail">${(0, previewHtmlHelpers_1.escapeHtml)(filePayload.filePath)}</div>
    </div>
  </div>
  <app-root></app-root>
  <script nonce="${nonce}">${runtimeScript}</script>
  <script nonce="${nonce}" type="module">${moduleBootstrap}</script>
</body>
</html>`;
}
//# sourceMappingURL=previewHtmlBuilder.js.map