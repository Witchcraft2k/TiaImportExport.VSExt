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
exports.sortBlocksByDependencies = sortBlocksByDependencies;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const KIND_PRIORITY = {
    FC: 0,
    FB: 1,
    OB: 2,
    GlobalDB: 3,
    InstanceDB: 4,
    Unknown: 99
};
// SIMATIC / IEC library blocks that must not be treated as user-block dependencies
const BUILTIN_BLOCK_NAMES = new Set([
    'TON_TIME', 'TOF_TIME', 'TP_TIME', 'TONR_TIME',
    'TON_LTIME', 'TOF_LTIME', 'TP_LTIME', 'TONR_LTIME',
    'IEC_TIMER', 'IEC_LTIMER',
    'IEC_COUNTER', 'IEC_SCOUNTER', 'IEC_DCOUNTER', 'IEC_UCOUNTER', 'IEC_UDCOUNTER',
    'CTU', 'CTD', 'CTUD',
    'CTU_DINT', 'CTD_DINT', 'CTUD_DINT',
    'CTU_UDINT', 'CTD_UDINT', 'CTUD_UDINT',
    'CTU_LINT', 'CTD_LINT', 'CTUD_LINT',
    'CTU_ULINT', 'CTD_ULINT', 'CTUD_ULINT',
    'R_TRIG', 'F_TRIG',
    'ERRORSTRUCT'
].map(s => s.toUpperCase()));
// ---- Regex helpers ----------------------------------------------------------
// <CallInfo Name="X" BlockType="FB|FC|..."/>  — occurs in LAD/FBD <Call> and SCL/STL <Access Scope="Call">
const CALL_INFO_REGEX = /<CallInfo\b([^/>]*)\/?>/g;
const NAME_ATTR_REGEX = /\bName="([^"]+)"/;
const BLOCKTYPE_ATTR_REGEX = /\bBlockType="([^"]+)"/;
// AttributeList/Name for the block itself (first occurrence wins)
const ATTRLIST_NAME_REGEX = /<AttributeList>[\s\S]*?<Name>([^<]+)<\/Name>/;
const INSTANCE_OF_NAME_REGEX = /<InstanceOfName>([^<]+)<\/InstanceOfName>/;
// Embedded SCL/STL in XML (tokens and literal text)
const TOKEN_REGEX = /<Token\b[^>]*Text="([^"]+)"[^>]*\/?>/g;
// Quoted identifiers in SCL / STL source or SCL tokens
const SCL_LINE_COMMENT = /\/\/[^\n]*/g;
const SCL_BLOCK_COMMENT = /\(\*[\s\S]*?\*\)/g;
const QUOTED_IDENTIFIER_REGEX = /"([A-Za-z_][A-Za-z0-9_]*)"/g;
// Source header: FUNCTION_BLOCK "Name" / FUNCTION "Name" / etc.
const SOURCE_HEADER_REGEX = /\b(FUNCTION_BLOCK|FUNCTION|ORGANIZATION_BLOCK|DATA_BLOCK|TYPE)\s+"([^"]+)"/i;
// Instance DB pattern in SCL: DATA_BLOCK "IdbX" ... "ParentFb"
const DATA_BLOCK_INSTANCE_REGEX = /DATA_BLOCK\s+"([^"]+)"[\s\S]*?"([A-Za-z_][A-Za-z0-9_]*)"/i;
// Block element detection in XML
const BLOCK_ELEMENT_REGEX = /<SW\.Blocks\.(OB|FC|FB|DB|GlobalDB|InstanceDB)\b/;
// ---- XML parsing ------------------------------------------------------------
function parseXmlBlock(filePath, content) {
    const blockMatch = content.match(BLOCK_ELEMENT_REGEX);
    if (!blockMatch) {
        return null;
    }
    const blockTypeStr = blockMatch[1];
    const kind = blockTypeStr === 'OB' ? 'OB' :
        blockTypeStr === 'FC' ? 'FC' :
            blockTypeStr === 'FB' ? 'FB' :
                blockTypeStr === 'InstanceDB' ? 'InstanceDB' :
                    /* DB | GlobalDB */ 'GlobalDB';
    const nameMatch = content.match(ATTRLIST_NAME_REGEX);
    const blockName = (nameMatch?.[1] ?? path.basename(filePath, path.extname(filePath))).trim();
    const dependencies = new Set();
    // Instance DB parent FB
    if (kind === 'InstanceDB') {
        const instOf = content.match(INSTANCE_OF_NAME_REGEX);
        if (instOf?.[1]) {
            dependencies.add(instOf[1].trim());
        }
    }
    // <CallInfo ...> elements (both LAD/FBD and SCL/STL forms)
    let m;
    CALL_INFO_REGEX.lastIndex = 0;
    while ((m = CALL_INFO_REGEX.exec(content)) !== null) {
        const attrs = m[1];
        const name = attrs.match(NAME_ATTR_REGEX)?.[1]?.trim();
        if (!name) {
            continue;
        }
        if (BUILTIN_BLOCK_NAMES.has(name.toUpperCase())) {
            continue;
        }
        const bt = attrs.match(BLOCKTYPE_ATTR_REGEX)?.[1];
        // Skip UDT/FBT/FCT references - those are data-type references, not block calls
        if (bt === 'UDT' || bt === 'FBT' || bt === 'FCT') {
            continue;
        }
        dependencies.add(name);
    }
    // SCL tokens embedded in XML: <Token Text="..."/> — pick up quoted names that
    // reference other blocks (useful for SCL blocks exported to XML).
    TOKEN_REGEX.lastIndex = 0;
    while ((m = TOKEN_REGEX.exec(content)) !== null) {
        const text = decodeXmlEntities(m[1]);
        collectQuotedIdentifiers(text, dependencies);
    }
    dependencies.delete(blockName);
    return { filePath, blockName, kind, dependencies };
}
function parseTextBlock(filePath, content) {
    const stripped = content
        .replace(SCL_BLOCK_COMMENT, ' ')
        .replace(SCL_LINE_COMMENT, ' ');
    let blockName = path.basename(filePath, path.extname(filePath));
    let kind = 'Unknown';
    const header = stripped.match(SOURCE_HEADER_REGEX);
    if (header) {
        const kw = header[1].toUpperCase();
        blockName = header[2].trim();
        kind =
            kw === 'FUNCTION_BLOCK' ? 'FB' :
                kw === 'FUNCTION' ? 'FC' :
                    kw === 'ORGANIZATION_BLOCK' ? 'OB' :
                        kw === 'DATA_BLOCK' ? 'GlobalDB' :
                            'Unknown';
    }
    const dependencies = new Set();
    // Detect Instance DB source: DATA_BLOCK "Name" ... "ParentFb"
    if (kind === 'GlobalDB') {
        const idb = stripped.match(DATA_BLOCK_INSTANCE_REGEX);
        if (idb && idb[2] && idb[2].trim().toUpperCase() !== blockName.toUpperCase()) {
            kind = 'InstanceDB';
            dependencies.add(idb[2].trim());
        }
    }
    collectQuotedIdentifiers(stripped, dependencies);
    dependencies.delete(blockName);
    return { filePath, blockName, kind, dependencies };
}
function collectQuotedIdentifiers(text, out) {
    QUOTED_IDENTIFIER_REGEX.lastIndex = 0;
    let m;
    while ((m = QUOTED_IDENTIFIER_REGEX.exec(text)) !== null) {
        const name = m[1].trim();
        if (!name) {
            continue;
        }
        if (BUILTIN_BLOCK_NAMES.has(name.toUpperCase())) {
            continue;
        }
        out.add(name);
    }
}
function decodeXmlEntities(s) {
    return s
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}
function parseBlockFile(filePath) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        const content = fs.readFileSync(filePath, 'utf-8');
        if (ext === '.xml') {
            return parseXmlBlock(filePath, content);
        }
        if (ext === '.scl' || ext === '.db' || ext === '.s7dcl') {
            return parseTextBlock(filePath, content);
        }
        return null;
    }
    catch {
        return null;
    }
}
// ---- Topological sort -------------------------------------------------------
/**
 * Sort block files (regular blocks + Instance DBs) by call/usage dependencies.
 * Referenced blocks come first; InstanceDB follows its parent FB.
 * Files that cannot be parsed are appended at the end in their input order.
 */
