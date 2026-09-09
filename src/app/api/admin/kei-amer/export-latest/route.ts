import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { parseKeiExportBody } from '@/lib/keiAmerExportRouteUtils';
import { enqueueKeiImportJob } from '@/lib/keiAmerImportJobs';

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
      queued: true,
      message: 'Import KEI trafił do kolejki workera — WWW go nie wykonuje.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się uruchomić importu.';
    const conflict = /już trwa/i.test(message);
    return NextResponse.json({ ok: false, error: message }, { status: conflict ? 409 : 422 });
  }
}
