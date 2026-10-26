import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { buildKeiImportAnalytics, type KeiAnalyticsRange } from '@/lib/keiImportAnalytics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }
  const raw = new URL(req.url).searchParams.get('range') || '30';
  const range: KeiAnalyticsRange = raw === '7' || raw === '90' || raw === 'all' ? raw : '30';
  return NextResponse.json({ ok: true, analytics: await buildKeiImportAnalytics(range) });
}
