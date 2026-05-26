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
exports.NativeModuleChecker = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("./logger");
const child_process_1 = require("child_process");
/**
 * Checks and repairs native module dependencies (edge-js / electron-edge-js).
 *
 * When the extension is installed on a new machine, the pre-built native .node
 * binaries may not match the current Electron version or may be missing.
 * This utility detects the problem and attempts automatic repair.
 */
class NativeModuleChecker {
    /**
     * Check if native modules are working and attempt repair if not.
     * Returns true if modules are ready, false if repair is needed (reload required).
     */
    static async ensureNativeModules(extensionPath) {
        logger_1.Logger.info('Checking native module availability...');
        // Log environment info for diagnostics
        const electronVersion = process.versions.electron;
        const nodeVersion = process.versions.node;
        const electronMajor = electronVersion ? parseInt(electronVersion.split('.')[0]) : undefined;
        logger_1.Logger.info(`  ├─ Electron: ${electronVersion ?? 'N/A'} (major: ${electronMajor ?? 'N/A'})`);
        logger_1.Logger.info(`  ├─ Node.js ABI: ${process.versions.modules}`);
        logger_1.Logger.info(`  └─ Node.js: ${nodeVersion}`);
        // Try loading the native module
        const loadResult = this.tryLoadNativeModule(extensionPath);
        if (loadResult.success) {
            logger_1.Logger.success('Native modules loaded successfully');
            return true;
        }
        // Module failed to load — diagnose and attempt repair
        logger_1.Logger.warn(`Native module failed to load: ${loadResult.error}`);
        // Check what pre-built versions are available
        this.logAvailableVersions(extensionPath);
        // Check system prerequisites
        const prereqIssues = await this.checkPrerequisites();
        if (prereqIssues.length > 0) {
            logger_1.Logger.warn('System prerequisite issues detected:');
            for (const issue of prereqIssues) {
                logger_1.Logger.warn(`  ├─ ${issue}`);
            }
        }
        // Attempt automatic repair
        const repaired = await this.attemptRepair(extensionPath, loadResult.error ?? '');
        if (repaired) {
            // Verify the repair worked
            const verifyResult = this.tryLoadNativeModule(extensionPath);
            if (verifyResult.success) {
                logger_1.Logger.success('Native modules repaired successfully!');
                return true;
            }
            // Repair ran but module still won't load — may need VS Code reload
            logger_1.Logger.warn('Repair completed but native module still cannot load.');
            logger_1.Logger.warn('A VS Code reload may be required.');
            const action = await vscode.window.showWarningMessage('TIA Import: Native modules were reinstalled. Please reload VS Code to apply changes.', 'Reload Now', 'Later');
            if (action === 'Reload Now') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
            return false;
        }
        // Automatic repair failed — show manual instructions
        this.showManualFixInstructions(extensionPath, prereqIssues, loadResult.error ?? '');
        return false;
    }
    /**
     * Try to load electron-edge-js or edge-js native module.
     */
    static tryLoadNativeModule(extensionPath) {
        // Try electron-edge-js first (preferred for VS Code/Electron)
        try {
            const modulePath = path.join(extensionPath, 'node_modules', 'electron-edge-js');
            if (fs.existsSync(modulePath)) {
                require(modulePath);
                return { success: true, moduleName: 'electron-edge-js' };
            }
        }
        catch (e) {
            const electronErr = e instanceof Error ? e.message : String(e);
            logger_1.Logger.debug(`electron-edge-js load failed: ${electronErr}`);
        }
        // Try edge-js as fallback
        try {
            const modulePath = path.join(extensionPath, 'node_modules', 'edge-js');
            if (fs.existsSync(modulePath)) {
                require(modulePath);
                return { success: true, moduleName: 'edge-js' };
            }
        }
        catch (e) {
            const edgeErr = e instanceof Error ? e.message : String(e);
            logger_1.Logger.debug(`edge-js load failed: ${edgeErr}`);
            return { success: false, error: edgeErr };
        }
        return { success: false, error: 'Neither electron-edge-js nor edge-js found in extension directory' };
    }
    /**
     * Log which pre-built Electron versions are available.
     */
    static logAvailableVersions(extensionPath) {
        const nativePath = path.join(extensionPath, 'node_modules', 'electron-edge-js', 'lib', 'native', 'win32', 'x64');
        if (!fs.existsSync(nativePath)) {
            logger_1.Logger.warn(`Pre-built native binaries directory not found: ${nativePath}`);
            return;
        }
        try {
            const versions = fs.readdirSync(nativePath)
                .filter(f => /^\d+$/.test(f))
                .sort((a, b) => parseInt(a) - parseInt(b));
            logger_1.Logger.info(`Available pre-built Electron versions: ${versions.join(', ')}`);
            const electronMajor = process.versions.electron
                ? parseInt(process.versions.electron.split('.')[0])
                : undefined;
            if (electronMajor && !versions.includes(String(electronMajor))) {
                logger_1.Logger.error(`Current Electron major version ${electronMajor} is NOT in pre-built list!`);
                logger_1.Logger.info('The electron-edge-js package needs to be updated to support this Electron version.');
            }
        }
        catch (e) {
            logger_1.Logger.debug(`Could not read native versions directory: ${e}`);
        }
    }
    /**
     * Check system prerequisites (VC++ Runtime, .NET Framework).
     */
    static async checkPrerequisites() {
        const issues = [];
        // Check .NET Framework 4.x
        try {
            const dotnetInstalled = await this.checkDotNetFramework();
            if (!dotnetInstalled) {
                issues.push('.NET Framework 4.5+ may not be installed (required for edge-js CLR hosting)');
            }
        }
        catch {
            logger_1.Logger.debug('Could not verify .NET Framework installation');
        }
        // Check VC++ Runtime (the .node files depend on VC++ redistributable)
        try {
            const vcInstalled = await this.checkVCRuntime();
            if (!vcInstalled) {
                issues.push('Visual C++ Redistributable 2015-2022 may not be installed');
            }
        }
        catch {
            logger_1.Logger.debug('Could not verify VC++ Runtime installation');
        }
        return issues;
    }
    static checkDotNetFramework() {
        return new Promise((resolve) => {
            (0, child_process_1.exec)('reg query "HKLM\\SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full" /v Release', (error, stdout) => {
                if (error) {
                    resolve(false);
                    return;
                }
                // Release value >= 378389 means .NET 4.5+
                const match = stdout.match(/Release\s+REG_DWORD\s+0x([0-9a-fA-F]+)/);
                if (match) {
                    const release = parseInt(match[1], 16);
                    resolve(release >= 378389);
                }
                else {
                    resolve(false);
                }
            });
        });
    }
    static checkVCRuntime() {
        return new Promise((resolve) => {
            (0, child_process_1.exec)('reg query "HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\X64" /v Version 2>nul', (error, stdout) => {
                if (error || !stdout.includes('Version')) {
                    // Try alternate registry path
                    (0, child_process_1.exec)('reg query "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\X64" /v Version 2>nul', (error2, stdout2) => {
                        resolve(!error2 && stdout2.includes('Version'));
                    });
                }
                else {
                    resolve(true);
                }
            });
        });
    }
    /**
     * Check if the installed electron-edge-js version matches the current Electron major version.
     * Returns the required version number if there's a mismatch, or null if versions match.
     */
    static getRequiredElectronEdgeVersion(extensionPath) {
        const electronMajor = process.versions.electron
            ? parseInt(process.versions.electron.split('.')[0])
            : null;
        if (!electronMajor) {
            return null;
        }
        const nativePath = path.join(extensionPath, 'node_modules', 'electron-edge-js', 'lib', 'native', 'win32', 'x64');
        if (!fs.existsSync(nativePath)) {
            return electronMajor;
        }
        try {
            const versions = fs.readdirSync(nativePath)
                .filter(f => /^\d+$/.test(f))
                .map(f => parseInt(f));
            if (!versions.includes(electronMajor)) {
                return electronMajor;
            }
        }
        catch {
            return electronMajor;
        }
        return null;
    }
    /**
     * Attempt automatic repair of native modules.
     */
    static async attemptRepair(extensionPath, errorMessage) {
        logger_1.Logger.info('Attempting automatic repair of native modules...');
        const progressResult = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'TIA Import: Repairing native modules...',
            cancellable: false
        }, async (progress) => {
            try {
                // Step 1: Check if Electron version mismatch requires a different electron-edge-js version
                const requiredVersion = this.getRequiredElectronEdgeVersion(extensionPath);
                if (requiredVersion) {
                    logger_1.Logger.info(`Electron major version ${requiredVersion} not in pre-built list. Installing matching electron-edge-js@${requiredVersion}...`);
                    progress.report({ message: `Installing electron-edge-js@${requiredVersion}...`, increment: 0 });
                    const versionInstallSuccess = await this.runVersionSpecificInstall(extensionPath, requiredVersion);
                    if (versionInstallSuccess) {
                        progress.report({ message: 'Version-matched install completed', increment: 60 });
                        // Verify it loaded
                        const verifyResult = this.tryLoadNativeModule(extensionPath);
                        if (verifyResult.success) {
                            logger_1.Logger.success(`electron-edge-js@${requiredVersion} installed and loaded successfully`);
                            return true;
                        }
                        logger_1.Logger.warn(`electron-edge-js@${requiredVersion} installed but still cannot load. Trying rebuild...`);
                    }
                    else {
                        logger_1.Logger.warn(`Failed to install electron-edge-js@${requiredVersion}. Trying standard repair...`);
                    }
                }
                // Step 2: Try npm rebuild (fastest, works when binaries just need recompilation)
                progress.report({ message: 'Rebuilding native modules...', increment: 20 });
                const rebuildSuccess = await this.runNpmRebuild(extensionPath);
                if (rebuildSuccess) {
                    progress.report({ message: 'Rebuild completed', increment: 50 });
                    return true;
                }
                // Step 3: Full reinstall of electron-edge-js (generic version)
                progress.report({ message: 'Reinstalling electron-edge-js...', increment: 30 });
                const reinstallSuccess = await this.runNpmInstall(extensionPath);
                if (reinstallSuccess) {
                    progress.report({ message: 'Reinstall completed', increment: 70 });
                    return true;
                }
                return false;
            }
            catch (e) {
                logger_1.Logger.error('Repair attempt failed', e);
                return false;
            }
        });
        return progressResult;
    }
    /**
     * Install a specific version of electron-edge-js matching the current Electron major version.
     */
    static runVersionSpecificInstall(extensionPath, electronMajor) {
        return new Promise((resolve) => {
            const pkg = `electron-edge-js@${electronMajor}`;
            logger_1.Logger.info(`Installing ${pkg} in extension directory...`);
            (0, child_process_1.exec)(`npm install --no-save ${pkg}`, { cwd: extensionPath, timeout: 180000 }, (error, stdout, stderr) => {
                if (error) {
                    logger_1.Logger.warn(`npm install ${pkg} failed: ${error.message}`);
                    if (stderr) {
                        logger_1.Logger.debug(`stderr: ${stderr}`);
                    }
                    resolve(false);
                }
                else {
                    logger_1.Logger.info(`npm install ${pkg} output: ${stdout}`);
                    resolve(true);
                }
            });
        });
    }
    static runNpmRebuild(extensionPath) {
        return new Promise((resolve) => {
            logger_1.Logger.info('Running npm rebuild in extension directory...');
            (0, child_process_1.exec)('npm rebuild electron-edge-js edge-js', { cwd: extensionPath, timeout: 120000 }, (error, stdout, stderr) => {
                if (error) {
                    logger_1.Logger.warn(`npm rebuild failed: ${error.message}`);
                    if (stderr) {
                        logger_1.Logger.debug(`stderr: ${stderr}`);
                    }
                    resolve(false);
                }
                else {
                    logger_1.Logger.info(`npm rebuild output: ${stdout}`);
                    resolve(true);
                }
            });
        });
    }
    static runNpmInstall(extensionPath) {
        return new Promise((resolve) => {
            logger_1.Logger.info('Running npm install in extension directory...');
            (0, child_process_1.exec)('npm install --no-save electron-edge-js edge-js', { cwd: extensionPath, timeout: 180000 }, (error, stdout, stderr) => {
                if (error) {
                    logger_1.Logger.warn(`npm install failed: ${error.message}`);
                    if (stderr) {
                        logger_1.Logger.debug(`stderr: ${stderr}`);
                    }
                    resolve(false);
                }
                else {
                    logger_1.Logger.info(`npm install output: ${stdout}`);
                    resolve(true);
                }
            });
        });
    }
    /**
     * Show manual fix instructions when automatic repair fails.
     */
    static showManualFixInstructions(extensionPath, prereqIssues, error) {
        logger_1.Logger.error('─────────────────────────────────────────────────');
        logger_1.Logger.error('NATIVE MODULE REPAIR FAILED - MANUAL FIX NEEDED');
        logger_1.Logger.error('─────────────────────────────────────────────────');
        logger_1.Logger.error('');
        logger_1.Logger.error('The extension requires native modules (electron-edge-js) to communicate');
        logger_1.Logger.error('with TIA Portal via .NET. These modules failed to load.');
        logger_1.Logger.error('');
        logger_1.Logger.error(`Error: ${error}`);
        logger_1.Logger.error('');
        const electronMajor = process.versions.electron
            ? parseInt(process.versions.electron.split('.')[0])
            : undefined;
        logger_1.Logger.error('To fix manually, run the following in a terminal:');
        logger_1.Logger.error('');
        logger_1.Logger.error(`  cd "${extensionPath}"`);
        if (electronMajor) {
            logger_1.Logger.error(`  npm install --no-save electron-edge-js@${electronMajor}`);
            logger_1.Logger.error('');
            logger_1.Logger.error(`  (This installs a version matching your Electron ${electronMajor} / VS Code ${process.versions.electron})`);
        }
        else {
            logger_1.Logger.error('  npm install --no-save electron-edge-js edge-js');
        }
        logger_1.Logger.error('');
        if (prereqIssues.length > 0) {
            logger_1.Logger.error('Additionally, the following system prerequisites may be missing:');
            for (const issue of prereqIssues) {
                logger_1.Logger.error(`  - ${issue}`);
            }
            logger_1.Logger.error('');
            logger_1.Logger.error('Install:');
            logger_1.Logger.error('  - .NET Framework 4.5+: https://dotnet.microsoft.com/download/dotnet-framework');
            logger_1.Logger.error('  - VC++ Redistributable: https://aka.ms/vs/17/release/vc_redist.x64.exe');
        }
        logger_1.Logger.error('');
        logger_1.Logger.error('After fixing, reload VS Code (Ctrl+Shift+P → "Reload Window")');
        logger_1.Logger.error('─────────────────────────────────────────────────');
        // Show notification
        vscode.window.showErrorMessage('TIA Import: Native modules failed to load. Check the TIA Portal Import output for instructions.', 'Show Logs', 'Open Terminal').then(action => {
            if (action === 'Show Logs') {
                vscode.commands.executeCommand('tia-import.showLogs');
            }
            else if (action === 'Open Terminal') {
                const electronMajor = process.versions.electron
                    ? parseInt(process.versions.electron.split('.')[0])
                    : undefined;
                const installCmd = electronMajor
                    ? `npm install --no-save electron-edge-js@${electronMajor}`
                    : 'npm install --no-save electron-edge-js edge-js';
                const terminal = vscode.window.createTerminal({
                    name: 'TIA Import - Fix',
                    cwd: extensionPath
                });
                terminal.show();
                terminal.sendText(`cd "${extensionPath}"`);
                terminal.sendText(installCmd);
            }
        });
    }
}
exports.NativeModuleChecker = NativeModuleChecker;
//# sourceMappingURL=nativeModuleChecker.js.map