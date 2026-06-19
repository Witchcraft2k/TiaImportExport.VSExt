"use strict";
/**
 * Inline scripts injected into the ACT preview webview. Kept verbatim from the
 * original single-file implementation — the body is a browser-side IIFE that
 * shims Electron IPC / @electron/remote, themes & expands LAD/FBD operand
 * labels, patches history navigation and bootstraps the ACT Angular bundle.
 *
 * IMPORTANT: this content lives inside a TypeScript template literal. Backslash
 * sequences are reproduced exactly as in the original (e.g. `\\s+` to emit a
 * literal `\s+` in the generated webview JS). Do not "fix" or collapse them.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildActRuntimeScript = buildActRuntimeScript;
exports.buildActModuleBootstrap = buildActModuleBootstrap;
/**
 * Build the body of the primary inline `<script>` (the runtime IIFE). The
 * returned string does NOT include the surrounding `<script>` tags.
 */
function buildActRuntimeScript(data) {
    return `
    (() => {
      const vscode = acquireVsCodeApi();
      const actBaseHref = ${data.baseHrefJson};
      const actAssetBaseHref = ${data.assetBaseHrefJson};
      const actEditingEnabled = ${data.editingEnabledJson} === true;
      const statusElement = document.getElementById('act-preview-status');
      const statusTitle = statusElement?.querySelector('.title');
      const statusDetail = statusElement?.querySelector('.detail');
      const globals = {
        leftFile: ${data.leftFileJson},
        rightFile: ${data.rightFileJson},
        title1: ${data.title1Json},
        title2: ${data.title2Json}
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

      function getLocalName(element) {
        return String(element?.localName || element?.nodeName || '').toLowerCase();
      }

      function findDescendantsByLocalName(root, localName) {
        const normalizedLocalName = String(localName || '').toLowerCase();
        const matches = [];
        const elements = root?.getElementsByTagName ? root.getElementsByTagName('*') : [];
        for (const element of Array.from(elements)) {
          if (getLocalName(element) === normalizedLocalName) {
            matches.push(element);
          }
        }
        return matches;
      }

      function normalizeCommentText(value) {
        return String(value || '').replace(/\\s+/g, ' ').trim();
      }

      function normalizeMultilineCommentText(value) {
        return String(value || '')
          .replace(/\\r\\n?/g, '\\n')
          .split('\\n')
          .map(line => line.replace(/[\\t\\f\\v ]+/g, ' ').trim())
          .join('\\n')
          .replace(/\\n{3,}/g, '\\n\\n')
          .trim();
      }

      function chooseLocalizedText(values) {
        const nonEmptyValues = values.filter(item => item && item.text);
        if (!nonEmptyValues.length) {
          return '';
        }
        return (
          nonEmptyValues.find(item => item.culture === 'en-us' || item.culture === 'enus') ||
          nonEmptyValues.find(item => item.culture.startsWith('en')) ||
          nonEmptyValues[0]
        ).text;
      }

      function getTextElementValue(item, preserveLines) {
        const textElement = findDescendantsByLocalName(item, 'Text')[0];
        if (!textElement) {
          return '';
        }
        return preserveLines
          ? normalizeMultilineCommentText(textElement.textContent)
          : normalizeCommentText(textElement.textContent);
      }

      function getCultureElementValue(item) {
        const cultureElement = findDescendantsByLocalName(item, 'Culture')[0];
        return cultureElement ? normalizeCommentText(cultureElement.textContent).toLowerCase() : '';
      }

      function getCommentTextFromContainer(container, preserveLines) {
        const simpleTexts = findDescendantsByLocalName(container, 'MultiLanguageText')
          .map(element => ({
            culture: String(element.getAttribute('Lang') || element.getAttribute('Culture') || '').toLowerCase(),
            text: preserveLines ? normalizeMultilineCommentText(element.textContent) : normalizeCommentText(element.textContent)
          }));
        const simpleText = chooseLocalizedText(simpleTexts);
        if (simpleText) {
          return simpleText;
        }

        const itemTexts = findDescendantsByLocalName(container, 'MultilingualTextItem')
          .map(item => ({
            culture: getCultureElementValue(item),
            text: getTextElementValue(item, preserveLines)
          }));
        return chooseLocalizedText(itemTexts);
      }

      function getDirectMemberComment(member) {
        for (const child of Array.from(member.children || [])) {
          if (getLocalName(child) === 'comment') {
            const comment = getCommentTextFromContainer(child);
            if (comment) {
              return comment;
            }
          }
        }

        for (const child of Array.from(member.children || [])) {
          if (getLocalName(child) !== 'objectlist') {
            continue;
          }
          for (const objectChild of Array.from(child.children || [])) {
            if (getLocalName(objectChild) === 'multilingualtext' && String(objectChild.getAttribute('CompositionName') || '').toLowerCase() === 'comment') {
              const comment = getCommentTextFromContainer(objectChild);
              if (comment) {
                return comment;
              }
            }
          }
        }

        return '';
      }

      function getMemberPath(member) {
        const names = [];
        let current = member;
        while (current) {
          if (getLocalName(current) === 'member') {
            const name = current.getAttribute('Name');
            if (name) {
              names.unshift(name);
            }
          }
          current = current.parentElement;
        }
        return names.join('.');
      }

      function addVariableComment(comments, key, comment) {
        const normalizedKey = normalizeOperandName(key);
        const normalizedComment = normalizeCommentText(comment);
        if (!normalizedKey || !normalizedComment) {
          return;
        }

        const existing = comments.get(normalizedKey);
        if (!existing) {
          comments.set(normalizedKey, normalizedComment);
          return;
        }
        if (existing.split('\\n').indexOf(normalizedComment) < 0) {
          comments.set(normalizedKey, existing + '\\n' + normalizedComment);
        }
      }

      function addVariableCommentsFromContent(comments, content) {
        if (typeof content !== 'string' || content.indexOf('<') < 0 || typeof DOMParser !== 'function') {
          return;
        }
        let documentXml;
        try {
          documentXml = new DOMParser().parseFromString(content, 'application/xml');
        } catch (error) {
          return;
        }
        if (!documentXml || findDescendantsByLocalName(documentXml, 'parsererror').length) {
          return;
        }

        for (const member of findDescendantsByLocalName(documentXml, 'Member')) {
          const comment = getDirectMemberComment(member);
          if (!comment) {
            continue;
          }
          const memberPath = getMemberPath(member);
          addVariableComment(comments, memberPath, comment);
        }
      }

      function buildVariableComments() {
        const comments = new Map();
        addVariableCommentsFromContent(comments, globals.leftFile?.content);
        addVariableCommentsFromContent(comments, globals.rightFile?.content);
        return comments;
      }

      function getDirectChildrenByLocalName(root, localName) {
        const normalizedLocalName = String(localName || '').toLowerCase();
        return Array.from(root?.children || []).filter(element => getLocalName(element) === normalizedLocalName);
      }

      function getDirectChildByLocalName(root, localName) {
        return getDirectChildrenByLocalName(root, localName)[0] || null;
      }

      function getDirectCompositionChild(root, localName, compositionName) {
        const normalizedCompositionName = String(compositionName || '').toLowerCase();
        return getDirectChildrenByLocalName(root, localName)
          .find(element => String(element.getAttribute('CompositionName') || '').toLowerCase() === normalizedCompositionName) || null;
      }

      function getNetworkCommentFromCompileUnit(compileUnit) {
        const objectList = getDirectChildByLocalName(compileUnit, 'ObjectList');
        const commentContainer = getDirectCompositionChild(objectList, 'MultilingualText', 'Comment');
        return commentContainer ? getCommentTextFromContainer(commentContainer, true) : '';
      }

      function addNetworkCommentsFromContent(comments, content) {
        if (typeof content !== 'string' || content.indexOf('<') < 0 || typeof DOMParser !== 'function') {
          return;
        }
        let documentXml;
        try {
          documentXml = new DOMParser().parseFromString(content, 'application/xml');
        } catch (error) {
          return;
        }
        if (!documentXml || findDescendantsByLocalName(documentXml, 'parsererror').length) {
          return;
        }

        const compileUnits = findDescendantsByLocalName(documentXml, 'SW.Blocks.CompileUnit');
        for (let index = 0; index < compileUnits.length; index++) {
          const comment = getNetworkCommentFromCompileUnit(compileUnits[index]);
          if (comment && !comments.has(index + 1)) {
            comments.set(index + 1, comment);
          }
        }
      }

      function buildNetworkComments() {
        const comments = new Map();
        addNetworkCommentsFromContent(comments, globals.leftFile?.content);
        addNetworkCommentsFromContent(comments, globals.rightFile?.content);
        return comments;
      }

      function normalizeOperandName(value) {
        return String(value || '')
          .split(/\\r?\\n/, 1)[0]
          .trim()
          .replace(/^#/, '')
          .replace(/\"/g, '')
          .replace(/\\[[^\\]]*\\]/g, '')
          .trim();
      }

      let variableComments = buildVariableComments();
      let networkComments = buildNetworkComments();
      post('actLog', { message: 'ACT variable comments indexed: ' + variableComments.size });

      function refreshVariableComments() {
        variableComments = buildVariableComments();
      }

      function refreshNetworkComments() {
        networkComments = buildNetworkComments();
      }

      function getOperandComment(titleText) {
        const key = normalizeOperandName(titleText);
        if (!key) {
          return '';
        }
        return variableComments.get(key) || '';
      }

      const layoutToggleDefinitions = [
        { key: 'overview', label: 'O', title: 'Show or hide the overview panel' },
        { key: 'interface', label: 'I', title: 'Show or hide the interface table' },
        { key: 'attributes', label: 'A', title: 'Show or hide the attributes table' }
      ];
      const hiddenLayoutPanels = new Set(layoutToggleDefinitions.map(definition => definition.key));
      let pendingNetworkBulkAction = null;
      let changingNetworks = false;
      function hideStatusBar() {
        const statusBar = document.querySelector('app-root status-bar') || document.querySelector('status-bar');
        if (!statusBar) {
          return;
        }

        const statusArea = statusBar.closest('as-split-area');
        if (statusArea) {
          statusArea.style.setProperty('flex', '0 0 0px', 'important');
          statusArea.style.setProperty('height', '0px', 'important');
          statusArea.style.setProperty('min-height', '0px', 'important');
          statusArea.style.setProperty('max-height', '0px', 'important');
          statusArea.style.setProperty('overflow', 'hidden', 'important');
        }

        statusBar.style.setProperty('display', 'none', 'important');
        statusBar.style.setProperty('height', '0px', 'important');
        statusBar.style.setProperty('min-height', '0px', 'important');
        statusBar.style.setProperty('padding', '0', 'important');
        statusBar.style.setProperty('overflow', 'hidden', 'important');
      }

      function getNetworkBodyFromExpander(expander) {
        const header = expander?.closest?.('.header');
        if (!header) {
          return null;
        }
        let sibling = header.nextElementSibling;
        while (sibling) {
          if (String(sibling.className || '').split(/\\s+/).indexOf('network-body') >= 0) {
            return sibling;
          }
          sibling = sibling.nextElementSibling;
        }
        return null;
      }

      function isNetworkExpanded(expander) {
        const symbol = (expander?.textContent || '').trim();
        if (symbol.indexOf('▼') >= 0 || symbol.indexOf('▾') >= 0 || symbol === '-') {
          return true;
        }
        if (symbol.indexOf('▶') >= 0 || symbol.indexOf('►') >= 0 || symbol === '+') {
          return false;
        }
        const body = getNetworkBodyFromExpander(expander);
        if (!body) {
          return false;
        }
        const style = window.getComputedStyle(body);
        return style.display !== 'none' && style.visibility !== 'hidden' && body.getClientRects().length > 0;
      }

      function getNetworkExpanders() {
        return Array.from(document.querySelectorAll('app-root network-view .network-expander, network-view .network-expander'));
      }

      function getNetworkBulkAction(expanders) {
        const networkExpanders = expanders || getNetworkExpanders();
        if (!networkExpanders.length) {
          return 'collapse';
        }
        return networkExpanders.some(expander => isNetworkExpanded(expander)) ? 'collapse' : 'expand';
      }

      function getNetworkBulkActionLabel(action) {
        return action === 'expand' ? 'Expand all networks' : 'Collapse all networks';
      }

      function updateNetworkBulkButton() {
        const button = document.querySelector('#act-layout-controls button[data-act-action="toggle-networks"]');
        if (!button) {
          return;
        }
        const expanders = getNetworkExpanders();
        const action = pendingNetworkBulkAction && pendingNetworkBulkAction !== 'toggle'
          ? pendingNetworkBulkAction
          : getNetworkBulkAction(expanders);
        const label = pendingNetworkBulkAction
          ? (expanders.length ? getNetworkBulkActionLabel(action) : 'Collapse or expand all networks') + ' when networks finish rendering'
          : (expanders.length ? getNetworkBulkActionLabel(action) : 'Collapse or expand all networks');
        button.title = label;
        button.setAttribute('aria-label', button.title);
        button.setAttribute('aria-busy', pendingNetworkBulkAction ? 'true' : 'false');
        button.setAttribute('aria-pressed', 'false');
      }

      function changeNetworks(action) {
        if (changingNetworks) {
          return false;
        }
        const expanders = getNetworkExpanders();
        if (!expanders.length) {
          return false;
        }
        const targets = expanders.filter(expander => action === 'collapse' ? isNetworkExpanded(expander) : !isNetworkExpanded(expander));
        if (!targets.length) {
          return true;
        }

        changingNetworks = true;
        for (const expander of targets) {
          try {
            expander.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          } catch (error) {
            expander.click?.();
          }
        }
        window.setTimeout(() => {
          changingNetworks = false;
          updateNetworkBulkButton();
        }, 0);
        return true;
      }

      function requestToggleAllNetworks() {
        const expanders = getNetworkExpanders();
        pendingNetworkBulkAction = expanders.length ? getNetworkBulkAction(expanders) : 'toggle';
        applyPendingNetworkBulkAction();
      }

      function applyPendingNetworkBulkAction() {
        if (!pendingNetworkBulkAction) {
          updateNetworkBulkButton();
          return;
        }
        const expanders = getNetworkExpanders();
        if (!expanders.length) {
          updateNetworkBulkButton();
          return;
        }
        const action = pendingNetworkBulkAction === 'toggle' ? getNetworkBulkAction(expanders) : pendingNetworkBulkAction;
        if (changeNetworks(action)) {
          pendingNetworkBulkAction = null;
        }
        updateNetworkBulkButton();
      }

      function getInlineOrder(element) {
        const order = Number(element?.style?.order || window.getComputedStyle(element).order || 0);
        return Number.isFinite(order) ? order : 0;
      }

      function getLayoutArea(key) {
        if (key === 'overview') {
          return document.querySelector('app-root as-split-area#overview') || document.getElementById('overview');
        }
        const container = key === 'interface'
          ? document.getElementById('interface-container')
          : document.getElementById('attribute-container');
        return container?.closest('as-split-area') || container || null;
      }

      function getAdjacentLayoutGutter(area) {
        if (!area?.parentElement) {
          return null;
        }
        const areaOrder = getInlineOrder(area);
        const gutterOrder = areaOrder === 0 ? 1 : areaOrder - 1;
        const siblings = Array.from(area.parentElement.children || []);
        return siblings.find(element => element.getAttribute?.('role') === 'separator' && getInlineOrder(element) === gutterOrder) || null;
      }

      function setLayoutElementHidden(element, hidden) {
        if (!element) {
          return;
        }
        if (hidden) {
          if (element.dataset.actOriginalStyle === undefined) {
            element.dataset.actOriginalStyle = element.getAttribute('style') || '';
          }
          element.style.setProperty('display', 'none', 'important');
          return;
        }

        if (element.dataset.actOriginalStyle !== undefined) {
          const originalStyle = element.dataset.actOriginalStyle;
          if (originalStyle) {
            element.setAttribute('style', originalStyle);
          } else {
            element.removeAttribute('style');
          }
          delete element.dataset.actOriginalStyle;
        } else {
          element.style.removeProperty('display');
        }
      }

      function applyLayoutToggles() {
        for (const definition of layoutToggleDefinitions) {
          const area = getLayoutArea(definition.key);
          const gutter = getAdjacentLayoutGutter(area);
          const hidden = hiddenLayoutPanels.has(definition.key);
          setLayoutElementHidden(area, hidden);
          setLayoutElementHidden(gutter, hidden);
        }

        for (const button of Array.from(document.querySelectorAll('#act-layout-controls button[data-act-layout-panel]'))) {
          const hidden = hiddenLayoutPanels.has(button.dataset.actLayoutPanel);
          button.setAttribute('aria-pressed', hidden ? 'true' : 'false');
        }
        updateNetworkBulkButton();
      }

      function installLayoutControls() {
        if (document.getElementById('act-layout-controls')) {
          applyLayoutToggles();
          return;
        }

        const controls = document.createElement('div');
        controls.id = 'act-layout-controls';
        controls.setAttribute('role', 'toolbar');
        controls.setAttribute('aria-label', 'ACT layout controls');

        for (const definition of layoutToggleDefinitions) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = definition.label;
          button.title = definition.title;
          button.setAttribute('aria-label', definition.title);
          button.setAttribute('aria-pressed', 'false');
          button.dataset.actLayoutPanel = definition.key;
          button.addEventListener('click', () => {
            if (hiddenLayoutPanels.has(definition.key)) {
              hiddenLayoutPanels.delete(definition.key);
            } else {
              hiddenLayoutPanels.add(definition.key);
            }
            applyLayoutToggles();
          });
          controls.appendChild(button);
        }

        const collapseNetworksButton = document.createElement('button');
        collapseNetworksButton.type = 'button';
        collapseNetworksButton.textContent = 'N';
        collapseNetworksButton.dataset.actAction = 'toggle-networks';
        collapseNetworksButton.addEventListener('click', () => {
          requestToggleAllNetworks();
        });
        controls.appendChild(collapseNetworksButton);

        document.body.appendChild(controls);
        applyLayoutToggles();
        applyPendingNetworkBulkAction();
      }

      // -------------------------------------------------------------------
      // Network removal context menu (single-file preview only).
      // -------------------------------------------------------------------
      function findRenderedNetworkHost(target) {
        if (!target || typeof target.closest !== 'function') {
          return null;
        }
        return (
          target.closest('network-view') ||
          target.closest('lad-network') ||
          target.closest('fbd-network') ||
          target.closest('app-network') ||
          (target.closest('.network-body') ? target.closest('.network-body').parentElement : null)
        );
      }

      function getNetworkNumberForHost(host) {
        if (!host) {
          return 0;
        }
        const body = host.querySelector ? host.querySelector('.network-body') : null;
        for (const className of Array.from(body?.classList || [])) {
          if (/^\\d+$/.test(className)) {
            return Number(className);
          }
        }
        // Fallback: index of this host among siblings of the same tag.
        const all = Array.from(document.querySelectorAll(host.tagName.toLowerCase()));
        const index = all.indexOf(host);
        return index >= 0 ? index + 1 : 0;
      }

      let actContextMenuElement = null;
      function hideNetworkContextMenu() {
        if (actContextMenuElement && actContextMenuElement.parentNode) {
          actContextMenuElement.parentNode.removeChild(actContextMenuElement);
        }
        actContextMenuElement = null;
      }

      function showNetworkContextMenu(x, y, networkNumber) {
        hideNetworkContextMenu();
        const menu = document.createElement('div');
        menu.id = 'act-network-context-menu';
        menu.setAttribute('role', 'menu');

        if (actEditingEnabled) {
          const removeItem = document.createElement('button');
          removeItem.type = 'button';
          removeItem.setAttribute('role', 'menuitem');
          removeItem.textContent = 'Remove network ' + networkNumber;
          removeItem.addEventListener('click', () => {
            hideNetworkContextMenu();
            post('removeNetwork', { networkIndex: networkNumber });
          });
          menu.appendChild(removeItem);

          const clearItem = document.createElement('button');
          clearItem.type = 'button';
          clearItem.setAttribute('role', 'menuitem');
          clearItem.textContent = 'Clear logic in network ' + networkNumber;
          clearItem.addEventListener('click', () => {
            hideNetworkContextMenu();
            post('clearNetworkLogic', { networkIndex: networkNumber });
          });
          menu.appendChild(clearItem);
        }

        const openItem = document.createElement('button');
        openItem.type = 'button';
        openItem.setAttribute('role', 'menuitem');
        openItem.textContent = 'Open network ' + networkNumber + ' in XML';
        openItem.addEventListener('click', () => {
          hideNetworkContextMenu();
          post('openNetworkInXml', { networkIndex: networkNumber });
        });
        menu.appendChild(openItem);

        document.body.appendChild(menu);
        actContextMenuElement = menu;

        // Constrain to viewport.
        const rect = menu.getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - rect.width - 4);
        const maxTop = Math.max(0, window.innerHeight - rect.height - 4);
        menu.style.left = Math.min(x, maxLeft) + 'px';
        menu.style.top = Math.min(y, maxTop) + 'px';
      }

      function installNetworkContextMenu() {
        document.addEventListener('contextmenu', event => {
          // Ignore ACT's own controls / our toolbar.
          if (event.target && typeof event.target.closest === 'function' && event.target.closest('#act-layout-controls, #act-network-context-menu')) {
            return;
          }
          const host = findRenderedNetworkHost(event.target);
          if (!host) {
            hideNetworkContextMenu();
            return;
          }
          const networkNumber = getNetworkNumberForHost(host);
          if (!networkNumber) {
            hideNetworkContextMenu();
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          showNetworkContextMenu(event.clientX, event.clientY, networkNumber);
        }, true);
        document.addEventListener('click', event => {
          if (!actContextMenuElement) {
            return;
          }
          if (event.target && typeof event.target.closest === 'function' && event.target.closest('#act-network-context-menu')) {
            return;
          }
          hideNetworkContextMenu();
        }, true);
        document.addEventListener('keydown', event => {
          if (event.key === 'Escape') {
            hideNetworkContextMenu();
          }
        });
        window.addEventListener('blur', hideNetworkContextMenu);
        window.addEventListener('scroll', hideNetworkContextMenu, true);
      }

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

      function getRenderedNetworkNumber(element, fallbackIndex) {
        const body = element?.closest?.('.network-body');
        for (const className of Array.from(body?.classList || [])) {
          if (/^\d+$/.test(className)) {
            return Number(className);
          }
        }
        return fallbackIndex + 1;
      }

      function patchNetworkComments(root) {
        if (!networkComments.size) {
          return;
        }
        const scope = root && root.querySelectorAll ? root : document;
        const commentElements = Array.from(scope.querySelectorAll('network-comment-view .network-comment, .network-comment'));
        for (let index = 0; index < commentElements.length; index++) {
          const element = commentElements[index];
          const networkNumber = getRenderedNetworkNumber(element, index);
          const comment = networkComments.get(networkNumber);
          if (!comment) {
            continue;
          }
          if (element.dataset.actNetworkComment === comment && element.textContent === comment) {
            continue;
          }
          element.textContent = comment;
          element.title = comment;
          element.dataset.actNetworkComment = comment;
        }
      }

      // Expand truncated LAD/FBD operand labels: ACT shortens names like "#ManMsgL1ToL2.oCountMsgToRun" to
      // "#ManMs…gToRun" inside <tspan>, but keeps the full name in a child <title> element. Walk the SVG
      // and replace the visible text nodes with the full title text. LAD keeps the wrapped layout fix; FBD
      // stays single-line to preserve ACT's original row layout.
      function getOperandLabelMetrics(tspan) {
        const textElement = tspan?.parentElement;
        const anchor = tspan?.getAttribute('text-anchor') || textElement?.getAttribute('text-anchor') || '';
        const x = tspan?.getAttribute('x') || textElement?.getAttribute('x') || '';
        if (x === '50%') {
          return { maxChars: 24, fontSize: '9pt', lineDy: 0.82, centerLines: true };
        }
        return {
          maxChars: anchor === 'middle' ? 9 : 12,
          fontSize: '7pt',
          lineDy: 0.68,
          centerLines: false
        };
      }

      function getOperandDiagramLanguage(element) {
        const target = element?.nodeType === 1 ? element : element?.parentElement;
        if (!target?.closest) {
          return '';
        }
        if (target.closest('lad-network')) {
          return 'LAD';
        }
        if (target.closest('fbd-network')) {
          return 'FBD';
        }
        return '';
      }

      function splitOperandLabelTokens(value) {
        const tokens = [];
        let token = '';
        for (const char of String(value || '')) {
          token += char;
          if (char === '.' || char === '_' || char === '-' || char === '/' || char === ']') {
            tokens.push(token);
            token = '';
          }
        }
        if (token) {
          tokens.push(token);
        }
        return tokens;
      }

      function wrapOperandLabel(value, maxChars) {
        const text = String(value || '').trim();
        if (!text || text.length <= maxChars) {
          return text ? [text] : [];
        }

        const lines = [];
        let line = '';
        for (let token of splitOperandLabelTokens(text)) {
          while (token.length > maxChars) {
            if (line) {
              lines.push(line);
              line = '';
            }
            lines.push(token.slice(0, maxChars));
            token = token.slice(maxChars);
          }
          if (!token) {
            continue;
          }
          if (!line) {
            line = token;
          } else if (line.length + token.length <= maxChars) {
            line += token;
          } else {
            lines.push(line);
            line = token;
          }
        }
        if (line) {
          lines.push(line);
        }
        return lines.length ? lines : [text];
      }

      function rememberOriginalAttribute(element, attributeName) {
        const key = 'actOriginal' + attributeName.slice(0, 1).toUpperCase() + attributeName.slice(1).replace(/-/g, '');
        if (element.dataset[key] === undefined) {
          element.dataset[key] = element.getAttribute(attributeName) || '';
        }
        return key;
      }

      function restoreOriginalAttribute(element, attributeName) {
        const key = 'actOriginal' + attributeName.slice(0, 1).toUpperCase() + attributeName.slice(1).replace(/-/g, '');
        if (element.dataset[key] === undefined) {
          return;
        }
        const original = element.dataset[key];
        if (original) {
          element.setAttribute(attributeName, original);
        } else {
          element.removeAttribute(attributeName);
        }
      }

      function removeGeneratedOperandLabelLines(tspan) {
        let sibling = tspan.nextSibling;
        while (sibling) {
          const nextSibling = sibling.nextSibling;
          if (sibling.nodeType === 1 && sibling.getAttribute('data-act-generated-label-line') === 'true') {
            sibling.remove();
            sibling = nextSibling;
            continue;
          }
          break;
        }
      }

      function setOperandLabelVerticalOffset(textElement, offset) {
        rememberOriginalAttribute(textElement, 'transform');
        const originalTransform = textElement.dataset.actOriginalTransform || '';
        if (!offset) {
          if (originalTransform) {
            textElement.setAttribute('transform', originalTransform);
          } else {
            textElement.removeAttribute('transform');
          }
          textElement.dataset.actOperandLabelOffset = '0';
          return;
        }
        const translate = 'translate(0 ' + offset.toFixed(1) + ')';
        textElement.setAttribute('transform', originalTransform ? originalTransform + ' ' + translate : translate);
        textElement.dataset.actOperandLabelOffset = String(offset);
      }

      function getShiftedRect(rect, offset) {
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top + offset,
          bottom: rect.bottom + offset,
          width: rect.width,
          height: rect.height
        };
      }

      function doRectsOverlap(first, second) {
        const paddingX = 4;
        const paddingY = 2;
        return first.left < second.right + paddingX &&
          first.right + paddingX > second.left &&
          first.top < second.bottom + paddingY &&
          first.bottom + paddingY > second.top;
      }

      function spreadOperandLabels(root) {
        const scope = root && root.querySelectorAll ? root : document;
        const labels = Array.from(scope.querySelectorAll('svg text[data-act-operand-label="true"][data-act-diagram-language="LAD"]'));
        if (!labels.length) {
          return;
        }

        const groupedLabels = new Map();
        for (const label of labels) {
          setOperandLabelVerticalOffset(label, 0);
          const group = label.closest('svg.network-body') || label.ownerSVGElement || document.body;
          const items = groupedLabels.get(group) || [];
          items.push(label);
          groupedLabels.set(group, items);
        }

        for (const groupLabels of groupedLabels.values()) {
          const candidates = groupLabels
            .map(element => ({ element, rect: element.getBoundingClientRect() }))
            .filter(item => item.rect.width > 0 && item.rect.height > 0)
            .sort((first, second) => first.rect.top - second.rect.top || first.rect.left - second.rect.left);
          const placedRects = [];
          for (const candidate of candidates) {
            const laneGap = Math.min(34, Math.max(10, candidate.rect.height + 2));
            let selectedOffset = 0;
            for (let lane = 0; lane < 8; lane++) {
              const offset = lane === 0 ? 0 : -lane * laneGap;
              const shiftedRect = getShiftedRect(candidate.rect, offset);
              if (!placedRects.some(rect => doRectsOverlap(rect, shiftedRect))) {
                selectedOffset = offset;
                placedRects.push(shiftedRect);
                break;
              }
              if (lane === 7) {
                selectedOffset = offset;
                placedRects.push(shiftedRect);
              }
            }
            setOperandLabelVerticalOffset(candidate.element, selectedOffset);
          }
        }
      }

      function renderOperandLabel(tspan, titleEl, displayName) {
        const textElement = tspan?.parentElement;
        if (!textElement) {
          return;
        }
        const diagramLanguage = getOperandDiagramLanguage(tspan);
        textElement.dataset.actOperandLabel = 'true';
        textElement.dataset.actDiagramLanguage = diagramLanguage || 'unknown';
        if (diagramLanguage !== 'LAD') {
          setOperandLabelVerticalOffset(textElement, 0);
        }
        const metrics = getOperandLabelMetrics(tspan);
        const lines = diagramLanguage === 'LAD'
          ? wrapOperandLabel(displayName, metrics.maxChars)
          : (displayName ? [displayName] : []);
        const labelKey = diagramLanguage + '|' + displayName + '|' + lines.join('|');
        if (tspan.getAttribute('data-act-visible-label') === labelKey) {
          return;
        }

        removeGeneratedOperandLabelLines(tspan);
        for (const child of Array.from(tspan.childNodes)) {
          if (child !== titleEl) {
            child.remove();
          }
        }
        if (tspan.firstChild !== titleEl) {
          tspan.insertBefore(titleEl, tspan.firstChild);
        }

        const x = tspan.getAttribute('x') || textElement.getAttribute('x') || '0';
        const anchor = tspan.getAttribute('text-anchor') || textElement.getAttribute('text-anchor') || '';
        const isWrapped = lines.length > 1;
        if (isWrapped) {
          rememberOriginalAttribute(tspan, 'x');
          rememberOriginalAttribute(tspan, 'dy');
          rememberOriginalAttribute(tspan, 'font-size');
          rememberOriginalAttribute(tspan, 'stroke');
          rememberOriginalAttribute(tspan, 'stroke-width');
          rememberOriginalAttribute(tspan, 'paint-order');
          tspan.setAttribute('x', x);
          const firstLineOffset = metrics.centerLines
            ? -(((lines.length - 1) * metrics.lineDy / 2) + 0.25)
            : -((lines.length + 0.45) * metrics.lineDy);
          tspan.setAttribute('dy', firstLineOffset.toFixed(2) + 'em');
          tspan.setAttribute('font-size', metrics.fontSize);
          tspan.setAttribute('stroke', 'var(--act-document-bg)');
          tspan.setAttribute('stroke-width', metrics.centerLines ? '2px' : '2px');
          tspan.setAttribute('paint-order', 'stroke');
        } else {
          restoreOriginalAttribute(tspan, 'x');
          restoreOriginalAttribute(tspan, 'dy');
          restoreOriginalAttribute(tspan, 'font-size');
          restoreOriginalAttribute(tspan, 'stroke');
          restoreOriginalAttribute(tspan, 'stroke-width');
          restoreOriginalAttribute(tspan, 'paint-order');
        }

        tspan.appendChild(document.createTextNode(lines[0] || displayName));
        let previousLine = tspan;
        for (const line of lines.slice(1)) {
          const lineTspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          lineTspan.setAttribute('data-act-generated-label-line', 'true');
          lineTspan.setAttribute('x', x);
          lineTspan.setAttribute('dy', metrics.lineDy.toFixed(2) + 'em');
          lineTspan.setAttribute('font-size', metrics.fontSize);
          lineTspan.setAttribute('stroke', 'var(--act-document-bg)');
          lineTspan.setAttribute('stroke-width', metrics.centerLines ? '2px' : '2px');
          lineTspan.setAttribute('paint-order', 'stroke');
          if (anchor) {
            lineTspan.setAttribute('text-anchor', anchor);
          }
          lineTspan.textContent = line;
          textElement.insertBefore(lineTspan, previousLine.nextSibling);
          previousLine = lineTspan;
        }
        tspan.setAttribute('data-act-visible-label', labelKey);
      }

      function expandActOperandLabels(root) {
        const scope = root && root.querySelectorAll ? root : document;
        const tspans = scope.querySelectorAll('tspan > title');
        for (const titleEl of tspans) {
          const tspan = titleEl.parentNode;
          if (!tspan) continue;
          const currentTitle = (titleEl.textContent || '').trim();
          const full = normalizeOperandName(currentTitle);
          if (!full || full === '...' || full === '…') continue;
          const displayName = currentTitle.split(/\\r?\\n/, 1)[0].trim();
          const comment = getOperandComment(displayName);
          if (comment) {
            const enhancedTitle = displayName + '\\n' + comment;
            if (titleEl.textContent !== enhancedTitle) {
              titleEl.textContent = enhancedTitle;
            }
          }
          renderOperandLabel(tspan, titleEl, displayName);
        }
        spreadOperandLabels(scope);
      }
      const operandLabelObserver = new MutationObserver(() => {
        try { patchNetworkComments(document.body); } catch (e) { /* swallow */ }
        try { expandActOperandLabels(document.body); } catch (e) { /* swallow */ }
        try { applyPendingNetworkBulkAction(); } catch (e) { /* swallow */ }
      });
      function startOperandLabelExpander() {
        try {
          patchNetworkComments(document.body);
          expandActOperandLabels(document.body);
          applyPendingNetworkBulkAction();
          operandLabelObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
        } catch (e) { /* ignore */ }
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideStatusBar, { once: true });
        document.addEventListener('DOMContentLoaded', startOperandLabelExpander, { once: true });
        document.addEventListener('DOMContentLoaded', installLayoutControls, { once: true });
        document.addEventListener('DOMContentLoaded', installNetworkContextMenu, { once: true });
      } else {
        hideStatusBar();
        startOperandLabelExpander();
        installLayoutControls();
        installNetworkContextMenu();
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
            refreshVariableComments();
            refreshNetworkComments();
            patchNetworkComments(document.body);
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
          hideStatusBar();
          patchNetworkComments(document.body);
          applyLayoutToggles();
          applyPendingNetworkBulkAction();
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
    })();`;
}
/**
 * Build the body of the ESM bootstrap `<script type="module">` that imports the
 * ACT polyfills + main bundle. The returned string does NOT include the
 * surrounding `<script>` tags.
 */
function buildActModuleBootstrap(data) {
    return `
    try {
      await import(${data.polyfillsImportJson});
      window.__tiaInstallActHistoryPatch?.('after-polyfills');
      await import(${data.mainImportJson});
    } catch (error) {
      const detail = error?.stack || error?.message || String(error || 'Unknown module loading error');
      window.__tiaPostActMessage?.('actError', { message: 'ACT module loading failed', detail });
      const statusElement = document.getElementById('act-preview-status');
      const statusTitle = statusElement?.querySelector('.title');
      const statusDetail = statusElement?.querySelector('.detail');
      if (statusTitle) statusTitle.textContent = 'ACT preview failed while loading modules.';
      if (statusDetail) statusDetail.textContent = detail;
    }
  `;
}
//# sourceMappingURL=previewClientScript.js.map