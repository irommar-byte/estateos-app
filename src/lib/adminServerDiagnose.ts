import { execFile } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { promisify } from 'util';
import {
  previewSafeCleanup,
  readCpuMetrics,
  readDiskMetrics,
  readMariaDbStatus,
  readMemoryMetrics,
  readPm2Processes,
  runSafeCleanup,
} from './adminServerOps';

const execFileAsync = promisify(execFile);
const HOME = (process.env.ADMIN_SERVER_HOME || process.env.HOME || '/home/rommar').replace(/\/+$/, '');
const APP_ROOT = process.env.ADMIN_CORE_CWD || path.join(HOME, 'estateos');
const ENV_PATH = path.join(APP_ROOT, '.env');
const LOG_DIR = path.join(HOME, '.pm2', 'logs');
const DOWNLOADER_DIR = path.join(HOME, 'lineage-movies', 'video-downloader');
const KEEP_LOG_BYTES = 8 * 1024 * 1024;
const BIG_LOG_BYTES = 16 * 1024 * 1024;
const HUNG_MEDIA_SEC = 10 * 60;
const WEB_RSS_WARN = 700 * 1024 * 1024;
const WEB_RSS_TOTAL_WARN = 1200 * 1024 * 1024;

export type FindingSeverity = 'critical' | 'warning' | 'info';

export type ServerFinding = {
  id: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
  evidence?: Array<{ label: string; value: string }>;
  action?: string;
  fixable: boolean;
};

export type DiagnoseReport = {
  ok: true;
  healthy: boolean;
  level: 'ok' | 'warning' | 'critical';
  score: number;
  summary: string;
  findings: ServerFinding[];
  collectedAt: string;
};

export type OptimizeAction = {
  id: string;
  label: string;
  detail: string;
  freedBytes?: number;
};

async function run(cmd: string, args: string[], timeout = 12_000): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout, maxBuffer: 8 * 1024 * 1024 });
    return String(stdout || '');
  } catch {
    return '';
  }
}

