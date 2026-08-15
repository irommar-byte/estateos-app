import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { listActiveKeiImportJobs } from '@/lib/keiAmerImportJobs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const jobs = await listActiveKeiImportJobs(admin.id);
  return NextResponse.json({
    ok: true,
    jobs,
    active: jobs.filter((j) => j.status === 'queued' || j.status === 'running'),
  });
}
