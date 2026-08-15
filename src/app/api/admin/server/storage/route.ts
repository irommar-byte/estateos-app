import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { collectStorageReport, readDiskMetrics } from '@/lib/adminServerOps';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [disk, buckets] = await Promise.all([readDiskMetrics('/'), collectStorageReport()]);
    return NextResponse.json(
      { ok: true, disk, buckets },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[admin/server/storage]', error);
    return NextResponse.json({ error: 'Nie udało się zliczyć pamięci.' }, { status: 500 });
  }
}
