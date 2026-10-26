#!/usr/bin/env node
/**
 * Nocna kopia bazy: mysqldump → gzip → ~/backups/estateos/estateos-RRRR-MM-DD_GGMM.sql.gz
 * Trzyma 14 dni (zawsze co najmniej 3 ostatnie kopie). Hasło idzie przez zmienną środowiskową, nie w poleceniu.
 *
 *   node scripts/db-backup.cjs            → zrób kopię
 *   node scripts/db-backup.cjs --list     → pokaż kopie
 *
 * Odtworzenie: gunzip -c plik.sql.gz | mysql -u UŻYTKOWNIK -p BAZA
 */
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const KEEP_DAYS = Number(process.env.DB_BACKUP_KEEP_DAYS || 14);
const KEEP_MIN = 3;
const dir = process.env.DB_BACKUP_DIR || path.join(os.homedir(), 'backups', 'estateos');

function listBackups() {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^estateos-.*\.sql\.gz$/.test(name))
    .map((name) => ({ name, full: path.join(dir, name), stat: fs.statSync(path.join(dir, name)) }))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
}

function prune() {
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  listBackups().forEach((file, index) => {
    if (index >= KEEP_MIN && file.stat.mtimeMs < cutoff) {
      fs.unlinkSync(file.full);
      console.log(`[db-backup] usunięto starą kopię ${file.name}`);
    }
  });
}

async function main() {
  if (process.argv.includes('--list')) {
    for (const file of listBackups()) {
      console.log(`${file.name}  ${(file.stat.size / 1024 / 1024).toFixed(1)} MB`);
    }
    return;
  }
  const url = new URL(String(process.env.DATABASE_URL || ''));
  if (!/^mysql|mariadb/.test(url.protocol)) throw new Error('DATABASE_URL nie wskazuje na MySQL/MariaDB.');
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
  const target = path.join(dir, `estateos-${stamp}.sql.gz`);
  const partial = `${target}.part`;

  const dump = spawn(
    'mysqldump',
    [
      `--host=${url.hostname || '127.0.0.1'}`,
      `--port=${url.port || '3306'}`,
      `--user=${decodeURIComponent(url.username)}`,
      '--single-transaction',
      '--quick',
      '--routines',
      '--triggers',
      '--no-tablespaces',
      '--default-character-set=utf8mb4',
      database,
    ],
    { env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stderr = '';
  dump.stderr.on('data', (chunk) => (stderr += chunk.toString()));
  const out = fs.createWriteStream(partial, { mode: 0o600 });
  dump.stdout.pipe(zlib.createGzip({ level: 6 })).pipe(out);

  const code = await new Promise((resolve) => dump.on('close', resolve));
  await new Promise((resolve) => out.on('close', resolve));
  if (code !== 0) {
    fs.rmSync(partial, { force: true });
    throw new Error(`mysqldump zakończył się kodem ${code}: ${stderr.trim().slice(0, 400)}`);
  }
  const size = fs.statSync(partial).size;
  if (size < 10 * 1024) {
    fs.rmSync(partial, { force: true });
    throw new Error(`Kopia podejrzanie mała (${size} B) — nie zapisuję.`);
  }
  fs.renameSync(partial, target);
  console.log(`[db-backup] OK ${path.basename(target)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  prune();
}

main().catch((error) => {
  console.error('[db-backup] BŁĄD', error instanceof Error ? error.message : error);
  process.exit(1);
});
