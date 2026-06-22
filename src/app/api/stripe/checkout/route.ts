import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import {
  PAKIET_PLUS_STRIPE_AMOUNT,
  PUBLICATION_RENEWAL_STRIPE_AMOUNT,
} from '@/lib/publicationConstants';
import {
  assertPartnerCheckoutAllowed,
  getPartnerPlanByStripePlan,
  isStripePartnerPlan,
  partnerCheckoutCopy,
} from '@/lib/partnerStripeGrant';
import { partnerStripeAmountGrosze } from '@/lib/partnerPricing';

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  return new Stripe(secretKey, { apiVersion: '2023-10-16' as any });
}

function buildSuccessUrl(baseUrl: string, params: Record<string, string>): string {
  const parsed = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value) parsed.searchParams.set(key, value);
  }
  parsed.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  return parsed.toString();
}

export async function POST(req: Request) {
  try {
    const stripe = getStripeClient();
    const body = await req.json();
    const { returnUrl, cancelUrl, plan, offerPayload, offerId } = body;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('estateos_session');

    const origin = req.headers.get('origin') || 'https://estateos.pl';
    const finalReturnUrl = returnUrl || `${origin}/moje-konto/crm`;
    const finalCancelUrl = cancelUrl || `${origin}/cennik?tab=partner`;
    const sessionData = sessionCookie ? decryptSession(sessionCookie.value) : null;
    const customerEmail = sessionData?.email || undefined;
    const userId = Number(sessionData?.id || 0);

    const normalizedPlan = String(plan || 'unknown').trim().toLowerCase();
    let productName = 'EstateOS™ Partner';
    let productDesc = 'Pakiet biura nieruchomości — CRM, pula kredytów publikacji i Concierge.';
    let unitAmount = 149900;
    const metadata: Record<string, string> = { plan_type: normalizedPlan };
    if (offerPayload) {
      metadata.offer_payload = JSON.stringify(offerPayload);
    }

    if (normalizedPlan === 'investor') {
      productName = 'EstateOS Investor PRO';
      productDesc =
        '5 kredytów publikacji (30 dni każdy), wczesny podgląd nowych ofert, Radar sprzedawcy bez 24-godzinnego oczekiwania. Kolejne publikacje — Pakiet +.';
      unitAmount = 24900;
    } else if (normalizedPlan === 'renewal') {
      productName = 'Odnowienie Oferty (30 Dni)';
      productDesc = 'Przedłużenie ważności Twojej oferty o kolejne 30 dni z natychmiastowym efektem.';
      unitAmount = PUBLICATION_RENEWAL_STRIPE_AMOUNT;
      if (offerId) {
        metadata.offer_id_to_renew = String(offerId);
      }
    } else if (normalizedPlan === 'pakiet_plus') {
      productName = 'Pakiet Plus (1 publikacja / 30 dni)';
      productDesc =
        'Jeden kredyt publikacji na 30 dni na szerokim rynku. Nie jest to abonament ani slot — zużywasz kredyt przy wystawieniu lub odnowieniu.';
      unitAmount = PAKIET_PLUS_STRIPE_AMOUNT;
    } else if (isStripePartnerPlan(normalizedPlan)) {
      if (!userId) {
        return NextResponse.json({ error: 'Zaloguj się jako administrator biura.' }, { status: 401 });
      }
      try {
        await assertPartnerCheckoutAllowed(userId);
      } catch (e: unknown) {
        const code = e instanceof Error ? e.message : 'PARTNER_CHECKOUT_DENIED';
        if (code === 'PARTNER_REQUIRES_AGENCY_ACCOUNT') {
          return NextResponse.json(
            { error: 'Najpierw załóż biuro na stronie Dla agencji, potem aktywuj pakiet Partner.' },
            { status: 403 },
          );
        }
        if (code === 'PARTNER_REQUIRES_COMPANY_ADMIN') {
          return NextResponse.json(
            { error: 'Pakiet Partner może aktywować tylko administrator biura.' },
            { status: 403 },
          );
        }
        return NextResponse.json({ error: 'Brak uprawnień do zakupu pakietu Partner.' }, { status: 403 });
      }

      const partnerPlan = getPartnerPlanByStripePlan(normalizedPlan);
      if (!partnerPlan) {
        return NextResponse.json({ error: 'Nieznany plan Partner.' }, { status: 400 });
      }
      const copy = partnerCheckoutCopy(partnerPlan);
      productName = copy.name;
      productDesc = copy.description;
      unitAmount = partnerStripeAmountGrosze(partnerPlan);
    }

    const successUrl = buildSuccessUrl(finalReturnUrl, {
      payment_success: 'true',
      plan_activated: normalizedPlan,
      renewalOfferId: normalizedPlan === 'renewal' && offerId ? String(offerId) : '',
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'blik'],
      line_items: [
        {
          price_data: {
            currency: 'pln',
            product_data: { name: productName, description: productDesc },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata,
      customer_email: customerEmail,
      success_url: successUrl,
      cancel_url: finalCancelUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Wewnętrzny błąd Stripe';
    console.error('Krytyczny błąd kasy Stripe:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
