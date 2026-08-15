import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { listActiveKeiImportJobs } from '@/lib/keiAmerImportJobs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const jobs = await listActiveKeiImportJobs(gate.adminId);
  return NextResponse.json({
    ok: true,
    jobs,
    active: jobs.filter((j) => j.status === 'queued' || j.status === 'running'),
  });
}
