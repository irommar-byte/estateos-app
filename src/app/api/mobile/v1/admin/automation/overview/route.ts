import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { buildAutomationOverview } from '@/lib/adminAutomationOverview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  try {
    const overview = await buildAutomationOverview();
    return NextResponse.json({ success: true, ok: true, ...overview });
  } catch (error) {
    console.error('[mobile admin automation overview]', error);
    return NextResponse.json(
      { success: false, ok: false, error: error instanceof Error ? error.message : 'Błąd automatyzacji.' },
      { status: 500 },
    );
  }
}
