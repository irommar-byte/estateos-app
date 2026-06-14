import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { exportKeiListingsToEstateOS } from '@/lib/keiAmerExport';
import type { KeiExportProgressEvent } from '@/lib/keiAmerExportProgress';
import { encodeKeiSseEvent, KEI_SSE_HEADERS } from '@/lib/keiAmerSse';

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
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: KeiExportProgressEvent) => {
        controller.enqueue(encodeKeiSseEvent(event));
      };

      send({ type: 'connected', message: 'Połączono — import w toku…' });

      void (async () => {
        try {
          const selections = Array.isArray(body?.selections)
            ? body.selections
                .map((row: Record<string, unknown>) => ({
                  keiId: String(row?.keiId || ''),
                  portalUrl: String(row?.portalUrl || ''),
                  address: String(row?.address || '').trim() || undefined,
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
            onProgress: send,
          });

          send({
            type: 'result',
            ok: true,
            exported: result.exported,
            skipped: result.skipped,
            message: result.message,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Eksport KEI nie powiódł się.';
          send({ type: 'error', message });
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, { headers: KEI_SSE_HEADERS });
}
