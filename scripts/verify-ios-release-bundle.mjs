#!/usr/bin/env node
/**
 * Sprawdza, czy aktualny kod JS trafi do Release (tak samo jak przy Archive w Xcode).
 * Użycie przed Product → Archive:
 *   npm run verify:ios-release
 * Po Archive (przed Upload):
 *   npm run verify:ios-archive
 */
import { execSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();
}

function gitSha() {
  try {
    return run('git rev-parse --short HEAD');
  } catch {
    return 'unknown';
  }
}

function readMarkerFromConfig() {
  delete require.cache[path.join(ROOT, 'app.config.js')];
  const config = require(path.join(ROOT, 'app.config.js'));
  return String(config?.expo?.extra?.buildGitSha ?? '').trim();
}

function embedGitSha() {
  const r = spawnSync('node', ['scripts/embed-git-sha.mjs'], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(1);
}

function releaseFingerprint(marker) {
  return `EOS_RELEASE_FP_${marker}`;
}

function bundleContainsMarker(filePath, marker) {
  const buf = fs.readFileSync(filePath);
  return buf.includes(Buffer.from(marker, 'utf8'));
}

function findBundleFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const full = path.join(d, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (/\.(hbc|jsbundle)$/.test(name)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function exportReleaseBundle(outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  const r = spawnSync(
    'npx',
    ['expo', 'export', '--platform', 'ios', '--output-dir', outDir],
    { cwd: ROOT, stdio: 'inherit' },
  );
  if (r.status !== 0) {
    console.error('\n[FAIL] expo export nie powiódł się.');
    process.exit(1);
  }
}

function verifyExport(marker) {
  const fingerprint = releaseFingerprint(marker);
  embedGitSha();
  const outDir = path.join(os.tmpdir(), 'eos-release-verify');
  console.log(`\n[1/2] Eksport Release bundle (jak Xcode Archive)…`);
  exportReleaseBundle(outDir);

  const bundles = findBundleFiles(outDir);
  if (!bundles.length) {
    console.error('[FAIL] Nie znaleziono .hbc / .jsbundle po eksporcie.');
    process.exit(1);
  }

  const hit = bundles.find((f) => bundleContainsMarker(f, fingerprint));
  if (!hit) {
    console.error(`[FAIL] Bundle nie zawiera ${fingerprint}`);
    console.error('       Archive w Xcode miałby STARY lub pusty JS. Zrób Clean Build Folder i spróbuj ponownie.');
    process.exit(1);
  }

  console.log(`[PASS] Release bundle OK (${path.basename(hit)})`);
  console.log(`       ${fingerprint}`);
}

function latestXcarchive() {
  const base = path.join(os.homedir(), 'Library/Developer/Xcode/Archives');
  if (!fs.existsSync(base)) return null;
  const archives = [];
  for (const day of fs.readdirSync(base)) {
    const dayDir = path.join(base, day);
    if (!fs.statSync(dayDir).isDirectory()) continue;
    for (const name of fs.readdirSync(dayDir)) {
      if (!name.endsWith('.xcarchive')) continue;
      const full = path.join(dayDir, name);
      archives.push({ full, mtime: fs.statSync(full).mtimeMs });
    }
  }
  archives.sort((a, b) => b.mtime - a.mtime);
  return archives[0]?.full ?? null;
}

function verifyArchive(marker) {
  const fingerprint = releaseFingerprint(marker);
  const archive = latestXcarchive();
  if (!archive) {
    console.error('[FAIL] Brak .xcarchive w ~/Library/Developer/Xcode/Archives');
    process.exit(1);
  }

  const appDir = path.join(archive, 'Products/Applications');
  const apps = fs.readdirSync(appDir).filter((n) => n.endsWith('.app'));
  const appPath = path.join(appDir, apps[0] ?? '');
  const bundlePath = path.join(appPath, 'main.jsbundle');

  if (!fs.existsSync(bundlePath)) {
    console.error(`[FAIL] Brak main.jsbundle w ${archive}`);
    process.exit(1);
  }

  let buildNum = '?';
  try {
    const plist = run(`plutil -p "${path.join(appPath, 'Info.plist')}"`);
    const m = plist.match(/"CFBundleVersion"\s*=>\s*"([^"]+)"/);
    if (m) buildNum = m[1];
  } catch {
    /* ignore */
  }

  if (!bundleContainsMarker(bundlePath, fingerprint)) {
    console.error(`[FAIL] Archive build ${buildNum} NIE zawiera ${fingerprint}`);
    console.error(`       Ścieżka: ${archive}`);
    console.error('       Nie wysyłaj tego buildu na TestFlight. Zrób Clean + Archive ponownie.');
    process.exit(1);
  }

  console.log(`[PASS] Ostatni Archive OK (build ${buildNum})`);
  console.log(`       ${fingerprint}`);
  console.log(`       ${archive}`);
}

const mode = process.argv[2] ?? 'export';
const sha = gitSha();
const marker = readMarkerFromConfig();

console.log('=== EstateOS iOS Release verify ===');
console.log(`HEAD:          ${sha}`);
console.log(`buildGitSha:   ${marker}`);

if (marker !== sha) {
  console.warn('\n[WARN] buildGitSha w app.config różni się od git HEAD — uruchom ponownie po zapisie plików.');
}

if (mode === 'archive') {
  console.log('\n[2/2] Sprawdzam ostatni Xcode Archive…');
  verifyArchive(marker);
} else {
  verifyExport(marker);
  console.log('\nNastępnie: Clean Build Folder → Archive → npm run verify:ios-archive → Upload TestFlight');
}
