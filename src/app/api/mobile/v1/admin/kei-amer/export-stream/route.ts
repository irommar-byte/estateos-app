import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
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

function parseFloorPlanSelections(raw: unknown) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, { enabled: boolean; imageIndex: number }> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    const enabled = row.enabled === true;
    const imageIndex = Number(row.imageIndex);
    out[key] = {
      enabled,
      imageIndex: Number.isFinite(imageIndex) && imageIndex >= 0 ? Math.floor(imageIndex) : 0,
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseExportBody(body: Record<string, unknown>) {
  const selections = Array.isArray(body?.selections)
    ? body.selections
        .map((row: Record<string, unknown>) => ({
          keiId: String(row?.keiId || ''),
          portalUrl: String(row?.portalUrl || ''),
          address: String(row?.address || '').trim() || undefined,
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
    transactionKind: body?.transactionKind === 'rent' ? ('rent' as const) : ('sale' as const),
    selections,
    floorPlanOverrides: parseFloorPlanOverrides(body?.floorPlanOverrides),
    floorPlanSelections: parseFloorPlanSelections(body?.floorPlanSelections),
  };
}

export async function POST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const parsed = parseExportBody(body as Record<string, unknown>);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: KeiExportProgressEvent) => {
        controller.enqueue(encodeKeiSseEvent(event));
      };

      send({ type: 'connected', message: 'Połączono — import w toku…' });

      void (async () => {
        try {
          const result = await exportKeiListingsToEstateOS({
            ...parsed,
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
