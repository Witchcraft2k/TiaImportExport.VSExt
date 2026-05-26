"use strict";
/**
 * Backwards-compatible barrel for the bridge.
 *
 * The bridge was split into domain mixins under `services/bridge/` to keep the
 * architecture modular. This module preserves the historical import path used
 * throughout the extension:
 *
 *     import { TiaOpennessBridge } from './services/tiaOpennessBridge';
 *
 * New code should prefer importing from `./services/bridge` directly, and use
 * the shared types from `./models`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeCore = exports.TiaOpennessBridge = void 0;
var bridge_1 = require("./bridge");
Object.defineProperty(exports, "TiaOpennessBridge", { enumerable: true, get: function () { return bridge_1.TiaOpennessBridge; } });
Object.defineProperty(exports, "BridgeCore", { enumerable: true, get: function () { return bridge_1.BridgeCore; } });
//# sourceMappingURL=tiaOpennessBridge.js.map