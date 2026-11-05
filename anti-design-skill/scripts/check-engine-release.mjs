#!/usr/bin/env node
/**
 * Release-order guard (triage decision D4).
 *
 * The launcher (skill/scripts/anti-design), the npm shim (cli/bin/cli.js), and
 * `anti-design install` all dead-end unless the engine release for the pinned
 * ENGINE_VERSION exists FIRST: the five platform binaries in the engine-v<version> GitHub Release
 * of Choxie77/anti-ai-design AND the five @anti-ai-design/cli-<os>-<arch> npm platform packages.
 * Nothing else mechanically stops a maintainer from tagging the skill release (or
 * merging and letting the sync workflow rewrite provider dirs) before those assets
 * are published, which breaks every install path.
 *
 * This script verifies, for the pinned engine version, that:
 *   1. each of the five release binaries anti-design-<os>-<arch>[.exe] is fetchable
 *   2. each binary's .sha256 sidecar is fetchable
 *   3. skill/scripts/engine-checksums.txt records the digest each sidecar publishes
 *   4. each npm platform package @anti-ai-design/cli-<os>-<arch>@<version> is published
 *      (skipped with --no-npm, which the tag-triggered skill release workflow uses
 *      because npm publishing is a separate, human-run step)
 *
 * Downloads trust engine-checksums.txt, never the sidecar; check 3 only proves
 * the two still agree. `--record` hashes the five downloaded binaries into the
 * manifest first, so a binary that disagrees with its own sidecar fails the run.
 *
 * Exits 0 when everything is present, non-zero (naming exactly what is missing)
 * otherwise. release.mjs runs it before an engine-dependent release; CI runs it
 * as a soft warning until the first engine release exists.
 *
 *   node scripts/check-engine-release.mjs            # check the pinned ENGINE_VERSION
 *   node scripts/check-engine-release.mjs --json     # machine-readable report
 *   node scripts/check-engine-release.mjs --no-npm   # skip the npm platform-package probe
 *   node scripts/check-engine-release.mjs --record   # download the release binaries, write engine-checksums.txt, then check
 *   node scripts/check-engine-release.mjs --from-dir <dir>   # write engine-checksums.txt from local release assets (no network, no check)
 *
 * Environment:
 *   ANTI_DESIGN_DOWNLOAD_BASE  release root (default: GitHub Releases of Choxie77/anti-ai-design)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  ENGINE_TARGETS,
  DEFAULT_DOWNLOAD_BASE,
  NPM_SCOPE,
  LEGACY_NPM_SCOPE,
  platformPackageName,
  readEngineVersion,
  assetName,
  assetUrl,
  download,
  expectedChecksum,
  manifestPath,
} from './fetch-engine.mjs';

const NPM_REGISTRY = 'https://registry.npmjs.org';

// A ranged GET is the most portable existence probe: GitHub release downloads
// answer HEAD inconsistently across their 302 to object storage, but a
// `Range: bytes=0-0` GET follows the redirect and returns 200/206 for a real
// asset and 404 for a missing one without pulling the whole binary.
async function urlExists(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { Range: 'bytes=0-0' } });
    return res.ok || res.status === 206;
  } catch (err) {
    return false;
  }
}

// The digest a .sha256 sidecar publishes, or null when it cannot be fetched.
async function sidecarDigest(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return res.ok ? (await res.text()).trim().split(/\s+/)[0].toLowerCase() || null : null;
  } catch {
    return null;
  }
}

function npmPackageUrl(target, version, registry, scope = NPM_SCOPE) {
  // Scoped name: the slash is percent-encoded for the registry path.
  return `${registry}/${platformPackageName(target, scope).replace('/', '%2f')}/${version}`;
}

// The package counts as published under our scope, or (until the rename pass
// moves the npm shim over) under the scope the shim still names.
async function npmVersionExists(target, version, registry) {
  for (const scope of [NPM_SCOPE, LEGACY_NPM_SCOPE]) {
    try {
      const res = await fetch(npmPackageUrl(target, version, registry, scope), { redirect: 'follow' });
      if (res.ok) return true;
    } catch {
      // try the next scope
    }
  }
  return false;
}

/**
 * Check every asset for one engine version. Returns { ok, version, base, missing }
 * where missing is a list of { kind, target, what, url } entries.
 */
export async function checkEngineRelease({
  version = readEngineVersion(),
  base = process.env.ANTI_DESIGN_DOWNLOAD_BASE || DEFAULT_DOWNLOAD_BASE,
  root,
  registry = NPM_REGISTRY,
  npm = true,
} = {}) {
  const missing = [];

  await Promise.all(
    ENGINE_TARGETS.map(async (target) => {
      const binUrl = assetUrl(version, target, base);
      const shaUrl = `${binUrl}.sha256`;
      const npmUrl = npmPackageUrl(target, version, registry);

      const [binOk, published, npmOk] = await Promise.all([
        urlExists(binUrl),
        sidecarDigest(shaUrl),
        npm ? npmVersionExists(target, version, registry) : true,
      ]);
      const recorded = expectedChecksum(version, target, root);

      if (!binOk) missing.push({ kind: 'binary', target, what: `anti-design-${target} binary`, url: binUrl });
      if (!published) missing.push({ kind: 'checksum', target, what: `anti-design-${target} .sha256`, url: shaUrl });
      else if (recorded !== published) {
        missing.push({
          kind: 'manifest',
          target,
          what: `engine-checksums.txt line for ${version} ${assetName(target)} (${recorded ? `records ${recorded}, the release publishes ${published}` : 'none'}; run check-engine-release --record)`,
          url: manifestPath(root),
        });
      }
      if (!npmOk) missing.push({ kind: 'npm', target, what: `${platformPackageName(target)}@${version}`, url: npmUrl });
    })
  );

  // Stable ordering for a readable report: by target, then binary/checksum/manifest/npm.
  const order = { binary: 0, checksum: 1, manifest: 2, npm: 3 };
  missing.sort((a, b) => ENGINE_TARGETS.indexOf(a.target) - ENGINE_TARGETS.indexOf(b.target) || order[a.kind] - order[b.kind]);

  return { ok: missing.length === 0, version, base, missing };
}

