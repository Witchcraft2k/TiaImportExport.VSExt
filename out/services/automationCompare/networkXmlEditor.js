"use strict";
/**
 * Text-based editor for SimaticML PLC code blocks that removes a single
 * `<SW.Blocks.CompileUnit>` (= one LAD/FBD/STL network) identified by its
 * 1-based document order.
 *
 * Why text-based (not a DOM serializer):
 *  - SimaticML files are produced by TIA Portal Openness with very specific
 *    formatting (indentation, attribute order). Re-serializing through an XML
 *    library reformats unrelated nodes which then breaks `git diff` review
 *    and round-trips through TIA Portal Import.
 *  - The CompileUnit element does not carry a `<Number>` field — the network
 *    number is implicit by document order (this matches the webview's own
 *    `getRenderedNetworkNumber` logic in previewClientScript.ts).
 *
 * The function counts top-level `<SW.Blocks.CompileUnit` opens and matches
 * the closing `</SW.Blocks.CompileUnit>` while ignoring nested unrelated
 * tags. It returns the modified document and the removed slice for undo.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.countCompileUnits = countCompileUnits;
exports.findCompileUnitPosition = findCompileUnitPosition;
exports.removeNetworkFromBlockXml = removeNetworkFromBlockXml;
exports.clearNetworkLogic = clearNetworkLogic;
const OPEN_TAG = '<SW.Blocks.CompileUnit';
const CLOSE_TAG = '</SW.Blocks.CompileUnit>';
/**
 * Locate the start (offset of `<`) and end (offset just past `>`) of the
 * Nth `<SW.Blocks.CompileUnit ...> ... </SW.Blocks.CompileUnit>` block.
 * Returns null if the requested ordinal does not exist.
 */
function findCompileUnitRange(content, networkIndex) {
    let cursor = 0;
    let foundCount = 0;
    let targetStart = -1;
    while (cursor < content.length) {
        const openIdx = content.indexOf(OPEN_TAG, cursor);
        if (openIdx < 0) {
            break;
        }
        // Make sure this is a real element open (next char must be whitespace, '>' or '/')
        const charAfter = content.charAt(openIdx + OPEN_TAG.length);
        if (charAfter !== ' ' && charAfter !== '\t' && charAfter !== '\n' && charAfter !== '\r' && charAfter !== '>' && charAfter !== '/') {
            cursor = openIdx + OPEN_TAG.length;
            continue;
        }
        foundCount++;
        if (foundCount === networkIndex) {
            targetStart = openIdx;
        }
        // Move cursor past this open tag's '>' to keep scanning for siblings.
        const gt = content.indexOf('>', openIdx + OPEN_TAG.length);
        if (gt < 0) {
            return null;
        }
        // Self-closing? <SW.Blocks.CompileUnit ... />
        if (content.charAt(gt - 1) === '/') {
            if (targetStart === openIdx) {
                return { start: openIdx, end: gt + 1, total: -1 };
            }
            cursor = gt + 1;
            continue;
        }
        // Otherwise find matching close, accounting for nested SW.Blocks.CompileUnit
        // (shouldn't occur but we stay safe).
        let depth = 1;
        let scan = gt + 1;
        while (scan < content.length && depth > 0) {
            const nextOpen = content.indexOf(OPEN_TAG, scan);
            const nextClose = content.indexOf(CLOSE_TAG, scan);
            if (nextClose < 0) {
                return null;
            }
            if (nextOpen >= 0 && nextOpen < nextClose) {
                const c2 = content.charAt(nextOpen + OPEN_TAG.length);
                if (c2 === ' ' || c2 === '\t' || c2 === '\n' || c2 === '\r' || c2 === '>' || c2 === '/') {
                    depth++;
                }
                scan = nextOpen + OPEN_TAG.length;
            }
            else {
                depth--;
                scan = nextClose + CLOSE_TAG.length;
                if (depth === 0) {
                    if (targetStart === openIdx) {
                        // Continue counting siblings to compute total before returning.
                        cursor = scan;
                        let total = foundCount;
                        let probe = cursor;
                        while (probe < content.length) {
                            const moreOpen = content.indexOf(OPEN_TAG, probe);
                            if (moreOpen < 0)
                                break;
                            const c3 = content.charAt(moreOpen + OPEN_TAG.length);
                            if (c3 === ' ' || c3 === '\t' || c3 === '\n' || c3 === '\r' || c3 === '>' || c3 === '/') {
                                total++;
                            }
                            probe = moreOpen + OPEN_TAG.length;
                        }
                        return { start: openIdx, end: scan, total };
                    }
                    cursor = scan;
                    break;
                }
            }
        }
        if (depth !== 0) {
            return null;
        }
    }
    return null;
}
/**
 * Count `<SW.Blocks.CompileUnit>` siblings in document order.
 */
