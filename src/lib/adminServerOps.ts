import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type DiskHealthLevel = 'ok' | 'warning' | 'critical';

export type StorageBucket = {
  id: string;
  label: string;
  service: string;
  root: string;
  deletable: boolean;
  excludeNames?: string[];
};

export type StorageBucketReport = StorageBucket & {
  exists: boolean;
  bytes: number;
  children: Array<{ name: string; path: string; bytes: number; isDir: boolean }>;
};

export type ServerFileEntry = {
  name: string;
  path: string;
  relativePath: string;
  isDir: boolean;
  bytes: number;
  mtimeMs: number | null;
  deletable: boolean;
};

const HOME = (process.env.ADMIN_SERVER_HOME || process.env.HOME || '/home/rommar').replace(/\/+$/, '');

export const STORAGE_BUCKETS: StorageBucket[] = [
  {
    id: 'movies',
    label: 'Filmy',
    service: 'EOS Library · filmy',
    root: path.join(HOME, 'lineage-movies/downloads/MOVIES'),
    deletable: true,
  },
  {
    id: 'music',
    label: 'Muzyka',
    service: 'EOS Library · muzyka',
    root: path.join(HOME, 'lineage-movies/downloads/music'),
    deletable: true,
  },
  {
    id: 'playlists',
    label: 'Playlisty i inne media',
    service: 'EOS Library · inne',
    root: path.join(HOME, 'lineage-movies/downloads'),
    deletable: true,
    excludeNames: ['MOVIES', 'music'],
  },
  {
    id: 'uploads',
    label: 'Zdjęcia ofert',
    service: 'Nieruchomości',
    root: path.join(HOME, 'uploads'),
    deletable: true,
  },
  {
    id: 'estateos',
    label: 'Aplikacja www',
    service: 'Nieruchomości',
    root: path.join(HOME, 'estateos'),
    deletable: false,
  },
  {
    id: 'mysql',
    label: 'Baza danych',
    service: 'MariaDB',
    root: '/var/lib/mysql',
    deletable: false,
  },
  {
    id: 'lineage-cache',
    label: 'Cache i pliki tymczasowe',
    service: 'EOS Library · cache',
    root: path.join(HOME, 'lineage-movies/video-downloader/tmp'),
    deletable: true,
  },
];

const BLOCKED_NAME_RE = /(\.env($|\.)|^id_rsa|^id_ed25519|\.pem$|\.key$)/i;
const MAX_LIST = 500;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

async function run(cmd: string, args: string[], timeout = 12000): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout, maxBuffer: 8 * 1024 * 1024 });
    return String(stdout || '');
  } catch {
    return '';
  }
}

export function diskHealth(percent: number, dbUp: boolean): DiskHealthLevel {
  if (!dbUp || percent >= 94) return 'critical';
  if (percent >= 85) return 'warning';
  return 'ok';
}

export function readCpuMetrics() {
  const cores = os.cpus()?.length || 1;
  const [load1 = 0, load5 = 0, load15 = 0] = os.loadavg();
  const percent = round1(Math.min(100, (load1 / Math.max(cores, 1)) * 100));
  return { percent, cores, load1: round1(load1), load5: round1(load5), load15: round1(load15) };
}

export function readMemoryMetrics() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const percent = totalBytes > 0 ? round1((usedBytes / totalBytes) * 100) : 0;
  return { usedBytes, totalBytes, freeBytes, percent };
}

export async function readDiskMetrics(targetPath = '/') {
  const out = await run('df', ['-kP', targetPath], 3000);
  const line = out.trim().split('\n').pop() || '';
  const parts = line.trim().split(/\s+/);
  const totalKb = Number(parts[1]);
  const usedKb = Number(parts[2]);
  const availKb = Number(parts[3]);
  if (!Number.isFinite(totalKb) || totalKb <= 0) {
    return { usedBytes: 0, totalBytes: 0, freeBytes: 0, percent: 0, mount: '/' };
  }
  const totalBytes = totalKb * 1024;
  const usedBytes = usedKb * 1024;
  const freeBytes = (Number.isFinite(availKb) ? availKb : Math.max(0, totalKb - usedKb)) * 1024;
  return {
    usedBytes,
    totalBytes,
    freeBytes,
    percent: round1((usedBytes / totalBytes) * 100),
    mount: parts[5] || '/',
  };
}

