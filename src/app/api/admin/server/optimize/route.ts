import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { diagnoseServer, optimizeServer } from '@/lib/adminServerDiagnose';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

let running = false;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const report = await diagnoseServer();
    return NextResponse.json({ ok: true, running, status: report }, { headers: NO_CACHE });
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
  if (running) {
    return NextResponse.json({ ok: false, error: 'Optymalizacja już trwa.' }, { status: 409, headers: NO_CACHE });
  }

  running = true;
  try {
    const result = await optimizeServer();
    return NextResponse.json(result, { headers: NO_CACHE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Optymalizacja nie powiodła się.' },
      { status: 500, headers: NO_CACHE },
    );
  } finally {
    running = false;
  }
}
