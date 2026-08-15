import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import type { KeiExportProgressEvent } from '@/lib/keiAmerExportProgress';
import { encodeKeiSseEvent, KEI_SSE_HEADERS } from '@/lib/keiAmerSse';
import { parseKeiExportBody } from '@/lib/keiAmerExportRouteUtils';
import {
  enqueueKeiImportJob,
  getKeiImportJob,
  isKeiImportJobTerminal,
  type KeiImportJobItem,
} from '@/lib/keiAmerImportJobs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

function eventsFromItemDelta(
  prev: KeiImportJobItem[] | null,
  next: KeiImportJobItem[],
): KeiExportProgressEvent[] {
  const events: KeiExportProgressEvent[] = [];
  for (const item of next) {
    const before = prev?.find((row) => row.index === item.index);
    if (!before || before.status === 'pending') {
      if (item.status !== 'pending') {
        events.push({
          type: 'item_start',
          index: item.index,
          total: next.length,
          keiListingId: item.keiListingId,
          portalUrl: item.portalUrl,
          address: item.address,
        });
      }
    }
    if (item.status === 'active' && item.currentStep && item.currentStep !== before?.currentStep) {
      events.push({
        type: 'step',
        index: item.index,
        step: item.currentStep,
        label: item.stepLabel,
        detail: item.stepDetail,
      });
    }
    if (item.imageProgress && item.imageProgress.index !== before?.imageProgress?.index) {
      events.push({
        type: 'image_progress',
        index: item.index,
        imageIndex: item.imageProgress.index,
        imageTotal: item.imageProgress.total,
        asFloorPlan: item.imageProgress.asFloorPlan,
        label: item.imageProgress.label,
      });
    }
    if (item.status === 'done' && before?.status !== 'done' && item.offerId && item.publicUrl && item.editUrl) {
      events.push({
        type: 'item_done',
        index: item.index,
        keiListingId: item.keiListingId,
        offerId: item.offerId,
        portalUrl: item.portalUrl,
        publicUrl: item.publicUrl,
        editUrl: item.editUrl,
      });
    }
    if (item.status === 'skipped' && before?.status !== 'skipped') {
      events.push({
        type: 'item_skip',
        index: item.index,
        keiListingId: item.keiListingId,
        portalUrl: item.portalUrl,
        reason: item.reason || 'Pominięto',
      });
    }
  }
  return events;
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseKeiExportBody(body as Record<string, unknown>);

  let job;
  try {
    job = await enqueueKeiImportJob({
      adminUserId: admin.id,
      ...parsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się uruchomić importu.';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }

  const accept = req.headers.get('accept') || '';
  if (accept.includes('application/json') && !accept.includes('text/event-stream')) {
    return NextResponse.json({
      ok: true,
      jobId: job.id,
      job,
      message: 'Import uruchomiony na serwerze.',
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: KeiExportProgressEvent & { jobId?: string }) => {
        controller.enqueue(encodeKeiSseEvent(event));
      };

      send({ type: 'connected', message: 'Import trwa na serwerze…', jobId: job.id } as KeiExportProgressEvent);

      void (async () => {
        let prevItems: KeiImportJobItem[] | null = null;
        try {
          send({ type: 'batch_start', total: job.items.length });
          for (;;) {
            const snapshot = await getKeiImportJob(job.id);
            if (!snapshot) break;
            for (const event of eventsFromItemDelta(prevItems, snapshot.items)) {
              send(event);
            }
            prevItems = snapshot.items;
            if (isKeiImportJobTerminal(snapshot.status)) {
              if (snapshot.status === 'error') {
                send({ type: 'error', message: snapshot.message || 'Import nie powiódł się.' });
              } else {
                send({
                  type: 'result',
                  ok: snapshot.status === 'done',
                  exported: snapshot.exported,
                  skipped: snapshot.skipped,
                  message: snapshot.message,
                });
              }
              break;
            }
            await new Promise((r) => setTimeout(r, 900));
          }
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
