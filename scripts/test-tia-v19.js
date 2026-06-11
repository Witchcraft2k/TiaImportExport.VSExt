// Standalone smoke test: call the V19 TiaOpennessWrapper via edge-js
// and verify Connect + GetProjects work against a running TIA Portal V19.
// Requires that TIA Portal V19 is already running and has at least one project open.

const path = require('path');

const VERSION = 19;

const assemblyPath = path.join(
    __dirname,
    '..',
    'dotnet',
    'TiaOpennessWrapper',
    'bin',
    'Release',
    'net48',
    `V${VERSION}`,
    'TiaOpennessWrapper.dll'
);

console.log('Loading assembly:', assemblyPath);

let edge;
try {
    edge = require('electron-edge-js');
    console.log('Using electron-edge-js');
} catch (e) {
    edge = require('edge-js');
    console.log('Using edge-js');
}

const tiaConnector = edge.func({
    assemblyFile: assemblyPath,
    typeName: 'TiaOpennessWrapper.TiaConnector',
    methodName: 'Invoke'
});

function call(method, params = {}) {
    return new Promise((resolve, reject) => {
        const payload = {
            method,
            params: { tiaPortalVersion: VERSION, ...params }
        };
        tiaConnector(payload, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

(async () => {
    try {
        console.log('\n--- Ping (no connect) ---');
        const pingResult = await call('Ping');
        console.log(JSON.stringify(pingResult, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('\nERROR:', err);
        process.exit(1);
    }
})();
