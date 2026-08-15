import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type DiskHealthLevel = 'ok' | 'warning' | 'critical';

export type StorageArea = {
  id: string;
  label: string;
  root: string;
  deletable: boolean;
  excludeNames?: string[];
};

export type StorageCategoryId = 'movies' | 'music' | 'realestate' | 'cars' | 'system';

export type StorageCategoryDef = {
  id: StorageCategoryId;
  label: string;
  description: string;
  accent: string;
  areas: StorageArea[];
};

export type StorageAreaReport = StorageArea & {
  exists: boolean;
  bytes: number;
  children: Array<{ name: string; path: string; bytes: number; isDir: boolean }>;
};

export type StorageCategoryReport = {
  id: StorageCategoryId;
  label: string;
  description: string;
  accent: string;
  bytes: number;
  percentOfUsed: number;
  deletable: boolean;
  areas: StorageAreaReport[];
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

export type LargeFileHint = {
  path: string;
  areaId: string;
  categoryId: StorageCategoryId;
  name: string;
  bytes: number;
  deletable: boolean;
};

export type SafeCleanupItem = {
  path: string;
  reason: string;
  bytes: number;
};

const HOME = (process.env.ADMIN_SERVER_HOME || process.env.HOME || '/home/rommar').replace(/\/+$/, '');
const DOWNLOADS = path.join(HOME, 'lineage-movies/downloads');
const UPLOADS = path.join(HOME, 'uploads');

export const STORAGE_CATEGORIES: StorageCategoryDef[] = [
  {
    id: 'movies',
    label: 'Filmy',
    description: 'EOS Library · pobrane filmy i seriale',
    accent: '#7c3aed',
    areas: [
      {
        id: 'movies-library',
        label: 'Biblioteka filmów',
        root: path.join(DOWNLOADS, 'MOVIES'),
        deletable: true,
      },
    ],
  },
  {
    id: 'music',
    label: 'Muzyka',
    description: 'EOS Library · utwory i playlisty',
    accent: '#db2777',
    areas: [
      {
        id: 'music-library',
        label: 'Biblioteka muzyki',
        root: path.join(DOWNLOADS, 'music'),
        deletable: true,
      },
      {
        id: 'music-playlists',
        label: 'Playlisty i albumy',
        root: DOWNLOADS,
        deletable: true,
        excludeNames: ['MOVIES', 'music', 'AUTO', 'jobs'],
      },
    ],
  },
  {
    id: 'realestate',
    label: 'Nieruchomości',
    description: 'Zdjęcia ofert, agencje, wiadomości i aplikacja www',
    accent: '#059669',
    areas: [
      {
        id: 're-offers',
        label: 'Zdjęcia ofert',
        root: path.join(UPLOADS, 'offers'),
        deletable: true,
      },
      {
        id: 're-offer-folders',
        label: 'Foldery ofert',
        root: UPLOADS,
        deletable: true,
        excludeNames: ['offers', 'cars', 'agency', 'contact', 'avatars', 'uploads'],
      },
      {
        id: 're-agency',
        label: 'Agencje',
        root: path.join(UPLOADS, 'agency'),
        deletable: true,
      },
      {
        id: 're-contact',
        label: 'Załączniki Contact',
        root: path.join(UPLOADS, 'contact'),
        deletable: true,
      },
      {
        id: 're-avatars',
        label: 'Avatary',
        root: path.join(UPLOADS, 'avatars'),
        deletable: true,
      },
      {
        id: 're-app',
        label: 'Aplikacja estateos (kod)',
        root: path.join(HOME, 'estateos'),
        deletable: false,
      },
    ],
  },
  {
    id: 'cars',
    label: 'Samochody',
    description: 'Zdjęcia aut i media CAR',
    accent: '#2563eb',
    areas: [
      {
        id: 'cars-uploads',
        label: 'Zdjęcia samochodów',
        root: path.join(UPLOADS, 'cars'),
        deletable: true,
      },
      {
        id: 'cars-auto-media',
        label: 'Media AUTO',
        root: path.join(DOWNLOADS, 'AUTO'),
        deletable: true,
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    description: 'Baza danych, cache i pliki tymczasowe',
    accent: '#64748b',
    areas: [
      {
        id: 'sys-mysql',
        label: 'MariaDB',
        root: '/var/lib/mysql',
        deletable: false,
      },
      {
        id: 'sys-cache',
        label: 'Cache EOS Library',
        root: path.join(HOME, 'lineage-movies/video-downloader/tmp'),
        deletable: true,
      },
      {
        id: 'sys-data-tmp',
        label: 'Dane tymczasowe downloadera',
        root: path.join(HOME, 'lineage-movies/video-downloader/data'),
        deletable: true,
      },
    ],
  },
];

const ALL_AREAS: StorageArea[] = STORAGE_CATEGORIES.flatMap((c) => c.areas);
const BLOCKED_NAME_RE = /(\.env($|\.)|^id_rsa|^id_ed25519|\.pem$|\.key$|schema\.prisma$)/i;
const SAFE_CLEAN_NAME_RE = /\.(part|tmp|ytdl|download)$/i;
const MAX_LIST = 500;
const HISTORY_LEN = 48;

type MetricSample = {
  at: number;
  cpu: number;
  ram: number;
  disk: number;
};

const metricHistory: MetricSample[] = [];

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

async function run(cmd: string, args: string[], timeout = 12000): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout, maxBuffer: 12 * 1024 * 1024 });
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

export function pushMetricSample(sample: Omit<MetricSample, 'at'>) {
  metricHistory.push({ ...sample, at: Date.now() });
  while (metricHistory.length > HISTORY_LEN) metricHistory.shift();
}

export function getMetricHistory() {
  return [...metricHistory];
}

export async function duBytes(target: string, timeout = 20000): Promise<number> {
  if (!fs.existsSync(target)) return 0;
  const gnu = await run('du', ['-sk', '--apparent-size', target], timeout);
  const line = (gnu || (await run('du', ['-sk', target], timeout))).trim().split('\n').pop() || '';
  const kb = Number(String(line).split(/\s+/)[0]);
  return Number.isFinite(kb) ? kb * 1024 : 0;
}

function areaById(id: string) {
  return ALL_AREAS.find((a) => a.id === id) || null;
}

function categoryForArea(areaId: string) {
  return STORAGE_CATEGORIES.find((c) => c.areas.some((a) => a.id === areaId)) || null;
}

function isInside(root: string, candidate: string) {
  const a = path.resolve(root);
  const b = path.resolve(candidate);
  return b === a || b.startsWith(a + path.sep);
}

export function resolveAreaPath(areaId: string, relativePath = ''): { area: StorageArea; abs: string } {
  const area = areaById(areaId);
  if (!area) throw new Error('Nieznany obszar pamięci.');
  const rel = String(relativePath || '').replace(/^\/+/, '');
  if (rel.includes('\0') || rel.split(path.sep).includes('..')) {
    throw new Error('Nieprawidłowa ścieżka.');
  }
  const abs = path.resolve(area.root, rel);
  if (!isInside(area.root, abs)) throw new Error('Ścieżka poza dozwolonym katalogiem.');
  return { area, abs };
}

/** Back-compat alias used by older route handlers. */
export function resolveBucketPath(bucketId: string, relativePath = '') {
  return resolveAreaPath(bucketId, relativePath);
}

async function dirChildrenBytes(root: string, excludeNames: string[] = []) {
  if (!fs.existsSync(root)) return { bytes: 0, children: [] as StorageAreaReport['children'] };
  const names = fs
    .readdirSync(root)
    .filter((name) => !excludeNames.includes(name) && name !== '.' && name !== '..');
  const children: StorageAreaReport['children'] = [];
  let bytes = 0;
  for (const name of names) {
    const full = path.join(root, name);
    let st: fs.Stats;
    try {
      st = fs.lstatSync(full);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) continue;
    const size = st.isDirectory() ? await duBytes(full, 18000) : st.size;
    bytes += size;
    children.push({ name, path: full, bytes: size, isDir: st.isDirectory() });
  }
  children.sort((a, b) => b.bytes - a.bytes);
  return { bytes, children };
}

export async function collectCategoryReport(): Promise<{
  categories: StorageCategoryReport[];
  accountedBytes: number;
}> {
  const categories: StorageCategoryReport[] = [];
  let accountedBytes = 0;

  for (const cat of STORAGE_CATEGORIES) {
    const areas: StorageAreaReport[] = [];
    let bytes = 0;
    for (const area of cat.areas) {
      const exists = fs.existsSync(area.root);
      if (!exists) {
        areas.push({ ...area, exists: false, bytes: 0, children: [] });
        continue;
      }
      const measured = await dirChildrenBytes(area.root, area.excludeNames || []);
      areas.push({ ...area, exists: true, bytes: measured.bytes, children: measured.children.slice(0, 24) });
      bytes += measured.bytes;
    }
    accountedBytes += bytes;
    categories.push({
      id: cat.id,
      label: cat.label,
      description: cat.description,
      accent: cat.accent,
      bytes,
      percentOfUsed: 0,
      deletable: areas.some((a) => a.deletable),
      areas,
    });
  }

  for (const cat of categories) {
    cat.percentOfUsed = accountedBytes > 0 ? round1((cat.bytes / accountedBytes) * 100) : 0;
  }
  categories.sort((a, b) => b.bytes - a.bytes);
  return { categories, accountedBytes };
}

/** Legacy shape for older clients. */
export async function collectStorageReport() {
  const { categories } = await collectCategoryReport();
  return categories.flatMap((cat) =>
    cat.areas.map((area) => ({
      ...area,
      service: cat.label,
      categoryId: cat.id,
    })),
  );
}

export function listFiles(areaId: string, relativePath = ''): {
  bucket: StorageArea & { service: string; categoryId: StorageCategoryId };
  cwd: string;
  parent: string | null;
  entries: ServerFileEntry[];
} {
  const { area, abs } = resolveAreaPath(areaId, relativePath);
  const cat = categoryForArea(areaId);
  const bucket = {
    ...area,
    service: cat?.label || area.label,
    categoryId: (cat?.id || 'system') as StorageCategoryId,
  };
  if (!fs.existsSync(abs)) {
    return {
      bucket,
      cwd: abs,
      parent: relativePath ? path.posix.dirname(relativePath.replace(/\\/g, '/')) : null,
      entries: [],
    };
  }
  const st = fs.lstatSync(abs);
  const dir = st.isDirectory() ? abs : path.dirname(abs);
  const names = fs.readdirSync(dir).filter((n) => n !== '.' && n !== '..');
  const exclude = !relativePath && area.excludeNames ? new Set(area.excludeNames) : null;
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
    if (info.isSymbolicLink()) continue;
    const rel = path.relative(area.root, full).split(path.sep).join('/');
    entries.push({
      name,
      path: full,
      relativePath: rel,
      isDir: info.isDirectory(),
      bytes: info.isDirectory() ? 0 : info.size,
      mtimeMs: Number.isFinite(info.mtimeMs) ? info.mtimeMs : null,
      deletable: area.deletable && !BLOCKED_NAME_RE.test(name),
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

export function deleteTargets(areaId: string, relativePaths: string[]) {
  const area = areaById(areaId);
  if (!area) throw new Error('Nieznany obszar pamięci.');
  if (!area.deletable) throw new Error('Ten obszar jest chroniony — nie można kasować.');
  const deleted: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  for (const raw of relativePaths) {
    try {
      const { abs } = resolveAreaPath(areaId, raw);
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

function walkSafeCleanup(dir: string, out: SafeCleanupItem[], depth = 0) {
  if (depth > 8 || out.length >= 400 || !fs.existsSync(dir)) return;
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name === '.' || name === '..') continue;
    const full = path.join(dir, name);
    let st: fs.Stats;
    try {
      st = fs.lstatSync(full);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) {
      if (name === 'thumb-cache' || name.endsWith('.tmp')) {
        out.push({ path: full, reason: 'Cache / katalog tymczasowy', bytes: 0 });
      }
      walkSafeCleanup(full, out, depth + 1);
      continue;
    }
    if (SAFE_CLEAN_NAME_RE.test(name) || /\.tmp\./i.test(name)) {
      out.push({
        path: full,
        reason: name.endsWith('.part') ? 'Niedokończone pobieranie' : 'Plik tymczasowy',
        bytes: st.size,
      });
    }
  }
}

export async function previewSafeCleanup() {
  const roots = [
    path.join(HOME, 'lineage-movies'),
    path.join(HOME, 'lineage-movies/video-downloader/tmp'),
    path.join(HOME, 'lineage-movies/video-downloader/data'),
  ];
  const items: SafeCleanupItem[] = [];
  for (const root of roots) walkSafeCleanup(root, items);
  for (const item of items) {
    if (item.bytes === 0 && fs.existsSync(item.path)) {
      try {
        const st = fs.lstatSync(item.path);
        item.bytes = st.isDirectory() ? await duBytes(item.path, 6000) : st.size;
      } catch {
        item.bytes = 0;
      }
    }
  }
  items.sort((a, b) => b.bytes - a.bytes);
  const bytes = items.reduce((sum, i) => sum + i.bytes, 0);
  return { items: items.slice(0, 200), bytes, count: items.length };
}

export function runSafeCleanup(paths?: string[]) {
  const deleted: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  const allowRoots = [
    path.join(HOME, 'lineage-movies'),
  ].map((p) => path.resolve(p));

  const targets = paths?.length
    ? paths
    : null;

  const ensureAllowed = (abs: string) => {
    const resolved = path.resolve(abs);
    return allowRoots.some((root) => isInside(root, resolved));
  };

  const removeOne = (abs: string) => {
    if (!ensureAllowed(abs)) {
      errors.push({ path: abs, error: 'Poza dozwolonym obszarem.' });
      return;
    }
    const base = path.basename(abs);
    const isSafe =
      SAFE_CLEAN_NAME_RE.test(base) ||
      base === 'thumb-cache' ||
      /\.tmp/i.test(base);
    if (!isSafe) {
      errors.push({ path: abs, error: 'Nie jest bezpiecznym celem.' });
      return;
    }
    try {
      if (!fs.existsSync(abs)) {
        errors.push({ path: abs, error: 'Nie istnieje.' });
        return;
      }
      fs.rmSync(abs, { recursive: true, force: true });
      deleted.push(abs);
    } catch (error) {
      errors.push({ path: abs, error: error instanceof Error ? error.message : 'Błąd' });
    }
  };

  if (targets) {
    for (const p of targets) removeOne(p);
    return { deleted, errors };
  }

  // Discover then delete.
  const previewSync: SafeCleanupItem[] = [];
  walkSafeCleanup(path.join(HOME, 'lineage-movies'), previewSync);
  for (const item of previewSync) removeOne(item.path);
  return { deleted, errors };
}

export async function findLargestFiles(limit = 20): Promise<LargeFileHint[]> {
  const searchable = ALL_AREAS.filter((a) => a.deletable);
  const found: LargeFileHint[] = [];

  for (const area of searchable) {
    if (!fs.existsSync(area.root)) continue;
    const cat = categoryForArea(area.id);
    const out = await run(
      'find',
      [area.root, '-type', 'f', '-printf', '%s\t%p\n'],
      25000,
    );
    const lines = out.split('\n').filter(Boolean);
    for (const line of lines) {
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      const bytes = Number(line.slice(0, tab));
      const full = line.slice(tab + 1);
      if (!Number.isFinite(bytes) || bytes < 5 * 1024 * 1024) continue;
      const name = path.basename(full);
      if (BLOCKED_NAME_RE.test(name)) continue;
      if (area.excludeNames?.some((ex) => full.includes(`${path.sep}${ex}${path.sep}`) || full.endsWith(`${path.sep}${ex}`))) {
        continue;
      }
      found.push({
        path: full,
        areaId: area.id,
        categoryId: (cat?.id || 'system') as StorageCategoryId,
        name,
        bytes,
        deletable: area.deletable,
      });
    }
  }

  found.sort((a, b) => b.bytes - a.bytes);
  return found.slice(0, limit);
}

export function deleteAbsoluteFiles(absPaths: string[]) {
  const deleted: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  for (const raw of absPaths) {
    try {
      const abs = path.resolve(raw);
      const area = ALL_AREAS.find((a) => a.deletable && isInside(a.root, abs));
      if (!area) {
        errors.push({ path: raw, error: 'Plik poza dozwolonym obszarem.' });
        continue;
      }
      if (BLOCKED_NAME_RE.test(path.basename(abs))) {
        errors.push({ path: raw, error: 'Plik chroniony.' });
        continue;
      }
      if (!fs.existsSync(abs) || fs.lstatSync(abs).isDirectory()) {
        errors.push({ path: raw, error: 'Dozwolone tylko pliki.' });
        continue;
      }
      fs.rmSync(abs, { force: true });
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
