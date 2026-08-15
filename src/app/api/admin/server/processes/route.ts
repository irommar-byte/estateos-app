import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { controlPm2, readMariaDbStatus, readPm2Processes, startMariaDb } from '@/lib/adminServerOps';

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
    const body = (await req.json()) as { name?: string; action?: string };
    const name = String(body.name || '').trim();
    const action = String(body.action || '').trim();
    if (name === 'mariadb' && action === 'start') {
      const result = await startMariaDb();
      return NextResponse.json(result);
    }
    const result = await controlPm2(name, action);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się wykonać akcji.' },
      { status: 400 },
    );
  }
}
