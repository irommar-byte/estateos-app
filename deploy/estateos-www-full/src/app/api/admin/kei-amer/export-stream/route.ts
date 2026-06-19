import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { exportKeiListingsToEstateOS } from '@/lib/keiAmerExport';
import type { KeiExportProgressEvent } from '@/lib/keiAmerExportProgress';

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
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: KeiExportProgressEvent | Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      send({ type: 'connected', message: 'Połączono — rozpoczynam import…' });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 4000);

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
          floorPlanOverrides: parseFloorPlanOverrides(body?.floorPlanOverrides),
          onProgress: send,
        });

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'result', ok: true, exported: result.exported, skipped: result.skipped, message: result.message })}\n\n`,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Eksport KEI nie powiódł się.';
        send({ type: 'error', message });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
