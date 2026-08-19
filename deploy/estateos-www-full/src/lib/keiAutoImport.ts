import { prisma } from '@/lib/prisma';
import {
  enqueueKeiImportJob,
  getKeiImportJob,
  hasActiveKeiImportJob,
  reapStaleKeiImportJobs,
  resumeOrphanKeiImportJobs,
} from '@/lib/keiAmerImportJobs';
import { pickNewestKeiListingsForImport } from '@/lib/keiAmerPreview';
import {
  KEI_AUTO_INTERVALS_MIN,
  KEI_AUTO_MAX_COUNT,
  keiAutoNextRunAt,
  type KeiAutoImportConfig,
} from '@/lib/keiAutoImportShared';

export {
  KEI_AUTO_INTERVALS_MIN,
  KEI_AUTO_MAX_COUNT,
  keiAutoIntervalLabel,
  keiAutoNextRunAt,
  type KeiAutoImportConfig,
} from '@/lib/keiAutoImportShared';

const DEFAULTS: KeiAutoImportConfig = {
  enabled: false,
  intervalMinutes: 60,
  count: 3,
  targetUserId: 55,
  agentCommissionPercent: 2,
  propertyKind: 'apartment',
  transactionKind: 'sale',
  adminUserId: 0,
  lastRunAt: null,
  lastJobId: null,
  lastError: null,
  updatedAt: null,
  sessionStartedAt: null,
  sessionImportedCount: 0,
  sessionSkippedCount: 0,
  sessionCycles: 0,
  nextRunAt: null,
};

let tableReady: Promise<void> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatBusy = false;

async function ensureTable() {
  if (!tableReady) {
    tableReady = prisma
      .$executeRawUnsafe(
        `
      CREATE TABLE IF NOT EXISTS KeiAutoImportSchedule (
        id TINYINT NOT NULL PRIMARY KEY,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        intervalMinutes INT NOT NULL DEFAULT 60,
        count INT NOT NULL DEFAULT 3,
        targetUserId INT NOT NULL DEFAULT 55,
        agentCommissionPercent DOUBLE NOT NULL DEFAULT 2,
        propertyKind VARCHAR(32) NOT NULL DEFAULT 'apartment',
        transactionKind VARCHAR(32) NOT NULL DEFAULT 'sale',
        adminUserId INT NOT NULL DEFAULT 0,
        lastRunAt DATETIME(3) NULL,
        lastJobId VARCHAR(36) NULL,
        lastError TEXT NULL,
        updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        sessionStartedAt DATETIME(3) NULL,
        sessionImportedCount INT NOT NULL DEFAULT 0,
        sessionSkippedCount INT NOT NULL DEFAULT 0,
        sessionCycles INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
      )
      .then(async () => {
        await ensureSessionColumns();
      });
  }
  await tableReady;
}

async function ensureSessionColumns() {
  const cols = (await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'KeiAutoImportSchedule'`,
  )) as Array<{ COLUMN_NAME: string }>;
  const names = new Set(cols.map((row) => row.COLUMN_NAME));
  const add: Array<[string, string]> = [
    ['sessionStartedAt', 'DATETIME(3) NULL'],
    ['sessionImportedCount', 'INT NOT NULL DEFAULT 0'],
    ['sessionSkippedCount', 'INT NOT NULL DEFAULT 0'],
    ['sessionCycles', 'INT NOT NULL DEFAULT 0'],
  ];
  for (const [name, spec] of add) {
    if (names.has(name)) continue;
    await prisma.$executeRawUnsafe(`ALTER TABLE KeiAutoImportSchedule ADD COLUMN ${name} ${spec}`);
  }
}

function clampInterval(n: number) {
  const v = Math.round(n);
  return (KEI_AUTO_INTERVALS_MIN as readonly number[]).includes(v) ? v : 60;
}

