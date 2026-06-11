const fs = require('fs');
const path = require('path');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function extractTsMethods(fileContent) {
  const methods = new Set();

  // Direct calls: this.callDotNet('Method', ...)
  const callDotNetRegex = /callDotNet(?:<[^>]+>)?\(\s*'([^']+)'/g;
  let match;
  while ((match = callDotNetRegex.exec(fileContent)) !== null) {
    methods.add(match[1]);
  }

  // Wrapper calls: this.safeCall('label', 'Method', ...)
  const safeCallRegex = /safeCall(?:<[^>]+>)?\(\s*'[^']+'\s*,\s*'([^']+)'/g;
  while ((match = safeCallRegex.exec(fileContent)) !== null) {
    methods.add(match[1]);
  }

  return methods;
}

function collectTsMethodsFromBridge(bridgeDir) {
  const methods = new Set();
  if (!fs.existsSync(bridgeDir)) {
    return methods;
  }
  for (const entry of fs.readdirSync(bridgeDir)) {
    if (!entry.endsWith('.ts')) continue;
    const content = read(path.join(bridgeDir, entry));
    for (const m of extractTsMethods(content)) methods.add(m);
  }
  return methods;
}

function extractCsMethods(fileContent) {
  const methods = new Set();
  const regex = /router\.Register\("([^"]+)"/g;
  let match;

  while ((match = regex.exec(fileContent)) !== null) {
    methods.add(match[1]);
  }

  return methods;
}

function difference(firstSet, secondSet) {
  return [...firstSet].filter(item => !secondSet.has(item));
}

function main() {
  const repositoryRoot = path.resolve(__dirname, '..');
  const bridgeDir = path.join(repositoryRoot, 'src', 'services', 'bridge');
  const connectorPath = path.join(repositoryRoot, 'dotnet', 'TiaOpennessWrapper', 'TiaConnector.cs');

  const csContent = read(connectorPath);

  const tsMethods = collectTsMethodsFromBridge(bridgeDir);
  const csMethods = extractCsMethods(csContent);

  const onlyInTs = difference(tsMethods, csMethods).sort();
  const onlyInCs = difference(csMethods, tsMethods).sort();

  if (onlyInTs.length === 0 && onlyInCs.length === 0) {
    console.log(`OK: method parity validated (${tsMethods.size} methods).`);
    process.exit(0);
  }

  console.error('FAIL: method parity mismatch between TS bridge and C# router.');

  if (onlyInTs.length > 0) {
    console.error(`- Missing in C# router (${onlyInTs.length}): ${onlyInTs.join(', ')}`);
  }

  if (onlyInCs.length > 0) {
    console.error(`- Missing in TS bridge (${onlyInCs.length}): ${onlyInCs.join(', ')}`);
  }

  process.exit(1);
}

main();