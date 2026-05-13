#!/usr/bin/env node
/**
 * Loads DATABASE_URL from APP_ROOT/.env (no secrets printed).
 * Writes gzip SQL to BACKUP_DIR (default: APP_ROOT/backup).
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { config } = require('dotenv');

const APP_ROOT = process.env.APP_ROOT || path.join(__dirname, '..');
config({ path: path.join(APP_ROOT, '.env'), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

let u;
try {
  u = new URL(databaseUrl);
} catch {
  console.error('DATABASE_URL is not a valid URL');
  process.exit(1);
}

const user = decodeURIComponent(u.username || '');
const password = u.password ? decodeURIComponent(u.password) : '';
const host = u.hostname;
const port = u.port || '3306';
const db = decodeURIComponent((u.pathname || '/').replace(/^\//, '').split('?')[0] || '');
if (!host || !db) {
  console.error('DATABASE_URL must include host and database name');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 15);
const backupDir = process.env.BACKUP_DIR || path.join(APP_ROOT, 'backup');
fs.mkdirSync(backupDir, { recursive: true });
const outfile = path.join(backupDir, `estateos_${db}_${stamp}.sql.gz`);

const args = [
  `--host=${host}`,
  `--port=${port}`,
  `--user=${user}`,
  '--single-transaction',
  '--quick',
  '--skip-routines',
  '--triggers',
  db,
];

const dump = spawn('mysqldump', args, {
  env: { ...process.env, MYSQL_PWD: password },
});
const gzip = spawn('gzip', ['-c', '-9']);
const out = fs.createWriteStream(outfile, { mode: 0o600 });

dump.stderr.on('data', (chunk) => process.stderr.write(chunk));

function bail(code, label) {
  console.error(`${label} exited with code ${code}`);
  try {
    fs.unlinkSync(outfile);
  } catch {
    /* ignore */
  }
  process.exit(1);
}

dump.on('error', (err) => {
  console.error('mysqldump spawn error:', err.message);
  process.exit(1);
});
gzip.on('error', (err) => {
  console.error('gzip spawn error:', err.message);
  process.exit(1);
});

dump.stdout.pipe(gzip.stdin);
gzip.stdout.pipe(out);

let dumpCode;
dump.on('close', (code) => {
  dumpCode = code;
});

gzip.on('close', (gzipCode) => {
  if (dumpCode !== 0) bail(dumpCode, 'mysqldump');
  if (gzipCode !== 0) bail(gzipCode, 'gzip');
  console.log('Backup written:', outfile);
});
