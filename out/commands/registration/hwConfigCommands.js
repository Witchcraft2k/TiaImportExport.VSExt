"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHwConfigCommands = registerHwConfigCommands;
const commandContext_1 = require("../commandContext");
const importHwConfigCommand_1 = require("../importHwConfigCommand");
const importDeviceCategoryCommand_1 = require("../importDeviceCategoryCommand");
const exportHwConfigToTiaCommand_1 = require("../exportHwConfigToTiaCommand");
/**
 * Commands covering hardware configuration import and export.
 */
function registerHwConfigCommands(ctx) {
    const { connectionService } = ctx;
    (0, commandContext_1.register)(ctx, 'tia-import.importHwConfig', (item) => (0, importHwConfigCommand_1.importHwConfigCommand)(connectionService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importDeviceHwConfig', (item) => (0, importHwConfigCommand_1.importDeviceHwConfigCommand)(connectionService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importDeviceCategoryHwConfig', (item) => (0, importDeviceCategoryCommand_1.importDeviceCategoryHwConfigCommand)(connectionService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.exportHwConfigToTia', (uri, uris) => (0, exportHwConfigToTiaCommand_1.exportHwConfigToTiaCommand)(connectionService, uri, uris));
    (0, commandContext_1.register)(ctx, 'tia-import.exportHwConfigFolderToTia', (uri) => (0, exportHwConfigToTiaCommand_1.exportHwConfigFolderToTiaCommand)(connectionService, uri));
}
//# sourceMappingURL=hwConfigCommands.js.map