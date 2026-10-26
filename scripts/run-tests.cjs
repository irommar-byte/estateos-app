#!/usr/bin/env node
/**
 * Wszystkie testy projektu jedną komendą: `npm test`.
 * Szuka plików *.test.ts / *.test.cjs w tests/ i uruchamia je w jednym przebiegu (tsx --test).
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const found = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.test\.(ts|cjs|mjs|js)$/.test(entry.name)) found.push(path.relative(root, full));
  }
})(path.join(root, 'tests'));
found.sort();

const filter = process.argv.slice(2);
const files = filter.length ? found.filter((file) => filter.some((part) => file.includes(part))) : found;
if (!files.length) {
  console.error('[test] brak plików testów');
  process.exit(1);
}
console.log(`[test] ${files.length} plików testów`);
const tsx = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const result = spawnSync(fs.existsSync(tsx) ? tsx : 'npx', fs.existsSync(tsx) ? ['--test', ...files] : ['--yes', 'tsx', '--test', ...files], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'test' },
});
process.exit(result.status ?? 1);