function mapRow(row: Record<string, unknown> | undefined): KeiAutoImportConfig {
  if (!row) return { ...DEFAULTS };
  const config: KeiAutoImportConfig = {
    enabled: Boolean(row.enabled),
    intervalMinutes: clampInterval(Number(row.intervalMinutes) || 60),
    count: Math.min(KEI_AUTO_MAX_COUNT, Math.max(1, Number(row.count) || 3)),
    targetUserId: Math.max(1, Number(row.targetUserId) || 55),
    agentCommissionPercent: Math.min(10, Math.max(0, Number(row.agentCommissionPercent) || 0)),
    propertyKind: row.propertyKind === 'house' ? 'house' : 'apartment',
    transactionKind: row.transactionKind === 'rent' ? 'rent' : 'sale',
    adminUserId: Number(row.adminUserId) || 0,
    lastRunAt: row.lastRunAt ? new Date(String(row.lastRunAt)).toISOString() : null,
    lastJobId: row.lastJobId ? String(row.lastJobId) : null,
    lastError: row.lastError ? String(row.lastError) : null,
    updatedAt: row.updatedAt ? new Date(String(row.updatedAt)).toISOString() : null,
    sessionStartedAt: row.sessionStartedAt ? new Date(String(row.sessionStartedAt)).toISOString() : null,
    sessionImportedCount: Math.max(0, Number(row.sessionImportedCount) || 0),
    sessionSkippedCount: Math.max(0, Number(row.sessionSkippedCount) || 0),
    sessionCycles: Math.max(0, Number(row.sessionCycles) || 0),
    nextRunAt: null,
  };
  config.nextRunAt = keiAutoNextRunAt(config);
  return config;
}

