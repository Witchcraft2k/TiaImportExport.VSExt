"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREVIEW_STYLES = void 0;
/**
 * Static CSS injected into the ACT preview webview. Themes the ACT Angular
 * shell, status bar, layout controls, tables and LAD/FBD diagrams against the
 * active VS Code color theme. No template interpolation — kept as a plain
 * constant so it can be dropped straight into the `<style>` element.
 */
exports.PREVIEW_STYLES = `
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
      --act-preview-status-height: 0px;
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
    app-root status-bar,
    app-root [class*="status-bar"] {
      display: none !important;
      box-sizing: border-box !important;
      width: 100% !important;
      height: 0 !important;
      min-height: 0 !important;
      padding: 0 !important;
      min-width: 0 !important;
      overflow: hidden !important;
    }
    app-root as-split-area:has(> status-bar) {
      flex: 0 0 var(--act-preview-status-height) !important;
      height: var(--act-preview-status-height) !important;
      min-height: var(--act-preview-status-height) !important;
      max-height: var(--act-preview-status-height) !important;
      overflow: hidden !important;
    }
    app-root status-bar .status-title,
    app-root [class*="status-title"] {
      color: var(--act-preview-muted-fg) !important;
      display: block !important;
      flex: 1 1 auto !important;
      min-width: 180px !important;
      max-width: none !important;
      width: auto !important;
      height: auto !important;
      line-height: 20px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    app-root status-bar .status-view,
    app-root [class*="status-view"] {
      flex: 0 0 28px !important;
      min-width: 28px !important;
      padding-right: 4px !important;
      text-align: right !important;
    }
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
    app-root network-comment-view .comment {
      align-items: flex-start !important;
      height: auto !important;
      min-height: 18px !important;
      overflow: visible !important;
    }
    app-root network-comment,
    app-root .network-comment,
    app-root .network-comment-verbose {
      display: block !important;
      width: auto !important;
      max-width: none !important;
      height: auto !important;
      min-height: 18px !important;
      overflow: visible !important;
      text-overflow: clip !important;
      white-space: pre-line !important;
      line-height: 1.25 !important;
    }
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
    app-root status-bar img[src*="folder.png"] {
      width: 18px !important;
      height: 18px !important;
      object-fit: contain !important;
      vertical-align: middle !important;
    }
    #act-layout-controls {
      position: fixed;
      top: 10px;
      right: 14px;
      z-index: 2147483000;
      display: flex;
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--act-preview-border);
      border-radius: 6px;
      background: var(--act-preview-panel-bg);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24);
    }
    #act-layout-controls button {
      width: 26px;
      height: 24px;
      padding: 0;
      border: 1px solid var(--act-preview-border) !important;
      border-radius: 4px;
      background: var(--act-preview-input-bg) !important;
      color: var(--act-preview-fg) !important;
      font: 600 11px/1 var(--vscode-font-family, Segoe UI, Arial, sans-serif) !important;
      cursor: pointer;
    }
    #act-layout-controls button:hover { background: var(--act-preview-button-hover-bg) !important; }
    #act-layout-controls button[aria-pressed="true"] {
      background: var(--vscode-list-activeSelectionBackground, var(--act-preview-button-bg)) !important;
      color: var(--vscode-list-activeSelectionForeground, var(--act-preview-button-fg)) !important;
      border-color: var(--vscode-focusBorder, var(--act-preview-button-bg)) !important;
    }
    #act-layout-controls button:focus-visible {
      outline: 1px solid var(--act-preview-focus-border);
      outline-offset: 2px;
    }
    #act-network-context-menu {
      position: fixed;
      z-index: 2147483646;
      min-width: 160px;
      padding: 4px;
      border: 1px solid var(--act-preview-border);
      border-radius: 4px;
      background: var(--act-preview-panel-bg);
      color: var(--act-preview-fg);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.32);
      font: 12px/1.3 var(--vscode-font-family, Segoe UI, Arial, sans-serif);
    }
    #act-network-context-menu button {
      display: block;
      width: 100%;
      padding: 6px 10px;
      border: none;
      background: transparent;
      color: inherit;
      text-align: left;
      font: inherit;
      cursor: pointer;
      border-radius: 3px;
    }
    #act-network-context-menu button:hover,
    #act-network-context-menu button:focus-visible {
      background: var(--vscode-list-hoverBackground, var(--act-preview-button-hover-bg));
      outline: none;
    }
    #act-preview-status { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; background: var(--act-preview-bg); color: var(--act-preview-fg); font-family: var(--vscode-font-family, Segoe UI, Arial, sans-serif); }
    #act-preview-status.ready { display: none; }
    #act-preview-status .box { max-width: 760px; width: 100%; border: 1px solid var(--act-preview-border); border-radius: 6px; padding: 18px 20px; background: var(--act-preview-panel-bg); color: var(--act-preview-fg); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); }
    #act-preview-status .title { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
    #act-preview-status .detail { font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
  `;
//# sourceMappingURL=previewStyles.js.map