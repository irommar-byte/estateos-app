import { radarService } from '@/lib/services/radar.service';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import type { PropertyType, TransactionType } from '@prisma/client';
import {
  activateOfferFromStripeRenewal,
  grantPlusCreditFromStripeCheckout,
} from '@/lib/stripePublication';

function coercePropertyType(raw: unknown): PropertyType {
  const s = String(raw || '').toLowerCase();
  if (s.includes('dom') || s.includes('house')) return 'HOUSE';
  if (s.includes('grunt') || s.includes('dział') || s.includes('plot')) return 'PLOT';
  if (s.includes('lokal') || s.includes('komercyj') || s.includes('commercial')) return 'COMMERCIAL';
  return 'FLAT';
}

function coerceTransactionType(raw: unknown): TransactionType {
  const s = String(raw || 'sale').toLowerCase();
  return s.includes('rent') || s.includes('wynaj') ? 'RENT' : 'SELL';
}

function coerceImagesPayload(payload: Record<string, unknown>): string | undefined {
  const raw = payload.images ?? payload.imageUrl;
  if (raw == null) return undefined;
  if (typeof raw === 'string') {
    try {
      JSON.parse(raw);
      return raw;
    } catch {
      return JSON.stringify([raw]);
    }
  }
  try {
    return JSON.stringify(raw);
  } catch {
    return undefined;
  }
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  return new Stripe(secretKey, { apiVersion: '2023-10-16' as any });
}

export async function POST(req: Request) {
  try {
    const stripe = getStripeClient();
    const payload = await req.text();
    const sig = req.headers.get('stripe-signature');

    // 🔒 TWARDY WARUNEK — MUSI BYĆ SECRET I PODPIS
    if (!process.env.STRIPE_WEBHOOK_SECRET || !sig) {
      return NextResponse.json({ error: 'Webhook nieautoryzowany' }, { status: 400 });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error('❌ Błąd sygnatury:', err.message);
      return NextResponse.json({ error: 'Nieprawidłowa sygnatura' }, { status: 400 });
    }

    // 🔥 reszta Twojej logiki BEZ ZMIAN
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerEmail = session.customer_details?.email;
      const rawPlanType = String(session.metadata?.plan_type || '').trim().toLowerCase();
      const offerIdToRenew = session.metadata?.offer_id_to_renew;
      const checkoutSessionId = session.id;

      if (customerEmail) {

        const dbUser = await prisma.user.findFirst({
          where: { email: customerEmail },
          select: { id: true },
        });

        if (rawPlanType === 'pakiet_plus' && dbUser?.id) {
          await grantPlusCreditFromStripeCheckout({
            userId: dbUser.id,
            checkoutSessionId,
          });
          console.log(`[stripe:webhook] pakiet_plus credit granted userId=${dbUser.id} session=${checkoutSessionId}`);
        } else if (rawPlanType === 'renewal') {
          console.log(`[stripe:webhook] renewal_completed email=${customerEmail} session=${checkoutSessionId} offer=${offerIdToRenew || 'missing'}`);
        } else {
          let validPlanType: 'PRO' | 'AGENCY' | 'NONE' = 'PRO';

          if (rawPlanType.toUpperCase() === 'AGENCY') {
            validPlanType = 'AGENCY';
          }

          const proExpiresAtDate = new Date();
          proExpiresAtDate.setDate(proExpiresAtDate.getDate() + 30);

          await prisma.user.updateMany({
            where: { email: customerEmail },
            data: {
              isPro: true,
              planType: validPlanType,
              proExpiresAt: proExpiresAtDate
            }
          });
        }


        if (rawPlanType === 'renewal' && offerIdToRenew && dbUser?.id) {
          const numericOfferId = Number(offerIdToRenew);
          if (!Number.isFinite(numericOfferId) || numericOfferId <= 0) {
            console.error(`[stripe:webhook] invalid renewal offer id: ${offerIdToRenew}`);
            return NextResponse.json({ error: 'Nieprawidłowe offerId do odnowienia' }, { status: 400 });
          }

          try {
            await activateOfferFromStripeRenewal({
              userId: dbUser.id,
              offerId: numericOfferId,
              checkoutSessionId,
            });
            console.log(`[stripe:webhook] renewal publication activated offerId=${numericOfferId} session=${checkoutSessionId}`);
          } catch (renewErr) {
            console.error(`[stripe:webhook] renewal activation failed offerId=${numericOfferId}`, renewErr);
            return NextResponse.json({ error: 'Nie udało się aktywować odnowionej oferty' }, { status: 500 });
          }
        }
      }
    }

    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
