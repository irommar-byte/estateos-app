import { execFile } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { promisify } from 'util';
import { readPm2Processes, type Pm2Process } from './adminServerOps';

const execFileAsync = promisify(execFile);

const HOME = (process.env.ADMIN_SERVER_HOME || process.env.HOME || '/home/rommar').replace(/\/+$/, '');
const APP_ROOT = process.env.ADMIN_CORE_CWD || path.join(HOME, 'estateos');
const ENV_PATH = path.join(APP_ROOT, '.env');

export function productionInSync(git: string, env: string, processCommit: string) {
  const a = String(git || '').trim();
  const b = String(env || '').trim();
  const c = String(processCommit || '').trim();
  return Boolean(a) && a === b && a === c;
}

async function run(cmd: string, args: string[], timeout = 8000): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { cwd: APP_ROOT, timeout, maxBuffer: 1024 * 1024 });
    return String(stdout || '').trim();
  } catch {
    return '';
  }
}

function readEnvCommit() {
  try {
    const text = fs.readFileSync(ENV_PATH, 'utf8');
    return text.match(/^COMMIT_SHA=(.+)$/m)?.[1]?.trim() || '';
  } catch {
    return '';
  }
}

type HealthSnap = {
  ok: boolean;
  status: string;
  commit: string;
  uptimeSec: number;
  durationMs: number;
};

function pingHealth(): Promise<HealthSnap | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port: Number(process.env.PORT || 3000),
        path: '/api/health',
        timeout: 8000,
        headers: { Connection: 'close' },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (body.length < 4000) body += chunk;
        });
        res.on('end', () => {
          const durationMs = Date.now() - started;
          try {
            const json = JSON.parse(body) as {
              ok?: boolean;
              status?: string;
              commit?: string;
              uptimeSec?: number;
              durationMs?: number;
            };
            resolve({
              ok: json.ok !== false,
              status: String(json.status || (res.statusCode && res.statusCode < 500 ? 'ok' : 'down')),
              commit: String(json.commit || ''),
              uptimeSec: Number(json.uptimeSec || 0),
              durationMs: Number(json.durationMs || durationMs),
            });
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
  });
}

export async function collectProductionSnapshot() {
  const [sha, logLine, processes, health] = await Promise.all([
    run('git', ['rev-parse', '--short', 'HEAD']),
    run('git', ['log', '-1', '--format=%s%x1f%cI']),
    readPm2Processes(),
    pingHealth(),
  ]);
  const [subject, committedAt] = logLine.split('\x1f');
  const envSha = readEnvCommit();
  const web = processes.filter((item) => item.name === 'nieruchomosci');
  const processCommit = health?.commit || web.find((item) => item.commitSha)?.commitSha || '';
  const inSync = productionInSync(sha, envSha, processCommit);

  return {
    collectedAt: new Date().toISOString(),
    git: {
      sha,
      subject: subject || '',
      committedAt: committedAt || '',
    },
    env: { commitSha: envSha },
    process: { commitSha: processCommit },
    health: health || {
      ok: false,
      status: 'down',
      commit: '',
      uptimeSec: 0,
      durationMs: 0,
    },
    workers: web.map((item) => serializeWorker(item)),
    inSync,
  };
}

function serializeWorker(item: Pm2Process) {
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    pid: item.pid,
    cpu: item.cpu,
    memoryBytes: item.memoryBytes,
    uptimeMs: item.uptimeMs,
    restarts: item.restarts,
    commitSha: item.commitSha || '',
  };
}
