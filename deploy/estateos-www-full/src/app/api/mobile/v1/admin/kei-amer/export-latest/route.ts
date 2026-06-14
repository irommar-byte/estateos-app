import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { exportKeiListingsToEstateOS } from '@/lib/keiAmerExport';

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

export async function POST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));

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
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Eksport KEI nie powiódł się.';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
