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
exports.BridgeCore = void 0;
const path = __importStar(require("path"));
const logger_1 = require("../../utils/logger");
const config_1 = require("../../utils/config");
/**
 * Core infrastructure for the TIA Openness bridge.
 *
 * Responsibilities:
 *  - Load edge-js / electron-edge-js
 *  - Resolve and load the .NET TiaOpennessWrapper assembly
 *  - Provide {@link callDotNet} for domain-specific bridge mixins
 *  - Normalize PascalCase .NET payloads into camelCase JS objects
 *
 * Domain logic lives in separate mixin modules (see sibling files in this folder)
 * to keep the file surface area small and the architecture modular.
 */
/**
 * NOTE: Members are intentionally `public` (not `private`/`protected`) so that
 * mixin return-type inference does not leak private names across module
 * boundaries (`TS4094`). They remain internal by convention - prefer the
 * higher-level `TiaOpennessBridge` facade API.
 */
class BridgeCore {
    /** @internal */ _edge = null;
    /** @internal */ _tiaConnector = null;
    /** @internal */ _isInitialized = false;
    static _extensionPath = '';
    /**
     * Set the extension path (must be called before first use)
     */
    static setExtensionPath(extensionPath) {
        BridgeCore._extensionPath = extensionPath;
    }
    constructor() {
        this.initialize();
    }
    /**
     * Initialize the edge-js bridge.
     * @internal
     */
    async initialize() {
        if (this._isInitialized) {
            return;
        }
        try {
            // Dynamic import of edge-js
            // Use electron-edge-js for VS Code (Electron) environment
            try {
                // Try electron-edge-js first (for VS Code extension)
                try {
                    this._edge = require('electron-edge-js');
                    logger_1.Logger.info('Using electron-edge-js for VS Code environment');
                }
                catch (electronEdgeError) {
                    // Log the electron-edge-js error for diagnostics
                    const electronMsg = electronEdgeError instanceof Error ? electronEdgeError.message : String(electronEdgeError);
                    logger_1.Logger.warn(`electron-edge-js failed to load: ${electronMsg}`);
                    // Fallback to edge-js for standalone Node.js
                    this._edge = require('edge-js');
                    logger_1.Logger.info('Using edge-js for Node.js environment');
                }
                // Use extension path if available, otherwise fallback to __dirname
                const basePath = BridgeCore._extensionPath || path.join(__dirname, '..', '..', '..');
                const tiaVersion = (0, config_1.getConfig)().tiaPortalVersion;
                const versionFolder = `V${tiaVersion}`;
                const assemblyPath = path.join(basePath, 'dotnet', 'TiaOpennessWrapper', 'bin', 'Release', 'net48', versionFolder, 'TiaOpennessWrapper.dll');
                if (!require('fs').existsSync(assemblyPath)) {
                    throw new Error(`TiaOpennessWrapper.dll for TIA Portal V${tiaVersion} not found at:\n  ${assemblyPath}\n\n` +
                        `This build of the extension does not ship a wrapper for V${tiaVersion}. ` +
                        `Either install TIA Portal V${tiaVersion} and rebuild the wrapper, ` +
                        `or change "tiaImport.tiaPortalVersion" to a supported version.`);
                }
                logger_1.Logger.info(`Loading .NET assembly for TIA V${tiaVersion} from: ${assemblyPath}`);
                this._tiaConnector = this._edge.func({
                    assemblyFile: assemblyPath,
                    typeName: 'TiaOpennessWrapper.TiaConnector',
                    methodName: 'Invoke'
                });
                this._isInitialized = true;
                logger_1.Logger.success('TIA Openness bridge initialized - connected to real TIA Portal API');
            }
            catch (edgeError) {
                logger_1.Logger.error('edge-js not available - cannot connect to TIA Portal', edgeError);
                throw new Error('edge-js is required to connect to TIA Portal. Make sure edge-js is properly installed.');
            }
        }
        catch (error) {
            logger_1.Logger.error('Failed to initialize TIA Openness bridge', error);
            throw error;
        }
    }
    /**
     * Convert PascalCase keys to camelCase (for .NET to JS interop).
     * @internal
     */
    toCamelCase(obj) {
        if (obj === null || obj === undefined) {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.toCamelCase(item));
        }
        if (typeof obj === 'object') {
            const result = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
                    result[camelKey] = this.toCamelCase(obj[key]);
                }
            }
            return result;
        }
        return obj;
    }
    /**
     * Call a method on the .NET TiaConnector via edge-js.
     *
     * @param method .NET method name (e.g. "Connect", "ExportBlock")
     * @param params Optional JSON payload passed to the .NET side
     * @param timeoutMs Optional timeout in ms; 0 = no timeout
     */
    async callDotNet(method, params = {}, timeoutMs = 0) {
        await this.initialize();
        if (!this._tiaConnector) {
            throw new Error('TIA Portal bridge is not initialized. Please connect to TIA Portal first.');
        }
        // Always include the configured TIA Portal version so .NET can initialize the correct resolver
        const config = (0, config_1.getConfig)();
        const enrichedParams = { tiaPortalVersion: config.tiaPortalVersion, ...params };
        const dotNetPromise = new Promise((resolve, reject) => {
            this._tiaConnector({ method, params: enrichedParams }, (error, result) => {
                if (error) {
                    reject(error);
                }
                else {
                    // Convert PascalCase to camelCase for TypeScript compatibility
                    const converted = this.toCamelCase(result);
                    logger_1.Logger.logWrapperDiagnostics(method, converted);
                    resolve(converted);
                }
            });
        });
        if (timeoutMs > 0) {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Operation '${method}' timed out after ${timeoutMs / 1000}s`)), timeoutMs);
            });
            return Promise.race([dotNetPromise, timeoutPromise]);
        }
        return dotNetPromise;
    }
    /**
     * Small helper used by every domain mixin: invoke a .NET method, log failures
     * uniformly, and return a { success: false, error } fallback on exception.
     *
     * Note: this preserves the exact shape the rest of the codebase expects for
     * bridge results (it never throws - always resolves with a result object).
     */
    async safeCall(logLabel, method, params = {}, timeoutMs = 0) {
        try {
            return await this.callDotNet(method, params, timeoutMs);
        }
        catch (error) {
            logger_1.Logger.error(`Bridge: ${logLabel}`, error);
            logger_1.Logger.logWrapperDiagnostics(method, {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                details: error instanceof Error ? error.stack : undefined
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
exports.BridgeCore = BridgeCore;
//# sourceMappingURL=bridgeCore.js.map