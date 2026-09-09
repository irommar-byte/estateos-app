import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import tls from 'node:tls';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function command(file: string, args: string[], timeout = 5_000) {
  try {
    const { stdout } = await execFileAsync(file, args, {
      timeout,
      maxBuffer: 512 * 1024,
      encoding: 'utf8',
    });
    return { available: true, output: stdout.trim().slice(0, 100_000) };
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string; code?: string | number };
    return {
      available: failure.code !== 'ENOENT',
      output: String(failure.stdout || '').trim().slice(0, 100_000),
      error: String(failure.stderr || failure.message || '').trim().slice(0, 1000),
    };
  }
}

function lines(output: string) {
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

export function isKernelCriticalEvent(line: string) {
  const text = String(line || '').trim();
  if (!text || text.startsWith('-- ') || /^no entries\b/i.test(text)) return false;
  return /\b(oom|out of memory|soft lockup|rcu[_ ]stall|blocked for more than)\b/i.test(text);
}

async function readPressure() {
  const result: Record<string, string> = {};
  await Promise.all(
    ['cpu', 'memory', 'io'].map(async (resource) => {
      try {
        result[resource] = (await fs.readFile(`/proc/pressure/${resource}`, 'utf8')).trim();
      } catch {
        result[resource] = '';
      }
    }),
  );
  return result;
}

async function readCronInventory() {
  const paths = ['/etc/crontab', '/etc/cron.d', '/etc/cron.daily', '/etc/cron.weekly', '/etc/cron.monthly'];
  const inventory: Array<{ path: string; modifiedAt: string }> = [];
  for (const target of paths) {
    try {
      const stat = await fs.stat(target);
      if (stat.isDirectory()) {
        for (const name of await fs.readdir(target)) {
          if (name.startsWith('.')) continue;
          const entryPath = `${target}/${name}`;
          const entryStat = await fs.stat(entryPath);
          inventory.push({ path: entryPath, modifiedAt: entryStat.mtime.toISOString() });
        }
      } else {
        inventory.push({ path: target, modifiedAt: stat.mtime.toISOString() });
      }
    } catch {
      // Brak katalogu na danej dystrybucji nie jest incydentem.
    }
  }
  return inventory;
}

async function newestBackupAt() {
  const configured = String(process.env.CORE_GUARD_BACKUP_PATHS || '/var/backups')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  let newest: Date | null = null;
  for (const root of configured) {
    try {
      for (const name of await fs.readdir(root)) {
        if (name.startsWith('.')) continue;
        const stat = await fs.stat(`${root}/${name}`);
        if (stat.isFile() && (!newest || stat.mtime > newest)) newest = stat.mtime;
      }
    } catch {
      // Ścieżki backupu mogą być dostępne tylko na wybranych hostach.
    }
  }
  return newest?.toISOString() || null;
}

async function readTls(host = String(process.env.CORE_GUARD_TLS_HOST || 'estateos.pl')) {
  return new Promise<{ host: string; validTo: string | null; daysRemaining: number | null; error?: string }>(
    (resolve) => {
      const socket = tls.connect(
        { host, port: 443, servername: host, rejectUnauthorized: true, timeout: 5_000 },
        () => {
          const certificate = socket.getPeerCertificate();
          const validTo = certificate.valid_to ? new Date(certificate.valid_to) : null;
          socket.end();
          resolve({
            host,
            validTo: validTo?.toISOString() || null,
            daysRemaining: validTo
              ? Math.floor((validTo.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
              : null,
          });
        },
      );
      socket.once('timeout', () => socket.destroy(new Error('timeout')));
      socket.once('error', (error) =>
        resolve({ host, validTo: null, daysRemaining: null, error: error.message }),
      );
    },
  );
}

export async function collectCoreGuardSystemSnapshot() {
  const [failed, timers, docker, listeners, kernel, inodes, pressure, cron, tlsState, backupAt] =
    await Promise.all([
      command('systemctl', ['--failed', '--no-legend', '--plain']),
      command('systemctl', ['list-timers', '--all', '--no-legend', '--plain']),
      command('docker', ['ps', '--format', '{{.Names}}\t{{.Status}}\t{{.Ports}}']),
      command('ss', ['-H', '-lntup']),
      command('journalctl', [
        '-k',
        '--since',
        '10 minutes ago',
        '--no-pager',
        '-g',
        'oom|out of memory|soft lockup|rcu.*stall',
      ]),
      command('df', ['-Pi']),
      readPressure(),
      readCronInventory(),
      readTls(),
      newestBackupAt(),
    ]);
  return {
    systemd: {
      failed: lines(failed.output),
      timers: lines(timers.output).slice(0, 100),
      available: failed.available,
    },
    cron,
    docker: { available: docker.available, containers: lines(docker.output) },
    network: { listeners: lines(listeners.output).slice(0, 200) },
    kernel: { recentCriticalEvents: lines(kernel.output).filter(isKernelCriticalEvent).slice(-100) },
    inodeUsage: lines(inodes.output),
    pressure,
    tls: tlsState,
    backup: { newestAt: backupAt },
  };
}
