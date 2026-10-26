import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { parseKeiExportBody } from '@/lib/keiAmerExportRouteUtils';
import { enqueueKeiImportJob, listKeiImportJobs } from '@/lib/keiAmerImportJobs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseKeiExportBody(body as Record<string, unknown>);
  try {
    const job = await enqueueKeiImportJob({
      adminUserId: admin.id,
      ...parsed,
    });
    return NextResponse.json({
      ok: true,
      jobId: job.id,
      job,
      message: 'Import uruchomiony na serwerze — możesz zamknąć aplikację.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się uruchomić importu.';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

/** Historia zadań (np. ostatnie cykle automatu) — do panelu harmonogramu. */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }
  const url = new URL(req.url);
  const limit = Math.min(30, Math.max(1, Number(url.searchParams.get('limit')) || 8));
  const source = url.searchParams.get('source');
  const { jobs } = await listKeiImportJobs({ limit: source ? 60 : limit, offset: 0 });
  const filtered = (source === 'auto' || source === 'manual' ? jobs.filter((job) => job.source === source) : jobs).slice(0, limit);
  return NextResponse.json({
    ok: true,
    jobs: filtered.map((job) => ({
      id: job.id,
      status: job.status,
      source: job.source,
      message: job.message,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      exported: job.exported.length,
      skipped: job.skipped.length,
      review: job.items.filter((item) => item.publishState === 'review').length,
      aiRewritten: job.items.filter((item) => item.aiRewritten).length,
      thumbs: job.items.filter((item) => item.status === 'done' && item.thumbUrl).slice(0, 4).map((item) => item.thumbUrl),
    })),
  });
}