export async function duBytes(target: string, timeout = 20000): Promise<number> {
  if (!fs.existsSync(target)) return 0;
  const gnu = await run('du', ['-sk', '--apparent-size', target], timeout);
  const line = (gnu || (await run('du', ['-sk', target], timeout))).trim().split('\n').pop() || '';
  const kb = Number(String(line).split(/\s+/)[0]);
  return Number.isFinite(kb) ? kb * 1024 : 0;
}

function bucketById(id: string) {
  return STORAGE_BUCKETS.find((b) => b.id === id) || null;
}

function isInside(root: string, candidate: string) {
  const a = path.resolve(root);
  const b = path.resolve(candidate);
  return b === a || b.startsWith(a + path.sep);
}

export function resolveBucketPath(bucketId: string, relativePath = ''): { bucket: StorageBucket; abs: string } {
  const bucket = bucketById(bucketId);
  if (!bucket) throw new Error('Nieznany obszar pamięci.');
  const rel = String(relativePath || '').replace(/^\/+/, '');
  if (rel.includes('\0') || rel.split(path.sep).includes('..')) {
    throw new Error('Nieprawidłowa ścieżka.');
  }
  const abs = path.resolve(bucket.root, rel);
  if (!isInside(bucket.root, abs)) throw new Error('Ścieżka poza dozwolonym katalogiem.');
  return { bucket, abs };
}

async function dirChildrenBytes(root: string, excludeNames: string[] = []) {
  if (!fs.existsSync(root)) return { bytes: 0, children: [] as StorageBucketReport['children'] };
  const names = fs.readdirSync(root).filter((name) => !excludeNames.includes(name) && name !== '.' && name !== '..');
  const children: StorageBucketReport['children'] = [];
  let bytes = 0;
  for (const name of names) {
    const full = path.join(root, name);
    let st: fs.Stats;
    try {
      st = fs.lstatSync(full);
    } catch {
      continue;
    }
    const size = st.isDirectory() ? await duBytes(full, 18000) : st.size;
    bytes += size;
    children.push({ name, path: full, bytes: size, isDir: st.isDirectory() });
  }
  children.sort((a, b) => b.bytes - a.bytes);
  return { bytes, children };
}

export async function collectStorageReport(): Promise<StorageBucketReport[]> {
  const reports: StorageBucketReport[] = [];
  for (const bucket of STORAGE_BUCKETS) {
    const exists = fs.existsSync(bucket.root);
    if (!exists) {
      reports.push({ ...bucket, exists: false, bytes: 0, children: [] });
      continue;
    }
    const { bytes, children } = await dirChildrenBytes(bucket.root, bucket.excludeNames || []);
    reports.push({ ...bucket, exists: true, bytes, children: children.slice(0, 40) });
  }
  reports.sort((a, b) => b.bytes - a.bytes);
  return reports;
}

export function listFiles(bucketId: string, relativePath = ''): {
  bucket: StorageBucket;
  cwd: string;
  parent: string | null;
  entries: ServerFileEntry[];
} {
  const { bucket, abs } = resolveBucketPath(bucketId, relativePath);
  if (!fs.existsSync(abs)) {
    return { bucket, cwd: abs, parent: relativePath ? path.posix.dirname(relativePath.replace(/\\/g, '/')) : null, entries: [] };
  }
  const st = fs.lstatSync(abs);
  const dir = st.isDirectory() ? abs : path.dirname(abs);
  const names = fs.readdirSync(dir).filter((n) => n !== '.' && n !== '..');
  const exclude = !relativePath && bucket.excludeNames ? new Set(bucket.excludeNames) : null;
  const entries: ServerFileEntry[] = [];
  for (const name of names) {
    if (exclude?.has(name)) continue;
    const full = path.join(dir, name);
    let info: fs.Stats;
    try {
      info = fs.lstatSync(full);
    } catch {
      continue;
    }
    const rel = path.relative(bucket.root, full).split(path.sep).join('/');
    entries.push({
      name,
      path: full,
      relativePath: rel,
      isDir: info.isDirectory(),
      bytes: info.isDirectory() ? 0 : info.size,
      mtimeMs: Number.isFinite(info.mtimeMs) ? info.mtimeMs : null,
      deletable: bucket.deletable && !BLOCKED_NAME_RE.test(name),
    });
  }
  entries.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name, 'pl'));
  const parentRel = relativePath ? path.posix.dirname(relativePath.replace(/\\/g, '/')) : null;
  return {
    bucket,
    cwd: dir,
    parent: parentRel === '.' ? '' : parentRel,
    entries: entries.slice(0, MAX_LIST),
  };
}

