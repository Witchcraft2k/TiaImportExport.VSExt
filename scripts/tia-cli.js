#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const path = require('path');

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.command) {
  printHelp(args.help ? 0 : 1);
}

const state = readState(args);
const payload = {
  command: args.command,
  args: args.payload
};

request(state, payload, args.timeoutMs)
  .then(result => {
    process.stdout.write(JSON.stringify(result, null, args.pretty ? 2 : 0));
    process.stdout.write('\n');
    if (result && result.success === false) {
      process.exitCode = 2;
    }
  })
  .catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });

function parseArgs(argv) {
  const parsed = {
    command: undefined,
    workspace: process.cwd(),
    statePath: process.env.TIA_CLI_STATE,
    payload: {},
    timeoutMs: 0,
    pretty: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--help' || item === '-h') {
      parsed.help = true;
      continue;
    }
    if (item === '--pretty') {
      parsed.pretty = true;
      continue;
    }
    if (item === '--workspace') {
      parsed.workspace = requiredValue(argv, ++index, item);
      continue;
    }
    if (item === '--state') {
      parsed.statePath = requiredValue(argv, ++index, item);
      continue;
    }
    if (item === '--timeout') {
      parsed.timeoutMs = Number(requiredValue(argv, ++index, item));
      if (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs < 0) {
        throw new Error('--timeout must be a non-negative number of milliseconds');
      }
      continue;
    }
    if (item === '--json') {
      parsed.payload = { ...parsed.payload, ...readJsonValue(requiredValue(argv, ++index, item)) };
      continue;
    }
    if (item === '--stdin') {
      parsed.payload = { ...parsed.payload, ...JSON.parse(fs.readFileSync(0, 'utf8')) };
      continue;
    }
    if (item.startsWith('--')) {
      const key = item.slice(2);
      const value = requiredValue(argv, ++index, item);
      mergeArg(parsed.payload, key, coerceValue(key, value));
      continue;
    }
    if (!parsed.command) {
      parsed.command = item;
      continue;
    }
    throw new Error(`Unexpected argument: ${item}`);
  }

  return parsed;
}

function readState(args) {
  const statePath = args.statePath || path.join(args.workspace, '.tia', 'cli.json');
  if (!fs.existsSync(statePath)) {
    throw new Error(`TIA CLI state not found: ${statePath}. Open the workspace in VS Code and make sure tiaImport.cli.enabled is true.`);
  }
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  for (const key of ['host', 'port', 'token']) {
    if (!state[key]) {
      throw new Error(`Invalid TIA CLI state file: missing ${key}`);
    }
  }
  return state;
}

function request(state, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request({
      host: state.host,
      port: state.port,
      path: '/api',
      method: 'POST',
      headers: {
        authorization: `Bearer ${state.token}`,
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body)
      }
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(new Error(`Invalid JSON response (${res.statusCode}): ${text}`));
        }
      });
    });

    req.on('error', reject);
    if (timeoutMs > 0) {
      req.setTimeout(timeoutMs, () => req.destroy(new Error(`TIA CLI request timed out after ${timeoutMs} ms`)));
    }
    req.end(body);
  });
}

function readJsonValue(value) {
  if (value.startsWith('@')) {
    return JSON.parse(fs.readFileSync(value.slice(1), 'utf8'));
  }
  return JSON.parse(value);
}

function coerceValue(key, value) {
  if (key === 'blocks') {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (/^-?\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}

function mergeArg(target, key, value) {
  if (Object.prototype.hasOwnProperty.call(target, key)) {
    target[key] = Array.isArray(target[key]) ? [...target[key], value] : [target[key], value];
    return;
  }
  target[key] = value;
}

function requiredValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printHelp(exitCode) {
  const text = `Usage:
  node scripts/tia-cli.js <command> [--workspace <path>] [--json '{"key":"value"}'] [--pretty]
  npm run tia:cli -- <command> [args]

Examples:
  npm run tia:cli -- current_project --pretty
  npm run tia:cli -- prepare_workspace --pretty
  npm run tia:cli -- get_logs --limit 100 --pretty
  npm run tia:cli -- connect --pretty
  npm run tia:cli -- open_project --filePath "C:\\Projects\\Demo.ap21" --pretty
  npm run tia:cli -- list_projects --pretty
  npm run tia:cli -- select_project --projectName Demo --pretty
  npm run tia:cli -- list_blocks --device PLC_1 --nameFilter FB --limit 50 --pretty
  npm run tia:cli -- import_blocks --device PLC_1 --blocks FB10,FC20 --pretty
  npm run tia:cli -- import_file --device PLC_1 --filePath "C:\\Projects\\Demo\\Block.xml" --overwriteExisting true
  npm run tia:cli -- tia_export_project --json '{"includeHwConfig":true}' --timeout 0 --pretty

Available command names match the LM tools with or without the tia_ prefix:
  prepare_workspace, connect, open_project, disconnect/close_project, current_project,
  list_projects, select_project, refresh, list_devices, list_blocks,
  import_blocks, export_block, export_device, export_hw_config, export_project,
  import_file, import_folder, import_hw_config, compile,
  get_problems, fix_compile_errors, export_cross_references, get_logs
`;
  process.stdout.write(text);
  process.exit(exitCode);
}
