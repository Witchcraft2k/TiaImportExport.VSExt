// One-off fidelity check: verify the extracted preview/* string blocks are
// verbatim substrings of the original (pre-refactor) committed file.
// Reads the original straight from git so encoding stays intact.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const orig = execSync(
  'git show HEAD:src/services/automationCompare/automationComparePreviewPanel.ts',
  { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
).replace(/\r\n/g, '\n');

const base = path.join(__dirname, '..', 'src', 'services', 'automationCompare', 'preview');
const norm = (s) => s.replace(/\r\n/g, '\n');

const stylesSrc = norm(fs.readFileSync(path.join(base, 'previewStyles.ts'), 'utf8'));
const cssMatch = stylesSrc.match(/PREVIEW_STYLES\s*=\s*`([\s\S]*?)`;\s*$/m);

const checks = [];
if (cssMatch) {
  checks.push(['PREVIEW_STYLES body verbatim', orig.includes(cssMatch[1])]);
} else {
  checks.push(['PREVIEW_STYLES body (extract regex)', false]);
}

// Distinctive literal fragments that must survive verbatim in the moved blocks.
const probes = [
  ':root {',
  'window.__tiaInstallActHistoryPatch',
  'after-polyfills',
  'viewFileInExplorer',
  'updateTitle',
  'actError',
  'actLog',
  'point them at VS Code theme colors'
];
for (const p of probes) {
  checks.push([`probe: ${JSON.stringify(p)}`, orig.includes(p)]);
}

let ok = true;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (!pass) ok = false;
}
console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
