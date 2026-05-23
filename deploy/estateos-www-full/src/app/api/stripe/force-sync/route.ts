import { decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  return new Stripe(secretKey, { apiVersion: '2023-10-16' as any });
}

export async function POST(req: Request) {
  try {
    const { plan, offerId, sessionId } = await req.json();
    const normalizedPlan = String(plan || '').trim().toLowerCase();
    if (!normalizedPlan) return NextResponse.json({ error: 'Brak planu' }, { status: 400 });

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Brak sesji' });

    const sessionData = decryptSession(sessionCookie.value);
    const email = sessionData?.email || null;
    if (!email) {
      return NextResponse.json({ error: 'Nieprawidłowa sesja' }, { status: 401 });
    }

    if (normalizedPlan === 'renewal') {
      const numericOfferId = Number(offerId);
      if (!Number.isFinite(numericOfferId) || numericOfferId <= 0) {
        return NextResponse.json({ error: 'Nieprawidłowy offerId' }, { status: 400 });
      }

      if (!sessionId) {
        return NextResponse.json({ error: 'Brak session_id dla odnowienia' }, { status: 400 });
      }

      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(String(sessionId), { expand: ['payment_intent'] });
      const paymentStatus = session.payment_status;
      const stripePlan = session.metadata?.plan_type;
      const stripeOfferId = Number(session.metadata?.offer_id_to_renew || 0);

      if (paymentStatus !== 'paid' || stripePlan !== 'renewal' || stripeOfferId !== numericOfferId) {
        return NextResponse.json({ error: 'Płatność niepotwierdzona dla tej oferty' }, { status: 409 });
      }

      const expires = new Date();
      expires.setDate(expires.getDate() + 30);

      const result = await prisma.offer.updateMany({
        where: {
          id: numericOfferId,
          userId: Number(sessionData?.id),
        },
        data: {
          status: 'ACTIVE',
          expiresAt: expires,
        },
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Nie znaleziono oferty do aktywacji' }, { status: 404 });
      }

      return NextResponse.json({ success: true, renewedOfferId: numericOfferId });
    }

    if (normalizedPlan === 'pakiet_plus') {
      // Pakiet Plus nie może być przyznawany przez ślepy sync z URL-a.
      // Księgowanie odbywa się wyłącznie po zweryfikowanej transakcji IAP/webhook.
      return NextResponse.json({ success: true, skipped: 'pakiet_plus_requires_verified_transaction' });
    }

    if (normalizedPlan === 'agency' || normalizedPlan === 'investor' || normalizedPlan === 'pro') {
      const planType = normalizedPlan === 'agency' ? 'AGENCY' : 'PRO';
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      
      // Twardy zapis do bazy danych - wymuszenie PRO!
      await prisma.user.updateMany({
        where: { email },
        data: { isPro: true, planType, proExpiresAt: expires }
      });
      console.log(`🔥 FORCE-SYNC: Użytkownik ${email} otrzymał wymuszone PRO (${planType})`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Nieobsługiwany plan płatności' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
