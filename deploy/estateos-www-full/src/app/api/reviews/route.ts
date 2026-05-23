import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { submitDealReview } from '@/lib/dealroomReviews';
import { collectReviewAuthSignals, resolveUserIdFromReviewAuth } from '@/lib/reviewAuth';

export async function POST(req: Request) {
  try {
    const { targetId, rating, comment, review, dealId, senderId } = await req.json();
    const cookieStore = await cookies();
    const sessionCookie =
      cookieStore.get('luxestate_user')?.value || cookieStore.get('estateos_session')?.value || null;
    const dealToken = cookieStore.get('deal_token')?.value || null;
    const reviewerId = await resolveUserIdFromReviewAuth({ req, sessionToken: sessionCookie, dealToken });
    if (!reviewerId) {
      const authSignals = collectReviewAuthSignals(req, dealToken);
      console.warn('[REVIEWS_AUTH_FAIL]', {
        route: '/api/reviews',
        hasSessionCookie: Boolean(sessionCookie),
        ...authSignals,
      });
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    const senderIdNumber = Number(senderId);
    if (Number.isFinite(senderIdNumber) && senderIdNumber > 0 && senderIdNumber !== Number(reviewerId)) {
      console.warn('[REVIEWS] Ignoruję body.senderId !== auth: klient wysłał', senderIdNumber, 'JWT/cookies:', reviewerId);
    }

    const reviewRecord = await submitDealReview({
      dealId: Number(dealId),
      reviewerId: Number(reviewerId),
      targetId: Number(targetId),
      rating: Number(rating),
      comment: (comment ?? review) || null,
    });

    return NextResponse.json({ success: true, review: reviewRecord });
  } catch(e) {
    const message = e instanceof Error ? e.message : 'UNKNOWN_ERROR';
    if (message === 'REVIEW_ALREADY_EXISTS') return NextResponse.json({ error: 'Opinia już istnieje' }, { status: 409 });
    if (message === 'INVALID_REVIEW_PAYLOAD') return NextResponse.json({ error: 'Nieprawidłowe dane opinii' }, { status: 400 });
    if (message === 'DEAL_NOT_FOUND') return NextResponse.json({ error: 'Transakcja nie istnieje' }, { status: 404 });
    if (message === 'DEAL_PARTICIPANT_REQUIRED') return NextResponse.json({ error: 'Nie jesteś stroną tej transakcji' }, { status: 403 });
    if (message === 'SELF_REVIEW_FORBIDDEN') return NextResponse.json({ error: 'Nie możesz ocenić samego siebie' }, { status: 403 });
    return NextResponse.json({ error: 'Błąd' }, { status: 500 });
  }
}
