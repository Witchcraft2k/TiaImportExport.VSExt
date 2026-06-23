"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerImportCommands = registerImportCommands;
const commandContext_1 = require("../commandContext");
const importProjectCommand_1 = require("../importProjectCommand");
const importDeviceCommand_1 = require("../importDeviceCommand");
const importBlockCommand_1 = require("../importBlockCommand");
const importBlockGroupCommand_1 = require("../importBlockGroupCommand");
const importTagTablesCommand_1 = require("../importTagTablesCommand");
const importTagTableCommand_1 = require("../importTagTableCommand");
const importUdtsCommand_1 = require("../importUdtsCommand");
const importUdtCommand_1 = require("../importUdtCommand");
const importWatchTablesCommand_1 = require("../importWatchTablesCommand");
const importWatchTableCommand_1 = require("../importWatchTableCommand");
const importHmiScreensCommand_1 = require("../importHmiScreensCommand");
const importHmiTagsCommand_1 = require("../importHmiTagsCommand");
const importHmiConnectionsCommand_1 = require("../importHmiConnectionsCommand");
const importAllHmiCommand_1 = require("../importAllHmiCommand");
const importDeviceCategoryCommand_1 = require("../importDeviceCategoryCommand");
const importSoftwareUnitCommand_1 = require("../importSoftwareUnitCommand");
const importLibraryCommand_1 = require("../importLibraryCommand");
/**
 * Commands that pull data *from* TIA Portal into local files
 * (projects, devices, blocks, tag/UDT/watch tables, HMI).
 */
function registerImportCommands(ctx) {
    const { connectionService, importService } = ctx;
    (0, commandContext_1.register)(ctx, 'tia-import.importProject', () => (0, importProjectCommand_1.importProjectCommand)(importService));
    (0, commandContext_1.register)(ctx, 'tia-import.importDevice', (item) => (0, importDeviceCommand_1.importDeviceCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importBlock', (item) => (0, importBlockCommand_1.importBlockCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importBlockGroup', (item) => (0, importBlockGroupCommand_1.importBlockGroupCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importTagTables', (item) => (0, importTagTablesCommand_1.importTagTablesCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importTagTable', (item) => (0, importTagTableCommand_1.importTagTableCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importUdts', (item) => (0, importUdtsCommand_1.importUdtsCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importUdt', (item) => (0, importUdtCommand_1.importUdtCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importWatchTables', (item) => (0, importWatchTablesCommand_1.importWatchTablesCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importWatchTable', (item) => (0, importWatchTableCommand_1.importWatchTableCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importHmiScreens', (item) => (0, importHmiScreensCommand_1.importHmiScreensCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importHmiTags', (item) => (0, importHmiTagsCommand_1.importHmiTagsCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importHmiConnections', (item) => (0, importHmiConnectionsCommand_1.importHmiConnectionsCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importAllHmi', (item) => (0, importAllHmiCommand_1.importAllHmiCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importDeviceCategory', (item) => (0, importDeviceCategoryCommand_1.importDeviceCategoryCommand)(importService, connectionService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importSoftwareUnit', (item) => (0, importSoftwareUnitCommand_1.importSoftwareUnitCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importLibrary', () => (0, importLibraryCommand_1.importLibraryCommand)(importService));
    (0, commandContext_1.register)(ctx, 'tia-import.importLibraryFolder', (item) => (0, importLibraryCommand_1.importLibraryFolderCommand)(importService, item));
    (0, commandContext_1.register)(ctx, 'tia-import.importLibraryType', (item) => (0, importLibraryCommand_1.importLibraryTypeCommand)(importService, item));
}
//# sourceMappingURL=importCommands.js.map