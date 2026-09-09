import { prisma } from '@/lib/prisma';

export const KEI_LEASE_SECONDS = 180;
export const KEI_LEASE_HEARTBEAT_MS = 30_000;
export const KEI_MAX_ATTEMPTS = 3;

type ClaimedRow = { id: string };

export function isKeiLeaseClaimable(
  job: {
    status: string;
    cancelRequested: boolean;
    attemptCount: number;
    leaseUntil: Date | null;
  },
  now = new Date(),
) {
  if (job.cancelRequested || job.attemptCount >= KEI_MAX_ATTEMPTS) return false;
  if (job.status === 'queued') return true;
  return job.status === 'running' && (!job.leaseUntil || job.leaseUntil <= now);
}

export async function claimNextKeiImportJob(leaseOwner: string): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE KeiAmerImportJob
       SET status = 'error',
           message = 'Import zatrzymany po wyczerpaniu limitu prób workera.',
           finishedAt = NOW(3),
           leaseOwner = NULL,
           leaseUntil = NULL
       WHERE status = 'running'
         AND cancelRequested = 0
         AND leaseUntil < NOW(3)
         AND attemptCount >= ?`,
      KEI_MAX_ATTEMPTS,
    );

    const rows = (await tx.$queryRawUnsafe(
      `SELECT id
       FROM KeiAmerImportJob
       WHERE cancelRequested = 0
         AND attemptCount < ?
         AND (
           status = 'queued'
           OR (status = 'running' AND (leaseUntil IS NULL OR leaseUntil < NOW(3)))
         )
       ORDER BY createdAt ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      KEI_MAX_ATTEMPTS,
    )) as ClaimedRow[];
    const id = rows[0]?.id;
    if (!id) return null;

    const updated = await tx.$executeRawUnsafe(
      `UPDATE KeiAmerImportJob
       SET status = 'running',
           message = 'Import przejęty przez dedykowany worker…',
           leaseOwner = ?,
           leaseUntil = DATE_ADD(NOW(3), INTERVAL ? SECOND),
           heartbeatAt = NOW(3),
           attemptCount = attemptCount + 1,
           finishedAt = NULL
       WHERE id = ?
         AND cancelRequested = 0
         AND attemptCount < ?
         AND (
           status = 'queued'
           OR (status = 'running' AND (leaseUntil IS NULL OR leaseUntil < NOW(3)))
         )`,
      leaseOwner,
      KEI_LEASE_SECONDS,
      id,
      KEI_MAX_ATTEMPTS,
    );
    return Number(updated) === 1 ? id : null;
  });
}

export async function renewKeiImportLease(jobId: string, leaseOwner: string): Promise<boolean> {
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE KeiAmerImportJob
     SET leaseUntil = DATE_ADD(NOW(3), INTERVAL ? SECOND),
         heartbeatAt = NOW(3)
     WHERE id = ?
       AND leaseOwner = ?
       AND status = 'running'
       AND cancelRequested = 0`,
    KEI_LEASE_SECONDS,
    jobId,
    leaseOwner,
  );
  return Number(updated) === 1;
}

export async function ownsKeiImportLease(jobId: string, leaseOwner: string): Promise<boolean> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS total
     FROM KeiAmerImportJob
     WHERE id = ?
       AND leaseOwner = ?
       AND status = 'running'
       AND cancelRequested = 0
       AND leaseUntil > NOW(3)`,
    jobId,
    leaseOwner,
  )) as Array<{ total: number | bigint }>;
  return Number(rows[0]?.total || 0) === 1;
}

export async function releaseKeiImportLease(
  jobId: string,
  leaseOwner: string,
  options?: { requeue?: boolean },
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE KeiAmerImportJob
     SET status = CASE WHEN ? = 1 AND status = 'running' THEN 'queued' ELSE status END,
         message = CASE
           WHEN ? = 1 AND status = 'running' THEN 'Worker kończy pracę — zadanie wróciło do kolejki.'
           ELSE message
         END,
         leaseOwner = NULL,
         leaseUntil = NULL
     WHERE id = ? AND leaseOwner = ?`,
    options?.requeue ? 1 : 0,
    options?.requeue ? 1 : 0,
    jobId,
    leaseOwner,
  );
}

export async function getKeiWorkerQueueHealth() {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT
       SUM(status = 'queued') AS queued,
       SUM(status = 'running' AND leaseUntil > NOW(3)) AS running,
       SUM(status = 'running' AND (leaseUntil IS NULL OR leaseUntil <= NOW(3))) AS expired,
       MIN(CASE WHEN status = 'queued' THEN createdAt ELSE NULL END) AS oldestQueuedAt
     FROM KeiAmerImportJob
     WHERE status IN ('queued', 'running')`,
  )) as Array<{
    queued: number | bigint | null;
    running: number | bigint | null;
    expired: number | bigint | null;
    oldestQueuedAt: Date | null;
  }>;
  const row = rows[0];
  return {
    queued: Number(row?.queued || 0),
    running: Number(row?.running || 0),
    expired: Number(row?.expired || 0),
    oldestQueuedAt: row?.oldestQueuedAt?.toISOString?.() || null,
  };
}
