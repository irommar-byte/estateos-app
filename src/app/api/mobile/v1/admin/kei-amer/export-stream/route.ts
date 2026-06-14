import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
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

function parseExportBody(body: Record<string, unknown>) {
  const selections = Array.isArray(body?.selections)
    ? body.selections
        .map((row: Record<string, unknown>) => ({
          keiId: String(row?.keiId || ''),
          portalUrl: String(row?.portalUrl || ''),
        }))
        .filter((row: { portalUrl: string }) => row.portalUrl)
    : undefined;

  const targetUserId = Number(body?.targetUserId);
  const agentCommissionPercent = Number(body?.agentCommissionPercent);
  const count = Number(body?.count);

  return {
    targetUserId: Number.isFinite(targetUserId) && targetUserId > 0 ? targetUserId : undefined,
    agentCommissionPercent:
      Number.isFinite(agentCommissionPercent) && agentCommissionPercent >= 0 ? agentCommissionPercent : undefined,
    count: Number.isFinite(count) && count > 0 ? count : undefined,
    propertyKind: body?.propertyKind === 'house' ? ('house' as const) : ('apartment' as const),
    selections,
    floorPlanOverrides: parseFloorPlanOverrides(body?.floorPlanOverrides),
  };
}

export async function POST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: KeiExportProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const result = await exportKeiListingsToEstateOS({
          ...parseExportBody(body as Record<string, unknown>),
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
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
