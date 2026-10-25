import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { listKeiTargetUserOptions } from '@/lib/keiAutoImport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Lista kont docelowych importu (agenci, admini, Pro) — wybór po nazwisku zamiast wpisywania ID. */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get('q') || '';
  return NextResponse.json({ ok: true, users: await listKeiTargetUserOptions(q) });
}
