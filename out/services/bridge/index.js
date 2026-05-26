"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeCore = exports.TiaOpennessBridge = void 0;
const bridgeCore_1 = require("./bridgeCore");
const connectionBridge_1 = require("./connectionBridge");
const blockBridge_1 = require("./blockBridge");
const hmiBridge_1 = require("./hmiBridge");
const plcDataBridge_1 = require("./plcDataBridge");
const importToTiaBridge_1 = require("./importToTiaBridge");
const hwConfigBridge_1 = require("./hwConfigBridge");
const libraryBridge_1 = require("./libraryBridge");
/**
 * Facade class that composes {@link BridgeCore} with all domain-specific
 * bridge mixins. This preserves the original flat public API used throughout
 * the extension (`bridge.exportBlock(...)`, `bridge.importHwConfig(...)`, etc.)
 * while keeping the implementation split across focused, per-domain files.
 *
 * Order is intentional: later mixins can shadow earlier ones if names collide
 * (none do today).
 */
exports.TiaOpennessBridge = (0, hwConfigBridge_1.HwConfigBridgeMixin)((0, importToTiaBridge_1.ImportToTiaBridgeMixin)((0, plcDataBridge_1.PlcDataBridgeMixin)((0, hmiBridge_1.HmiBridgeMixin)((0, blockBridge_1.BlockBridgeMixin)((0, libraryBridge_1.LibraryBridgeMixin)((0, connectionBridge_1.ConnectionBridgeMixin)(bridgeCore_1.BridgeCore)))))));
var bridgeCore_2 = require("./bridgeCore");
Object.defineProperty(exports, "BridgeCore", { enumerable: true, get: function () { return bridgeCore_2.BridgeCore; } });
//# sourceMappingURL=index.js.map