function countCompileUnits(content) {
    let count = 0;
    let cursor = 0;
    while (cursor < content.length) {
        const idx = content.indexOf(OPEN_TAG, cursor);
        if (idx < 0)
            break;
        const c = content.charAt(idx + OPEN_TAG.length);
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '>' || c === '/') {
            count++;
        }
        cursor = idx + OPEN_TAG.length;
    }
    return count;
}
/**
 * Locate the 0-based offset (and resulting 1-based line/column) of the Nth
 * `<SW.Blocks.CompileUnit>` open tag in a SimaticML document. Returns null
 * when the network does not exist.
 */
function findCompileUnitPosition(content, networkIndex) {
    if (!Number.isInteger(networkIndex) || networkIndex < 1) {
        return null;
    }
    let cursor = 0;
    let found = 0;
    while (cursor < content.length) {
        const idx = content.indexOf(OPEN_TAG, cursor);
        if (idx < 0)
            break;
        const c = content.charAt(idx + OPEN_TAG.length);
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '>' || c === '/') {
            found++;
            if (found === networkIndex) {
                // Compute 1-based line / column from absolute offset.
                let line = 1;
                let lineStart = 0;
                for (let i = 0; i < idx; i++) {
                    if (content.charCodeAt(i) === 10 /* \n */) {
                        line++;
                        lineStart = i + 1;
                    }
                }
                return { offset: idx, line, column: idx - lineStart + 1 };
            }
        }
        cursor = idx + OPEN_TAG.length;
    }
    return null;
}
/**
 * Remove the Nth (1-based) `<SW.Blocks.CompileUnit>` from a SimaticML block
 * XML document. Throws on out-of-range / not-found.
 *
 * Note: remaining networks are NOT renumbered — SimaticML CompileUnits carry
 * no explicit Number element, network ordering is purely document order, and
 * TIA Portal Import is fine with the new (shifted) ordering.
 */
function removeNetworkFromBlockXml(content, networkIndex) {
    if (!Number.isInteger(networkIndex) || networkIndex < 1) {
        throw new Error(`Invalid network index: ${networkIndex}. Must be a positive integer.`);
    }
    const range = findCompileUnitRange(content, networkIndex);
    if (!range) {
        const total = countCompileUnits(content);
        throw new Error(`Network ${networkIndex} not found in document (block contains ${total} network(s)).`);
    }
    // Extend `start` backward over the leading whitespace on the same line so
    // we don't leave an orphan blank line behind in the output.
    let start = range.start;
    while (start > 0) {
        const prev = content.charAt(start - 1);
        if (prev === ' ' || prev === '\t') {
            start--;
            continue;
        }
        if (prev === '\n') {
            // Eat one trailing newline that belonged to the removed element.
            break;
        }
        break;
    }
    let end = range.end;
    // Also consume the newline that follows the close tag so the surrounding
    // siblings stay vertically aligned.
    if (content.charAt(end) === '\r')
        end++;
    if (content.charAt(end) === '\n')
        end++;
    const removedSlice = content.slice(start, end);
    const updatedContent = content.slice(0, start) + content.slice(end);
    const total = range.total >= 0 ? range.total : countCompileUnits(content);
    return {
        updatedContent,
        totalNetworks: total,
        removedIndex: networkIndex,
        removedSlice
    };
}
/**
 * Clear the logic content of the Nth `<SW.Blocks.CompileUnit>` by replacing
 * its `<NetworkSource>...</NetworkSource>` element with a self-closing
 * `<NetworkSource />`. The CompileUnit envelope, programming language,
 * title and comment metadata are preserved.
 *
 * No-op (changed=false) when the NetworkSource is already empty / self-closing.
 * Throws when the requested network or NetworkSource cannot be located.
 */
