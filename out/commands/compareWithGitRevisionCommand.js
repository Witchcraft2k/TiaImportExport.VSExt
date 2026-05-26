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
exports.compareWithGitRevisionInAct = compareWithGitRevisionInAct;
exports.buildCompareArguments = buildCompareArguments;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const util_1 = require("util");
const vscode = __importStar(require("vscode"));
const automationCompareService_1 = require("../services/automationCompare/automationCompareService");
const automationCompareToolLocator_1 = require("../services/automationCompare/automationCompareToolLocator");
const automationComparePreviewPanel_1 = require("../services/automationCompare/automationComparePreviewPanel");
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
const s7dclPreviewMirror_1 = require("../utils/s7dclPreviewMirror");
const simaticMl_1 = require("../utils/simaticMl");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
/**
 * Compare the working-tree or two historical revisions of a SimaticML XML
 * (or its `.s7dcl` mirror) side-by-side in SIMATIC Automation Compare Tool.
 */
async function compareWithGitRevisionInAct(uri, uris) {
    const target = (uris && uris[0]) || uri;
    if (!target || target.scheme !== 'file') {
        vscode.window.showWarningMessage('ACT compare: select a local .xml or .s7dcl file first.');
        return;
    }
    // For .s7dcl resolve the matching XML mirror; ACT only accepts SimaticML XML.
    let xmlPath = target.fsPath;
    if (xmlPath.toLowerCase().endsWith('.s7dcl')) {
        const mirror = (0, s7dclPreviewMirror_1.findPreviewXmlForS7dcl)(xmlPath);
        if (!mirror) {
            vscode.window.showWarningMessage('ACT compare: no cached XML preview was found for this .s7dcl. ' +
                'Enable "tiaImport.s7dclPreviewXml.enabled" and re-export, or pick the .xml mirror directly.');
            return;
        }
        xmlPath = mirror;
    }
    const validation = (0, simaticMl_1.validateAutomationComparePreviewFile)(xmlPath);
    if (!validation.supported) {
        vscode.window.showWarningMessage(`ACT compare: ${validation.reason || 'Unsupported file type.'}`);
        return;
    }
    const repoRoot = await findGitRepoRoot(path.dirname(xmlPath));
    if (!repoRoot) {
        vscode.window.showWarningMessage('ACT compare: this file is not inside a Git repository.');
        return;
    }
    const relPath = toGitRelativePath(repoRoot, xmlPath);
    let commits;
    try {
        commits = await loadGitHistory(repoRoot, relPath);
    }
    catch (error) {
        logger_1.Logger.error('ACT compare: git log failed', error);
        vscode.window.showErrorMessage(`ACT compare: git log failed — ${errorMessage(error)}`);
        return;
    }
    if (commits.length === 0) {
        vscode.window.showInformationMessage('ACT compare: no Git history found for this file.');
        return;
    }
    const baseItems = [
        { label: '$(file) Working tree', description: 'current file on disk', sha: undefined },
        ...commits.map(commitToChoice)
    ];
    const first = await vscode.window.showQuickPick(baseItems, {
        title: `ACT compare — pick FIRST revision of ${path.basename(relPath)}`,
        placeHolder: 'Select the left-hand revision'
    });
    if (!first) {
        return;
    }
    const secondItems = baseItems.filter(item => item.sha !== first.sha
        || (first.sha === undefined && item.sha !== undefined));
    const second = await vscode.window.showQuickPick(secondItems, {
        title: `ACT compare — pick SECOND revision of ${path.basename(relPath)}`,
        placeHolder: 'Select the right-hand revision'
    });
    if (!second) {
        return;
    }
    try {
        const file1 = await materializeRevision(repoRoot, relPath, first);
        const file2 = await materializeRevision(repoRoot, relPath, second);
        const cfg = (0, config_1.getConfig)().automationCompareTool;
        const locator = await (0, automationCompareToolLocator_1.locateAutomationCompareTool)(cfg);
        if (!locator.success || !locator.location) {
            vscode.window.showErrorMessage(`ACT compare: ${locator.error || 'SIMATIC Automation Compare Tool was not found.'}`);
            return;
        }
        const title1 = revisionTitle(relPath, first);
        const title2 = revisionTitle(relPath, second);
        logger_1.Logger.section('AUTOMATION COMPARE — GIT REVISIONS');
        logger_1.Logger.info(`Tool: ${locator.location.filePath}`);
        logger_1.Logger.info(`File 1: ${file1}  (${title1})`);
        logger_1.Logger.info(`File 2: ${file2}  (${title2})`);
        // Prefer the embedded VS Code webview (same UX as the single-file
        // preview). It loads ACT's installed renderer with both files inlined
        // as Angular globals — no external ACTool.exe process, no
        // single-instance contention, no env-var hazards.
        if (cfg.embedMode === 'native') {
            const webviewResult = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Opening ACT diff (${title1} ↔ ${title2})...`,
                cancellable: false
            }, () => (0, automationComparePreviewPanel_1.openAutomationCompareWebviewForCompare)(locator.location.filePath, {
                leftFilePath: file1,
                rightFilePath: file2,
                leftTitle: title1,
                rightTitle: title2
            }));
            if (webviewResult.success) {
                logger_1.Logger.success('Automation Compare Tool diff opened in VS Code panel.');
                return;
            }
            logger_1.Logger.warn('ACT webview diff failed; falling back to external ACT window.', webviewResult.error);
        }
        // External fallback (embedMode === 'external' or webview launch failed).
        const args = buildCompareArguments(cfg.compareArgumentsTemplate, file1, file2, title1, title2);
        logger_1.Logger.info(`Arguments: ${JSON.stringify(args)}`);
        // ACT runs in single-instance mode by default: when a window is
        // already open it forwards new CLI args to that instance and the
        // spawned process exits immediately. The forwarded args are NOT
        // re-parsed as a "compare two files" request, so the existing window
        // keeps showing its previous content. Close ACT first or accept the
        // refresh.
        const existingAct = await isAutomationCompareToolRunning();
        if (existingAct) {
            const choice = await vscode.window.showWarningMessage('SIMATIC Automation Compare Tool is already running. Its single-instance ' +
                'mode may ignore the new compare request. Close the existing ACT window ' +
                'before retrying for best results.', { modal: false }, 'Close existing ACT and continue', 'Continue anyway', 'Cancel');
            if (choice === 'Cancel' || !choice) {
                return;
            }
            if (choice === 'Close existing ACT and continue') {
                await closeAutomationCompareTool();
            }
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Opening ACT (${title1} ↔ ${title2})...`,
            cancellable: false
        }, async () => {
            await spawnDetached(locator.location.filePath, args);
        });
        logger_1.Logger.success('Automation Compare Tool launched for revision compare.');
    }
    catch (error) {
        logger_1.Logger.error('ACT compare failed', error);
        vscode.window.showErrorMessage(`ACT compare failed: ${errorMessage(error)}`);
    }
}
function commitToChoice(commit) {
    return {
        label: `$(git-commit) ${commit.shortSha}`,
        description: commit.subject,
        detail: commit.date,
        sha: commit.sha
    };
}
function revisionTitle(relPath, choice) {
    const base = path.basename(relPath);
    return choice.sha ? `${base} @ ${choice.sha.slice(0, 8)}` : `${base} (working tree)`;
}
async function materializeRevision(repoRoot, relPath, choice) {
    const tmpDir = path.join(os.tmpdir(), 'tia-act-compare');
    await fs.promises.mkdir(tmpDir, { recursive: true });
    // ACT 1.4 (Electron) misinterprets the first positional arg as the main
    // module when the path contains spaces or leading-dot segments (e.g.
    // ".tiaPreview\Program blocks\..."), producing "Unexpected token '<'"
    // errors. Always stage to a clean temp name with no spaces.
    const baseName = sanitizeForActPath(path.basename(relPath));
    if (!choice.sha) {
        // Working tree — copy current on-disk file to temp.
        const target = path.join(tmpDir, `working_${baseName}`);
        await fs.promises.copyFile(path.join(repoRoot, relPath), target);
        return target;
    }
    const target = path.join(tmpDir, `${choice.sha.slice(0, 8)}_${baseName}`);
    const { stdout } = await execFileAsync('git', ['-C', repoRoot, 'show', `${choice.sha}:${relPath.replace(/\\/g, '/')}`], { maxBuffer: 64 * 1024 * 1024, encoding: 'buffer' });
    await fs.promises.writeFile(target, stdout);
    return target;
}
/**
 * Strip characters that confuse ACT's CLI parser: spaces and leading dots.
 * Preserves the original extension.
 */
