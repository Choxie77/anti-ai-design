#!/usr/bin/env node
// Anti-AI Design Studio: `node studio/server.mjs [folder] [--lock] [--port 4180] [--engine <binary>]`
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './lib/app.mjs';
import { resolveBinary, engineVersion, BUILD_COMMAND } from './lib/engine.mjs';
import { inspectProject } from './lib/project.mjs';
import { isTooBroad, defaultStateFile } from './lib/folders.mjs';

function usage(code) {
  process.stderr.write(
    'Usage: node studio/server.mjs [folder] [--lock] [--port 4180] [--engine <binary>]\n\n' +
      '  folder    the project to open (same as --root). Leave it out and pick the project in the page;\n' +
      '            if you start the Studio inside a project, that project opens by itself\n' +
      '  --root    same as the folder argument\n' +
      '  --lock    pin the Studio to that one folder: the page cannot switch to another project\n' +
      '  --port    port on 127.0.0.1 (default 4180)\n' +
      '  --engine  path to the detector binary (default: auto-detect)\n',
  );
  process.exit(code);
}

const args = process.argv.slice(2);
const opt = { port: 4180, lock: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--help' || a === '-h') usage(0);
  else if (a === '--root') opt.root = args[++i];
  else if (a === '--lock') opt.lock = true;
  else if (a === '--port') opt.port = Number(args[++i]);
  else if (a === '--engine') opt.engine = args[++i];
  else if (!a.startsWith('-') && opt.root === undefined) opt.root = a;
  else usage(1);
}
if (!Number.isInteger(opt.port) || opt.port < 0 || opt.port > 65535) usage(1);
if (opt.lock && !opt.root) {
  process.stderr.write('--lock needs a folder to pin to: node studio/server.mjs <folder> --lock\n');
  process.exit(1);
}

// Which project to open at start-up. A folder given on the command line always wins. Otherwise the folder
// the Studio was started in is used when it looks like a project; if it does not (an empty folder, the home
// folder, the disk root) the page asks the person to choose.
let rootPath = null;
let how = 'none yet: the page will ask you to choose one';
if (opt.root) {
  rootPath = path.resolve(opt.root);
  if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
    process.stderr.write(`That is not a folder: ${rootPath}\n`);
    process.exit(1);
  }
  how = opt.lock ? '(locked)' : '';
} else {
  const here = fs.realpathSync(process.cwd());
  if (!isTooBroad(here) && inspectProject(here).files > 0) {
    rootPath = here;
    how = '(the folder you started in)';
  }
}

const app = createApp({ root: rootPath, lockRoot: opt.lock, engineBin: opt.engine, stateFile: opt.lock ? null : defaultStateFile() });
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
process.stdout.write(`  project ${app.root ? `${app.root} ${how}`.trim() : how}\n`);
process.stdout.write(`  engine  ${bin ? `${bin} ${version}` : `NOT FOUND. Build it with: ${BUILD_COMMAND}`}\n`);
process.stdout.write(`  open    http://127.0.0.1:${port}/#token=${app.token}\n`);
process.stdout.write(`The token changes on every start. Nothing leaves this machine. Ctrl+C stops the server.\n`);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => app.close().then(() => process.exit(0)));
}
