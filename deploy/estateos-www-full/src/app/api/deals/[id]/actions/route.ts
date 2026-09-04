import { NextResponse } from 'next/server';
import { resolveDealUserId } from '@/lib/dealRequestAuth';
import { executeDealAction } from '@/app/api/mobile/v1/deals/[id]/actions/route';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const dealId = Number(id);
    if (!dealId || Number.isNaN(dealId)) {
      return NextResponse.json({ error: 'Nieprawidłowe ID transakcji' }, { status: 400 });
    }
    const actorId = await resolveDealUserId(req);
    if (!actorId) return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return executeDealAction(actorId, dealId, body);
  } catch (error) {
    console.error('[deals.actions]', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
