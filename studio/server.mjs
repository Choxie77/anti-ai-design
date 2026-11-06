#!/usr/bin/env node
// Anti-AI Design Studio: `node studio/server.mjs --root <folder> [--port 4180] [--engine <binary>]`
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './lib/app.mjs';
import { resolveBinary, engineVersion, BUILD_COMMAND } from './lib/engine.mjs';

function usage(code) {
  process.stderr.write(
    'Usage: node studio/server.mjs --root <folder> [--port 4180] [--engine <binary>]\n\n' +
      '  --root    folder the Studio may read and write (required)\n' +
      '  --port    port on 127.0.0.1 (default 4180)\n' +
      '  --engine  path to the detector binary (default: auto-detect)\n',
  );
  process.exit(code);
}

const args = process.argv.slice(2);
const opt = { port: 4180 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--help' || a === '-h') usage(0);
  else if (a === '--root') opt.root = args[++i];
  else if (a === '--port') opt.port = Number(args[++i]);
  else if (a === '--engine') opt.engine = args[++i];
  else usage(1);
}
if (!opt.root) usage(1);
if (!Number.isInteger(opt.port) || opt.port < 0 || opt.port > 65535) usage(1);
const rootPath = path.resolve(opt.root);
if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
  process.stderr.write(`--root is not a folder: ${rootPath}\n`);
  process.exit(1);
}

const app = createApp({ root: rootPath, engineBin: opt.engine });
let port;
try {
  port = await app.listen(opt.port);
} catch (err) {
  process.stderr.write(`Could not listen on 127.0.0.1:${opt.port}: ${err.message}\n`);
  process.exit(1);
}

const bin = resolveBinary({ explicit: opt.engine });
let version = '';
if (bin) {
  try {
    version = await engineVersion(bin);
  } catch {
    version = '(version unavailable)';
  }
}
process.stdout.write(`Anti-AI Design Studio\n`);
process.stdout.write(`  root    ${app.root}\n`);
process.stdout.write(`  engine  ${bin ? `${bin} ${version}` : `NOT FOUND. Build it with: ${BUILD_COMMAND}`}\n`);
process.stdout.write(`  open    http://127.0.0.1:${port}/#token=${app.token}\n`);
process.stdout.write(`The token changes on every start. Nothing leaves this machine. Ctrl+C stops the server.\n`);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => app.close().then(() => process.exit(0)));
}
