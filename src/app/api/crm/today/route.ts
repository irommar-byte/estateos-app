import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { loadAgentToday } from '@/lib/crm/agentToday';
import { recordOwnerCallOutcome, type OwnerCallOutcome } from '@/lib/crm/intelligenceApproval';

export const dynamic = 'force-dynamic';

/** Ekran „Dziś” agenta — wszystko, co czeka na jego ruch. */
export async function GET(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }
  const today = await loadAgentToday({ agencyUserId, scheduleUserId: agencyUserId });
  return NextResponse.json({ success: true, today });
}

/** Akcje wykonywane wprost z ekranu „Dziś”. */
export async function POST(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '');

  if (action === 'owner_call_result') {
    const outcome = String(body.outcome || '') as OwnerCallOutcome;
    if (!['available', 'sold', 'no_answer'].includes(outcome)) {
      return NextResponse.json({ error: 'Nieznany wynik rozmowy.' }, { status: 400 });
    }
    const activityId = Number(body.approvalId);
    if (!Number.isFinite(activityId) || activityId <= 0) {
      return NextResponse.json({ error: 'Brak propozycji.' }, { status: 400 });
    }
    const result = await recordOwnerCallOutcome({
      agencyUserId,
      activityId,
      outcome,
      note: typeof body.note === 'string' ? body.note : null,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ success: true, ...result });
  }

  return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
}
