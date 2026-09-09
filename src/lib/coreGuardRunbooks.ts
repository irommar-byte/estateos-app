import { diagnoseServer } from '@/lib/adminServerDiagnose';
import {
  controlPm2,
  previewSafeCleanup,
  readPm2Processes,
  runSafeCleanup,
  startMariaDb,
} from '@/lib/adminServerOps';
import { prisma } from '@/lib/prisma';

export type CoreGuardRunbookId =
  | 'safe-cleanup'
  | 'recover-kei-lease'
  | 'reload-web'
  | 'restart-kei-worker'
  | 'start-mariadb';

type Runbook = {
  id: CoreGuardRunbookId;
  label: string;
  risk: 'low' | 'medium' | 'high';
  automatic: boolean;
  impact: string;
  rollback: string;
};

export const CORE_GUARD_RUNBOOKS: Runbook[] = [
  {
    id: 'safe-cleanup',
    label: 'Bezpieczne czyszczenie plików tymczasowych',
    risk: 'low',
    automatic: true,
    impact: 'Usuwa wyłącznie znane pliki .part/.tmp/.download oraz stare resztki cache.',
    rollback: 'Brak — pliki są nieukończonymi artefaktami, nie danymi klientów.',
  },
  {
    id: 'recover-kei-lease',
    label: 'Odzyskaj wygasły lease KEI',
    risk: 'low',
    automatic: true,
    impact: 'Oddaje wygasłe zadanie do kolejki. Worker wznowi je pojedynczo.',
    rollback: 'Zadanie można anulować w panelu KEI.',
  },
  {
    id: 'reload-web',
    label: 'Łagodnie przeładuj workery WWW',
    risk: 'medium',
    automatic: false,
    impact: 'PM2 przeładuje obie instancje Next.js kolejno, bez planowanej przerwy.',
    rollback: 'PM2 zachowuje poprzedni proces do przejęcia ruchu przez nowy.',
  },
  {
    id: 'restart-kei-worker',
    label: 'Uruchom ponownie worker KEI',
    risk: 'medium',
    automatic: false,
    impact: 'Bieżący job po wygaśnięciu lease wróci do bezpiecznego wykonania.',
    rollback: 'Worker można zatrzymać w widoku procesów; dane joba pozostają w bazie.',
  },
  {
    id: 'start-mariadb',
    label: 'Uruchom MariaDB',
    risk: 'high',
    automatic: false,
    impact: 'Uruchamia usługę bazy przez jawnie dozwolony systemctl start mariadb.',
    rollback: 'CORE nie zatrzymuje MariaDB automatycznie.',
  },
];

export function getCoreGuardRunbook(id: string) {
  return CORE_GUARD_RUNBOOKS.find((runbook) => runbook.id === id) || null;
}

export async function buildCoreGuardRemediationPlan(actionId?: string) {
  const incidents = (await prisma.$queryRawUnsafe(
    `SELECT id, title, recommendedAction, autoFixable
     FROM CoreIncident
     WHERE status = 'open'
     ORDER BY FIELD(severity, 'critical', 'warning', 'info'), lastSeenAt DESC`,
  )) as Array<{
    id: string;
    title: string;
    recommendedAction: string | null;
    autoFixable: number | boolean;
  }>;
  const requested = actionId ? getCoreGuardRunbook(actionId) : null;
  const selected = requested
    ? [requested]
    : CORE_GUARD_RUNBOOKS.filter(
        (runbook) =>
          runbook.automatic &&
          incidents.some(
            (incident) =>
              Boolean(incident.autoFixable) && incident.recommendedAction === runbook.id,
          ),
      );
  return {
    generatedAt: new Date().toISOString(),
    requiresConfirmation: selected.some((runbook) => !runbook.automatic),
    confirmation: selected.some((runbook) => !runbook.automatic)
      ? `CONFIRM:${selected[0]?.id || ''}`
      : null,
    actions: selected,
    incidents: incidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      recommendedAction: incident.recommendedAction,
    })),
  };
}