export async function enrichDirectorySizes(entries: ServerFileEntry[]) {
  const dirs = entries.filter((e) => e.isDir).slice(0, 40);
  await Promise.all(
    dirs.map(async (entry) => {
      entry.bytes = await duBytes(entry.path, 8000);
    }),
  );
  return entries;
}

export function deleteTargets(bucketId: string, relativePaths: string[]) {
  const bucket = bucketById(bucketId);
  if (!bucket) throw new Error('Nieznany obszar pamięci.');
  if (!bucket.deletable) throw new Error('Ten obszar jest chroniony — nie można kasować.');
  const deleted: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  for (const raw of relativePaths) {
    try {
      const { abs } = resolveBucketPath(bucketId, raw);
      const base = path.basename(abs);
      if (BLOCKED_NAME_RE.test(base)) {
        errors.push({ path: raw, error: 'Plik chroniony.' });
        continue;
      }
      if (!fs.existsSync(abs)) {
        errors.push({ path: raw, error: 'Nie istnieje.' });
        continue;
      }
      fs.rmSync(abs, { recursive: true, force: true });
      deleted.push(raw);
    } catch (error) {
      errors.push({ path: raw, error: error instanceof Error ? error.message : 'Błąd' });
    }
  }
  return { deleted, errors };
}

export type Pm2Process = {
  name: string;
  status: string;
  cpu: number;
  memoryBytes: number;
  uptimeMs: number;
  restarts: number;
  pid: number | null;
};

export async function readPm2Processes(): Promise<Pm2Process[]> {
  const out = await run('pm2', ['jlist'], 5000);
  if (!out.trim()) return [];
  try {
    const list = JSON.parse(out) as Array<{
      name?: string;
      pid?: number;
      pm2_env?: { status?: string; pm_uptime?: number; restart_time?: number };
      monit?: { cpu?: number; memory?: number };
    }>;
    return list.map((item) => ({
      name: String(item.name || 'unknown'),
      status: String(item.pm2_env?.status || 'unknown'),
      cpu: Number(item.monit?.cpu || 0),
      memoryBytes: Number(item.monit?.memory || 0),
      uptimeMs: item.pm2_env?.pm_uptime ? Math.max(0, Date.now() - Number(item.pm2_env.pm_uptime)) : 0,
      restarts: Number(item.pm2_env?.restart_time || 0),
      pid: Number.isFinite(Number(item.pid)) && Number(item.pid) > 0 ? Number(item.pid) : null,
    }));
  } catch {
    return [];
  }
}

export async function readMariaDbStatus() {
  const active = (await run('systemctl', ['is-active', 'mariadb'], 3000)).trim();
  return {
    name: 'mariadb',
    status: active === 'active' ? 'online' : active || 'unknown',
    up: active === 'active',
  };
}

const ALLOWED_PM2_ACTIONS = new Set(['restart', 'start', 'stop']);
const ALLOWED_PM2_NAMES = new Set([
  'nieruchomosci',
  'lineage-movies-downloader',
  'lineage-movies-proxy',
  'partner-growth-nurture',
  'reviews-finalization-fallback',
]);

export async function controlPm2(name: string, action: string) {
  if (!ALLOWED_PM2_NAMES.has(name)) throw new Error('Nieznany proces.');
  if (!ALLOWED_PM2_ACTIONS.has(action)) throw new Error('Nieznana akcja.');
  const out = await run('pm2', [action, name], 15000);
  return { ok: true, output: out.slice(0, 2000) };
}

export async function startMariaDb() {
  const out = await run('sudo', ['-n', 'systemctl', 'start', 'mariadb'], 15000);
  const status = await readMariaDbStatus();
  return { ok: status.up, output: out.slice(0, 2000), status };
}
