#!/usr/bin/env node
/**
 * Build and package a release VSIX with a single version bump.
 *
 * Usage:
 *   npm run release:vsix
 *   npm run release:vsix -- --out dist/tia-import.vsix
 *   npm run release:vsix -- --skip-docs-sync
 *
 * What it does:
 *   1. Builds the .NET wrapper for all supported TIA Portal versions (V18-V21).
 *   2. Runs `npx tsc -p ./` without triggering `precompile`, so release retries
 *      do not accidentally bump package.json and the README version badge.
 *   3. Packages the extension into a VSIX without running `vscode:prepublish`.
 *   4. Syncs README.md and CHANGELOG.md to the public GitHub repository copy.
 *
 * Before running:
 *   - Update CHANGELOG.md for the version that will be created.
 *   - Commit or intentionally keep any working-tree changes you want included.
 *
 * Output:
 *   - By default: tia-import-<version>.vsix in the repository root.
 *   - With --out: writes to the provided file or directory path.
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pack } = require('@vscode/vsce/out/package');

const root = path.resolve(__dirname, '..');
const defaultDocsRepo = 'https://github.com/cmariusz/TiaImportExport.VSExt.git';

function parseArgs(argv) {
    const options = {
        out: undefined,
        syncDocs: process.env.TIA_RELEASE_SYNC_DOCS !== '0',
        docsRepo: process.env.TIA_RELEASE_DOCS_REPO || defaultDocsRepo,
        docsBranch: process.env.TIA_RELEASE_DOCS_BRANCH || undefined,
        docsDryRun: false,
        docsCommitMessage: undefined
    };
    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        if (arg === '--out' || arg === '-o') {
            const value = argv[++index];
            if (!value) {
                throw new Error(`${arg} requires a file or directory path`);
            }
            options.out = path.resolve(root, value);
            continue;
        }
        if (arg === '--sync-docs') {
            options.syncDocs = true;
            continue;
        }
        if (arg === '--skip-docs-sync' || arg === '--no-sync-docs') {
            options.syncDocs = false;
            continue;
        }
        if (arg === '--docs-repo') {
            const value = argv[++index];
            if (!value) {
                throw new Error(`${arg} requires a repository URL`);
            }
            options.docsRepo = value;
            continue;
        }
        if (arg === '--docs-branch') {
            const value = argv[++index];
            if (!value) {
                throw new Error(`${arg} requires a branch name`);
            }
            options.docsBranch = value;
            continue;
        }
        if (arg === '--docs-dry-run') {
            options.docsDryRun = true;
            continue;
        }
        if (arg === '--docs-commit-message') {
            const value = argv[++index];
            if (!value) {
                throw new Error(`${arg} requires a commit message`);
            }
            options.docsCommitMessage = value;
            continue;
        }
        if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        }
        throw new Error(`Unknown argument: ${arg}`);
    }
    return options;
}

function resolvePackagePath(out) {
    if (!out) {
        return undefined;
    }

    if (path.extname(out).toLowerCase() === '.vsix') {
        fs.mkdirSync(path.dirname(out), { recursive: true });
        return out;
    }

    fs.mkdirSync(out, { recursive: true });
    return out;
}

function printUsage() {
    console.log([
        'Usage:',
        '  npm run release:vsix',
        '  npm run release:vsix -- --out dist/tia-import.vsix',
        '  npm run release:vsix -- --skip-docs-sync',
        '  npm run release:vsix -- --docs-dry-run',
        '',
        'Builds V18-V21 .NET wrappers, runs TypeScript compile without version bumping, then packages VSIX.',
        '',
        'By default, after packaging it syncs README.md and CHANGELOG.md to:',
        `  ${defaultDocsRepo}`,
        '',
        'Options:',
        '  --skip-docs-sync         Do not update the public documentation repository',
        '  --docs-repo <url>        Override the Git repository used for documentation sync',
        '  --docs-branch <name>     Clone/push a specific branch instead of the remote default',
        '  --docs-dry-run           Copy docs and show git status without committing or pushing',
        '  --docs-commit-message    Override the generated docs sync commit message',
        '',
        'Environment:',
        '  TIA_RELEASE_SYNC_DOCS=0  Disable docs sync by default',
        '  TIA_RELEASE_DOCS_REPO    Override the docs repository URL',
        '  TIA_RELEASE_DOCS_BRANCH  Override the docs repository branch'
    ].join('\n'));
}

function shouldUseShell(command) {
    return process.platform === 'win32' && /^(npm|npx)(\.cmd)?$/i.test(command);
}

function run(command, args, cwd = root) {
    console.log(`\n> ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args, {
        cwd,
        stdio: 'inherit',
        shell: shouldUseShell(command)
    });

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
    }
}

function capture(command, args, cwd = root) {
    const result = spawnSync(command, args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: shouldUseShell(command)
    });

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        const output = [result.stdout, result.stderr]
            .filter(Boolean)
            .join('\n')
            .trim();
        throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}${output ? `:\n${output}` : ''}`);
    }

    return result.stdout;
}

function readPackageVersion() {
    const packageJsonPath = path.join(root, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
}

async function packageVsix(options) {
    const result = await pack({
        cwd: root,
        useYarn: false,
        packagePath: resolvePackagePath(options.out)
    });
    const stats = fs.statSync(result.packagePath);
    console.log(`\nPackaged: ${result.packagePath} (${result.files.length} files, ${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    return result.packagePath;
}

function getTrackedFile(repositoryRoot, candidates) {
    const trackedFiles = capture('git', ['ls-files'], repositoryRoot)
        .split(/\r?\n/)
        .filter(Boolean);
    const byLowerName = new Map(trackedFiles.map(file => [file.toLowerCase(), file]));

    for (const candidate of candidates) {
        const tracked = byLowerName.get(candidate.toLowerCase());
        if (tracked) {
            return tracked;
        }
    }

    return candidates[0];
}

function copyDocumentation(repositoryRoot) {
    const mappings = [
        {
            source: 'README.md',
            target: getTrackedFile(repositoryRoot, ['README.md', 'Readme.md', 'readme.md'])
        },
        {
            source: 'CHANGELOG.md',
            target: getTrackedFile(repositoryRoot, ['CHANGELOG.md', 'Changelog.md', 'changelog.md'])
        }
    ];

    for (const mapping of mappings) {
        const sourcePath = path.join(root, mapping.source);
        const targetPath = path.join(repositoryRoot, mapping.target);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`Synced ${mapping.source} -> ${mapping.target}`);
    }

    return mappings.map(mapping => mapping.target);
}

function syncDocumentation(options, version) {
    if (!options.syncDocs) {
        console.log('\nDocumentation repository sync skipped.');
        return;
    }

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tia-docs-sync-'));
    const repositoryRoot = path.join(tempRoot, 'repo');
    const cloneArgs = ['clone', '--depth', '1'];
    if (options.docsBranch) {
        cloneArgs.push('--branch', options.docsBranch);
    }
    cloneArgs.push(options.docsRepo, repositoryRoot);

    try {
        console.log(`\nSyncing README.md and CHANGELOG.md to ${options.docsRepo}`);
        run('git', cloneArgs);

        const syncedFiles = copyDocumentation(repositoryRoot);
        const status = capture('git', ['status', '--short', '--', ...syncedFiles], repositoryRoot).trim();
        if (!status) {
            console.log('Documentation repository is already up to date.');
            return;
        }

        console.log('\nDocumentation changes:');
        console.log(status);

        if (options.docsDryRun) {
            console.log('\nDry run enabled: documentation changes were not committed or pushed.');
            return;
        }

        run('git', ['add', '--', ...syncedFiles], repositoryRoot);
        run('git', ['commit', '-m', options.docsCommitMessage || `docs: sync TIA Import release v${version}`], repositoryRoot);
        if (options.docsBranch) {
            run('git', ['push', 'origin', `HEAD:${options.docsBranch}`], repositoryRoot);
        } else {
            run('git', ['push'], repositoryRoot);
        }
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
}

async function main() {
    const options = parseArgs(process.argv.slice(2));

    console.log('TIA Import VSIX release build');
    console.log(`Starting version: ${readPackageVersion()}`);

    run('npm', ['run', 'build:dotnet']);
    run('npx', ['tsc', '-p', './']);

    const version = readPackageVersion();
    console.log(`Release version: ${version}`);

    const vsixPath = await packageVsix(options);
    syncDocumentation(options, version);
    console.log(`Done: ${vsixPath}`);
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
