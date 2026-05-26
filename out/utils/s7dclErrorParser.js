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
exports.initS7dclDiagnostics = initS7dclDiagnostics;
exports.clearS7dclDiagnostics = clearS7dclDiagnostics;
exports.clearS7dclDiagnosticsForFile = clearS7dclDiagnosticsForFile;
exports.getS7dclDiagnosticsSnapshot = getS7dclDiagnosticsSnapshot;
exports.addDiagnostic = addDiagnostic;
exports.parseS7dclErrors = parseS7dclErrors;
exports.parseS7dclNetworks = parseS7dclNetworks;
exports.resolveS7dclErrorLines = resolveS7dclErrorLines;
exports.enhanceS7dclErrors = enhanceS7dclErrors;
const fs = __importStar(require("fs"));
const vscode = __importStar(require("vscode"));
// ── Diagnostic collection for TIA import errors ──────────────────────
let diagnosticCollection;
/**
 * Initialize the diagnostic collection. Call once during extension activation.
 */
function initS7dclDiagnostics(context) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('tia-import');
    context.subscriptions.push(diagnosticCollection);
}
/**
 * Clear all TIA import diagnostics (e.g. at the start of a new export operation).
 */
function clearS7dclDiagnostics() {
    diagnosticCollection?.clear();
}
/**
 * Clear diagnostics for a specific file.
 */
function clearS7dclDiagnosticsForFile(filePath) {
    diagnosticCollection?.delete(vscode.Uri.file(filePath));
}
/**
 * Snapshot of all current TIA import diagnostics for consumption by
 * Language Model Tools / programmatic callers.
 */
function getS7dclDiagnosticsSnapshot() {
    const out = [];
    if (!diagnosticCollection) {
        return out;
    }
    diagnosticCollection.forEach((uri, diags) => {
        for (const d of diags) {
            out.push({
                file: uri.fsPath,
                line: d.range.start.line + 1,
                column: d.range.start.character + 1,
                severity: d.severity === vscode.DiagnosticSeverity.Error ? 'error' :
                    d.severity === vscode.DiagnosticSeverity.Warning ? 'warning' :
                        d.severity === vscode.DiagnosticSeverity.Information ? 'information' : 'hint',
                message: d.message,
                source: d.source
            });
        }
    });
    return out;
}
/**
 * Add a diagnostic entry to the Problems panel for a specific file.
 */
function addDiagnostic(filePath, line, column, message, source) {
    if (!diagnosticCollection) {
        return;
    }
    const fileUri = vscode.Uri.file(filePath);
    // Convert to 0-based for VS Code Range
    const zeroLine = Math.max(line - 1, 0);
    const zeroCol = Math.max(column - 1, 0);
    const range = new vscode.Range(zeroLine, zeroCol, zeroLine, Number.MAX_SAFE_INTEGER);
    const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
    diagnostic.source = source;
    const existing = diagnosticCollection.get(fileUri) || [];
    diagnosticCollection.set(fileUri, [...existing, diagnostic]);
}
/**
 * Parse error string from TIA Portal ImportFromDocuments for .s7dcl files.
 *
 * Extracts individual errors with line numbers and network titles from the
 * compact error string format:
 * ```
 * Error: "desc'. Error in Line Number: N, in Network: { ... S7_NetworkTitle := "MLC_xxx" ... }" ; Error: "..." ; ...
 * ```
 */
