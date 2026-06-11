#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { pack } = require('@vscode/vsce/out/package');

const root = path.resolve(__dirname, '..');

async function main() {
    const result = await pack({
        cwd: root,
        useYarn: false
    });
    const stats = fs.statSync(result.packagePath);
    console.log(`Packaged: ${result.packagePath} (${result.files.length} files, ${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});