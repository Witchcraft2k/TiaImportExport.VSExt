"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConnectionCommands = registerConnectionCommands;
const commandContext_1 = require("../commandContext");
const connectCommand_1 = require("../connectCommand");
const disconnectCommand_1 = require("../disconnectCommand");
const selectProjectCommand_1 = require("../selectProjectCommand");
const refreshCommand_1 = require("../refreshCommand");
/**
 * Commands that manage the lifecycle of the TIA Portal connection
 * (connect / disconnect / select project / refresh tree).
 */
function registerConnectionCommands(ctx) {
    const { connectionService, projectTreeProvider, connectionTreeProvider } = ctx;
    (0, commandContext_1.register)(ctx, 'tia-import.connect', () => (0, connectCommand_1.connectCommand)(connectionService, projectTreeProvider, connectionTreeProvider));
    (0, commandContext_1.register)(ctx, 'tia-import.disconnect', () => (0, disconnectCommand_1.disconnectCommand)(connectionService, projectTreeProvider, connectionTreeProvider));
    (0, commandContext_1.register)(ctx, 'tia-import.selectProject', () => (0, selectProjectCommand_1.selectProjectCommand)(connectionService, projectTreeProvider));
    (0, commandContext_1.register)(ctx, 'tia-import.refresh', () => (0, refreshCommand_1.refreshCommand)(connectionService, projectTreeProvider));
}
//# sourceMappingURL=connectionCommands.js.map