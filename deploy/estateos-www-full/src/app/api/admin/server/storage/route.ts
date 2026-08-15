import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import {
  collectCategoryReport,
  findLargestFiles,
  previewSafeCleanup,
  readDiskMetrics,
} from '@/lib/adminServerOps';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [disk, categoryPack, largestFiles, safeCleanup] = await Promise.all([
      readDiskMetrics('/'),
      collectCategoryReport(),
      findLargestFiles(18),
      previewSafeCleanup(),
    ]);

    return NextResponse.json(
      {
        ok: true,
        disk,
        categories: categoryPack.categories,
        accountedBytes: categoryPack.accountedBytes,
        otherBytes: Math.max(0, disk.usedBytes - categoryPack.accountedBytes),
        largestFiles,
        safeCleanup: {
          count: safeCleanup.count,
          bytes: safeCleanup.bytes,
          preview: safeCleanup.items.slice(0, 12),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[admin/server/storage]', error);
    return NextResponse.json({ error: 'Nie udało się zliczyć pamięci.' }, { status: 500 });
  }
}