export function parsePsEtimeToSec(etime: string): number {
  const raw = String(etime || '').trim();
  if (!raw) return 0;
  const [dayPart, clockPart] = raw.includes('-') ? raw.split('-') : ['0', raw];
  const days = Number(dayPart) || 0;
  const parts = clockPart.split(':').map((part) => Number(part) || 0);
  if (parts.length === 2) return days * 86400 + parts[0] * 60 + parts[1];
  if (parts.length === 3) return days * 86400 + parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export function healthScore(findings: ServerFinding[]): number {
  let score = 100;
  for (const item of findings) {
    if (item.severity === 'critical') score -= 35;
    else if (item.severity === 'warning') score -= 12;
    else score -= 5;
  }
  return Math.max(0, Math.min(100, score));
}

export function summarizeFindings(findings: ServerFinding[]): {
  level: 'ok' | 'warning' | 'critical';
  healthy: boolean;
  score: number;
  summary: string;
} {
  const score = healthScore(findings);
  const fixable = findings.filter((item) => item.fixable).length;
  if (findings.some((item) => item.severity === 'critical')) {
    return {
      level: 'critical',
      healthy: false,
      score,
      summary: `${findings.length} problemów, w tym krytyczne. Przywrócenie zdrowego stanu jest wymagane.`,
    };
  }
  if (findings.some((item) => item.severity === 'warning')) {
    return {
      level: 'warning',
      healthy: false,
      score,
      summary: `${findings.length} problemów do przeglądu${fixable ? `, ${fixable} można naprawić od razu` : ''}.`,
    };
  }
  if (findings.length > 0) {
    return {
      level: 'ok',
      healthy: false,
      score,
      summary: `${findings.length} ${findings.length === 1 ? 'odchylenie od wzorca produkcyjnego' : 'odchylenia od wzorca produkcyjnego'}. Nic nie zagraża stronie.`,
    };
  }
  return {
    level: 'ok',
    healthy: true,
    score: 100,
    summary: 'Wszystkie kontrole przeszły. Serwer jest w zdrowym stanie.',
  };
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n >= 10 || i === 0 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`;
}

function gitShortSha() {
  return run('git', ['-C', APP_ROOT, 'rev-parse', '--short', 'HEAD'], 4000).then((out) => out.trim());
}

function readEnvCommit() {
  try {
    const text = fs.readFileSync(ENV_PATH, 'utf8');
    return text.match(/^COMMIT_SHA=(.+)$/m)?.[1]?.trim() || '';
  } catch {
    return '';
  }
}

function upsertEnv(key: string, value: string) {
  const current = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const line = `${key}=${value}`;
  const next = new RegExp(`^${key}=.*$`, 'm').test(current)
    ? current.replace(new RegExp(`^${key}=.*$`, 'm'), line)
    : `${current}${current && !current.endsWith('\n') ? '\n' : ''}${line}\n`;
  if (next !== current) fs.writeFileSync(ENV_PATH, next, { encoding: 'utf8', mode: 0o600 });
}

function listCoreDumps() {
  if (!fs.existsSync(DOWNLOADER_DIR)) return [];
  return fs
    .readdirSync(DOWNLOADER_DIR)
    .filter((name) => name.startsWith('core.'))
    .map((name) => {
      const full = path.join(DOWNLOADER_DIR, name);
      try {
        return { path: full, bytes: fs.statSync(full).size };
      } catch {
        return { path: full, bytes: 0 };
      }
    });
}

function listOversizedLogs() {
  if (!fs.existsSync(LOG_DIR)) return [];
  return fs
    .readdirSync(LOG_DIR)
    .filter((name) => name.endsWith('.log'))
    .map((name) => {
      const full = path.join(LOG_DIR, name);
      try {
        return { path: full, bytes: fs.statSync(full).size };
      } catch {
        return { path: full, bytes: 0 };
      }
    })
    .filter((item) => item.bytes >= BIG_LOG_BYTES);
}

function leftoverBuildDirs() {
  return ['.next-build', '.next-prev']
    .map((name) => path.join(APP_ROOT, name))
    .filter((full) => fs.existsSync(full));
}

function isBuildLocked() {
  const lock = path.join(APP_ROOT, '.next', 'lock');
  if (!fs.existsSync(lock)) return false;
  return Date.now() - fs.statSync(lock).mtimeMs < 30 * 60 * 1000;
}

async function listHungMedia() {
  const out = await run('ps', ['-eo', 'pid=,etime=,cmd='], 4000);
  const rows: Array<{ pid: number; seconds: number; cmd: string }> = [];
  for (const line of out.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(\S+)\s+(.+)$/);
    if (!match) continue;
    const cmd = match[3];
    if (!/yt-dlp|ffmpeg-static|ytsearch1/.test(cmd)) continue;
    const seconds = parsePsEtimeToSec(match[2]);
    if (seconds < HUNG_MEDIA_SEC) continue;
    rows.push({ pid: Number(match[1]), seconds, cmd });
  }
  return rows;
}

const HEALTH_PING_MS = 8000;

type HealthPing = {
  reached: boolean;
  timedOut: boolean;
  statusCode: number | null;
  ms: number;
  commit: string;
  db: string;
};

function pingHealth(): Promise<HealthPing> {
  return new Promise((resolve) => {
    const started = Date.now();
    const finish = (partial: Partial<HealthPing> & Pick<HealthPing, 'reached'>) => {
      resolve({
        reached: partial.reached,
        timedOut: partial.timedOut === true,
        statusCode: partial.statusCode ?? null,
        ms: Date.now() - started,
        commit: partial.commit || '',
        db: partial.db || '',
      });
    };
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port: Number(process.env.PORT || 3000),
        path: '/api/health',
        timeout: HEALTH_PING_MS,
        headers: { Connection: 'close' },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (body.length < 4000) body += chunk;
        });
        res.on('end', () => {
          let commit = '';
          let db = '';
          try {
            const json = JSON.parse(body) as { commit?: string; db?: string };
            commit = String(json.commit || '');
            db = String(json.db || '');
          } catch {
            /* body is still a response from WWW */
          }
          finish({
            reached: true,
            statusCode: res.statusCode ?? null,
            commit,
            db,
          });
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      finish({ reached: false, timedOut: true });
    });
    req.on('error', () => finish({ reached: false }));
  });
}

function readSwapUsedBytes() {
  try {
    const text = fs.readFileSync('/proc/meminfo', 'utf8');
    const total = Number(text.match(/^SwapTotal:\s+(\d+)/m)?.[1] || 0) * 1024;
    const free = Number(text.match(/^SwapFree:\s+(\d+)/m)?.[1] || 0) * 1024;
    return Math.max(0, total - free);
  } catch {
    return 0;
  }
}

export async function diagnoseServer(): Promise<DiagnoseReport> {
  const [health, disk, processes, mariadb, junk, hung, sha] = await Promise.all([
    pingHealth(),
    readDiskMetrics('/'),
    readPm2Processes(),
    readMariaDbStatus(),
    previewSafeCleanup(),
    listHungMedia(),
    gitShortSha(),
  ]);
  const cpu = readCpuMetrics();
  const memory = readMemoryMetrics();
  const cores = listCoreDumps();
  const logs = listOversizedLogs();
  const leftovers = leftoverBuildDirs();
  const envSha = readEnvCommit();
  const swapUsed = readSwapUsedBytes();
  const web = processes.filter((item) => item.name === 'nieruchomosci');
  const webRss = web.reduce((sum, item) => sum + item.memoryBytes, 0);
  const maxWebRss = web.reduce((max, item) => Math.max(max, item.memoryBytes), 0);
  const findings: ServerFinding[] = [];

  if (!mariadb.up) {
    findings.push({
      id: 'mariadb',
      severity: 'critical',
      title: 'Baza danych nie odpowiada',
      detail: 'Oferty, CRM i logowanie mogą nie działać, dopóki MariaDB nie wstanie.',
      evidence: [{ label: 'Usługa', value: mariadb.status }],
      action: 'Uruchom MariaDB',
      fixable: true,
    });
  }
  if (disk.percent >= 94) {
    findings.push({
      id: 'disk-critical',
      severity: 'critical',
      title: 'Dysk prawie pełny',
      detail: 'Brak miejsca zatrzyma logi, importy i uploady.',
      evidence: [
        { label: 'Zajęte', value: `${disk.percent}%` },
        { label: 'Wolne', value: formatBytes(disk.freeBytes) },
      ],
      action: junk.count > 0 ? 'Usuń pliki tymczasowe' : undefined,
      fixable: junk.count > 0,
    });
  } else if (disk.percent >= 85) {
    findings.push({
      id: 'disk-warning',
      severity: 'warning',
      title: 'Dysk zapełnia się',
      detail: 'Zostało mało zapasu na importy i media.',
      evidence: [
        { label: 'Zajęte', value: `${disk.percent}%` },
        { label: 'Wolne', value: formatBytes(disk.freeBytes) },
      ],
      action: junk.count > 0 ? 'Usuń pliki tymczasowe' : undefined,
      fixable: junk.count > 0,
    });
  }
  if (junk.count > 0) {
    findings.push({
      id: 'junk',
      severity: junk.bytes > 200 * 1024 * 1024 ? 'warning' : 'info',
      title: 'Pliki tymczasowe i niedokończone pobrania',
      detail: 'Cache, .part i .tmp — nic z biblioteki filmów ani ofert.',
      evidence: [
        { label: 'Pozycje', value: String(junk.count) },
        { label: 'Do odzyskania', value: formatBytes(junk.bytes) },
      ],
      action: 'Usuń śmieci',
      fixable: true,
    });
  }
  if (logs.length > 0) {
    const bytes = logs.reduce((sum, item) => sum + item.bytes, 0);
    findings.push({
      id: 'logs',
      severity: 'warning',
      title: 'Logi PM2 są rozdęte',
      detail: 'Zostaną ostatnie 8 MB każdego pliku. Historia błędów nie znika w całości.',
      evidence: [
        { label: 'Pliki', value: String(logs.length) },
        { label: 'Rozmiar', value: formatBytes(bytes) },
      ],
      action: 'Przytnij logi',
      fixable: true,
    });
  }
  if (cores.length > 0) {
    const bytes = cores.reduce((sum, item) => sum + item.bytes, 0);
    findings.push({
      id: 'cores',
      severity: 'warning',
      title: 'Zrzuty pamięci po awarii procesu',
      detail: 'Pliki core w downloaderze nie są potrzebne do działania serwisu.',
      evidence: [
        { label: 'Pliki', value: String(cores.length) },
        { label: 'Rozmiar', value: formatBytes(bytes) },
      ],
      action: 'Usuń zrzuty',
      fixable: true,
    });
  }
  if (hung.length > 0) {
    findings.push({
      id: 'hung-media',
      severity: 'warning',
      title: 'Zacięte procesy pobierania',
      detail: 'yt-dlp albo ffmpeg działa ponad 10 minut i nie oddaje wyniku.',
      evidence: [{ label: 'Procesy', value: String(hung.length) }],
      action: 'Przerwij zacięte joby',
      fixable: true,
    });
  }
  if (!health.reached) {
    findings.push({
      id: 'health-down',
      severity: 'critical',
      title: 'WWW nie odpowiada',
      detail: health.timedOut
        ? `Lokalny /api/health nie wrócił w ${HEALTH_PING_MS / 1000} sekund.`
        : 'Nie udało się połączyć z workerem WWW.',
      evidence: [{ label: 'Port', value: String(process.env.PORT || '3000') }],
      action: isBuildLocked() ? undefined : 'Przeładuj workery',
      fixable: !isBuildLocked(),
    });
  } else if (health.db && health.db !== 'ok') {
    findings.push({
      id: 'health-db',
      severity: 'warning',
      title: 'Baza odpowiada wolno',
      detail: 'WWW działa. Ping do MariaDB nie zmieścił się w limicie liveness.',
      evidence: [
        { label: 'Baza', value: health.db },
        { label: 'Czas', value: `${health.ms} ms` },
      ],
      fixable: false,
    });
  } else if (health.ms >= 2000) {
    findings.push({
      id: 'health-slow',
      severity: 'warning',
      title: 'Wolna odpowiedź aplikacji',
      detail: 'Health powinien zamykać się w ułamku sekundy.',
      evidence: [{ label: 'Czas', value: `${health.ms} ms` }],
      action: isBuildLocked() ? undefined : 'Przeładuj workery',
      fixable: !isBuildLocked(),
    });
  }
  if (maxWebRss >= WEB_RSS_WARN || webRss >= WEB_RSS_TOTAL_WARN) {
    findings.push({
      id: 'web-memory',
      severity: 'warning',
      title: 'Workery WWW zużywają za dużo RAM',
      detail: 'Łagodny reload zwalnia stertę bez wyłączania strony.',
      evidence: [
        { label: 'Największy', value: formatBytes(maxWebRss) },
        { label: 'Suma', value: formatBytes(webRss) },
      ],
      action: isBuildLocked() ? undefined : 'Przeładuj workery',
      fixable: !isBuildLocked(),
    });
  }
  const noisyRestarts = web.filter((item) => item.restarts >= 20);
  if (noisyRestarts.length > 0) {
    findings.push({
      id: 'restarts',
      severity: 'info',
      title: 'Wysoki licznik restartów PM2',
      detail: 'To historia, nie awaria. Licznik można wyzerować po stabilnym starcie.',
      evidence: noisyRestarts.map((item) => ({ label: item.name, value: String(item.restarts) })),
      action: 'Wyzeruj licznik',
      fixable: true,
    });
  }
  if (leftovers.length > 0 && !isBuildLocked()) {
    findings.push({
      id: 'build-leftovers',
      severity: 'info',
      title: 'Zostały katalogi po buildzie',
      detail: '.next-build albo .next-prev nie są już potrzebne.',
      evidence: leftovers.map((item) => ({ label: 'Katalog', value: path.basename(item) })),
      action: 'Usuń resztki',
      fixable: true,
    });
  }
  if (sha && (envSha !== sha || (health.commit && health.commit !== sha))) {
    findings.push({
      id: 'commit-stale',
      severity: 'info',
      title: 'Health pokazuje stary commit',
      detail: 'Kod na dysku jest aktualny. Workery WWW trzymają starą zmienną COMMIT_SHA po reloadzie, który nie wczytał ecosystem.config.cjs.',
      evidence: [
        { label: 'W repozytorium', value: sha },
        { label: 'W pliku .env', value: envSha || 'brak' },
        { label: 'W procesie WWW', value: health.commit || 'brak' },
      ],
      action: isBuildLocked() ? undefined : 'Przeładuj z aktualnym commitem',
      fixable: !isBuildLocked(),
    });
  }
  if (swapUsed > 400 * 1024 * 1024) {
    findings.push({
      id: 'swap',
      severity: 'warning',
      title: 'System korzysta ze swapu',
      detail: 'Część RAM-u spadła na dysk. Strona może zwalniać.',
      evidence: [
        { label: 'Swap', value: formatBytes(swapUsed) },
        { label: 'RAM', value: `${memory.percent}%` },
      ],
      action: maxWebRss >= WEB_RSS_WARN && !isBuildLocked() ? 'Przeładuj workery' : undefined,
      fixable: maxWebRss >= WEB_RSS_WARN && !isBuildLocked(),
    });
  }
  if (cpu.load1 >= cpu.cores * 2) {
    findings.push({
      id: 'load',
      severity: 'warning',
      title: 'Wysokie obciążenie procesora',
      detail: 'Load przekracza liczbę rdzeni.',
      evidence: [
        { label: 'Load', value: String(cpu.load1) },
        { label: 'Rdzenie', value: String(cpu.cores) },
      ],
      action: hung.length > 0 ? 'Przerwij zacięte joby' : undefined,
      fixable: hung.length > 0,
    });
  }

  const rollup = summarizeFindings(findings);
  return {
    ok: true,
    ...rollup,
    findings,
    collectedAt: new Date().toISOString(),
  };
}

function trimLogTail(filePath: string, keepBytes: number) {
  const stat = fs.statSync(filePath);
  if (stat.size <= keepBytes) return 0;
  const fd = fs.openSync(filePath, 'r');
  const size = Math.min(keepBytes, stat.size);
  const buffer = Buffer.allocUnsafe(size);
  fs.readSync(fd, buffer, 0, size, stat.size - size);
  fs.closeSync(fd);
  fs.writeFileSync(filePath, buffer);
  return stat.size - size;
}

async function waitHealthy(timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await pingHealth();
    if (health.reached) return true;
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  return false;
}

export async function optimizeServer(): Promise<{
  ok: boolean;
  actions: OptimizeAction[];
  before: DiagnoseReport;
  after: DiagnoseReport;
}> {
  const before = await diagnoseServer();
  return {
    ok: before.healthy || before.level !== 'critical',
    actions: [
      {
        id: 'guard-required',
        label: 'Wymagany plan CORE Guard',
        detail: 'Naprawa nie została wykonana. Użyj planu, podglądu skutków i zatwierdzonego runbooka.',
      },
    ],
    before,
    after: before,
  };
}
