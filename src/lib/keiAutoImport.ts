import { prisma } from '@/lib/prisma';
import { enqueueKeiImportJob, ensureKeiAmerImportJobTable } from '@/lib/keiAmerImportJobs';
import {
  KEI_AUTO_INTERVALS_MIN,
  KEI_AUTO_MAX_COUNT,
  type KeiAutoImportConfig,
} from '@/lib/keiAutoImportShared';

export {
  KEI_AUTO_INTERVALS_MIN,
  KEI_AUTO_MAX_COUNT,
  keiAutoIntervalLabel,
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
};

let tableReady: Promise<void> | null = null;

async function ensureTable() {
  if (!tableReady) {
    tableReady = prisma.$executeRawUnsafe(`
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
        updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).then(() => undefined);
  }
  await tableReady;
}

function clampInterval(n: number) {
  const v = Math.round(n);
  return (KEI_AUTO_INTERVALS_MIN as readonly number[]).includes(v) ? v : 60;
}

function mapRow(row: Record<string, unknown> | undefined): KeiAutoImportConfig {
  if (!row) return { ...DEFAULTS };
  return {
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
  };
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
  const next: KeiAutoImportConfig = {
    ...current,
    enabled: patch.enabled ?? current.enabled,
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
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      enabled = VALUES(enabled),
      intervalMinutes = VALUES(intervalMinutes),
      count = VALUES(count),
      targetUserId = VALUES(targetUserId),
      agentCommissionPercent = VALUES(agentCommissionPercent),
      propertyKind = VALUES(propertyKind),
      transactionKind = VALUES(transactionKind),
      adminUserId = VALUES(adminUserId)`,
    next.enabled ? 1 : 0,
    next.intervalMinutes,
    next.count,
    next.targetUserId,
    next.agentCommissionPercent,
    next.propertyKind,
    next.transactionKind,
    next.adminUserId,
    current.lastRunAt ? new Date(current.lastRunAt) : null,
    current.lastJobId,
    current.lastError,
  );
  return getKeiAutoImportConfig();
}

async function hasRunningJob(): Promise<boolean> {
  await ensureKeiAmerImportJobTable();
  const rows = (await prisma.$queryRawUnsafe<Array<{ total: number | bigint }>>(
    `SELECT COUNT(*) AS total FROM KeiAmerImportJob WHERE status IN ('queued','running')`,
  )) as Array<{ total: number | bigint }>;
  return Number(rows[0]?.total || 0) > 0;
}

export async function tickKeiAutoImport(): Promise<{ ran: boolean; reason: string; jobId?: string }> {
  const cfg = await getKeiAutoImportConfig();
  if (!cfg.enabled) return { ran: false, reason: 'disabled' };
  if (!cfg.adminUserId) return { ran: false, reason: 'no_admin' };
  if (await hasRunningJob()) return { ran: false, reason: 'job_running' };

  const last = cfg.lastRunAt ? new Date(cfg.lastRunAt).getTime() : 0;
  const dueAt = last + cfg.intervalMinutes * 60_000;
  if (Date.now() < dueAt) return { ran: false, reason: 'not_due' };

  try {
    const job = await enqueueKeiImportJob({
      adminUserId: cfg.adminUserId,
      propertyKind: cfg.propertyKind,
      transactionKind: cfg.transactionKind,
      targetUserId: cfg.targetUserId,
      agentCommissionPercent: cfg.agentCommissionPercent,
      count: cfg.count,
    });
    await prisma.$executeRawUnsafe(
      `UPDATE KeiAutoImportSchedule SET lastRunAt = NOW(3), lastJobId = ?, lastError = NULL WHERE id = 1`,
      job.id,
    );
    return { ran: true, reason: 'queued', jobId: job.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.$executeRawUnsafe(
      `UPDATE KeiAutoImportSchedule SET lastError = ? WHERE id = 1`,
      message.slice(0, 500),
    );
    return { ran: false, reason: message };
  }
}
