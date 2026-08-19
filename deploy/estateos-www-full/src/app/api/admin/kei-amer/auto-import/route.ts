import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getKeiAutoImportConfig, parseKeiAutoImportPatch, saveKeiAutoImportAndKick } from '@/lib/keiAutoImport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }
  const config = await getKeiAutoImportConfig();
  return NextResponse.json({ ok: true, config });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { config, tick } = await saveKeiAutoImportAndKick(parseKeiAutoImportPatch(body, admin.id));
  return NextResponse.json({ ok: true, config, tick });
}