function sortBlocksByDependencies(blockFiles) {
    if (blockFiles.length <= 1) {
        return [...blockFiles];
    }
    const infos = [];
    const nameToFile = new Map(); // upper-case name -> file
    for (const f of blockFiles) {
        const info = parseBlockFile(f);
        if (info && info.blockName) {
            infos.push(info);
            const key = info.blockName.toUpperCase();
            if (!nameToFile.has(key)) {
                nameToFile.set(key, f);
            }
        }
    }
    if (infos.length === 0) {
        return [...blockFiles];
    }
    // graph: dependency -> set(dependents)
    const graph = new Map();
    const inDegree = new Map();
    const infoByKey = new Map();
    for (const info of infos) {
        const key = info.blockName.toUpperCase();
        if (!graph.has(key)) {
            graph.set(key, new Set());
        }
        if (!inDegree.has(key)) {
            inDegree.set(key, 0);
        }
        if (!infoByKey.has(key)) {
            infoByKey.set(key, info);
        }
    }
    for (const info of infos) {
        const selfKey = info.blockName.toUpperCase();
        for (const dep of info.dependencies) {
            const depKey = dep.toUpperCase();
            if (depKey === selfKey) {
                continue;
            }
            if (!nameToFile.has(depKey)) {
                continue;
            } // external — ignore
            if (!graph.has(depKey)) {
                graph.set(depKey, new Set());
            }
            const dependents = graph.get(depKey);
            if (!dependents.has(selfKey)) {
                dependents.add(selfKey);
                inDegree.set(selfKey, (inDegree.get(selfKey) ?? 0) + 1);
            }
        }
    }
    const cmp = (a, b) => {
        const ka = infoByKey.get(a)?.kind ?? 'Unknown';
        const kb = infoByKey.get(b)?.kind ?? 'Unknown';
        const d = KIND_PRIORITY[ka] - KIND_PRIORITY[kb];
        return d !== 0 ? d : a.localeCompare(b);
    };
    const ready = [];
    for (const [name, deg] of inDegree) {
        if (deg === 0) {
            ready.push(name);
        }
    }
    ready.sort(cmp);
    const sortedKeys = [];
    while (ready.length > 0) {
        const current = ready.shift();
        sortedKeys.push(current);
        const dependents = graph.get(current);
        if (dependents && dependents.size > 0) {
            for (const d of dependents) {
                inDegree.set(d, (inDegree.get(d) ?? 1) - 1);
                if (inDegree.get(d) === 0) {
                    ready.push(d);
                }
            }
            ready.sort(cmp);
        }
    }
    // Map back to files; append unprocessed / unparseable in input order
    const usedFiles = new Set();
    const result = [];
    for (const key of sortedKeys) {
        const file = nameToFile.get(key);
        if (file && !usedFiles.has(file.toLowerCase())) {
            usedFiles.add(file.toLowerCase());
            result.push(file);
        }
    }
    for (const f of blockFiles) {
        const lower = f.toLowerCase();
        if (!usedFiles.has(lower)) {
            usedFiles.add(lower);
            result.push(f);
        }
    }
    return result;
}
//# sourceMappingURL=blockDependencySorter.js.map