"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseXmlErrors = parseXmlErrors;
exports.enhanceXmlErrors = enhanceXmlErrors;
const s7dclErrorParser_1 = require("./s7dclErrorParser");
/**
 * Parse XML import errors from TIA Portal error strings.
 *
 * Typical error formats from TIA Portal (via EngineeringException):
 *   "The 'Member' start tag on line 69 position 18 does not match the end tag of 'Section'. Line 70, position 17."
 *   "'' is an invalid value for the 'Name' attribute. Line 12, position 6."
 *   "'123' is not a valid value for 'UId'. Line 5, position 10."
 *
 * The error string from .NET wrapper may contain a preamble like:
 *   "Error when calling method 'Import' ...\n\nInvalid XML document.\nThe 'Member' start tag on line 69..."
 *
 * We extract all occurrences of "line N" / "Line N" with optional "position M".
 */
function parseXmlErrors(errorString) {
    if (!errorString) {
        return [];
    }
    const errors = [];
    // Split multi-line error into individual sentences/lines for context
    // TIA errors are typically separated by newlines or ". " 
    const lines = errorString.split(/\n/);
    for (const rawLine of lines) {
        // Skip preamble lines like "Error when calling method 'Import'..."
        // Only process lines that contain actual XML validation errors
        const lineRefPattern = /[Ll]ine\s+(\d+)(?:\s*,?\s*[Pp]osition\s+(\d+))?/g;
        const message = rawLine.trim();
        if (!message) {
            continue;
        }
        let match;
        // Use only the FIRST line/position reference — that's the actual error location.
        // Subsequent references (e.g. "Line 70, position 17") are just context about
        // where the mismatch was detected, not the root cause.
        match = lineRefPattern.exec(rawLine);
        if (match) {
            const lineNum = parseInt(match[1], 10);
            const col = match[2] ? parseInt(match[2], 10) : 0;
            if (lineNum > 0) {
                errors.push({
                    line: lineNum,
                    column: col,
                    message: message
                });
            }
        }
    }
    return errors;
}
/**
 * Enhanced error logging for XML file import failures.
 *
 * Parses the error string for line/position references,
 * registers diagnostics in the VS Code Problems panel,
 * and returns formatted error lines for the output channel.
 *
 * @param filePath - Local path to the XML file
 * @param errorString - The error string from TIA Portal (result.error)
 * @returns Formatted error lines, or null if no XML-specific errors with line numbers found
 */
function enhanceXmlErrors(filePath, errorString) {
    const errors = parseXmlErrors(errorString);
    if (errors.length === 0) {
        return null;
    }
    // ── Add diagnostics to Problems panel ──
    for (const error of errors) {
        (0, s7dclErrorParser_1.addDiagnostic)(filePath, error.line, error.column || 1, error.message, 'TIA Import (XML)');
    }
    // ── Format for output channel ──
    const formattedLines = [];
    for (const error of errors) {
        const colInfo = error.column ? `, col ${error.column}` : '';
        formattedLines.push(`     → (line ${error.line}${colInfo}): ${error.message}`);
        // Clickable link only for paths without spaces
        if (!filePath.includes(' ')) {
            formattedLines.push(`       ↳ ${filePath}:${error.line}:${error.column || 1}`);
        }
    }
    return formattedLines;
}
//# sourceMappingURL=s7xmlErrorParser.js.map