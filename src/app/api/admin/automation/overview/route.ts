import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { buildAutomationOverview } from '@/lib/adminAutomationOverview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  try {
    const overview = await buildAutomationOverview();
    return NextResponse.json({ ok: true, ...overview });
  } catch (error) {
    console.error('[automation/overview]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Błąd pobierania automatyzacji.' },
      { status: 500 },
    );
  }
}