function parseS7dclErrors(errorString) {
    const errors = [];
    // ── Pattern 1: "Error in Line Number: N" (with optional network context) ──
    // Format: Error: "desc'. Error in Line Number: N, in Network: { ... S7_NetworkTitle := "MLC_xxx" ... }" ; ...
    const lineRegex = /Error in Line Number:\s*(\d+)/gi;
    let match;
    while ((match = lineRegex.exec(errorString)) !== null) {
        const lineInNetwork = parseInt(match[1], 10);
        const matchIndex = match.index;
        const matchEnd = matchIndex + match[0].length;
        // --- Extract network title ---
        // Look AFTER the match for S7_NetworkTitle (within the network content block)
        // The network block ends at the next '" ;' or '}' or end of string
        const afterText = errorString.substring(matchEnd, Math.min(matchEnd + 1000, errorString.length));
        const titleMatch = afterText.match(/S7_NetworkTitle\s*:=\s*["']([^"']+)["']/i);
        const networkTitle = titleMatch ? titleMatch[1] : undefined;
        // --- Extract error description ---
        // Look backwards from "Error in Line Number" for the error text
        const beforeText = errorString.substring(0, matchIndex);
        // Find the start of this error message: the most recent boundary
        // Boundaries: '; Error: "' or start of string or '; ' followed by 'Error:'
        let descStart = 0;
        const lastBoundary = beforeText.lastIndexOf('; ');
        if (lastBoundary >= 0) {
            descStart = lastBoundary + 2;
        }
        let descText = beforeText.substring(descStart).trim();
        // Clean up: remove 'Error: "' prefix
        descText = descText.replace(/^Error:\s*"?/i, '');
        // Remove trailing quote, period, whitespace
        descText = descText.replace(/['".\s]+$/, '');
        // Truncate very long descriptions
        if (descText.length > 200) {
            descText = descText.substring(0, 197) + '...';
        }
        const errorDescription = descText || `Error at line ${lineInNetwork}`;
        errors.push({
            errorDescription,
            lineInNetwork,
            networkTitle,
        });
    }
    // ── Pattern 2: "Line number N:" (file-level errors without network context) ──
    // Format: "Line number 21: Syntax Error : Unexpected input 'S7_Language'; Import failed with error '...'"
    // Only try this pattern if Pattern 1 found nothing (different error format)
    if (errors.length === 0) {
        const lineNumRegex = /Line number\s+(\d+)\s*:\s*(.*?)(?=;\s*(?:Import failed|Line number\s+\d+)|$)/gi;
        while ((match = lineNumRegex.exec(errorString)) !== null) {
            const lineInNetwork = parseInt(match[1], 10);
            let descText = match[2].trim();
            // Remove trailing semicolons, quotes, whitespace
            descText = descText.replace(/[;'".\s]+$/, '');
            // Truncate very long descriptions
            if (descText.length > 200) {
                descText = descText.substring(0, 197) + '...';
            }
            errors.push({
                errorDescription: descText || `Error at line ${lineInNetwork}`,
                lineInNetwork,
                networkTitle: undefined,
            });
        }
    }
    return errors;
}
/**
 * Parse a .s7dcl file content to find NETWORK blocks and their MLC title IDs.
 *
 * In .s7dcl files the attribute block `{ S7_NetworkTitle := ... }` appears
 * BEFORE the `NETWORK` keyword, between the previous `END_NETWORK` (or `BEGIN`)
 * and the current `NETWORK`:
 *
 * ```
 * END_NETWORK          ← end of previous network
 * {
 *   S7_Language := "FBD";
 *   S7_NetworkTitle := "MLC_xxx"
 * }
 * NETWORK              ← start of this network (MLC_xxx)
 *   ...code...         ← line 1 in network
 * END_NETWORK
 * ```
 *
 * Alternative (less common): TITLE keyword right after NETWORK:
 * ```
 * NETWORK
 * TITLE = MLC_xxx
 * ```
 *
 * The NETWORK keyword line is the reference for calculating absolute line numbers
 * (line 1 in network = NETWORK_line + 1, line 2 = NETWORK_line + 2, etc.)
 */
function parseS7dclNetworks(fileContent) {
    const networks = [];
    const lines = fileContent.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trim();
        if (/^NETWORK\s*$/i.test(trimmedLine)) {
            let title;
            // Strategy 1: Look BEFORE the NETWORK keyword for attribute block
            // The attribute block { S7_NetworkTitle := "..." } appears between
            // the previous END_NETWORK/BEGIN and this NETWORK keyword
            for (let j = i - 1; j >= Math.max(i - 15, 0); j--) {
                const prevLine = lines[j].trim();
                // Found S7_NetworkTitle in attribute block
                const attrMatch = prevLine.match(/S7_NetworkTitle\s*:=\s*["']([^"']+)["']/i);
                if (attrMatch) {
                    title = attrMatch[1];
                    break;
                }
                // Stop searching backwards if we hit a structural keyword
                // (meaning there's no attribute block for this network)
                if (/^(END_NETWORK|BEGIN|END_FUNCTION|END_DATA|END_ORGANIZATION|NETWORK)\b/i.test(prevLine)) {
                    break;
                }
            }
            // Strategy 2: Look AFTER the NETWORK keyword for TITLE = syntax
            if (!title) {
                for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                    const nextLine = lines[j].trim();
                    if (nextLine.startsWith('TITLE = ') || nextLine.startsWith('TITLE =')) {
                        title = nextLine.substring(nextLine.indexOf('=') + 1).trim();
                        break;
                    }
                    // Stop if we encounter code content
                    if (/^(NETWORK|RUNG|END_RUNG|END_FUNCTION|END_NETWORK)\b/i.test(nextLine)) {
                        break;
                    }
                }
            }
            if (title) {
                networks.push({
                    title,
                    startLine: i + 1, // 1-based line of the NETWORK keyword
                });
            }
        }
    }
    return networks;
}
/**
 * Resolve absolute line numbers for parsed .s7dcl errors
 * by reading the source file and matching network titles.
 *
 * @param filePath - Path to the .s7dcl file
 * @param errors - Parsed errors from parseS7dclErrors
 * @returns Same errors array with absoluteLine resolved where possible
 */
function resolveS7dclErrorLines(filePath, errors) {
    if (errors.length === 0) {
        return errors;
    }
    // For errors without networkTitle, the line number IS the absolute line
    // (file-level errors reported by TIA with "Line number N:" format)
    for (const error of errors) {
        if (!error.networkTitle) {
            error.absoluteLine = error.lineInNetwork;
        }
    }
    // Only read the file if there are network-level errors needing resolution
    const needsNetworkResolution = errors.some(e => e.networkTitle && !e.absoluteLine);
    if (!needsNetworkResolution) {
        return errors;
    }
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const networks = parseS7dclNetworks(content);
        for (const error of errors) {
            if (error.networkTitle && !error.absoluteLine) {
                const network = networks.find(n => n.title === error.networkTitle);
                if (network) {
                    // Absolute line = NETWORK keyword line + relative line number from error
                    // lineInNetwork is 1-based (line 1 = first line after NETWORK keyword)
                    error.absoluteLine = network.startLine + error.lineInNetwork - 1;
                }
            }
        }
    }
    catch {
        // File read failed - absoluteLine remains undefined
    }
    return errors;
}
/**
 * Format a single resolved error as a log line for the output channel.
 *
 * - Paths WITHOUT spaces: appends `path:line:col` (clickable + navigates to line in VS Code output)
 * - Paths WITH spaces: no link in output (VS Code can't navigate to line via file:// URIs);
 *   use the Problems panel (Ctrl+Shift+M) instead — diagnostics are registered there.
 */
function formatSingleError(filePath, error) {
    const lines = [];
    // Error description with network context
    const networkInfo = error.networkTitle
        ? `Network "${error.networkTitle}", line ${error.lineInNetwork}`
        : `line ${error.lineInNetwork}`;
    const lineInfo = (error.absoluteLine && error.networkTitle) ? ` → line ${error.absoluteLine}` : '';
    lines.push(`     → (${networkInfo}${lineInfo}): ${error.errorDescription}`);
    // Clickable link only for paths without spaces (path:line:col works in VS Code output)
    if (!filePath.includes(' ') && error.absoluteLine) {
        lines.push(`       ↳ ${filePath}:${error.absoluteLine}:1`);
    }
    return lines;
}
/**
 * Enhanced error logging for .s7dcl file import failures.
 *
 * Parses the compact error string, resolves absolute line numbers,
 * and returns formatted error lines for display in the output channel.
 * Also adds errors to the VS Code Problems panel (Diagnostics) so
 * users can click and navigate directly to the file:line.
 *
 * @param filePath - Local path to the .s7dcl file
 * @param errorString - The error string from TIA Portal (result.error)
 * @returns Formatted error lines, or null if no .s7dcl-specific errors found
 */
function enhanceS7dclErrors(filePath, errorString) {
    const errors = parseS7dclErrors(errorString);
    if (errors.length === 0) {
        return null;
    }
    // Resolve absolute line numbers by reading the file
    resolveS7dclErrorLines(filePath, errors);
    // ── Add diagnostics to Problems panel ──
    if (diagnosticCollection) {
        const fileUri = vscode.Uri.file(filePath);
        const diagnostics = [];
        for (const error of errors) {
            // Use resolved absolute line (0-based for VS Code Range), or 0 if unresolved
            const line = error.absoluteLine ? error.absoluteLine - 1 : 0;
            const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
            const networkInfo = error.networkTitle
                ? ` [Network "${error.networkTitle}", line ${error.lineInNetwork}]`
                : '';
            const diagnostic = new vscode.Diagnostic(range, `${error.errorDescription}${networkInfo}`, vscode.DiagnosticSeverity.Error);
            diagnostic.source = 'TIA Import (SD)';
            diagnostics.push(diagnostic);
        }
        // Append to existing diagnostics for this file (multiple error batches possible)
        const existing = diagnosticCollection.get(fileUri) || [];
        diagnosticCollection.set(fileUri, [...existing, ...diagnostics]);
    }
    // ── Format for output channel ──
    const formattedLines = [];
    for (const error of errors) {
        formattedLines.push(...formatSingleError(filePath, error));
    }
    return formattedLines;
}
//# sourceMappingURL=s7dclErrorParser.js.map