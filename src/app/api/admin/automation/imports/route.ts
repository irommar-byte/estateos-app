import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { listImportRegistry } from '@/lib/adminImportRegistry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 50);
  const offset = Number(url.searchParams.get('offset') || 0);
  const source = url.searchParams.get('source');

  try {
    const result = await listImportRegistry({
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
      source,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[automation/imports]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Błąd rejestru importów.' },
      { status: 500 },
    );
  }
}
