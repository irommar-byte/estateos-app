import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { isControlEnabled } from '@/lib/adminCoreControl';
import { diagnoseServer } from '@/lib/adminServerDiagnose';
import { isServerOptimizeRunning, runServerOptimizeExclusive } from '@/lib/adminServerOptimizeLock';
import {
  buildCoreGuardRemediationPlan,
  executeCoreGuardRunbook,
} from '@/lib/coreGuardRunbooks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const report = await diagnoseServer();
    return NextResponse.json(
      { ok: true, running: isServerOptimizeRunning(), status: report },
      { headers: NO_CACHE },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Skan nie powiódł się.' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isControlEnabled()) {
    return NextResponse.json({ error: 'Sterowanie CORE jest wyłączone.' }, { status: 403 });
  }
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
        actorUserId: admin.id,
        mode: 'automatic',
      });
      actions.push({ id: action.id, label: action.label, detail: JSON.stringify(result.result) });
    }
    const after = await diagnoseServer();
    return { ok: true, before, after, actions };
  });
  if (exclusive.conflict) {
    return NextResponse.json({ ok: false, error: 'Optymalizacja już trwa.' }, { status: 409, headers: NO_CACHE });
  }
  return NextResponse.json(exclusive.result, { headers: NO_CACHE });
}
