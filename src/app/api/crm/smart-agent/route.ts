import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import {
  assignSmartAgentSeat,
  buySmartAgent,
  getSmartAgentAccess,
  getSmartAgentTriggers,
  listSeatCandidates,
  saveSmartAgentTriggers,
  smartAgentBoard,
} from '@/lib/crm/smartAgent';
import { sendSmartSearchInvite, smartSearchSummary } from '@/lib/crm/smartSearch';

/** Smart Agent OS™: dostęp, ustawienia reakcji, tablica i statystyki pracy. */
export async function GET(req: Request) {
  const userId = await requireAgencyUserId(req);
  if (!userId) return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  try {
    const [access, triggers] = await Promise.all([getSmartAgentAccess(userId), getSmartAgentTriggers(userId)]);
    const board = await smartAgentBoard(userId, access, triggers);
    const [candidates, search] = await Promise.all([
      access.seat?.isAdmin && access.seat.enterprise ? listSeatCandidates(userId) : Promise.resolve([]),
      smartSearchSummary(userId),
    ]);
    return NextResponse.json({ success: true, userId, access, triggers, board, candidates, search });
  } catch (error) {
    console.error('[smart-agent GET]', error);
    return NextResponse.json({ error: 'Nie udało się wczytać Smart Agent OS™.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await requireAgencyUserId(req);
  if (!userId) return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '');
  try {
    if (action === 'save_triggers') {
      const t = (body.triggers && typeof body.triggers === 'object' ? body.triggers : {}) as Record<string, unknown>;
      await saveSmartAgentTriggers(userId, { like: Boolean(t.like), maybe: Boolean(t.maybe), favorite: Boolean(t.favorite) });
    } else if (action === 'buy') {
      await buySmartAgent(userId);
    } else if (action === 'send_search_invite') {
      await sendSmartSearchInvite({ userId, email: String(body.email || ''), name: body.name ? String(body.name) : null });
    } else if (action === 'assign_seat') {
      await assignSmartAgentSeat(userId, Number(body.toUserId || 0));
    } else {
      return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Nie udało się.' }, { status: 400 });
  }
}
