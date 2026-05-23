import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { fetchRadarSearchHistoryForUser } from '@/lib/radarSearchHistoryService';

export async function GET(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const gate = await requireMobileAdmin(req);
    if (!gate.ok) return gate.response;

    const { userId } = await context.params;
    const targetUserId = Number(userId);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy userId' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') ?? searchParams.get('n');

    const radarSearchHistory = await fetchRadarSearchHistoryForUser(targetUserId, limit);

    return NextResponse.json({
      success: true,
      radarSearchHistory,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
