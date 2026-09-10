import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { isControlEnabled } from '@/lib/adminCoreControl';
import { diagnoseServer } from '@/lib/adminServerDiagnose';
import { isServerOptimizeRunning, runServerOptimizeExclusive } from '@/lib/adminServerOptimizeLock';
import { collectProductionSnapshot } from '@/lib/adminCoreProduction';
import { readMariaDbStatus, readPm2Processes } from '@/lib/adminServerOps';
import {
  buildCoreGuardRemediationPlan,
  executeCoreGuardProcessControl,
  executeCoreGuardRunbook,
} from '@/lib/coreGuardRunbooks';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

function controlDenied() {
  return NextResponse.json(
    { success: false, error: 'Sterowanie CORE wyłączone (ADMIN_CORE_CONTROL_ENABLED).' },
    { status: 403, headers: NO_CACHE },
  );
}

export async function handleAdminCoreDiagnoseGET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;
  try {
    const report = await diagnoseServer();
    return NextResponse.json(report, { headers: NO_CACHE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Skan nie powiódł się.' },
      { status: 500, headers: NO_CACHE },
    );
  }
}

export async function handleAdminCoreOptimizeGET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;
  try {
    const report = await diagnoseServer();
    return NextResponse.json(
      { ok: true, running: isServerOptimizeRunning(), status: report },
      { headers: NO_CACHE },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Skan nie powiódł się.' },
      { status: 500, headers: NO_CACHE },
    );
  }
}

export async function handleAdminCoreOptimizePOST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;
  if (!isControlEnabled()) return controlDenied();

  try {
    const body = (await req.json().catch(() => ({}))) as { confirmation?: string };
    const plan = await buildCoreGuardRemediationPlan();
    if (body.confirmation !== 'CONFIRM:SAFE') {
      return NextResponse.json(
        {
          ok: false,
          requiresConfirmation: true,
          expectedConfirmation: 'CONFIRM:SAFE',
          plan,
        },
        { status: 409, headers: NO_CACHE },
      );
    }
    const exclusive = await runServerOptimizeExclusive(async () => {
      const before = await diagnoseServer();
      const actions = [];
      for (const action of plan.actions) {
        const result = await executeCoreGuardRunbook({
          actionId: action.id,
          actorUserId: gate.adminId,
          mode: 'automatic',
        });
        actions.push({
          id: action.id,
          label: action.label,
          detail:
            result && typeof result === 'object' && 'result' in result
              ? JSON.stringify((result as { result?: unknown }).result)
              : action.impact,
        });
      }
      if (actions.length === 0) {
        actions.push({
          id: 'noop',
          label: 'Nie było automatycznej naprawy',
          detail: 'Nie było śmieci, licznika restartów ani realnego błędu WWW do przeładowania.',
        });
      }
      const after = await diagnoseServer();
      return { ok: true, before, after, actions };
    });
    if (exclusive.conflict) {
      return NextResponse.json({ ok: false, error: 'Optymalizacja już trwa.' }, { status: 409, headers: NO_CACHE });
    }
    return NextResponse.json(exclusive.result, { headers: NO_CACHE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Optymalizacja nie powiodła się.' },
      { status: 500, headers: NO_CACHE },
    );
  }
}

export async function handleAdminCoreProcessesGET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;
  try {
    const [processes, mariadb] = await Promise.all([readPm2Processes(), readMariaDbStatus()]);
    return NextResponse.json({ ok: true, processes, mariadb }, { headers: NO_CACHE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się wczytać procesów.' },
      { status: 500, headers: NO_CACHE },
    );
  }
}

export async function handleAdminCoreProcessesPOST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;
  if (!isControlEnabled()) return controlDenied();

  try {
    const body = (await req.json()) as { name?: string; action?: string; confirmation?: string };
    const name = String(body.name || '').trim();
    const action = String(body.action || '').trim();
    if (!['start', 'stop', 'restart', 'reload'].includes(action)) {
      return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400, headers: NO_CACHE });
    }
    const result = await executeCoreGuardProcessControl({
      name,
      action: action as 'start' | 'stop' | 'restart' | 'reload',
      confirmation: body.confirmation,
      actorUserId: gate.adminId,
    });
    return NextResponse.json(result, {
      status: result.ok === false && result.requiresConfirmation ? 409 : 200,
      headers: NO_CACHE,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się wykonać akcji.' },
      { status: 400, headers: NO_CACHE },
    );
  }
}

export async function handleAdminCoreProductionGET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;
  try {
    const snapshot = await collectProductionSnapshot();
    return NextResponse.json({ ok: true, ...snapshot }, { headers: NO_CACHE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się odczytać produkcji.' },
      { status: 500, headers: NO_CACHE },
    );
  }
}
