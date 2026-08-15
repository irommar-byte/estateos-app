import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { collectKeiSearchFacets } from '@/lib/keiAmerFacets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 90;

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const propertyKind = url.searchParams.get('propertyKind') === 'house' ? 'house' : 'apartment';
  const transactionKind = url.searchParams.get('transactionKind') === 'rent' ? 'rent' : 'sale';

  try {
    const result = await collectKeiSearchFacets({ propertyKind, transactionKind });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się pobrać filtrów KEI.';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
