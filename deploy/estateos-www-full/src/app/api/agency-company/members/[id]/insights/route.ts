import { NextResponse } from 'next/server';
import { getMemberInsights } from '@/lib/agencyCompany';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak sesji.' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const memberId = Number(id);
  if (!Number.isFinite(memberId)) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowy identyfikator.' }, { status: 400 });
  }

  try {
    const payload = await getMemberInsights({
      adminUserId: userId,
      memberId,
    });
    return NextResponse.json({ success: true, ...payload });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Błąd serwera.';
    const status = message.includes('uprawnień') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
