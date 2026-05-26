"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPreviewCommands = registerPreviewCommands;
const commandContext_1 = require("../commandContext");
const compareWithGitRevisionCommand_1 = require("../compareWithGitRevisionCommand");
const previewBlockGraphicCommand_1 = require("../previewBlockGraphicCommand");
function registerPreviewCommands(ctx) {
    (0, commandContext_1.register)(ctx, 'tia-import.previewBlockWithAutomationCompare', (uri, uris) => (0, previewBlockGraphicCommand_1.previewBlockWithAutomationCompareCommand)(uri, uris));
    (0, commandContext_1.register)(ctx, 'tia-import.previewS7dclLadFbd', (uri, uris) => (0, previewBlockGraphicCommand_1.previewBlockWithAutomationCompareCommand)(uri, uris));
    (0, commandContext_1.register)(ctx, 'tia-import.compareS7dclRevisionsInAct', (uri, uris) => (0, compareWithGitRevisionCommand_1.compareWithGitRevisionInAct)(uri, uris));
}
//# sourceMappingURL=previewCommands.js.map