async function acquireRepairLock() {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT GET_LOCK('estateos_core_guard_repair', 0) AS acquired`,
  )) as Array<{ acquired: number | bigint | null }>;
  return Number(rows[0]?.acquired || 0) === 1;
}

async function releaseRepairLock() {
  await prisma.$queryRawUnsafe(`SELECT RELEASE_LOCK('estateos_core_guard_repair')`);
}

async function executeAllowedRunbook(actionId: CoreGuardRunbookId) {
  if (actionId === 'safe-cleanup') {
    const preview = await previewSafeCleanup();
    const result = runSafeCleanup();
    return {
      detail: `Usunięto ${result.deleted.length} bezpiecznych artefaktów.`,
      freedBytes: preview.bytes,
      errors: result.errors,
    };
  }
  if (actionId === 'recover-kei-lease') {
    const updated = await prisma.$executeRawUnsafe(
      `UPDATE KeiAmerImportJob
       SET status = 'queued',
           message = 'Wygasły lease odzyskany przez CORE Guard.',
           leaseOwner = NULL,
           leaseUntil = NULL
       WHERE status = 'running'
         AND cancelRequested = 0
         AND leaseUntil < NOW(3)
         AND attemptCount < 3`,
    );
    return { detail: `Do kolejki wróciło ${Number(updated)} zadań.` };
  }
  if (actionId === 'reload-web') {
    return controlPm2('nieruchomosci', 'reload');
  }
  if (actionId === 'restart-kei-worker') {
    return controlPm2('kei-import-worker', 'restart');
  }
  if (actionId === 'start-mariadb') {
    return startMariaDb();
  }
  throw new Error('Runbook nie jest dozwolony.');
}

export async function executeCoreGuardRunbook(params: {
  actionId: string;
  confirmation?: string;
  actorUserId: number;
  incidentId?: string;
  mode?: 'manual' | 'automatic';
}) {
  const runbook = getCoreGuardRunbook(params.actionId);
  if (!runbook) throw new Error('Nieznany runbook.');
  if (!runbook.automatic && params.confirmation !== `CONFIRM:${runbook.id}`) {
    return {
      ok: false,
      requiresConfirmation: true,
      expectedConfirmation: `CONFIRM:${runbook.id}`,
      runbook,
    };
  }
  if (params.mode === 'automatic' && !runbook.automatic) {
    throw new Error('Ten runbook nie może działać automatycznie.');
  }
  if (!(await acquireRepairLock())) {
    const error = new Error('Inna naprawa CORE już trwa.');
    (error as Error & { code?: string }).code = 'REPAIR_CONFLICT';
    throw error;
  }

  let auditId: number | bigint | null = null;
  try {
    const before = await diagnoseServer();
    const audit = await prisma.coreRemediationAudit.create({
      data: {
        incidentId: params.incidentId || null,
        actionId: runbook.id,
        mode: params.mode || 'manual',
        actorUserId: params.actorUserId,
        status: 'running',
        beforeJson: JSON.stringify(before),
      },
      select: { id: true },
    });
    auditId = audit.id;

    const result = await executeAllowedRunbook(runbook.id);
    const after = await diagnoseServer();
    if (auditId != null) {
      await prisma.$executeRawUnsafe(
        `UPDATE CoreRemediationAudit
         SET status = 'done', detail = ?, afterJson = ?, finishedAt = NOW(3)
         WHERE id = ?`,
        JSON.stringify(result).slice(0, 64_000),
        JSON.stringify(after),
        auditId,
      );
    }
    return {
      ok: true,
      runbook,
      result,
      before,
      after,
      auditId: auditId == null ? null : Number(auditId),
    };
  } catch (error) {
    if (auditId != null) {
      await prisma.$executeRawUnsafe(
        `UPDATE CoreRemediationAudit
         SET status = 'error', detail = ?, finishedAt = NOW(3)
         WHERE id = ?`,
        error instanceof Error ? error.message.slice(0, 4000) : 'Nieznany błąd.',
        auditId,
      );
    }
    throw error;
  } finally {
    await releaseRepairLock().catch(() => undefined);
  }
}

export async function executeCoreGuardProcessControl(params: {
  name: string;
  action: 'start' | 'stop' | 'restart' | 'reload';
  confirmation?: string;
  actorUserId: number;
}) {
  const expectedConfirmation = `CONFIRM:${params.action}:${params.name}`;
  if (params.confirmation !== expectedConfirmation) {
    return {
      ok: false,
      requiresConfirmation: true,
      expectedConfirmation,
      impact:
        params.name === 'mariadb'
          ? 'Zmienia stan usługi bazy danych.'
          : `Wykonuje PM2 ${params.action} dla procesu ${params.name}.`,
    };
  }
  if (!(await acquireRepairLock())) {
    const error = new Error('Inna naprawa CORE już trwa.');
    (error as Error & { code?: string }).code = 'REPAIR_CONFLICT';
    throw error;
  }
  let auditId: bigint | null = null;
  try {
    const before = await readPm2Processes();
    const audit = await prisma.coreRemediationAudit.create({
      data: {
        actionId: `process:${params.action}:${params.name}`,
        mode: 'manual',
        actorUserId: params.actorUserId,
        status: 'running',
        beforeJson: JSON.stringify(before),
      },
      select: { id: true },
    });
    auditId = audit.id;
    const result =
      params.name === 'mariadb' && params.action === 'start'
        ? await startMariaDb()
        : await controlPm2(params.name, params.action);
    const after = await readPm2Processes();
    await prisma.coreRemediationAudit.update({
      where: { id: audit.id },
      data: {
        status: 'done',
        detail: JSON.stringify(result).slice(0, 64_000),
        afterJson: JSON.stringify(after),
        finishedAt: new Date(),
      },
    });
    return { ok: true, result, auditId: Number(audit.id) };
  } catch (error) {
    if (auditId != null) {
      await prisma.coreRemediationAudit.update({
        where: { id: auditId },
        data: {
          status: 'error',
          detail: error instanceof Error ? error.message.slice(0, 4000) : 'Nieznany błąd.',
          finishedAt: new Date(),
        },
      });
    }
    throw error;
  } finally {
    await releaseRepairLock().catch(() => undefined);
  }
}
