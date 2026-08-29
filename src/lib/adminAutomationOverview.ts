import { AUTOMATION_CRON_CATALOG } from '@/lib/adminAutomationCatalog';
import { listImportRegistry } from '@/lib/adminImportRegistry';
import { readPm2Processes, type Pm2Process } from '@/lib/adminServerOps';
import { getKeiAutoImportConfig } from '@/lib/keiAutoImport';
import { listActiveKeiImportJobs, listKeiImportJobs } from '@/lib/keiAmerImportJobs';
import { formatWarsawDateTime } from '@/lib/warsawDateTime';

function formatPm2Uptime(ms: number): string | null {
  if (!ms) return null;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  return `${hours} h ${min % 60} min`;
}

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return formatWarsawDateTime(iso);
  } catch {
    return iso;
  }
}

export type ScheduledJobView = {
  id: string;
  name: string;
  schedule: string;
  scheduleLabel: string;
  description: string;
  pm2Status: string | null;
  pm2Uptime: string | null;
  pm2Restarts: number | null;
  nextHint: string | null;
};

export async function buildAutomationOverview() {
  const [pm2, keiAuto, activeJobs, recentJobs, imports] = await Promise.all([
    readPm2Processes().catch(() => [] as Pm2Process[]),
    getKeiAutoImportConfig().catch(() => null),
    listActiveKeiImportJobs().catch(() => []),
    listKeiImportJobs({ limit: 20, offset: 0 }).catch(() => ({ jobs: [], total: 0 })),
    listImportRegistry({ limit: 30, offset: 0 }).catch(() => ({ rows: [], total: 0 })),
  ]);

  const pm2ByName = new Map(pm2.map((row) => [row.name, row]));

  const scheduled: ScheduledJobView[] = AUTOMATION_CRON_CATALOG.map((job) => {
    const proc = pm2ByName.get(job.id);
    let nextHint: string | null = null;
    if (job.id === 'kei-auto-import' && keiAuto?.enabled) {
      const when = formatWhen(keiAuto.nextRunAt);
      nextHint = when ? `Następny import KEI: ${when}` : 'Auto-import włączony';
    }
    return {
      id: job.id,
      name: job.name,
      schedule: job.schedule,
      scheduleLabel: job.scheduleLabel,
      description: job.description,
      pm2Status: proc?.status ?? 'stopped',
      pm2Uptime: proc ? formatPm2Uptime(proc.uptimeMs) : null,
      pm2Restarts: proc?.restarts ?? null,
      nextHint,
    };
  });

  if (keiAuto) {
    scheduled.unshift({
      id: 'kei-auto-import-config',
      name: 'KEI auto-import (harmonogram)',
      schedule: `co ${keiAuto.intervalMinutes} min`,
      scheduleLabel: keiAuto.enabled ? 'Włączony' : 'Wyłączony',
      description: `Cel: użytkownik #${keiAuto.targetUserId}, ${keiAuto.count} ofert / cykl, ${keiAuto.propertyKind} / ${keiAuto.transactionKind}.`,
      pm2Status: keiAuto.enabled ? 'online' : 'stopped',
      pm2Uptime: keiAuto.lastRunAt ? `Ostatni: ${formatWhen(keiAuto.lastRunAt)}` : null,
      pm2Restarts: keiAuto.sessionCycles,
      nextHint: formatWhen(keiAuto.nextRunAt),
    });
  }

  return {
    scheduled,
    keiAuto,
    activeJobs,
    recentJobs: recentJobs.jobs,
    recentJobsTotal: recentJobs.total,
    imports: imports.rows,
    importsTotal: imports.total,
    generatedAt: new Date().toISOString(),
  };
}
