import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { exportKeiListingsToEstateOS } from '@/lib/keiAmerExport';
import { hasActiveKeiImportJob } from '@/lib/keiAmerImportJobs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (await hasActiveKeiImportJob()) {
    return NextResponse.json(
      { ok: false, error: 'Inny import KEI już trwa. Poczekaj, aż się skończy.' },
      { status: 409 },
    );
  }
  try {
    const selections = Array.isArray(body?.selections)
      ? body.selections
          .map((row: Record<string, unknown>) => ({
            keiId: String(row?.keiId || ''),
            portalUrl: String(row?.portalUrl || ''),
          }))
          .filter((row: { portalUrl: string }) => row.portalUrl)
      : undefined;

    const result = await exportKeiListingsToEstateOS({
      targetUserId: body?.targetUserId,
      agentCommissionPercent: body?.agentCommissionPercent,
      count: body?.count,
      propertyKind: body?.propertyKind === 'house' ? 'house' : 'apartment',
      selections,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Eksport KEI nie powiódł się.';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
