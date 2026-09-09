import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { isControlEnabled } from '@/lib/adminCoreControl';
import { acknowledgeCoreGuardIncident, readCoreGuardDashboard } from '@/lib/coreGuard';
import {
  buildCoreGuardRemediationPlan,
  executeCoreGuardRunbook,
} from '@/lib/coreGuardRunbooks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const range = new URL(req.url).searchParams.get('range') || '24h';
  try {
    return NextResponse.json(await readCoreGuardDashboard(range), { headers: NO_CACHE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się odczytać CORE Guard.' },
      { status: 500, headers: NO_CACHE },
    );
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    operation?: string;
    actionId?: string;
    incidentId?: string;
    confirmation?: string;
  };
  try {
    if (body.operation === 'acknowledge' && body.incidentId) {
      await acknowledgeCoreGuardIncident(body.incidentId);
      return NextResponse.json({ ok: true }, { headers: NO_CACHE });
    }
    if (body.operation === 'plan') {
      return NextResponse.json(
        { ok: true, plan: await buildCoreGuardRemediationPlan(body.actionId) },
        { headers: NO_CACHE },
      );
    }
    if (body.operation === 'execute' && body.actionId) {
      if (!isControlEnabled()) {
        return NextResponse.json(
          { error: 'Sterowanie CORE jest wyłączone.' },
          { status: 403, headers: NO_CACHE },
        );
      }
      const result = await executeCoreGuardRunbook({
        actionId: body.actionId,
        confirmation: body.confirmation,
        actorUserId: admin.id,
        incidentId: body.incidentId,
      });
      return NextResponse.json(result, {
        status: result.ok === false && result.requiresConfirmation ? 409 : 200,
        headers: NO_CACHE,
      });
    }
    return NextResponse.json({ error: 'Nieznana operacja.' }, { status: 400, headers: NO_CACHE });
  } catch (error) {
    const conflict = error instanceof Error && (error as Error & { code?: string }).code === 'REPAIR_CONFLICT';
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Operacja CORE Guard nie powiodła się.' },
      { status: conflict ? 409 : 500, headers: NO_CACHE },
    );
  }
}
