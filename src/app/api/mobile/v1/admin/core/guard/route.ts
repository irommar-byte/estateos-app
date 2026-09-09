import { NextResponse } from 'next/server';
import { isControlEnabled } from '@/lib/adminCoreControl';
import { acknowledgeCoreGuardIncident, readCoreGuardDashboard } from '@/lib/coreGuard';
import {
  buildCoreGuardRemediationPlan,
  executeCoreGuardRunbook,
} from '@/lib/coreGuardRunbooks';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;
  const range = new URL(req.url).searchParams.get('range') || '24h';
  try {
    return NextResponse.json(
      { success: true, guard: await readCoreGuardDashboard(range) },
      { headers: NO_CACHE },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Błąd CORE Guard.' },
      { status: 500, headers: NO_CACHE },
    );
  }
}

export async function POST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as {
    operation?: string;
    actionId?: string;
    incidentId?: string;
    confirmation?: string;
  };
  try {
    if (body.operation === 'acknowledge' && body.incidentId) {
      await acknowledgeCoreGuardIncident(body.incidentId);
      return NextResponse.json({ success: true }, { headers: NO_CACHE });
    }
    if (body.operation === 'plan') {
      return NextResponse.json(
        { success: true, plan: await buildCoreGuardRemediationPlan(body.actionId) },
        { headers: NO_CACHE },
      );
    }
    if (body.operation === 'execute' && body.actionId) {
      if (!isControlEnabled()) {
        return NextResponse.json(
          { success: false, message: 'Sterowanie CORE jest wyłączone.' },
          { status: 403, headers: NO_CACHE },
        );
      }
      const result = await executeCoreGuardRunbook({
        actionId: body.actionId,
        confirmation: body.confirmation,
        actorUserId: gate.adminId,
        incidentId: body.incidentId,
      });
      return NextResponse.json(
        { success: result.ok !== false, result },
        {
          status: result.ok === false && result.requiresConfirmation ? 409 : 200,
          headers: NO_CACHE,
        },
      );
    }
    return NextResponse.json(
      { success: false, message: 'Nieznana operacja.' },
      { status: 400, headers: NO_CACHE },
    );
  } catch (error) {
    const conflict = error instanceof Error && (error as Error & { code?: string }).code === 'REPAIR_CONFLICT';
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Błąd operacji CORE Guard.' },
      { status: conflict ? 409 : 500, headers: NO_CACHE },
    );
  }
}
