import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { exportKeiListingsToEstateOS } from '@/lib/keiAmerExport';
import { hasActiveKeiImportJob } from '@/lib/keiAmerImportJobs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

function parseFloorPlanOverrides(raw: unknown): Record<string, boolean> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'boolean') out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseFloorPlanSelections(raw: unknown) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, { enabled: boolean; imageIndex: number }> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    out[key] = {
      enabled: row.enabled === true,
      imageIndex:
        Number.isFinite(Number(row.imageIndex)) && Number(row.imageIndex) >= 0
          ? Math.floor(Number(row.imageIndex))
          : 0,
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function POST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

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
      transactionKind: body?.transactionKind === 'rent' ? 'rent' : 'sale',
      selections,
      floorPlanOverrides: parseFloorPlanOverrides(body?.floorPlanOverrides),
      floorPlanSelections: parseFloorPlanSelections(body?.floorPlanSelections),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Eksport KEI nie powiódł się.';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
