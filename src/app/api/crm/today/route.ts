import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { loadAgentToday } from '@/lib/crm/agentToday';
import { INTELLIGENCE_APPROVAL_KIND, recordOwnerCallOutcome, type OwnerCallOutcome } from '@/lib/crm/intelligenceApproval';
import { canSeeOfferOwner, saveAgentOwnerPhone } from '@/lib/crm/ownerContactLookup';
import { prisma } from '@/lib/prisma';

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

  if (action === 'owner_phone') {
    // Agent dopisuje numer właściciela (znalazł go w telefonie, w notatkach, u klienta) — od teraz jest na karcie.
    const activityId = Number(body.approvalId);
    const row = Number.isFinite(activityId)
      ? await prisma.agencyClientActivity.findFirst({
          where: { id: activityId, agencyUserId, kind: INTELLIGENCE_APPROVAL_KIND },
          select: { offerId: true },
        })
      : null;
    const offer = row?.offerId
      ? await prisma.offer.findUnique({ where: { id: row.offerId }, select: { id: true, userId: true } })
      : null;
    if (!offer) return NextResponse.json({ error: 'Nie znaleziono oferty.' }, { status: 404 });
    const actor = await prisma.user.findUnique({ where: { id: agencyUserId }, select: { role: true } });
    const isAdmin = String(actor?.role || '').toUpperCase() === 'ADMIN';
    if (!(await canSeeOfferOwner(agencyUserId, offer.userId, isAdmin))) {
      return NextResponse.json({ error: 'To oferta innego agenta — numer dopisuje agent prowadzący.' }, { status: 403 });
    }
    const phone = await saveAgentOwnerPhone(offer, String(body.phone || ''));
    if (!phone) return NextResponse.json({ error: 'Wpisz 9-cyfrowy numer telefonu.' }, { status: 400 });
    return NextResponse.json({ success: true, phone });
  }

  return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
}