const MANIFEST_HEADER = [
  '# Engine binary digests for the pinned ENGINE_VERSION: <engine-version> <asset> <sha256>.',
  '# The launchers, the npm shim, `anti-design install` and scripts/fetch-engine.mjs verify',
  '# every engine download against this file. Written by',
  '# `node scripts/check-engine-release.mjs --record` (or --from-dir, which the',
  '# build-engine workflow runs on the assets it publishes) after each engine release.',
];

/** The manifest text for `[version, asset, sha256]` rows, in ENGINE_TARGETS order. */
export function renderManifest(rows) {
  return [...MANIFEST_HEADER, ...rows.map((row) => row.join(' ')), ''].join('\n');
}

/**
 * Download the five release binaries for `version`, hash them, and write
 * engine-checksums.txt with one line per asset. The manifest holds the pinned
 * version only; each engine release replaces it.
 */
export async function recordEngineChecksums({
  version = readEngineVersion(),
  base = process.env.ANTI_DESIGN_DOWNLOAD_BASE || DEFAULT_DOWNLOAD_BASE,
  root,
} = {}) {
  const rows = await Promise.all(ENGINE_TARGETS.map(async (target) => {
    const digest = createHash('sha256').update(await download(assetUrl(version, target, base))).digest('hex');
    return [version, assetName(target), digest];
  }));
  fs.writeFileSync(manifestPath(root), renderManifest(rows));
}

/**
 * Hash the five release assets already on disk in `dir` (the layout
 * release-engine publishes: <dir>/anti-design-<os>-<arch>[.exe]) and write the
 * manifest to `out` (default: skill/scripts/engine-checksums.txt). Throws when
 * any asset is missing, so a partial build never yields a partial manifest.
 */
export function writeChecksumsFromDir(dir, { version = readEngineVersion(), out = manifestPath() } = {}) {
  const rows = ENGINE_TARGETS.map((target) => {
    const file = path.join(dir, assetName(target));
    if (!fs.existsSync(file)) throw new Error(`missing release asset ${file}`);
    return [version, assetName(target), createHash('sha256').update(fs.readFileSync(file)).digest('hex')];
  });
  fs.writeFileSync(out, renderManifest(rows));
  return out;
}

function report(result) {
  const { ok, version, base, missing } = result;
  if (ok) {
    console.log(`✓ engine v${version} release is complete: all ${ENGINE_TARGETS.length} binaries + .sha256 (+ npm platform packages unless --no-npm) are published, and engine-checksums.txt matches.`);
    console.log(`  release base: ${base}`);
    return;
  }
  const unpublished = missing.filter((m) => m.kind !== 'manifest');
  const stale = missing.filter((m) => m.kind === 'manifest');
  const list = (entries) => {
    for (const m of entries) {
      console.error(`  · ${m.what}`);
      console.error(`      ${m.url}`);
    }
  };
  if (unpublished.length) {
    console.error(`✗ engine v${version} release is INCOMPLETE — ${unpublished.length} asset(s) missing:`);
    list(unpublished);
    console.error('');
    console.error(`Publish engine v${version} (tag engine-v${version}, bun run release:engine) AND the`);
    console.error('five @anti-ai-design/cli-<os>-<arch> npm platform packages BEFORE releasing the');
    console.error('skill or merging rust-swap. Ordering: engine release → platform packages →');
    console.error('skill release/merge. See CLAUDE.md "Releases" and docs REVIEW-TRIAGE.md D4.');
  }
  if (stale.length) {
    console.error(`✗ skill/scripts/engine-checksums.txt disagrees with the engine v${version} release:`);
    list(stale);
    console.error('');
    console.error('Run node scripts/check-engine-release.mjs --record and commit the manifest.');
  }
  console.error(`  release base: ${base}`);
}

async function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  const fromDir = argv.indexOf('--from-dir');
  if (fromDir !== -1) {
    const dir = argv[fromDir + 1];
    if (!dir) throw new Error('--from-dir needs a directory of release assets');
    console.log(`wrote ${writeChecksumsFromDir(path.resolve(dir))}`);
    return 0;
  }
  if (argv.includes('--record')) await recordEngineChecksums();
  const result = await checkEngineRelease({ npm: !argv.includes('--no-npm') });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    report(result);
  }
  return result.ok ? 0 : 1;
}

// Run only when invoked directly, not when imported by release.mjs.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code), (err) => { console.error(`check-engine-release: ${err.message}`); process.exit(1); });
}
