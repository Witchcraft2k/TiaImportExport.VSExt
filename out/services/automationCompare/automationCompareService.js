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
exports.AutomationCompareService = void 0;
exports.buildAutomationCompareArguments = buildAutomationCompareArguments;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const config_1 = require("../../utils/config");
const logger_1 = require("../../utils/logger");
const simaticMl_1 = require("../../utils/simaticMl");
const automationComparePreviewPanel_1 = require("./automationComparePreviewPanel");
const automationCompareToolLocator_1 = require("./automationCompareToolLocator");
class AutomationCompareService {
    async openPreview(filePath) {
        const normalizedPath = path.resolve(filePath);
        const config = (0, config_1.getConfig)().automationCompareTool;
        if (process.platform !== 'win32') {
            return {
                success: false,
                filePath: normalizedPath,
                mode: config.embedMode,
                error: 'SIMATIC Automation Compare Tool preview is available only on Windows.'
            };
        }
        const validation = (0, simaticMl_1.validateAutomationComparePreviewFile)(normalizedPath);
        if (!validation.supported) {
            return {
                success: false,
                filePath: normalizedPath,
                mode: config.embedMode,
                error: validation.reason || 'Unsupported SimaticML file.'
            };
        }
        const locatedTool = await (0, automationCompareToolLocator_1.locateAutomationCompareTool)(config);
        if (!locatedTool.success || !locatedTool.location) {
            logger_1.Logger.warn('Automation Compare Tool auto-detection failed', {
                error: locatedTool.error,
                searchedPaths: locatedTool.searchedPaths
            });
            return {
                success: false,
                filePath: normalizedPath,
                mode: config.embedMode,
                error: locatedTool.error || 'SIMATIC Automation Compare Tool was not found.'
            };
        }
        if (config.embedMode === 'native') {
            logger_1.Logger.section('AUTOMATION COMPARE PREVIEW');
            logger_1.Logger.info(`Tool: ${locatedTool.location.filePath}`);
            logger_1.Logger.info(`Input: ${normalizedPath}`);
            logger_1.Logger.info('Mode: VS Code webview panel');
            const panelResult = await (0, automationComparePreviewPanel_1.openAutomationComparePreviewPanel)(locatedTool.location.filePath, normalizedPath);
            if (panelResult.success) {
                return {
                    success: true,
                    filePath: normalizedPath,
                    mode: 'native',
                    toolPath: locatedTool.location.filePath
                };
            }
            logger_1.Logger.warn('ACT webview preview failed; launching external ACT window instead.', panelResult.error);
        }
        const args = buildAutomationCompareArguments(config.argumentsTemplate, normalizedPath, path.basename(normalizedPath));
        logger_1.Logger.section('AUTOMATION COMPARE PREVIEW');
        logger_1.Logger.info(`Tool: ${locatedTool.location.filePath}`);
        logger_1.Logger.info(`Input: ${normalizedPath}`);
        logger_1.Logger.info(`Arguments: ${args.join(' ')}`);
        try {
            const child = await startDetachedProcess(locatedTool.location.filePath, args);
            logger_1.Logger.success(`Automation Compare Tool started (PID ${child.pid ?? 'unknown'})`);
            return {
                success: true,
                filePath: normalizedPath,
                mode: config.embedMode,
                toolPath: locatedTool.location.filePath,
                processId: child.pid,
                fallbackUsed: config.embedMode === 'native'
            };
        }
        catch (error) {
            logger_1.Logger.error('Failed to start Automation Compare Tool', error);
            return {
                success: false,
                filePath: normalizedPath,
                mode: config.embedMode,
                toolPath: locatedTool.location.filePath,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
exports.AutomationCompareService = AutomationCompareService;
function buildAutomationCompareArguments(template, filePath, title = path.basename(filePath)) {
    const tokens = splitArgumentsTemplate(template.trim() || '${file}');
    return tokens.map(token => token
        .replace(/\$\{file\}/g, filePath)
        .replace(/\$\{title\}/g, title));
}
function splitArgumentsTemplate(template) {
    const result = [];
    let current = '';
    let quote;
    for (let index = 0; index < template.length; index++) {
        const character = template[index];
        if (character === '"' && quote !== 'single') {
            quote = quote === 'double' ? undefined : 'double';
            continue;
        }
        if (character === '\'' && quote !== 'double') {
            quote = quote === 'single' ? undefined : 'single';
            continue;
        }
        if (/\s/.test(character) && !quote) {
            if (current) {
                result.push(current);
                current = '';
            }
            continue;
        }
        current += character;
    }
    if (current) {
        result.push(current);
    }
    return result.length > 0 ? result : ['${file}'];
}
function startDetachedProcess(executablePath, args) {
    return new Promise((resolve, reject) => {
        // Strip Electron-internal env vars so ACTool.exe (which is itself an
        // Electron app) doesn't inherit ELECTRON_RUN_AS_NODE from the VS Code
        // extension host and boot in Node mode (it would then try to execute
        // the XML as a JS script and crash with "Unexpected token '<'").
        const childEnv = { ...process.env };
        delete childEnv.ELECTRON_RUN_AS_NODE;
        delete childEnv.ELECTRON_NO_ATTACH_CONSOLE;
        delete childEnv.ELECTRON_NO_ASAR;
        delete childEnv.NODE_OPTIONS;
        const child = (0, child_process_1.spawn)(executablePath, args, {
            detached: true,
            shell: false,
            stdio: 'ignore',
            windowsHide: false,
            env: childEnv
        });
        child.once('error', reject);
        child.once('spawn', () => {
            child.removeListener('error', reject);
            child.unref();
            resolve(child);
        });
    });
}
//# sourceMappingURL=automationCompareService.js.map