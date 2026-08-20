import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { collectAdminCoreMonitor } from '@/lib/adminCoreMetrics';
import { isAdminCoreOfflineFlagSet } from '@/lib/adminCoreControl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  if (isAdminCoreOfflineFlagSet()) {
    return NextResponse.json(
      { success: false, state: 'offline', message: 'CORE jest w trybie OFFLINE.' },
      { status: 503 },
    );
  }

  try {
    const monitor = await collectAdminCoreMonitor();
    return NextResponse.json({ success: true, monitor });
  } catch (error) {
    console.error('[admin/core/monitor]', error);
    return NextResponse.json({ success: false, message: 'Nie udało się zebrać monitora CORE' }, { status: 500 });
  }
}
