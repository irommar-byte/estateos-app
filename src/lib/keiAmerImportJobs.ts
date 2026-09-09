import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import {
  exportKeiListingsToEstateOS,
  type KeiFloorPlanSelection,
} from '@/lib/keiAmerExport';
import type { KeiExportProgressEvent } from '@/lib/keiAmerExportProgress';
import type { KeiPropertyKind, KeiTransactionKind } from '@/lib/keiAmerClient';
import {
  KEI_LEASE_HEARTBEAT_MS,
  ownsKeiImportLease,
  releaseKeiImportLease,
  renewKeiImportLease,
} from '@/lib/keiImportLease';

export type KeiImportJobItemStatus = 'pending' | 'active' | 'done' | 'skipped';

export type KeiImportJobItem = {
  index: number;
  keiListingId: string;
  portalUrl: string;
  address?: string;
  status: KeiImportJobItemStatus;
  completedSteps: Array<'check_duplicate' | 'fetch_portal' | 'create_offer' | 'images' | 'activate'>;
  currentStep: 'check_duplicate' | 'fetch_portal' | 'create_offer' | 'images' | 'activate' | null;
  stepLabel: string;
  stepDetail?: string;
  imageProgress?: { index: number; total: number; label: string; asFloorPlan: boolean };
  offerId?: number;
  publicUrl?: string;
  editUrl?: string;
  reason?: string;
};

