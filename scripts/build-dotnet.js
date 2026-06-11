#!/usr/bin/env node
/**
 * Build the TiaOpennessWrapper .NET project once per supported TIA Portal
 * major version. The Siemens NuGet package only resolves Siemens.Engineering*
 * reference assemblies from the locally installed TIA Portal, so each major
 * version produces a separate binary in:
 *   dotnet/TiaOpennessWrapper/bin/Release/net48/V<n>/TiaOpennessWrapper.dll
 *
 * Versions whose PublicAPI directory is missing are skipped with a warning
 * (you cannot build a V19 binary without TIA Portal V19 installed). At least
 * one version must build successfully.
 */
'use strict';

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SUPPORTED_VERSIONS = [18, 19, 20, 21];
const PROJECT = path.resolve(__dirname, '..', 'dotnet', 'TiaOpennessWrapper', 'TiaOpennessWrapper.csproj');
const PROJECT_DIR = path.dirname(PROJECT);
const OUTPUT_ROOT = path.join(PROJECT_DIR, 'bin', 'Release', 'net48');
const REFS_ROOT = path.resolve(__dirname, '..', 'dotnet', 'refs');
const WRAPPER_DLL = 'TiaOpennessWrapper.dll';

function publicApiDir(major) {
    return `C:\\Program Files\\Siemens\\Automation\\Portal V${major}\\PublicAPI\\V${major}\\net48`;
}

function localRefsDir(major) {
    return path.join(REFS_ROOT, `V${major}`);
}

function hasLocalRefs(major) {
    const dir = localRefsDir(major);
    if (!fs.existsSync(dir)) return false;
    // Require at least Siemens.Engineering.dll
    return fs.existsSync(path.join(dir, 'Siemens.Engineering.dll'));
}

function hashFile(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function cleanOutputRoot() {
    fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
}

function deduplicateCommonDependencies(builtVersions) {
    if (builtVersions.length < 2) {
        return;
    }

    const versionDirs = builtVersions
        .map(major => ({ major, dir: path.join(OUTPUT_ROOT, `V${major}`) }))
        .filter(item => fs.existsSync(item.dir));
    if (versionDirs.length < 2) {
        return;
    }

    const filesByName = new Map();
    for (const { dir } of versionDirs) {
        for (const fileName of fs.readdirSync(dir)) {
            if (!fileName.toLowerCase().endsWith('.dll') || fileName === WRAPPER_DLL) {
                continue;
            }
            const files = filesByName.get(fileName) ?? [];
            files.push(path.join(dir, fileName));
            filesByName.set(fileName, files);
        }
    }

    const commonDir = path.join(OUTPUT_ROOT, 'common');
    fs.rmSync(commonDir, { recursive: true, force: true });
    fs.mkdirSync(commonDir, { recursive: true });

    let moved = 0;
    let savedBytes = 0;
    for (const [fileName, files] of filesByName.entries()) {
        if (files.length !== versionDirs.length) {
            continue;
        }
        const hashes = files.map(hashFile);
        if (!hashes.every(hash => hash === hashes[0])) {
            continue;
        }

        const source = files[0];
        const size = fs.statSync(source).size;
        fs.copyFileSync(source, path.join(commonDir, fileName));
        for (const file of files) {
            fs.unlinkSync(file);
        }
        moved++;
        savedBytes += size * (files.length - 1);
    }

    if (moved === 0) {
        fs.rmSync(commonDir, { recursive: true, force: true });
        console.log('No duplicate .NET dependencies found to deduplicate.');
        return;
    }

    console.log(`Deduplicated ${moved} common .NET dependencies into ${path.relative(process.cwd(), commonDir)} (saved ${(savedBytes / 1024 / 1024).toFixed(1)} MB before VSIX compression).`);
}

let built = 0;
let skipped = 0;
const failures = [];
const builtVersions = [];

cleanOutputRoot();

for (const major of SUPPORTED_VERSIONS) {
    const apiDir = publicApiDir(major);
    const localRefs = hasLocalRefs(major);
    const installed = fs.existsSync(apiDir);

    if (!installed && !localRefs) {
        console.log(`[V${major}] Skipped — TIA Portal V${major} not installed and no local refs at ${localRefsDir(major)}.`);
        skipped++;
        continue;
    }

    const source = localRefs ? `local refs (${localRefsDir(major)})` : `installed TIA (${apiDir})`;
    console.log(`[V${major}] Building wrapper using ${source}...`);
    const res = spawnSync(
        'dotnet',
        ['build', PROJECT, '-c', 'Release', `/p:OpennessTiaMajor=${major}`, '-v', 'minimal'],
        { stdio: 'inherit', shell: true }
    );

    if (res.status === 0) {
        built++;
        builtVersions.push(major);
    } else {
        failures.push(major);
    }
}

console.log('');
console.log(`Build summary: built=${built}, skipped=${skipped}, failed=${failures.length}`);

if (failures.length > 0) {
    console.error(`Failed versions: V${failures.join(', V')}`);
    process.exit(1);
}

if (built === 0) {
    console.error('No TIA Portal version is installed — at least one is required to produce the wrapper.');
    process.exit(1);
}

deduplicateCommonDependencies(builtVersions);
