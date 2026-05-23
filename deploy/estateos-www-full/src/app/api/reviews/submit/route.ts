import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { submitDealReview } from '@/lib/dealroomReviews';
import { collectReviewAuthSignals, resolveUserIdFromReviewAuth } from '@/lib/reviewAuth';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie =
      cookieStore.get('luxestate_user')?.value || cookieStore.get('estateos_session')?.value || null;
    const dealToken = cookieStore.get('deal_token')?.value || null;
    const reviewerId = await resolveUserIdFromReviewAuth({ req, sessionToken: sessionCookie, dealToken });
    if (!reviewerId) {
      const authSignals = collectReviewAuthSignals(req, dealToken);
      console.warn('[REVIEWS_AUTH_FAIL]', {
        route: '/api/reviews/submit',
        hasSessionCookie: Boolean(sessionCookie),
        ...authSignals,
      });
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const { targetId, rating, comment, review, dealId, senderId } = await req.json();

    if (!targetId || !rating || !dealId) {
      return NextResponse.json({ error: "Brak wymaganych danych" }, { status: 400 });
    }

    const senderIdNumber = Number(senderId);
    if (Number.isFinite(senderIdNumber) && senderIdNumber > 0 && senderIdNumber !== Number(reviewerId)) {
      return NextResponse.json({ error: 'Brak uprawnień do wystawienia opinii' }, { status: 403 });
    }
    const newReview = await submitDealReview({
      dealId: Number(dealId),
      reviewerId: Number(reviewerId),
      targetId: Number(targetId),
      rating: Number(rating),
      comment: (comment ?? review) || null,
    });

    return NextResponse.json({ success: true, review: newReview });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    if (message === 'REVIEW_ALREADY_EXISTS') {
      return NextResponse.json({ error: 'Opinia dla tej relacji w transakcji już istnieje' }, { status: 409 });
    }
    if (message === 'INVALID_REVIEW_PAYLOAD') {
      return NextResponse.json({ error: 'Nieprawidłowe dane opinii' }, { status: 400 });
    }
    if (message === 'DEAL_NOT_FOUND') {
      return NextResponse.json({ error: 'Transakcja nie istnieje' }, { status: 404 });
    }
    if (message === 'DEAL_PARTICIPANT_REQUIRED' || message === 'SELF_REVIEW_FORBIDDEN') {
      return NextResponse.json({ error: 'Brak uprawnień do wystawienia opinii' }, { status: 403 });
    }
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
