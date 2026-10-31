import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import {
  assignSmartAgentSeat,
  buySmartAgent,
  getSmartAgentAccess,
  getSmartAgentTriggers,
  listOfficeSmartSeats,
  listSeatCandidates,
  rejectSmartAgentRequest,
  requestSmartAgent,
  saveSmartAgentTriggers,
  smartAgentBoard,
  smartCompanyContext,
  transferOfficeSmartSeat,
} from '@/lib/crm/smartAgent';
import { regenerateSmartLink, sendSmartSearchInvite, smartSearchSummary } from '@/lib/crm/smartSearch';

/** Smart Agent OS™: dostęp, ustawienia reakcji, tablica i statystyki pracy. */
export async function GET(req: Request) {
  const userId = await requireAgencyUserId(req);
  if (!userId) return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  try {
    const [access, triggers] = await Promise.all([getSmartAgentAccess(userId), getSmartAgentTriggers(userId)]);
    const board = await smartAgentBoard(userId, access, triggers);
    const ctx = await smartCompanyContext(userId);
    const [candidates, search, officeSeats] = await Promise.all([
      ctx?.isAdmin ? listSeatCandidates(userId) : Promise.resolve([]),
      smartSearchSummary(userId),
      ctx?.isAdmin ? listOfficeSmartSeats(userId) : Promise.resolve([]),
    ]);
    return NextResponse.json({ success: true, userId, access, triggers, board, candidates, search, officeSeats, isManager: Boolean(ctx?.isAdmin) });
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
      const forUserId = Number(body.forUserId || 0) || undefined;
      const from = body.from === 'pool' || body.from === 'personal' ? body.from : undefined;
      await buySmartAgent(userId, { forUserId, from });
    } else if (action === 'request') {
      await requestSmartAgent(userId);
    } else if (action === 'approve_request') {
      await buySmartAgent(userId, { forUserId: Number(body.forUserId || 0), from: 'pool' });
    } else if (action === 'reject_request') {
      await rejectSmartAgentRequest(userId, Number(body.forUserId || 0));
    } else if (action === 'transfer_office_seat') {
      await transferOfficeSmartSeat(userId, Number(body.fromUserId || 0), Number(body.toUserId || 0));
    } else if (action === 'regenerate_link') {
      await regenerateSmartLink(userId);
    } else if (action === 'send_search_invite') {
      await sendSmartSearchInvite({ userId, email: String(body.email || ''), name: body.name ? String(body.name) : null });
    } else if (action === 'assign_seat') {
      await assignSmartAgentSeat(userId, Number(body.toUserId || 0));
    } else {
      return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się.';
    const code = message.startsWith('W puli biura brakuje kredytów') ? 'NO_OFFICE_CREDIT' : null;
    return NextResponse.json({ error: message, code }, { status: 400 });
  }
}
