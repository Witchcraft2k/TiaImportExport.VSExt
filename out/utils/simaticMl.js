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
exports.detectSimaticMlFileType = detectSimaticMlFileType;
exports.validateAutomationComparePreviewFile = validateAutomationComparePreviewFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ACT_SUPPORTED_XML_TYPES = new Set([
    'block',
    'instancedb',
    'tagtable',
    'udt'
]);
/**
 * Detect STEP 7/SimaticML file type by reading a small header first and the
 * full file only if needed. Also classifies source-document extensions.
 */
function detectSimaticMlFileType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === '.s7dcl') {
        return 'sd';
    }
    if (extension === '.scl') {
        return 'scl';
    }
    if (extension === '.db') {
        return 'scl';
    }
    if (extension === '.s7res') {
        return 's7res';
    }
    if (extension !== '.xml') {
        return 'unknown';
    }
    try {
        const header = readFileHeader(filePath, 4096);
        const headerType = detectFromXmlContent(header);
        if (headerType !== 'unknown') {
            return headerType;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return detectFromXmlContent(content);
    }
    catch {
        return 'unknown';
    }
}
function validateAutomationComparePreviewFile(filePath) {
    if (path.extname(filePath).toLowerCase() !== '.xml') {
        return {
            supported: false,
            fileType: detectSimaticMlFileType(filePath),
            reason: 'Automation Compare Tool preview requires a SimaticML XML file.'
        };
    }
    const fileType = detectSimaticMlFileType(filePath);
    if (ACT_SUPPORTED_XML_TYPES.has(fileType)) {
        return { supported: true, fileType };
    }
    const reasons = {
        udt: '',
        block: '',
        instancedb: '',
        tagtable: '',
        watchtable: 'Watch/force table XML is detected, but Automation Compare Tool supports only STEP 7 code blocks, DBs, PLC tag tables and UDTs.',
        sd: 'SIMATIC Source Documents are not accepted by Automation Compare Tool preview; use SimaticML XML.',
        scl: 'SCL/DB source files are not accepted by Automation Compare Tool preview; use SimaticML XML.',
        s7res: 'Resource files are not standalone preview inputs; select a SimaticML XML file supported by Automation Compare Tool.',
        knowhow: 'Know-how protected block placeholders cannot be rendered in Automation Compare Tool.',
        unknown: 'The file was not recognized as a SimaticML XML object supported by Automation Compare Tool.'
    };
    return {
        supported: false,
        fileType,
        reason: reasons[fileType]
    };
}
function readFileHeader(filePath, byteCount) {
    const descriptor = fs.openSync(filePath, 'r');
    try {
        const buffer = Buffer.alloc(byteCount);
        const bytesRead = fs.readSync(descriptor, buffer, 0, byteCount, 0);
        return buffer.toString('utf-8', 0, bytesRead);
    }
    finally {
        fs.closeSync(descriptor);
    }
}
function detectFromXmlContent(content) {
    if (content.includes('<KnowHowProtectedBlock>')) {
        return 'knowhow';
    }
    if (content.includes('SW.Blocks.InstanceDB')) {
        return 'instancedb';
    }
    if (content.includes('SW.Types.PlcStruct') || content.includes('SW.Types.')) {
        return 'udt';
    }
    if (content.includes('SW.Blocks.')) {
        return 'block';
    }
    if (content.includes('SW.Tags.')) {
        return 'tagtable';
    }
    if (content.includes('SW.WatchAndForceTables.')) {
        return 'watchtable';
    }
    return 'unknown';
}
//# sourceMappingURL=simaticMl.js.map