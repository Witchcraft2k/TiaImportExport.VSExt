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
exports.registerChatParticipant = registerChatParticipant;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const TIA_TOOL_NAMES = [
    'tia_connect',
    'tia_disconnect',
    'tia_list_projects',
    'tia_select_project',
    'tia_list_devices',
    'tia_list_blocks',
    'tia_export_block',
    'tia_export_device',
    'tia_export_hw_config',
    'tia_import_file',
    'tia_import_folder',
    'tia_import_hw_config',
    'tia_export_project',
    'tia_refresh',
    'tia_compile',
    'tia_get_problems',
    'tia_fix_compile_errors',
    'tia_export_cross_references'
];
const SYSTEM_PROMPT = `You are the TIA Portal automation assistant. You help the user import,
export, compile and fix PLC programs in Siemens TIA Portal via the registered tia_* tools.

Workflow rules:
- Always make sure the user is connected to TIA Portal (use tia_connect) before any export/import/compile.
- After importing edited code into TIA Portal, ALWAYS run tia_compile and read tia_get_problems.
- When fixing compile errors, prefer the orchestrator tia_fix_compile_errors which respects the
  iteration limit configured in tiaImport.lmTools.maxFixIterations.
- Never delete or move user files unless explicitly asked.
- When the user references a block by name, use tia_list_blocks to find its id/groupPath first.
- Keep responses concise; show diagnostics in compact form.`;
/**
 * Register the @tia chat participant. Routes the user's request to the model
 * with the registered tia_* language model tools attached.
 */
function registerChatParticipant(context) {
    const handler = async (request, _chatContext, response, token) => {
        try {
            const tools = vscode.lm.tools.filter(t => TIA_TOOL_NAMES.includes(t.name));
            if (tools.length === 0) {
                response.markdown('TIA tools are not registered yet. Try reloading the window.');
                return;
            }
            const messages = [
                vscode.LanguageModelChatMessage.User(SYSTEM_PROMPT),
                vscode.LanguageModelChatMessage.User(request.prompt)
            ];
            const chatResponse = await request.model.sendRequest(messages, { tools, toolMode: vscode.LanguageModelChatToolMode.Auto }, token);
            for await (const part of chatResponse.stream) {
                if (part instanceof vscode.LanguageModelTextPart) {
                    response.markdown(part.value);
                }
                else if (part instanceof vscode.LanguageModelToolCallPart) {
                    // VS Code surfaces tool invocation UI itself; we just keep streaming.
                    continue;
                }
            }
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logger_1.Logger.error('Chat participant error', e);
            response.markdown(`**TIA assistant error:** ${msg}`);
        }
    };
    const participant = vscode.chat.createChatParticipant('tia.assistant', handler);
    participant.iconPath = new vscode.ThemeIcon('plug');
    context.subscriptions.push(participant);
    logger_1.Logger.info('Registered @tia chat participant');
}
//# sourceMappingURL=chatParticipant.js.map