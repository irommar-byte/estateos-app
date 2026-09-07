import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { diagnoseServer, optimizeServer } from '@/lib/adminServerDiagnose';
import { isServerOptimizeRunning, runServerOptimizeExclusive } from '@/lib/adminServerOptimizeLock';

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

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const exclusive = await runServerOptimizeExclusive(() => optimizeServer());
  if (exclusive.conflict) {
    return NextResponse.json({ ok: false, error: 'Optymalizacja już trwa.' }, { status: 409, headers: NO_CACHE });
  }
  return NextResponse.json(exclusive.result, { headers: NO_CACHE });
}
