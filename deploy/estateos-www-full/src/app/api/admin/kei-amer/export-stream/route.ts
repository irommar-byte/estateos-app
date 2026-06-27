import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { exportKeiListingsToEstateOS } from '@/lib/keiAmerExport';
import type { KeiExportProgressEvent } from '@/lib/keiAmerExportProgress';
import { encodeKeiSseEvent, KEI_SSE_HEADERS } from '@/lib/keiAmerSse';
import { parseKeiExportBody } from '@/lib/keiAmerExportRouteUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseKeiExportBody(body as Record<string, unknown>);

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
