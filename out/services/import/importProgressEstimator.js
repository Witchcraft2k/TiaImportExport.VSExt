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
exports.TimedImportProgress = void 0;
exports.estimateImportProgressForDevices = estimateImportProgressForDevices;
exports.formatImportProgressEstimate = formatImportProgressEstimate;
exports.estimateHwConfigImportProgressForDevices = estimateHwConfigImportProgressForDevices;
exports.formatHwConfigProgressEstimate = formatHwConfigProgressEstimate;
const vscode = __importStar(require("vscode"));
const models_1 = require("../../models");
const DEFAULT_ITEMS_PER_SECOND = 1;
const MIN_ESTIMATED_SECONDS = 5;
const DEVICE_SETUP_UNITS = 1;
const PLC_SETUP_UNITS = 1;
const DEVICE_SETUP_SECONDS = 0.5;
const PLC_SETUP_SECONDS = 0.5;
const FINAL_PROGRESS_HEADROOM = 0.5;
const ESTIMATION_SAFETY_FACTOR = 1.10;
// Calibrated from a real large PLC import: 563 blocks (+ ACT XML mirror),
// 1391 UDTs, 9 tag tables and 162 watch tables completed in about 232s.
const SD_BLOCK_SECONDS = 0.28;
const SOURCE_BLOCK_SECONDS = 0.08;
const XML_BLOCK_SECONDS = 0.10;
const ACT_PREVIEW_XML_SECONDS = 0.10;
const TAG_TABLE_SECONDS = 0.40;
const UDT_SECONDS = 0.022;
const WATCH_TABLE_SECONDS = 0.033;
// Calibrated from category HW Config import: 30 IO devices completed in about 358s.
const HW_CONFIG_DEVICE_SECONDS = 11.92;
function estimateImportProgressForDevices(devices, options) {
    let plcCount = 0;
    let blockCount = 0;
    let sdBlockCount = 0;
    let sourceBlockCount = 0;
    let xmlBlockCount = 0;
    let previewMirrorBlockCount = 0;
    let tagTableCount = 0;
    let udtCount = 0;
    let watchTableCount = 0;
    let weightedSeconds = 0;
    for (const device of devices) {
        weightedSeconds += DEVICE_SETUP_SECONDS;
        for (const plc of device.plcSoftware) {
            plcCount++;
            weightedSeconds += PLC_SETUP_SECONDS;
            const blocks = collectPlcBlocks(plc, options.excludeSystemBlocks);
            blockCount += blocks.length;
            const blockTiming = estimateBlockTiming(blocks, options);
            sdBlockCount += blockTiming.sdBlockCount;
            sourceBlockCount += blockTiming.sourceBlockCount;
            xmlBlockCount += blockTiming.xmlBlockCount;
            weightedSeconds += blockTiming.weightedSeconds;
            if (options.exportFormat === 'sd' && options.s7dclPreviewXmlEnabled) {
                previewMirrorBlockCount += blocks.length;
                weightedSeconds += blocks.length * ACT_PREVIEW_XML_SECONDS;
            }
            const plcTagTableCount = countUniqueTagTables(plc);
            const plcUdtCount = countUniqueUdts(plc);
            const plcWatchTableCount = countUniqueWatchTables(plc);
            tagTableCount += plcTagTableCount;
            udtCount += plcUdtCount;
            watchTableCount += plcWatchTableCount;
            weightedSeconds += plcTagTableCount * TAG_TABLE_SECONDS;
            weightedSeconds += plcUdtCount * UDT_SECONDS;
            weightedSeconds += plcWatchTableCount * WATCH_TABLE_SECONDS;
        }
    }
    const setupUnitCount = devices.length * DEVICE_SETUP_UNITS + plcCount * PLC_SETUP_UNITS;
    const totalUnits = Math.max(1, Math.ceil(weightedSeconds * ESTIMATION_SAFETY_FACTOR));
    const itemsPerSecond = normalizeItemsPerSecond(options.itemsPerSecond);
    const estimatedSeconds = Math.max(MIN_ESTIMATED_SECONDS, Math.ceil(totalUnits / itemsPerSecond));
    return {
        deviceCount: devices.length,
        plcCount,
        blockCount,
        sdBlockCount,
        sourceBlockCount,
        xmlBlockCount,
        previewMirrorBlockCount,
        tagTableCount,
        udtCount,
        watchTableCount,
        setupUnitCount,
        totalUnits,
        estimatedSeconds
    };
}
function formatImportProgressEstimate(estimate) {
    const parts = [
        `${estimate.deviceCount} device(s)`,
        `${estimate.plcCount} PLC(s)`,
        `${estimate.blockCount} block(s)`
    ];
    const blockParts = [];
    if (estimate.sdBlockCount > 0) {
        blockParts.push(`${estimate.sdBlockCount} SD`);
    }
    if (estimate.sourceBlockCount > 0) {
        blockParts.push(`${estimate.sourceBlockCount} SCL/DB source`);
    }
    if (estimate.xmlBlockCount > 0) {
        blockParts.push(`${estimate.xmlBlockCount} XML`);
    }
    if (blockParts.length > 0) {
        parts.push(`block mix: ${blockParts.join(', ')}`);
    }
    if (estimate.previewMirrorBlockCount > 0) {
        parts.push(`${estimate.previewMirrorBlockCount} ACT XML preview(s)`);
    }
    if (estimate.udtCount > 0) {
        parts.push(`${estimate.udtCount} UDT(s)`);
    }
    if (estimate.tagTableCount > 0) {
        parts.push(`${estimate.tagTableCount} tag table(s)`);
    }
    if (estimate.watchTableCount > 0) {
        parts.push(`${estimate.watchTableCount} watch table(s)`);
    }
    parts.push(`${estimate.totalUnits} weighted unit(s)`);
    parts.push(`ETA ${formatDuration(estimate.estimatedSeconds)}`);
    return parts.join(', ');
}
function estimateHwConfigImportProgressForDevices(devices, options) {
    const totalUnits = Math.max(1, Math.ceil(devices.length * HW_CONFIG_DEVICE_SECONDS * ESTIMATION_SAFETY_FACTOR));
    const itemsPerSecond = normalizeItemsPerSecond(options.itemsPerSecond);
    const estimatedSeconds = Math.max(MIN_ESTIMATED_SECONDS, Math.ceil(totalUnits / itemsPerSecond));
    return {
        deviceCount: devices.length,
        plcCount: 0,
        blockCount: 0,
        sdBlockCount: 0,
        sourceBlockCount: 0,
        xmlBlockCount: 0,
        previewMirrorBlockCount: 0,
        tagTableCount: 0,
        udtCount: 0,
        watchTableCount: 0,
        setupUnitCount: devices.length,
        totalUnits,
        estimatedSeconds
    };
}
function formatHwConfigProgressEstimate(estimate) {
    return [
        `${estimate.deviceCount} HW device(s)`,
        `${estimate.totalUnits} weighted unit(s)`,
        `ETA ${formatDuration(estimate.estimatedSeconds)}`
    ].join(', ');
}
class TimedImportProgress {
    progress;
    estimate;
    options;
    startedAt = 0;
    timer;
    lastSpanPercent = 0;
    currentMessage = 'Importing project data...';
    running = false;
    statusBarItem;
    constructor(progress, estimate, options) {
        this.progress = progress;
        this.estimate = estimate;
        this.options = options;
        if (typeof vscode.window.createStatusBarItem === 'function') {
            this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        }
    }
    start(message) {
        this.currentMessage = message;
        this.startedAt = Date.now();
        this.running = true;
        this.updateStatusBar();
        this.progress(this.formatMessage(), 0);
        this.statusBarItem?.show();
        const intervalMs = this.options.updateIntervalMs ?? 1000;
        this.timer = setInterval(() => this.tick(), intervalMs);
    }
    setMessage(message) {
        this.currentMessage = message;
        if (this.running) {
            this.tick(true);
        }
        else {
            this.progress(message);
        }
    }
    complete(message) {
        if (!this.running) {
            this.progress(message);
            return;
        }
        this.currentMessage = message;
        this.stopTimer();
        const remaining = Math.max(0, this.options.spanPercent - this.lastSpanPercent);
        this.lastSpanPercent = this.options.spanPercent;
        this.running = false;
        this.updateStatusBar(this.options.startPercent + this.options.spanPercent);
        this.progress(this.formatMessage(this.options.startPercent + this.options.spanPercent), remaining);
    }
    dispose() {
        this.stopTimer();
        this.statusBarItem?.dispose();
        this.running = false;
    }
    tick(forceMessage = false) {
        if (!this.running) {
            return;
        }
        const elapsedSeconds = this.getElapsedSeconds();
        const rawSpanPercent = (elapsedSeconds / this.estimate.estimatedSeconds) * this.options.spanPercent;
        const maxBeforeCompletion = Math.max(0, this.options.spanPercent - FINAL_PROGRESS_HEADROOM);
        const nextSpanPercent = Math.min(maxBeforeCompletion, Math.max(this.lastSpanPercent, rawSpanPercent));
        const increment = Math.max(0, nextSpanPercent - this.lastSpanPercent);
        if (!forceMessage && increment < 0.1) {
            return;
        }
        this.lastSpanPercent += increment;
        this.updateStatusBar();
        this.progress(this.formatMessage(), increment > 0 ? increment : undefined);
    }
    formatMessage(percentOverride) {
        const { percent, completedUnits, totalUnits } = this.getProgressNumbers(percentOverride);
        const remainingSeconds = Math.max(0, Math.ceil(this.estimate.estimatedSeconds - this.getElapsedSeconds()));
        return `${percent}% (${completedUnits}/${totalUnits} work) - ${this.currentMessage} - ETA ${formatDuration(remainingSeconds)}`;
    }
    updateStatusBar(percentOverride) {
        if (!this.statusBarItem) {
            return;
        }
        const { percent, completedUnits, totalUnits } = this.getProgressNumbers(percentOverride);
        const remainingSeconds = Math.max(0, Math.ceil(this.estimate.estimatedSeconds - this.getElapsedSeconds()));
        this.statusBarItem.text = `$(cloud-download) TIA Import: ${percent}% (${completedUnits}/${totalUnits})`;
        this.statusBarItem.tooltip = `${this.currentMessage}\nEstimated progress: ${percent}% (${completedUnits}/${totalUnits} weighted units)\nETA ${formatDuration(remainingSeconds)}`;
    }
    getProgressNumbers(percentOverride) {
        const percent = percentOverride ?? Math.min(99, Math.floor(this.options.startPercent + this.lastSpanPercent));
        const totalUnits = this.estimate.totalUnits;
        const importRatio = this.options.spanPercent > 0
            ? Math.max(0, Math.min(1, this.lastSpanPercent / this.options.spanPercent))
            : 1;
        const completedUnits = Math.min(totalUnits, Math.floor(totalUnits * importRatio));
        return { percent, completedUnits, totalUnits };
    }
    getElapsedSeconds() {
        if (!this.startedAt) {
            return 0;
        }
        return Math.max(0, (Date.now() - this.startedAt) / 1000);
    }
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
}
exports.TimedImportProgress = TimedImportProgress;
function normalizeItemsPerSecond(value) {
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_ITEMS_PER_SECOND;
}
function collectPlcBlocks(plc, excludeSystemBlocks) {
    const blocks = new Map();
    for (const group of plc.blockGroups || []) {
        collectBlocksFromGroup(group, blocks, excludeSystemBlocks);
    }
    return Array.from(blocks.values());
}
function collectBlocksFromGroup(group, blocks, excludeSystemBlocks) {
    for (const block of group.blocks || []) {
        if (excludeSystemBlocks && block.isSystem) {
            continue;
        }
        blocks.set(block.id, block);
    }
    for (const subGroup of group.subGroups || []) {
        collectBlocksFromGroup(subGroup, blocks, excludeSystemBlocks);
    }
}
function estimateBlockTiming(blocks, options) {
    let sdBlockCount = 0;
    let sourceBlockCount = 0;
    let xmlBlockCount = 0;
    let weightedSeconds = 0;
    for (const block of blocks) {
        const category = getBlockExportCategory(block, options);
        if (category === 'sd') {
            sdBlockCount++;
            weightedSeconds += SD_BLOCK_SECONDS;
        }
        else if (category === 'source') {
            sourceBlockCount++;
            weightedSeconds += SOURCE_BLOCK_SECONDS;
        }
        else {
            xmlBlockCount++;
            weightedSeconds += XML_BLOCK_SECONDS;
        }
    }
    return { sdBlockCount, sourceBlockCount, xmlBlockCount, weightedSeconds };
}
function getBlockExportCategory(block, options) {
    if (isInstanceDb(block)) {
        return 'xml';
    }
    if (block.type === models_1.TiaBlockType.DB) {
        return options.dbExportFormat === 'db' ? 'source' : 'xml';
    }
    if (block.language === models_1.TiaProgrammingLanguage.GRAPH) {
        return 'xml';
    }
    if (options.exportFormat === 'sd') {
        return block.language === models_1.TiaProgrammingLanguage.SCL ? 'source' : 'sd';
    }
    return 'xml';
}
function isInstanceDb(block) {
    return Boolean(block.instanceOfFb) || /^instance\s*db$/i.test(String(block.type));
}
function countUniqueTagTables(plc) {
    const items = new Map();
    addUnique(items, plc.tagTables || []);
    for (const group of plc.tagTableGroups || []) {
        collectTagTablesFromGroup(group, items);
    }
    return items.size;
}
function collectTagTablesFromGroup(group, items) {
    addUnique(items, group.tagTables || []);
    for (const subGroup of group.subGroups || []) {
        collectTagTablesFromGroup(subGroup, items);
    }
}
function countUniqueUdts(plc) {
    const items = new Map();
    addUnique(items, plc.userDataTypes || []);
    for (const group of plc.udtGroups || []) {
        collectUdtsFromGroup(group, items);
    }
    return items.size;
}
function collectUdtsFromGroup(group, items) {
    addUnique(items, group.udts || []);
    for (const subGroup of group.subGroups || []) {
        collectUdtsFromGroup(subGroup, items);
    }
}
function countUniqueWatchTables(plc) {
    const items = new Map();
    addUnique(items, plc.watchTables || []);
    for (const group of plc.watchTableGroups || []) {
        collectWatchTablesFromGroup(group, items);
    }
    return items.size;
}
function collectWatchTablesFromGroup(group, items) {
    addUnique(items, group.watchTables || []);
    for (const subGroup of group.subGroups || []) {
        collectWatchTablesFromGroup(subGroup, items);
    }
}
function addUnique(items, values) {
    for (const value of values) {
        items.set(value.id, value);
    }
}
function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    if (hours > 0) {
        return `${hours}:${pad2(minutes)}:${pad2(remainingSeconds)}`;
    }
    return `${minutes}:${pad2(remainingSeconds)}`;
}
function pad2(value) {
    return value.toString().padStart(2, '0');
}
//# sourceMappingURL=importProgressEstimator.js.map