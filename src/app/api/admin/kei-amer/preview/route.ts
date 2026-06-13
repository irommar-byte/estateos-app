import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { previewKeiExportListings } from '@/lib/keiAmerPreview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const propertyKind = url.searchParams.get('propertyKind') === 'house' ? 'house' : 'apartment';
  const page = Number(url.searchParams.get('page') || 1);
  const pageSize = Number(url.searchParams.get('pageSize') || 12);
  const selectionPool = url.searchParams.get('selectionPool') === '1';

  try {
    const result = await previewKeiExportListings({ propertyKind, page, pageSize, selectionPool });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Podgląd KEI nie powiódł się.';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
