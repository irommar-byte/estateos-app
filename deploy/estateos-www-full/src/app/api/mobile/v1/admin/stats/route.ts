import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { getAdminStatsPayload } from '@/lib/adminStatsPayload';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  try {
    const stats = await getAdminStatsPayload();
    return NextResponse.json({ success: true, ...stats });
  } catch (error: any) {
    console.error('[mobile admin stats]', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Błąd obliczeń' },
      { status: 500 }
    );
  }
}
