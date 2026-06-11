/**
 * Auto-increment build number in package.json version.
 * 
 * Version format: MAJOR.RELEASE.BUILD
 *   - MAJOR   (1)   — fixed, change manually for breaking changes
 *   - RELEASE (yyy) — change manually for new releases
 *   - BUILD   (xxx) — auto-incremented on each compile
 * 
 * Usage: node scripts/bump-version.js
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const currentVersion = packageJson.version;
const parts = currentVersion.split('.');

if (parts.length !== 3) {
    console.error(`Invalid version format: ${currentVersion}. Expected MAJOR.RELEASE.BUILD`);
    process.exit(1);
}

const major = parts[0];
const release = parts[1];
const build = parseInt(parts[2], 10);

const newBuild = build + 1;
const newVersion = `${major}.${release}.${newBuild}`;

packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

// Update version badge in README.md
const readmePath = path.join(__dirname, '..', 'README.md');
if (fs.existsSync(readmePath)) {
    let readme = fs.readFileSync(readmePath, 'utf8');
    const badgeRegex = /<!-- VERSION-BADGE -->\r?\n.*?\r?\n<!-- \/VERSION-BADGE -->/s;
    const eol = readme.includes('\r\n') ? '\r\n' : '\n';
    const newBadge = `<!-- VERSION-BADGE -->${eol}[![Version](https://img.shields.io/badge/version-${newVersion}-blue)](package.json)${eol}<!-- /VERSION-BADGE -->`;
    const replaced = readme.replace(badgeRegex, newBadge);
    if (replaced !== readme) {
        fs.writeFileSync(readmePath, replaced, 'utf8');
    }
}

console.log(`Version: ${currentVersion} → ${newVersion}`);
