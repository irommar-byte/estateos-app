import { NextResponse } from 'next/server';
import os from 'os';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import {
  diskHealth,
  readCpuMetrics,
  readDiskMetrics,
  readMariaDbStatus,
  readMemoryMetrics,
  readPm2Processes,
} from '@/lib/adminServerOps';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [disk, processes, mariadb] = await Promise.all([
      readDiskMetrics('/'),
      readPm2Processes(),
      readMariaDbStatus(),
    ]);
    const cpu = readCpuMetrics();
    const memory = readMemoryMetrics();
    const level = diskHealth(disk.percent, mariadb.up);
    const online = processes.filter((p) => p.status === 'online').length;

    return NextResponse.json(
      {
        ok: true,
        collectedAt: new Date().toISOString(),
        host: os.hostname(),
        uptimeSec: Math.floor(os.uptime()),
        level,
        cpu,
        memory,
        disk,
        database: mariadb,
        processes: { total: processes.length, online },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[admin/server/status]', error);
    return NextResponse.json({ error: 'Nie udało się odczytać stanu serwera.' }, { status: 500 });
  }
}
