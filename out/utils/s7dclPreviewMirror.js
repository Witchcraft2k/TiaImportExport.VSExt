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
exports.PREVIEW_MIRROR_DIR = void 0;
exports.isS7dclPreviewMirrorEnabled = isS7dclPreviewMirrorEnabled;
exports.getMirrorExportPath = getMirrorExportPath;
exports.findPreviewXmlForS7dcl = findPreviewXmlForS7dcl;
exports.detectPreviewStaleness = detectPreviewStaleness;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
/**
 * Helpers for the optional XML preview mirror that is written alongside
 * `.s7dcl` / `.s7res` exports so that the SIMATIC Automation Compare Tool
 * can render the block graphically without re-exporting from TIA Portal.
 *
 * Mirror layout (per device, sibling of `Program blocks`):
 *   <ws>/TiaExport/Projects/<proj>/Devices/<cat>/<dev>/Program blocks/<...>.s7dcl
 *   <ws>/TiaExport/Projects/<proj>/Devices/<cat>/<dev>/.tiaPreview/Program blocks/<...>.xml
 *
 * Fallback when no device root is detected in the path (rare: ad-hoc exports
 * outside the standard layout): `<ws>/.tiaPreview/<original-relative-path>`.
 */
exports.PREVIEW_MIRROR_DIR = '.tiaPreview';
/**
 * Returns true when the user has enabled the SD → XML preview mirror feature.
 * Default: enabled.
 */
function isS7dclPreviewMirrorEnabled() {
    return vscode.workspace
        .getConfiguration('tiaImport')
        .get('s7dclPreviewXml.enabled', true);
}
function findOwningWorkspace(targetPath) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return undefined;
    }
    const normalizedTarget = path.resolve(targetPath).toLowerCase();
    for (const folder of folders) {
        const folderPath = path.resolve(folder.uri.fsPath);
        const lower = folderPath.toLowerCase();
        if (normalizedTarget === lower || normalizedTarget.startsWith(lower + path.sep)) {
            return folderPath;
        }
    }
    // Fallback: treat the first workspace folder as the root for paths that
    // are not yet inside the workspace (e.g. brand-new export folder).
    return folders[0].uri.fsPath;
}
/**
 * Find the device root inside an export path. Returns the index of the
 * device-name segment (the segment immediately after `Devices/<Category>`),
 * or `-1` when the path does not follow the standard layout.
 */
function findDeviceRootIndex(segments) {
    for (let i = 0; i < segments.length - 2; i++) {
        if (segments[i].toLowerCase() === 'devices') {
            // segments[i+1] = category folder (PLCs/HMIs/IO_Devices/...);
            // segments[i+2] = device display name; mirror is rooted there.
            return i + 2;
        }
    }
    return -1;
}
/**
 * Map an export directory (where `.s7dcl` files will be written) to the
 * parallel `.tiaPreview/...` directory where the XML mirror should land.
 * Returns `undefined` when no workspace is open or the path escapes the
 * workspace root.
 */
function getMirrorExportPath(originalExportPath) {
    const ws = findOwningWorkspace(originalExportPath);
    if (!ws) {
        return undefined;
    }
    const absolute = path.resolve(originalExportPath);
    const relative = path.relative(ws, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return undefined;
    }
    const segments = relative.split(/[\\/]/).filter(Boolean);
    if (segments.length === 0) {
        return undefined;
    }
    // Avoid re-mirroring an already-mirrored path (legacy workspace-level layout).
    if (segments[0] === exports.PREVIEW_MIRROR_DIR || segments.includes(exports.PREVIEW_MIRROR_DIR)) {
        return undefined;
    }
    const deviceIdx = findDeviceRootIndex(segments);
    if (deviceIdx >= 0 && deviceIdx < segments.length) {
        // <ws>/<...up-to-and-including-deviceName>/.tiaPreview/<rest>
        const head = segments.slice(0, deviceIdx + 1);
        const tail = segments.slice(deviceIdx + 1);
        return path.join(ws, ...head, exports.PREVIEW_MIRROR_DIR, ...tail);
    }
    // Fallback: workspace-root mirror.
    return path.join(ws, exports.PREVIEW_MIRROR_DIR, relative);
}
/**
 * Locate the cached XML preview that corresponds to a given `.s7dcl` file.
 * Search order:
 *   1. per-device mirror: `<deviceRoot>/.tiaPreview/<rest>.xml`
 *   2. legacy workspace-level mirror: `<ws>/.tiaPreview/<relative>.xml`
 *   3. sibling `<basename>.xml` next to the `.s7dcl` file
 * Returns the absolute path or `undefined` when no preview is available.
 */
