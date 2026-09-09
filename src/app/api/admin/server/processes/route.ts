import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { readMariaDbStatus, readPm2Processes } from '@/lib/adminServerOps';
import { executeCoreGuardProcessControl } from '@/lib/coreGuardRunbooks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [processes, mariadb] = await Promise.all([readPm2Processes(), readMariaDbStatus()]);
    return NextResponse.json(
      { ok: true, processes, mariadb },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[admin/server/processes]', error);
    return NextResponse.json({ error: 'Nie udało się wczytać procesów.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json()) as { name?: string; action?: string; confirmation?: string };
    const name = String(body.name || '').trim();
    const action = String(body.action || '').trim();
    if (!['start', 'stop', 'restart', 'reload'].includes(action)) {
      return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
    }
    const result = await executeCoreGuardProcessControl({
      name,
      action: action as 'start' | 'stop' | 'restart' | 'reload',
      confirmation: body.confirmation,
      actorUserId: admin.id,
    });
    return NextResponse.json(result, {
      status: result.ok === false && result.requiresConfirmation ? 409 : 200,
    });
  } catch (error) {
    const status =
      (error as Error & { code?: string })?.code === 'REPAIR_CONFLICT' ? 409 : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się wykonać akcji.' },
      { status },
    );
  }
}
