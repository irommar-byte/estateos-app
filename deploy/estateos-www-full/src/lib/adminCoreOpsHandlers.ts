import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { isControlEnabled } from '@/lib/adminCoreControl';
import { diagnoseServer, optimizeServer } from '@/lib/adminServerDiagnose';
import { isServerOptimizeRunning, runServerOptimizeExclusive } from '@/lib/adminServerOptimizeLock';
import { collectProductionSnapshot } from '@/lib/adminCoreProduction';
import { controlPm2, readMariaDbStatus, readPm2Processes, startMariaDb } from '@/lib/adminServerOps';

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
    const exclusive = await runServerOptimizeExclusive(() => optimizeServer());
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
    const body = (await req.json()) as { name?: string; action?: string };
    const name = String(body.name || '').trim();
    const action = String(body.action || '').trim();
    if (name === 'mariadb' && action === 'start') {
      const result = await startMariaDb();
      return NextResponse.json(result, { headers: NO_CACHE });
    }
    const result = await controlPm2(name, action);
    return NextResponse.json(result, { headers: NO_CACHE });
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
