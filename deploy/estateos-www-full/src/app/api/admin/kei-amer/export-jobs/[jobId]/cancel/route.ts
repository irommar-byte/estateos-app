import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { requestCancelKeiImportJob } from '@/lib/keiAmerImportJobs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const { jobId } = await ctx.params;
  const job = await requestCancelKeiImportJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: 'Zadanie nie istnieje.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, job, cancelled: true });
}