export async function getKeiAutoImportConfig(): Promise<KeiAutoImportConfig> {
  await ensureTable();
  const rows = (await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM KeiAutoImportSchedule WHERE id = 1 LIMIT 1`,
  )) as Array<Record<string, unknown>>;
  return mapRow(rows[0]);
}

export async function saveKeiAutoImportConfig(
  patch: Partial<KeiAutoImportConfig> & { adminUserId: number },
): Promise<KeiAutoImportConfig> {
  await ensureTable();
  const current = await getKeiAutoImportConfig();
  const nextEnabled = patch.enabled ?? current.enabled;
  const becomingEnabled = nextEnabled && !current.enabled;
  const next: KeiAutoImportConfig = {
    ...current,
    enabled: nextEnabled,
    intervalMinutes: clampInterval(patch.intervalMinutes ?? current.intervalMinutes),
    count: Math.min(KEI_AUTO_MAX_COUNT, Math.max(1, patch.count ?? current.count)),
    targetUserId: Math.max(1, patch.targetUserId ?? current.targetUserId),
    agentCommissionPercent: Math.min(10, Math.max(0, patch.agentCommissionPercent ?? current.agentCommissionPercent)),
    propertyKind: patch.propertyKind ?? current.propertyKind,
    transactionKind: patch.transactionKind ?? current.transactionKind,
    adminUserId: patch.adminUserId || current.adminUserId,
  };

  await prisma.$executeRawUnsafe(
    `INSERT INTO KeiAutoImportSchedule
      (id, enabled, intervalMinutes, count, targetUserId, agentCommissionPercent, propertyKind, transactionKind, adminUserId, lastRunAt, lastJobId, lastError)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE
      enabled = VALUES(enabled),
      intervalMinutes = VALUES(intervalMinutes),
      count = VALUES(count),
      targetUserId = VALUES(targetUserId),
      agentCommissionPercent = VALUES(agentCommissionPercent),
      propertyKind = VALUES(propertyKind),
      transactionKind = VALUES(transactionKind),
      adminUserId = VALUES(adminUserId),
      lastError = NULL`,
    next.enabled ? 1 : 0,
    next.intervalMinutes,
    next.count,
    next.targetUserId,
    next.agentCommissionPercent,
    next.propertyKind,
    next.transactionKind,
    next.adminUserId,
    becomingEnabled ? null : current.lastRunAt ? new Date(current.lastRunAt) : null,
    becomingEnabled ? null : current.lastJobId,
  );

  if (becomingEnabled) {
    await prisma.$executeRawUnsafe(
      `UPDATE KeiAutoImportSchedule
       SET lastRunAt = NULL,
           lastJobId = NULL,
           lastError = NULL,
           sessionStartedAt = NOW(3),
           sessionImportedCount = 0,
           sessionSkippedCount = 0,
           sessionCycles = 0
       WHERE id = 1`,
    );
  }

  return getKeiAutoImportConfig();
}

export async function saveKeiAutoImportAndKick(
  patch: Partial<KeiAutoImportConfig> & { adminUserId: number },
): Promise<{
  config: KeiAutoImportConfig;
  tick: { ran: boolean; reason: string; jobId?: string; picked?: number } | null;
}> {
  const previous = await getKeiAutoImportConfig();
  const config = await saveKeiAutoImportConfig(patch);
  const justTurnedOn = config.enabled && !previous.enabled;
  if (!config.enabled) return { config, tick: null };
  if (!justTurnedOn) return { config, tick: null };
  const tick = await tickKeiAutoImport({ force: true });
  return { config: await getKeiAutoImportConfig(), tick };
}

export async function recordKeiAutoImportCycle(result: {
  imported: number;
  skipped: number;
  error?: string | null;
}): Promise<void> {
  await ensureTable();
  if (result.error) {
    await prisma.$executeRawUnsafe(
      `UPDATE KeiAutoImportSchedule
       SET lastRunAt = NOW(3),
           lastError = ?,
           sessionCycles = sessionCycles + 1
       WHERE id = 1 AND enabled = 1`,
      result.error.slice(0, 500),
    );
    return;
  }
  await prisma.$executeRawUnsafe(
    `UPDATE KeiAutoImportSchedule
     SET lastRunAt = NOW(3),
         lastError = NULL,
         sessionImportedCount = sessionImportedCount + ?,
         sessionSkippedCount = sessionSkippedCount + ?,
         sessionCycles = sessionCycles + 1
     WHERE id = 1 AND enabled = 1`,
    Math.max(0, result.imported),
    Math.max(0, result.skipped),
  );
}

export async function tickKeiAutoImport(opts?: {
  force?: boolean;
}): Promise<{ ran: boolean; reason: string; jobId?: string; picked?: number }> {
  await reapStaleKeiImportJobs();
  const resumed = await resumeOrphanKeiImportJobs();
  if (resumed > 0) return { ran: true, reason: 'resumed' };
  const cfg = await getKeiAutoImportConfig();
  if (!cfg.enabled) return { ran: false, reason: 'disabled' };
  if (!cfg.adminUserId) return { ran: false, reason: 'no_admin' };
  if (await hasActiveKeiImportJob()) return { ran: false, reason: 'job_running' };

  let force = Boolean(opts?.force);
  if (!force && cfg.lastJobId) {
    const lastJob = await getKeiImportJob(cfg.lastJobId);
    if (lastJob && lastJob.status === 'error' && /nie wystartował|utknął|przerwany/i.test(lastJob.message || '')) {
      force = true;
    }
  }

  const last = cfg.lastRunAt ? new Date(cfg.lastRunAt).getTime() : 0;
  const dueAt = last + cfg.intervalMinutes * 60_000;
  if (!force && last > 0 && Date.now() < dueAt) return { ran: false, reason: 'not_due' };

  try {
    const selections = await pickNewestKeiListingsForImport({
      propertyKind: cfg.propertyKind,
      transactionKind: cfg.transactionKind,
      count: cfg.count,
    });

    if (selections.length === 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE KeiAutoImportSchedule SET lastRunAt = NOW(3), lastError = NULL WHERE id = 1`,
      );
      return { ran: false, reason: 'no_new_listings', picked: 0 };
    }

    const job = await enqueueKeiImportJob({
      adminUserId: cfg.adminUserId,
      propertyKind: cfg.propertyKind,
      transactionKind: cfg.transactionKind,
      targetUserId: cfg.targetUserId,
      agentCommissionPercent: cfg.agentCommissionPercent,
      selections,
      source: 'auto',
    });
    await prisma.$executeRawUnsafe(
      `UPDATE KeiAutoImportSchedule SET lastJobId = ?, lastError = NULL WHERE id = 1`,
      job.id,
    );
    return { ran: true, reason: 'queued', jobId: job.id, picked: selections.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.$executeRawUnsafe(`UPDATE KeiAutoImportSchedule SET lastError = ? WHERE id = 1`, message.slice(0, 500));
    return { ran: false, reason: message };
  }
}

export function startKeiAutoImportHeartbeat(): void {
  if (heartbeatTimer) return;
  const tick = () => {
    if (heartbeatBusy) return;
    heartbeatBusy = true;
    void tickKeiAutoImport()
      .catch(() => undefined)
      .finally(() => {
        heartbeatBusy = false;
      });
  };
  setTimeout(tick, 12_000);
  heartbeatTimer = setInterval(tick, 60_000);
}