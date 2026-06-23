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
exports.getUnitNameFromId = getUnitNameFromId;
exports.resolveExportRoot = resolveExportRoot;
/**
 * Helpers for resolving Software Unit scope from logical TIA identifiers.
 *
 * Tree ids built by the C# bridge use the form
 * "{deviceId}/{plcId}/Units/{UnitName}/{Root}/{...}" for unit-scoped objects.
 * The wrapper services on the .NET side detect the unit via the same
 * "/Units/&lt;UnitName&gt;/" segment. These helpers mirror that detection on the
 * TypeScript side so the local export folder can be routed under
 * "Devices/&lt;Cat&gt;/&lt;Device&gt;/Units/&lt;UnitName&gt;/" instead of the PLC root.
 */
const path = __importStar(require("path"));
const UNITS_MARKER = '/Units/';
/**
 * Extract the unit name from a logical id such as
 * "PLC1/Units/MyUnit/Program blocks/FB1". Returns null when the id has no
 * "/Units/&lt;name&gt;" segment.
 */
function getUnitNameFromId(id) {
    if (!id) {
        return null;
    }
    const idx = id.indexOf(UNITS_MARKER);
    if (idx < 0) {
        return null;
    }
    const start = idx + UNITS_MARKER.length;
    if (start >= id.length) {
        return null;
    }
    const end = id.indexOf('/', start);
    const name = end < 0 ? id.substring(start) : id.substring(start, end);
    return name && name.trim().length > 0 ? name : null;
}
/**
 * Resolve the export root for a PLC asset, optionally routed into a unit
 * folder. Returns "<devicePlcPath>/Units/<UnitName>/<subFolder>" when the id
 * carries a unit segment, else "<devicePlcPath>/<subFolder>".
 */
function resolveExportRoot(devicePlcPath, id, subFolder) {
    const unitName = getUnitNameFromId(id);
    return unitName
        ? path.join(devicePlcPath, 'Units', unitName, subFolder)
        : path.join(devicePlcPath, subFolder);
}
//# sourceMappingURL=unitScope.js.map