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
exports.disconnectCommand = disconnectCommand;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
async function disconnectCommand(connectionService, projectTreeProvider, connectionTreeProvider) {
    try {
        const confirm = await vscode.window.showWarningMessage('Are you sure you want to disconnect from TIA Portal?', { modal: true }, 'Yes', 'No');
        if (confirm !== 'Yes') {
            logger_1.Logger.info('Disconnect cancelled by user');
            return;
        }
        logger_1.Logger.section('DISCONNECT FROM TIA PORTAL');
        await connectionService.disconnect();
        // Refresh tree views
        connectionTreeProvider.refresh();
        projectTreeProvider.refresh();
        logger_1.Logger.success('Disconnected from TIA Portal');
        vscode.window.showInformationMessage('TIA Import: Disconnected from TIA Portal');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error('Failed to disconnect from TIA Portal', error);
        vscode.window.showErrorMessage(`TIA Import: ${message}`);
    }
}
//# sourceMappingURL=disconnectCommand.js.map