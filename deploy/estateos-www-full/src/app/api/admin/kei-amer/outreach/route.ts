import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { sendKeiOwnerOutreach } from '@/lib/keiAmerOutreach';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const selections = Array.isArray(body?.selections)
    ? body.selections
        .map((row: Record<string, unknown>) => ({
          keiId: String(row?.keiId || ''),
          portalUrl: String(row?.portalUrl || ''),
          address: String(row?.address || ''),
        }))
        .filter((row: { portalUrl: string }) => row.portalUrl)
    : [];

  try {
    const result = await sendKeiOwnerOutreach({
      adminUserId: admin.id,
      selections,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się przygotować zaproszenia.';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