function sanitizeForActPath(fileName) {
    const cleaned = fileName.replace(/\s+/g, '_').replace(/^\.+/, '');
    return cleaned || 'file.xml';
}
async function loadGitHistory(repoRoot, relPath) {
    const { stdout } = await execFileAsync('git', [
        '-C', repoRoot,
        'log',
        '-n', '50',
        '--date=iso-strict',
        '--pretty=format:%H%x09%h%x09%ad%x09%s',
        '--',
        relPath
    ], { maxBuffer: 4 * 1024 * 1024 });
    return stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
        const [sha, shortSha, date, ...rest] = line.split('\t');
        return { sha, shortSha, date, subject: rest.join('\t') };
    });
}
async function findGitRepoRoot(startDir) {
    try {
        const { stdout } = await execFileAsync('git', ['-C', startDir, 'rev-parse', '--show-toplevel'], { maxBuffer: 1024 * 1024 });
        const root = stdout.trim();
        return root || undefined;
    }
    catch {
        return undefined;
    }
}
function toGitRelativePath(repoRoot, absolutePath) {
    return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}
async function isAutomationCompareToolRunning() {
    if (process.platform !== 'win32') {
        return false;
    }
    try {
        const { stdout } = await execFileAsync('tasklist.exe', ['/FI', 'IMAGENAME eq ACTool.exe', '/NH', '/FO', 'CSV'], { maxBuffer: 1024 * 1024 });
        return /ACTool\.exe/i.test(stdout);
    }
    catch {
        return false;
    }
}
async function closeAutomationCompareTool() {
    if (process.platform !== 'win32') {
        return;
    }
    try {
        await execFileAsync('taskkill.exe', ['/IM', 'ACTool.exe', '/F'], { maxBuffer: 1024 * 1024 });
        // Give Electron a moment to release the single-instance lock.
        await new Promise(resolve => setTimeout(resolve, 600));
    }
    catch (error) {
        logger_1.Logger.warn('Failed to close existing ACT instance.', error);
    }
}
function spawnDetached(executablePath, args) {
    return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        // VS Code's extension host sets ELECTRON_RUN_AS_NODE=1 (and a few
        // related vars) so its own helper processes behave as plain Node.
        // ACTool.exe is also an Electron app — if it inherits these vars it
        // boots in Node mode, treats argv[1] (our XML) as the main script,
        // and crashes with "SyntaxError: Unexpected token '<'". Strip the
        // Electron-internal variables before launching.
        const childEnv = { ...process.env };
        delete childEnv.ELECTRON_RUN_AS_NODE;
        delete childEnv.ELECTRON_NO_ATTACH_CONSOLE;
        delete childEnv.ELECTRON_NO_ASAR;
        delete childEnv.NODE_OPTIONS;
        const child = spawn(executablePath, args, {
            detached: true,
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: false,
            env: childEnv
        });
        child.once('error', reject);
        child.stdout?.on('data', chunk => {
            const text = chunk.toString('utf-8').trim();
            if (text) {
                logger_1.Logger.info(`ACT stdout: ${text}`);
            }
        });
        child.stderr?.on('data', chunk => {
            const text = chunk.toString('utf-8').trim();
            if (text) {
                logger_1.Logger.warn(`ACT stderr: ${text}`);
            }
        });
        child.once('exit', (code, signal) => {
            logger_1.Logger.info(`ACT process exited (code=${code}, signal=${signal ?? 'none'}).`);
        });
        child.once('spawn', () => {
            child.unref();
            resolve();
        });
    });
}
function buildCompareArguments(template, file1, file2, title1, title2) {
    // Reuse the single-file argument splitter to handle quoted tokens, then
    // substitute the four compare-specific placeholders.
    const tokens = (0, automationCompareService_1.buildAutomationCompareArguments)(template.trim()
        || '"${file1}" "${file2}" --title1 "${title1}" --title2 "${title2}"', '', '');
    return tokens.map(token => token
        .replace(/\$\{file1\}/g, file1)
        .replace(/\$\{file2\}/g, file2)
        .replace(/\$\{title1\}/g, title1)
        .replace(/\$\{title2\}/g, title2));
}
function errorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
//# sourceMappingURL=compareWithGitRevisionCommand.js.map