function findPreviewXmlForS7dcl(s7dclPath) {
    const absolute = path.resolve(s7dclPath);
    const ws = findOwningWorkspace(absolute);
    if (ws) {
        const relative = path.relative(ws, absolute);
        if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
            const segments = relative.split(/[\\/]/).filter(Boolean);
            const insidePreview = segments.includes(exports.PREVIEW_MIRROR_DIR);
            // (1) per-device mirror
            if (!insidePreview) {
                const deviceIdx = findDeviceRootIndex(segments);
                if (deviceIdx >= 0 && deviceIdx < segments.length) {
                    const head = segments.slice(0, deviceIdx + 1);
                    const tail = segments.slice(deviceIdx + 1);
                    const candidate = path.join(ws, ...head, exports.PREVIEW_MIRROR_DIR, ...tail).replace(/\.s7dcl$/i, '.xml');
                    if (fs.existsSync(candidate)) {
                        return candidate;
                    }
                }
            }
            // (2) legacy workspace-level mirror (back-compat with older exports)
            const previewRelative = insidePreview
                ? relative
                : path.join(exports.PREVIEW_MIRROR_DIR, relative);
            const legacyCandidate = path.join(ws, previewRelative.replace(/\.s7dcl$/i, '.xml'));
            if (fs.existsSync(legacyCandidate)) {
                return legacyCandidate;
            }
        }
    }
    // (3) sibling fallback
    const sibling = absolute.replace(/\.s7dcl$/i, '.xml');
    if (sibling !== absolute && fs.existsSync(sibling)) {
        return sibling;
    }
    return undefined;
}
/**
 * Detect whether the cached XML mirror is older than its SD source files.
 *
 * Heuristic: compare `mtime` of the `.s7dcl` (and its sibling `.s7res` if
 * present) against the `mtime` of the XML mirror. A small tolerance window
 * absorbs the natural ordering of "write XML right after the .s7dcl" during a
 * fresh export — the user's edits in the workspace always come long after, so
 * any positive delta beyond the tolerance is a reliable "stale" signal.
 *
 * Returns `{ stale: false }` when files cannot be stat-ed; callers should
 * treat that as "best-effort, proceed with preview".
 */
function detectPreviewStaleness(s7dclPath, xmlPath, toleranceMs = 120_000) {
    try {
        const xmlStat = fs.statSync(xmlPath);
        const xmlMtimeMs = xmlStat.mtimeMs;
        const candidates = [s7dclPath];
        const s7resPath = s7dclPath.replace(/\.s7dcl$/i, '.s7res');
        if (s7resPath !== s7dclPath && fs.existsSync(s7resPath)) {
            candidates.push(s7resPath);
        }
        let newest;
        for (const candidate of candidates) {
            try {
                const stat = fs.statSync(candidate);
                if (!newest || stat.mtimeMs > newest.mtimeMs) {
                    newest = { path: candidate, mtimeMs: stat.mtimeMs };
                }
            }
            catch {
                // ignore unreadable candidate
            }
        }
        if (!newest) {
            return { stale: false, xmlMtimeMs };
        }
        const delta = newest.mtimeMs - xmlMtimeMs;
        if (delta > toleranceMs) {
            return {
                stale: true,
                newerSourcePath: newest.path,
                sourceMtimeMs: newest.mtimeMs,
                xmlMtimeMs
            };
        }
        return {
            stale: false,
            sourceMtimeMs: newest.mtimeMs,
            xmlMtimeMs
        };
    }
    catch {
        return { stale: false };
    }
}
//# sourceMappingURL=s7dclPreviewMirror.js.map