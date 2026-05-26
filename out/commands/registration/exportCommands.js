"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerExportCommands = registerExportCommands;
const commandContext_1 = require("../commandContext");
const export_1 = require("../export");
/**
 * Commands that push local files back to TIA Portal (XML blocks, XLSX tags,
 * unified exports, program-only exports). HW-config export is registered
 * separately in {@link registerHwConfigCommands}.
 */
function registerExportCommands(ctx) {
    const { connectionService } = ctx;
    (0, commandContext_1.register)(ctx, 'tia-import.exportXmlToTia', (uri, uris) => (0, export_1.exportXmlToTiaCommand)(connectionService, uri, uris));
    (0, commandContext_1.register)(ctx, 'tia-import.exportXmlFolderToTia', (uri, uris) => (0, export_1.exportXmlFolderToTiaCommand)(connectionService, uri, uris));
    (0, commandContext_1.register)(ctx, 'tia-import.exportBlockToTia', (uri, uris) => (0, export_1.exportBlockToTiaCommand)(connectionService, uri, uris));
    (0, commandContext_1.register)(ctx, 'tia-import.exportBlockFolderToTia', (uri, uris) => (0, export_1.exportBlockFolderToTiaCommand)(connectionService, uri, uris));
    (0, commandContext_1.register)(ctx, 'tia-import.exportUnifiedToTia', (uri, uris) => (0, export_1.exportUnifiedToTiaCommand)(connectionService, uri, uris));
    (0, commandContext_1.register)(ctx, 'tia-import.exportProgramToTia', (uri, uris) => (0, export_1.exportProgramToTiaCommand)(connectionService, uri, uris));
    (0, commandContext_1.register)(ctx, 'tia-import.exportXlsxToTia', (uri, uris) => (0, export_1.exportXlsxToTiaCommand)(connectionService, uri, uris));
    (0, commandContext_1.register)(ctx, 'tia-import.exportXlsxFolderToTia', (uri) => (0, export_1.exportXlsxFolderToTiaCommand)(connectionService, uri));
}
//# sourceMappingURL=exportCommands.js.map