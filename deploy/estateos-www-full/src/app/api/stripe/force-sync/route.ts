import { decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { buildInvestorProGrantData, isStripeInvestorProPlan } from '@/lib/investorProGrant';
import { grantPlusCreditFromStripeCheckout } from '@/lib/stripePublication';
import {
  grantPartnerPlanFromStripeCheckout,
  grantPartnerPlanFromStripeSubscription,
  isStripePartnerPlan,
} from '@/lib/partnerStripeGrant';

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
    const userId = Number(sessionData?.id || 0);
    if (!email || !userId) {
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
      if (!sessionId) {
        return NextResponse.json({ error: 'Brak session_id dla Pakiet Plus' }, { status: 400 });
      }
      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(String(sessionId), { expand: ['payment_intent'] });
      const paymentStatus = session.payment_status;
      const stripePlan = String(session.metadata?.plan_type || '').trim().toLowerCase();
      if (paymentStatus !== 'paid' || stripePlan !== 'pakiet_plus') {
        return NextResponse.json({ error: 'Płatność Pakiet Plus niepotwierdzona' }, { status: 409 });
      }
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!user?.id) {
        return NextResponse.json({ error: 'Nie znaleziono użytkownika do przyznania kredytu Plus' }, { status: 404 });
      }
      await grantPlusCreditFromStripeCheckout({
        userId: Number(user.id),
        checkoutSessionId: String(sessionId),
      });
      return NextResponse.json({ success: true, planType: 'PAKIET_PLUS', plusCreditGranted: true });
    }

    if (isStripePartnerPlan(normalizedPlan)) {
      if (!sessionId) {
        return NextResponse.json({ error: 'Brak session_id dla pakietu Partner' }, { status: 400 });
      }
      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(String(sessionId), {
        expand: ['payment_intent', 'subscription'],
      });
      const paymentStatus = session.payment_status;
      const stripePlan = String(session.metadata?.plan_type || '').trim().toLowerCase();
      const isSubscriptionTrial =
        session.mode === 'subscription' && session.metadata?.partner_trial === 'true';
      const paymentOk =
        paymentStatus === 'paid' ||
        (isSubscriptionTrial && (paymentStatus === 'no_payment_required' || paymentStatus === 'unpaid'));

      if (!paymentOk || stripePlan !== normalizedPlan) {
        return NextResponse.json({ error: 'Płatność Partner niepotwierdzona' }, { status: 409 });
      }

      if (session.mode === 'subscription') {
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (!subscriptionId) {
          return NextResponse.json({ error: 'Brak subskrypcji Partner' }, { status: 409 });
        }
        const grant = await grantPartnerPlanFromStripeSubscription({
          userId,
          checkoutSessionId: String(sessionId),
          subscriptionId,
          stripePlanType: normalizedPlan,
          isTrial: isSubscriptionTrial,
        });
        return NextResponse.json({
          success: true,
          planType: 'AGENCY',
          partnerPlanId: grant.partnerPlanId,
          creditsAdded: grant.creditsAdded,
          companyId: grant.companyId,
          alreadyGranted: grant.alreadyGranted,
          subscriptionTrial: isSubscriptionTrial,
        });
      }

      const grant = await grantPartnerPlanFromStripeCheckout({
        userId,
        checkoutSessionId: String(sessionId),
        stripePlanType: normalizedPlan,
      });

      return NextResponse.json({
        success: true,
        planType: 'AGENCY',
        partnerPlanId: grant.partnerPlanId,
        creditsAdded: grant.creditsAdded,
        companyId: grant.companyId,
        alreadyGranted: grant.alreadyGranted,
      });
    }

    if (isStripeInvestorProPlan(normalizedPlan)) {
      const grant = buildInvestorProGrantData();
      await prisma.user.updateMany({
        where: { email },
        data: grant,
      });
      console.log(`[force-sync] investor_pro_granted email=${email} until=${grant.proExpiresAt.toISOString()}`);
      return NextResponse.json({ success: true, planType: 'PRO', proExpiresAt: grant.proExpiresAt });
    }

    return NextResponse.json({ error: 'Nieobsługiwany plan płatności' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