function clearNetworkLogic(content, networkIndex) {
    if (!Number.isInteger(networkIndex) || networkIndex < 1) {
        throw new Error(`Invalid network index: ${networkIndex}. Must be a positive integer.`);
    }
    const range = findCompileUnitRange(content, networkIndex);
    if (!range) {
        const total = countCompileUnits(content);
        throw new Error(`Network ${networkIndex} not found in document (block contains ${total} network(s)).`);
    }
    const NS_OPEN = '<NetworkSource';
    const NS_CLOSE = '</NetworkSource>';
    const unitText = content.slice(range.start, range.end);
    // Locate <NetworkSource ...> inside this CompileUnit only.
    let nsOpenRel = -1;
    let probe = 0;
    while (probe < unitText.length) {
        const idx = unitText.indexOf(NS_OPEN, probe);
        if (idx < 0)
            break;
        const c = unitText.charAt(idx + NS_OPEN.length);
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '>' || c === '/') {
            nsOpenRel = idx;
            break;
        }
        probe = idx + NS_OPEN.length;
    }
    if (nsOpenRel < 0) {
        throw new Error(`Network ${networkIndex} has no <NetworkSource> element.`);
    }
    const gtRel = unitText.indexOf('>', nsOpenRel + NS_OPEN.length);
    if (gtRel < 0) {
        throw new Error(`Malformed <NetworkSource> tag in network ${networkIndex}.`);
    }
    // Compute indent of the NetworkSource open tag for tidy replacement.
    let lineStart = nsOpenRel;
    while (lineStart > 0 && unitText.charAt(lineStart - 1) !== '\n') {
        lineStart--;
    }
    const indent = unitText.slice(lineStart, nsOpenRel);
    // Self-closing already? Treat as empty / no-op.
    if (unitText.charAt(gtRel - 1) === '/') {
        return { updatedContent: content, clearedIndex: networkIndex, changed: false };
    }
    const closeRel = unitText.indexOf(NS_CLOSE, gtRel + 1);
    if (closeRel < 0) {
        throw new Error(`Unterminated <NetworkSource> in network ${networkIndex}.`);
    }
    const innerText = unitText.slice(gtRel + 1, closeRel);
    if (innerText.trim().length === 0) {
        return { updatedContent: content, clearedIndex: networkIndex, changed: false };
    }
    // Preserve any attributes on the original open tag.
    const openAttrsText = unitText.slice(nsOpenRel + NS_OPEN.length, gtRel).replace(/\s+$/, '');
    const selfClosing = `<NetworkSource${openAttrsText} />`;
    const beforeUnit = content.slice(0, range.start);
    const afterUnit = content.slice(range.end);
    // Drop the original NetworkSource entirely (open + body + close) and the
    // leading indent we just measured, then insert the freshly indented
    // self-closing variant.
    const newUnit = unitText.slice(0, lineStart) +
        indent + selfClosing +
        unitText.slice(closeRel + NS_CLOSE.length);
    return {
        updatedContent: beforeUnit + newUnit + afterUnit,
        clearedIndex: networkIndex,
        changed: true
    };
}
//# sourceMappingURL=networkXmlEditor.js.map