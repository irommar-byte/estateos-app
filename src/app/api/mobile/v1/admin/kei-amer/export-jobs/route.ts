import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { parseKeiExportBody } from '@/lib/keiAmerExportRouteUtils';
import { enqueueKeiImportJob } from '@/lib/keiAmerImportJobs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function POST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const parsed = parseKeiExportBody(body as Record<string, unknown>);
  try {
    const job = await enqueueKeiImportJob({
      adminUserId: gate.adminId,
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