export type KeiImportJobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export type KeiImportJobSnapshot = {
  id: string;
  adminUserId: number;
  status: KeiImportJobStatus;
  message: string;
  propertyKind: KeiPropertyKind;
  transactionKind: KeiTransactionKind;
  source: KeiImportJobSource;
  targetCount: number;
  items: KeiImportJobItem[];
  exported: Array<{
    keiListingId?: string;
    offerId: number;
    portalUrl: string;
    publicUrl: string;
    editUrl: string;
  }>;
  skipped: Array<{
    keiListingId?: string;
    portalUrl: string;
    reason: string;
    existingOfferId?: number;
  }>;
  cancelRequested: boolean;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type KeiImportJobSource = 'manual' | 'auto';

export type KeiImportJobCreateInput = {
  adminUserId: number;
  propertyKind: KeiPropertyKind;
  transactionKind: KeiTransactionKind;
  targetUserId?: number;
  agentCommissionPercent?: number;
  count?: number;
  selections?: Array<{
    keiId?: string;
    portalUrl: string;
    address?: string;
    phone?: string;
    district?: string;
    street?: string;
    rooms?: number | null;
    listedAt?: string;
    directOwner?: boolean;
  }>;
  floorPlanOverrides?: Record<string, boolean>;
  floorPlanSelections?: Record<string, KeiFloorPlanSelection>;
  smartAddEnabled?: boolean;
  smartAddDecisionsByUrl?: Record<string, Record<string, boolean>>;
  /** Cron vs ręczny Importuj — jeden job na raz, żeby się nie gryzły. */
  source?: KeiImportJobSource;
};

type JobRow = {
  id: string;
  adminUserId: number;
  status: string;
  message: string | null;
  propertyKind: string | null;
  transactionKind: string | null;
  payloadJson: string;
  itemsJson: string;
  resultJson: string | null;
  cancelRequested: number | boolean;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
};

const KEI_STEPS = ['check_duplicate', 'fetch_portal', 'create_offer', 'images', 'activate'] as const;

export async function ensureKeiAmerImportJobTable(): Promise<void> {
  // Schemat powstaje przed startem aplikacji przez db:core-guard.
}

function mergeCompletedSteps(
  existing: KeiImportJobItem['completedSteps'],
  step: KeiImportJobItem['currentStep'],
): KeiImportJobItem['completedSteps'] {
  if (!step) return existing;
  const stepIdx = KEI_STEPS.indexOf(step);
  const completed = [...existing];
  for (let i = 0; i < stepIdx; i += 1) {
    const prior = KEI_STEPS[i];
    if (!completed.includes(prior)) completed.push(prior);
  }
  return completed;
}

function applyEventToItems(items: KeiImportJobItem[], event: KeiExportProgressEvent): KeiImportJobItem[] {
  if (event.type === 'item_start') {
    return items.map((item) =>
      item.index !== event.index
        ? item
        : {
            ...item,
            status: 'active',
            keiListingId: event.keiListingId,
            portalUrl: event.portalUrl,
            address: event.address ?? item.address,
            currentStep: 'check_duplicate',
            stepLabel: 'Sprawdzanie duplikatu…',
          },
    );
  }
  if (event.type === 'step') {
    return items.map((item) =>
      item.index !== event.index
        ? item
        : {
            ...item,
            status: 'active',
            currentStep: event.step,
            stepLabel: event.label,
            stepDetail: event.detail ?? item.stepDetail,
            completedSteps: mergeCompletedSteps(item.completedSteps, event.step),
          },
    );
  }
  if (event.type === 'ai_rewrite') {
    return items.map((item) =>
      item.index !== event.index
        ? item
        : {
            ...item,
            status: 'active',
            currentStep: 'create_offer',
            stepLabel: event.rewrite.working ? 'AI przepisuje opis…' : 'Opis gotowy',
            stepDetail: event.rewrite.working
              ? 'GPT'
              : event.rewrite.rewrittenByAi
                ? 'AI ✓'
                : 'reguły',
            completedSteps: mergeCompletedSteps(item.completedSteps, 'create_offer'),
          },
    );
  }
  if (event.type === 'image_progress') {
    return items.map((item) =>
      item.index !== event.index
        ? item
        : {
            ...item,
            status: 'active',
            currentStep: 'images',
            stepLabel: event.asFloorPlan
              ? `Zdjęcie ${event.imageIndex}/${event.imageTotal} (rzut)`
              : event.label,
            stepDetail: event.asFloorPlan
              ? 'Wybrane zdjęcie zapisywane jako rzut mieszkania'
              : item.stepDetail,
            completedSteps: mergeCompletedSteps(item.completedSteps, 'images'),
            imageProgress: {
              index: event.imageIndex,
              total: event.imageTotal,
              label: event.label,
              asFloorPlan: event.asFloorPlan,
            },
          },
    );
  }
  if (event.type === 'floor_plan_decision') {
    return items.map((item) =>
      item.index !== event.index
        ? item
        : {
            ...item,
            stepDetail: event.asFloorPlan
              ? 'Wybrane zdjęcie zostanie zapisane jako rzut'
              : 'Zdjęcia trafią tylko do galerii',
          },
    );
  }
  if (event.type === 'item_done') {
    return items.map((item) =>
      item.index !== event.index
        ? item
        : {
            ...item,
            status: 'done',
            currentStep: null,
            stepLabel: 'Gotowe',
            offerId: event.offerId,
            publicUrl: event.publicUrl,
            editUrl: event.editUrl,
            completedSteps: [...KEI_STEPS],
          },
    );
  }
  if (event.type === 'item_skip') {
    return items.map((item) =>
      item.index !== event.index
        ? item
        : {
            ...item,
            status: 'skipped',
            currentStep: null,
            stepLabel: 'Pominięto',
            reason: event.existingOfferId
              ? `${event.reason} (oferta #${event.existingOfferId})`
              : event.reason,
            completedSteps: [],
          },
    );
  }
  return items;
}

function parseJobPayload(payloadJson: string | null | undefined): {
  source: KeiImportJobSource;
  targetCount: number;
} {
  try {
    const payload = JSON.parse(payloadJson || '{}') as { source?: string; count?: unknown };
    const count = Number(payload.count);
    return {
      source: payload.source === 'auto' ? 'auto' : 'manual',
      targetCount: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
    };
  } catch {
    return { source: 'manual', targetCount: 0 };
  }
}

function mapRow(row: JobRow): KeiImportJobSnapshot {
  let items: KeiImportJobItem[] = [];
  let exported: KeiImportJobSnapshot['exported'] = [];
  let skipped: KeiImportJobSnapshot['skipped'] = [];
  try {
    items = JSON.parse(row.itemsJson || '[]') as KeiImportJobItem[];
  } catch {
    items = [];
  }
  if (row.resultJson) {
    try {
      const parsed = JSON.parse(row.resultJson) as {
        exported?: KeiImportJobSnapshot['exported'];
        skipped?: KeiImportJobSnapshot['skipped'];
      };
      exported = parsed.exported || [];
      skipped = parsed.skipped || [];
    } catch {
      /* ignore */
    }
  }
  return {
    id: row.id,
    adminUserId: row.adminUserId,
    status: row.status as KeiImportJobStatus,
    message: row.message || '',
    propertyKind: (row.propertyKind as KeiPropertyKind) || 'apartment',
    transactionKind: (row.transactionKind as KeiTransactionKind) || 'sale',
    source: parseJobPayload(row.payloadJson).source,
    targetCount: parseJobPayload(row.payloadJson).targetCount,
    items,
    exported,
    skipped,
    cancelRequested: Boolean(row.cancelRequested),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

async function writeJobFields(
  jobId: string,
  fields: {
    status?: KeiImportJobStatus;
    message?: string;
    items?: KeiImportJobItem[];
    resultJson?: string | null;
    finishedAt?: Date | null;
  },
  leaseOwner?: string,
): Promise<void> {
  await ensureKeiAmerImportJobTable();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.status != null) {
    sets.push('status = ?');
    values.push(fields.status);
  }
  if (fields.message != null) {
    sets.push('message = ?');
    values.push(fields.message);
  }
  if (fields.items != null) {
    sets.push('itemsJson = ?');
    values.push(JSON.stringify(fields.items));
  }
  if (fields.resultJson !== undefined) {
    sets.push('resultJson = ?');
    values.push(fields.resultJson);
  }
  if (fields.finishedAt !== undefined) {
    sets.push('finishedAt = ?');
    values.push(fields.finishedAt);
  }
  if (fields.status && ['done', 'error', 'cancelled'].includes(fields.status)) {
    sets.push('leaseOwner = NULL', 'leaseUntil = NULL');
  }
  if (sets.length === 0) return;
  values.push(jobId);
  if (leaseOwner) values.push(leaseOwner);
  const protectCancelled =
    fields.status && fields.status !== 'cancelled'
      ? ` AND status NOT IN ('cancelled') AND cancelRequested = 0`
      : '';
  await prisma.$executeRawUnsafe(
    `UPDATE KeiAmerImportJob
     SET ${sets.join(', ')}
     WHERE id = ?
       ${leaseOwner ? 'AND leaseOwner = ?' : ''}
       ${protectCancelled}`,
    ...values,
  );
}

export async function getKeiImportJob(jobId: string): Promise<KeiImportJobSnapshot | null> {
  await ensureKeiAmerImportJobTable();
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, adminUserId, status, message, propertyKind, transactionKind, payloadJson, itemsJson,
            resultJson, cancelRequested, createdAt, updatedAt, finishedAt
     FROM KeiAmerImportJob WHERE id = ? LIMIT 1`,
    jobId,
  )) as JobRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listActiveKeiImportJobs(adminUserId?: number): Promise<KeiImportJobSnapshot[]> {
  await ensureKeiAmerImportJobTable();
  const rows = (
    adminUserId
      ? await prisma.$queryRawUnsafe(
          `SELECT id, adminUserId, status, message, propertyKind, transactionKind, payloadJson, itemsJson,
                  resultJson, cancelRequested, createdAt, updatedAt, finishedAt
           FROM KeiAmerImportJob
           WHERE status IN ('queued', 'running')
              OR (finishedAt IS NOT NULL AND finishedAt > DATE_SUB(NOW(3), INTERVAL 2 HOUR))
           ORDER BY updatedAt DESC
           LIMIT 20`,
        )
      : await prisma.$queryRawUnsafe(
          `SELECT id, adminUserId, status, message, propertyKind, transactionKind, payloadJson, itemsJson,
                  resultJson, cancelRequested, createdAt, updatedAt, finishedAt
           FROM KeiAmerImportJob
           WHERE status IN ('queued', 'running')
              OR (finishedAt IS NOT NULL AND finishedAt > DATE_SUB(NOW(3), INTERVAL 2 HOUR))
           ORDER BY updatedAt DESC
           LIMIT 20`,
        )
  ) as JobRow[];

  // Prefer admin's jobs first, but return shared account queue (all admins see running imports).
  const mapped = rows.map(mapRow);
  if (adminUserId) {
    mapped.sort((a, b) => {
      const aMine = a.adminUserId === adminUserId ? 0 : 1;
      const bMine = b.adminUserId === adminUserId ? 0 : 1;
      if (aMine !== bMine) return aMine - bMine;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }
  return mapped;
}

export async function listKeiImportJobs(params: {
  limit?: number;
  offset?: number;
  status?: KeiImportJobStatus | 'all';
}): Promise<{ jobs: KeiImportJobSnapshot[]; total: number }> {
  await ensureKeiAmerImportJobTable();
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const status = params.status ?? 'all';

  const where = status !== 'all' ? 'WHERE status = ?' : '';
  const countParams = status !== 'all' ? [status] : [];
  const listParams = status !== 'all' ? [status, limit, offset] : [limit, offset];

  const countRows = (await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    `SELECT COUNT(*) AS total FROM KeiAmerImportJob ${where}`,
    ...countParams,
  )) as Array<{ total: bigint | number }>;

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, adminUserId, status, message, propertyKind, transactionKind, payloadJson, itemsJson,
            resultJson, cancelRequested, createdAt, updatedAt, finishedAt
     FROM KeiAmerImportJob
     ${where}
     ORDER BY updatedAt DESC
     LIMIT ? OFFSET ?`,
    ...listParams,
  )) as JobRow[];

  return {
    jobs: rows.map(mapRow),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function requestCancelKeiImportJob(jobId: string): Promise<KeiImportJobSnapshot | null> {
  await ensureKeiAmerImportJobTable();
  await prisma.$executeRawUnsafe(
    `UPDATE KeiAmerImportJob
     SET cancelRequested = 1,
         status = 'cancelled',
         message = ?,
         finishedAt = NOW(3),
         leaseOwner = NULL,
         leaseUntil = NULL
     WHERE id = ? AND status IN ('queued', 'running')`,
    'Import zatrzymany — ukończone pozycje zostają na serwerze.',
    jobId,
  );
  return getKeiImportJob(jobId);
}

async function isCancelRequested(jobId: string, leaseOwner: string): Promise<boolean> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT cancelRequested, leaseOwner
     FROM KeiAmerImportJob
     WHERE id = ?
     LIMIT 1`,
    jobId,
  )) as Array<{ cancelRequested: number | boolean; leaseOwner: string | null }>;
  return Boolean(rows[0]?.cancelRequested) || rows[0]?.leaseOwner !== leaseOwner;
}

export async function createKeiImportJob(input: KeiImportJobCreateInput): Promise<KeiImportJobSnapshot> {
  await ensureKeiAmerImportJobTable();

  const selections = Array.isArray(input.selections) ? input.selections : [];
  const items: KeiImportJobItem[] =
    selections.length > 0
      ? selections.map((row, index) => ({
          index,
          keiListingId: String(row.keiId || row.portalUrl || '').trim() || `item-${index}`,
          portalUrl: String(row.portalUrl || '').trim(),
          address: row.address,
          status: 'pending',
          completedSteps: [],
          currentStep: null,
          stepLabel: 'Oczekuje w kolejce…',
        }))
      : Array.from({ length: Math.max(1, Math.min(Number(input.count) || 1, 25)) }, (_, index) => ({
          index,
          keiListingId: `auto-${index + 1}`,
          portalUrl: '',
          status: 'pending' as const,
          completedSteps: [],
          currentStep: null,
          stepLabel: 'Oczekuje w kolejce…',
        }));

  const id = randomUUID();
  const payload = {
    targetUserId: input.targetUserId,
    agentCommissionPercent: input.agentCommissionPercent,
    count: input.count,
    propertyKind: input.propertyKind,
    transactionKind: input.transactionKind,
    selections: input.selections,
    floorPlanOverrides: input.floorPlanOverrides,
    floorPlanSelections: input.floorPlanSelections,
    source: input.source === 'auto' ? 'auto' : 'manual',
  };

  await prisma.$executeRawUnsafe(
    `INSERT INTO KeiAmerImportJob
      (id, adminUserId, status, message, propertyKind, transactionKind, payloadJson, itemsJson, cancelRequested)
     VALUES (?, ?, 'queued', ?, ?, ?, ?, ?, 0)`,
    id,
    input.adminUserId,
    'W kolejce na serwerze…',
    input.propertyKind,
    input.transactionKind,
    JSON.stringify(payload),
    JSON.stringify(items),
  );

  return (await getKeiImportJob(id))!;
}

export async function runKeiImportJob(jobId: string, leaseOwner: string): Promise<void> {
  if (!(await ownsKeiImportLease(jobId, leaseOwner))) return;
  const heartbeat = setInterval(() => {
    void renewKeiImportLease(jobId, leaseOwner).catch((error) => {
      console.error('[kei-import-worker] lease heartbeat failed', jobId, error);
    });
  }, KEI_LEASE_HEARTBEAT_MS);
  heartbeat.unref();
  try {
    const job = await getKeiImportJob(jobId);
    if (!job) return;
    if (job.status === 'done' || job.status === 'error' || job.status === 'cancelled') return;

    await writeJobFields(jobId, {
      status: 'running',
      message: 'Import w toku na serwerze…',
    }, leaseOwner);

    const rows = (await prisma.$queryRawUnsafe(
      `SELECT payloadJson, itemsJson FROM KeiAmerImportJob WHERE id = ? LIMIT 1`,
      jobId,
    )) as Array<{ payloadJson: string; itemsJson: string }>;
    const payload = JSON.parse(rows[0]?.payloadJson || '{}') as KeiImportJobCreateInput;
    let items = JSON.parse(rows[0]?.itemsJson || '[]') as KeiImportJobItem[];

    const persistEvent = async (event: KeiExportProgressEvent) => {
      if (event.type === 'connected') return;
      if (event.type === 'batch_start') {
        await writeJobFields(jobId, {
          message: `Import ${event.total} ogłoszeń…`,
          items,
        }, leaseOwner);
        return;
      }
      if (event.type === 'batch_done') {
        await writeJobFields(jobId, { message: event.message, items }, leaseOwner);
        return;
      }
      if (event.type === 'error') {
        await writeJobFields(jobId, { message: event.message, items }, leaseOwner);
        return;
      }
      if (event.type === 'result') {
        await writeJobFields(jobId, {
          message: event.message,
          items,
          resultJson: JSON.stringify({ exported: event.exported, skipped: event.skipped }),
        }, leaseOwner);
        return;
      }
      items = applyEventToItems(items, event);
      let message: string | undefined;
      if (event.type === 'item_start') {
        message = `Import ${event.index + 1}/${event.total}…`;
      }
      await writeJobFields(jobId, { items, message }, leaseOwner);
    };

    let progressChain: Promise<void> = Promise.resolve();
    const enqueueProgress = (event: KeiExportProgressEvent) => {
      progressChain = progressChain.then(() => persistEvent(event)).catch(() => undefined);
    };

    try {
      const result = await exportKeiListingsToEstateOS({
        targetUserId: payload.targetUserId,
        agentCommissionPercent: payload.agentCommissionPercent,
        count: payload.count,
        propertyKind: payload.propertyKind,
        transactionKind: payload.transactionKind,
        selections: payload.selections,
        floorPlanOverrides: payload.floorPlanOverrides,
        floorPlanSelections: payload.floorPlanSelections,
        fillUntilPublished: payload.source === 'auto',
        shouldCancel: () => isCancelRequested(jobId, leaseOwner),
        onProgress: enqueueProgress,
        smartAddEnabled: true,
        smartAddDecisionsByUrl: payload.smartAddDecisionsByUrl,
      });
      await progressChain;

      if (!(await ownsKeiImportLease(jobId, leaseOwner))) return;
      const cancelled = await isCancelRequested(jobId, leaseOwner);
      items = items.map((item) =>
        cancelled && (item.status === 'pending' || item.status === 'active')
          ? {
              ...item,
              status: 'skipped' as const,
              currentStep: null,
              stepLabel: 'Anulowano',
              reason: 'Przerwano ręcznie przez administratora',
            }
          : item,
      );

      await writeJobFields(jobId, {
        status: cancelled ? 'cancelled' : 'done',
        message: cancelled
          ? 'Import zatrzymany — ukończone pozycje zostają na serwerze.'
          : result.message,
        items,
        resultJson: JSON.stringify({ exported: result.exported, skipped: result.skipped }),
        finishedAt: new Date(),
      }, leaseOwner);
      if (payload.source === 'auto') {
        const { recordKeiAutoImportCycle } = await import('@/lib/keiAutoImport');
        await recordKeiAutoImportCycle({
          imported: cancelled ? 0 : result.exported.length,
          skipped: result.skipped.length,
          error: cancelled ? 'Przerwano ręcznie.' : null,
        });
      }
    } catch (error) {
      if (!(await ownsKeiImportLease(jobId, leaseOwner))) return;
      const cancelled = await isCancelRequested(jobId, leaseOwner);
      const message =
        error instanceof Error ? error.message : 'Eksport KEI nie powiódł się.';
      if (/anulow/i.test(message) || cancelled) {
        items = items.map((item) =>
          item.status === 'pending' || item.status === 'active'
            ? {
                ...item,
                status: 'skipped' as const,
                currentStep: null,
                stepLabel: 'Anulowano',
                reason: 'Przerwano ręcznie przez administratora',
              }
            : item,
        );
        await writeJobFields(jobId, {
          status: 'cancelled',
          message: 'Import zatrzymany.',
          items,
          finishedAt: new Date(),
        }, leaseOwner);
        if (payload.source === 'auto') {
          const { recordKeiAutoImportCycle } = await import('@/lib/keiAutoImport');
          await recordKeiAutoImportCycle({ imported: 0, skipped: 0, error: 'Przerwano ręcznie.' });
        }
      } else {
        await writeJobFields(jobId, {
          status: 'error',
          message,
          items,
          finishedAt: new Date(),
        }, leaseOwner);
        if (payload.source === 'auto') {
          const { recordKeiAutoImportCycle } = await import('@/lib/keiAutoImport');
          await recordKeiAutoImportCycle({ imported: 0, skipped: 0, error: message });
        }
      }
    }
  } finally {
    clearInterval(heartbeat);
    await releaseKeiImportLease(jobId, leaseOwner).catch(() => undefined);
  }
}

export async function hasActiveKeiImportJob(): Promise<boolean> {
  await ensureKeiAmerImportJobTable();
  const rows = (await prisma.$queryRawUnsafe<Array<{ total: number | bigint }>>(
    `SELECT COUNT(*) AS total FROM KeiAmerImportJob
     WHERE status IN ('queued', 'running')`,
  )) as Array<{ total: number | bigint }>;
  return Number(rows[0]?.total || 0) > 0;
}

/**
 * Kolejkuje job. Wykonanie należy wyłącznie do procesu `kei-import-worker`.
 */
export async function enqueueKeiImportJob(input: KeiImportJobCreateInput): Promise<KeiImportJobSnapshot> {
  if (await hasActiveKeiImportJob()) {
    throw new Error('Inny import KEI już trwa. Poczekaj, aż się skończy — automatyczny i ręczny nie mogą iść naraz.');
  }
  return createKeiImportJob(input);
}

export function isKeiImportJobTerminal(status: KeiImportJobStatus): boolean {
  return status === 'done' || status === 'error' || status === 'cancelled';
}
