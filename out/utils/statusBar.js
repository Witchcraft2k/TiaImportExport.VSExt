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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
const config_1 = require("./config");
class StatusBarManager {
    statusBarItem;
    connectionService;
    constructor(connectionService) {
        this.connectionService = connectionService;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'tia-import.connect';
        this.updateStatusBar();
        this.statusBarItem.show();
        // Listen for connection changes
        connectionService.onConnectionChanged(() => {
            this.updateStatusBar();
        });
    }
    updateStatusBar() {
        const version = `V${(0, config_1.getConfig)().tiaPortalVersion}`;
        if (this.connectionService.isConnected) {
            const projectName = this.connectionService.currentProjectName;
            this.statusBarItem.text = `$(plug) TIA ${version}: ${projectName || 'Connected'}`;
            this.statusBarItem.tooltip = `Connected to TIA Portal ${version}\nProject: ${projectName || 'None selected'}\nClick to manage connection`;
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.command = 'tia-import.selectProject';
        }
        else {
            this.statusBarItem.text = `$(debug-disconnect) TIA ${version}: Disconnected`;
            this.statusBarItem.tooltip = `Click to connect to TIA Portal ${version}`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.command = 'tia-import.connect';
        }
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=statusBar.js.map