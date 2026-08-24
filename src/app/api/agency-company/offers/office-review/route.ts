import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import {
  canManageOfficeOffers,
  decideOfficeOfferReview,
  listOfficeReviewQueue,
  submitOfferForOfficeActivation,
} from '@/lib/crm/officeOfferReview';
import { getUserAgencyMembership } from '@/lib/agencyCompany';

export async function GET(req: Request) {
  const userId = await requireAgencyUserId(req);
  if (!userId) return NextResponse.json({ error: 'Brak dostępu.' }, { status: 403 });
  const capability = await canManageOfficeOffers(userId);
  if (!capability.ok || !capability.companyId) {
    return NextResponse.json({ error: 'Tylko kierownik biura widzi kolejkę.' }, { status: 403 });
  }
  const queue = await listOfficeReviewQueue(capability.companyId);
  return NextResponse.json({ success: true, queue, capability });
}

export async function POST(req: Request) {
  const userId = await requireAgencyUserId(req);
  if (!userId) return NextResponse.json({ error: 'Brak dostępu.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const offerId = Number(body.offerId);

  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: 'Brak ID oferty.' }, { status: 400 });
  }

  if (action === 'submit') {
    const result = await submitOfferForOfficeActivation({ offerId, actorUserId: userId });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    return NextResponse.json({ success: true, ...result });
  }

  if (action === 'approve' || action === 'reject') {
    const result = await decideOfficeOfferReview({
      offerId,
      reviewerUserId: userId,
      decision: action,
      note: body.note ? String(body.note) : null,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    return NextResponse.json({ success: true, ...result });
  }

  if (action === 'capability') {
    const membership = await getUserAgencyMembership(userId);
    const capability = await canManageOfficeOffers(userId);
    return NextResponse.json({
      success: true,
      capability,
      membershipRole: membership?.role ?? null,
    });
  }

  return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
}
