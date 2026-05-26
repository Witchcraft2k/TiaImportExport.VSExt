"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = registerCommands;
const logger_1 = require("../utils/logger");
const connectionCommands_1 = require("./registration/connectionCommands");
const importCommands_1 = require("./registration/importCommands");
const exportCommands_1 = require("./registration/exportCommands");
const hwConfigCommands_1 = require("./registration/hwConfigCommands");
const previewCommands_1 = require("./registration/previewCommands");
const utilityCommands_1 = require("./registration/utilityCommands");
/**
 * Top-level command registration. Builds a {@link CommandContext} and dispatches
 * to per-domain registrars. Adding a new command means editing exactly one
 * registration module - the top-level list stays stable.
 */
function registerCommands(context, connectionService, importService, projectTreeProvider, connectionTreeProvider) {
    const ctx = {
        context,
        connectionService,
        importService,
        projectTreeProvider,
        connectionTreeProvider
    };
    (0, connectionCommands_1.registerConnectionCommands)(ctx);
    (0, importCommands_1.registerImportCommands)(ctx);
    (0, exportCommands_1.registerExportCommands)(ctx);
    (0, hwConfigCommands_1.registerHwConfigCommands)(ctx);
    (0, previewCommands_1.registerPreviewCommands)(ctx);
    (0, utilityCommands_1.registerUtilityCommands)(ctx);
    logger_1.Logger.debug('All command registrars completed');
}
//# sourceMappingURL=index.js.map