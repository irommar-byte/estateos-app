import {
  applySafeHygiene,
  diagnoseServer,
  FINDING_RUNBOOK_ID,
} from '@/lib/adminServerDiagnose';
import {
  controlPm2,
  readPm2Processes,
  resetPm2RestartCounters,
  startMariaDb,
} from '@/lib/adminServerOps';
import { prisma } from '@/lib/prisma';

export type CoreGuardRunbookId =
  | 'safe-cleanup'
  | 'recover-kei-lease'
  | 'reset-pm2-counters'
  | 'recycle-web'
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
    id: 'reset-pm2-counters',
    label: 'Wyzeruj historyczny licznik restartów PM2',
    risk: 'low',
    automatic: true,
    impact: 'Zeruje restart_time. Nie restartuje procesów i nie zmienia ruchu.',
    rollback: 'Licznik znowu urośnie przy następnym restarcie — to tylko etykieta PM2.',
  },
  {
    id: 'recycle-web',
    label: 'Przeładuj workery WWW zanim PM2 je zabije',
    risk: 'low',
    automatic: true,
    impact: 'Kolejny rolling reload dwóch instancji Next.js, potem zeruje licznik restartów.',
    rollback: 'PM2 trzyma poprzedni proces do przejęcia ruchu przez nowy.',
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
  const [incidents, report] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT id, title, recommendedAction, autoFixable
       FROM CoreIncident
       WHERE status = 'open'
       ORDER BY FIELD(severity, 'critical', 'warning', 'info'), lastSeenAt DESC`,
    ) as Promise<
      Array<{
        id: string;
        title: string;
        recommendedAction: string | null;
        autoFixable: number | boolean;
      }>
    >,
    diagnoseServer(),
  ]);
  const requested = actionId ? getCoreGuardRunbook(actionId) : null;
  const wanted = new Set<CoreGuardRunbookId>();
  for (const finding of report.findings) {
    const mapped = FINDING_RUNBOOK_ID[finding.id];
    const runbook = mapped ? getCoreGuardRunbook(mapped) : null;
    if (runbook?.automatic) wanted.add(runbook.id);
  }
  for (const incident of incidents) {
    const runbook = incident.recommendedAction ? getCoreGuardRunbook(incident.recommendedAction) : null;
    if (runbook?.automatic && (Boolean(incident.autoFixable) || runbook.id === 'reset-pm2-counters')) {
      wanted.add(runbook.id);
    }
  }
  const selected = requested
    ? [requested]
    : CORE_GUARD_RUNBOOKS.filter((runbook) => wanted.has(runbook.id) && runbook.automatic);
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

async function reloadWebAndResetCounters() {
  const reload = await controlPm2('nieruchomosci', 'reload');
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const reset = await resetPm2RestartCounters('nieruchomosci');
  return {
    detail: 'Przeładowano workery WWW kolejno i wyzerowano licznik restartów.',
    reload,
    reset,
  };
}

async function executeAllowedRunbook(actionId: CoreGuardRunbookId) {
  if (actionId === 'safe-cleanup') {
    const hygiene = await applySafeHygiene();
    return {
      detail: `Usunięto ${hygiene.cleanup.deleted.length} artefaktów, przycięto ${hygiene.logs.length} logów, katalogi build: ${hygiene.leftovers.removed.length}.`,
      freedBytes: hygiene.preview.bytes,
      errors: hygiene.cleanup.errors,
      leftovers: hygiene.leftovers,
    };
  }
  if (actionId === 'reset-pm2-counters') {
    const reset = await resetPm2RestartCounters();
    return { detail: `Wyzerowano licznik restartów: ${reset.names.join(', ')}.`, reset };
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
  if (actionId === 'reload-web' || actionId === 'recycle-web') {
    return reloadWebAndResetCounters();
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
  actorUserId?: number | null;
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
        actorUserId: params.actorUserId ?? null,
        status: 'running',
        beforeJson: JSON.stringify(before),
      },
      select: { id: true },
    });
    auditId = audit.id;

    const result = await executeAllowedRunbook(runbook.id);
    const after = await diagnoseServer();
    if (params.incidentId) {
      await prisma.$executeRawUnsafe(
        `UPDATE CoreIncident
         SET status = 'resolved', resolvedAt = NOW(3),
             cooldownUntil = DATE_ADD(NOW(3), INTERVAL 20 MINUTE)
         WHERE id = ? AND status IN ('open', 'pending')`,
        params.incidentId,
      );
    }
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

const AUTOMATIC_ACTIONS = new Set<CoreGuardRunbookId>([
  'safe-cleanup',
  'recover-kei-lease',
  'reset-pm2-counters',
  'recycle-web',
]);

export async function executeAutomaticCoreGuardRepairs() {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, recommendedAction
     FROM CoreIncident
     WHERE status = 'open'
       AND autoFixable = 1
       AND recommendedAction IS NOT NULL
       AND (cooldownUntil IS NULL OR cooldownUntil < NOW(3))
     ORDER BY lastSeenAt DESC
     LIMIT 8`,
  )) as Array<{ id: string; recommendedAction: string | null }>;
  const seen = new Set<string>();
  const executed: string[] = [];
  for (const row of rows) {
    const actionId = String(row.recommendedAction || '');
    if (!AUTOMATIC_ACTIONS.has(actionId as CoreGuardRunbookId) || seen.has(actionId)) continue;
    seen.add(actionId);
    const result = await executeCoreGuardRunbook({
      actionId,
      incidentId: row.id,
      mode: 'automatic',
    });
    if (result.ok === false) continue;
    executed.push(actionId);
    await prisma.$executeRawUnsafe(
      `UPDATE CoreIncident
       SET cooldownUntil = DATE_ADD(NOW(3), INTERVAL 20 MINUTE)
       WHERE id = ?`,
      row.id,
    );
  }
  return executed;
}
