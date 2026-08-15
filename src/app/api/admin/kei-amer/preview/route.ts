import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { parseKeiPreviewSearchParams, previewKeiExportListings } from '@/lib/keiAmerPreview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const search = parseKeiPreviewSearchParams(url.searchParams);
  const page = Number(url.searchParams.get('page') || 1);
  const pageSize = Number(url.searchParams.get('pageSize') || 20);
  const selectionPool = url.searchParams.get('selectionPool') === '1';
  const mode = url.searchParams.get('mode') === 'search' ? 'search' : 'feed';
  const verifyPortal =
    url.searchParams.get('verify') === '1' ||
    (mode === 'search' && url.searchParams.get('verify') !== '0');

  try {
    const result = await previewKeiExportListings({
      propertyKind: search.propertyKind,
      transactionKind: search.transactionKind,
      page,
      pageSize,
      selectionPool,
      mode,
      search,
      verifyPortal,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Podgląd KEI nie powiódł się.';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
