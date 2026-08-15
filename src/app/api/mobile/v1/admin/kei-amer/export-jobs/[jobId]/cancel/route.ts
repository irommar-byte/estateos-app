import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { requestCancelKeiImportJob } from '@/lib/keiAmerImportJobs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const { jobId } = await ctx.params;
  const job = await requestCancelKeiImportJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: 'Zadanie nie istnieje.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, job, cancelled: true });
}
