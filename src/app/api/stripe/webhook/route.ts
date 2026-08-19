import { radarService } from '@/lib/services/radar.service';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import type { PropertyType, TransactionType } from '@prisma/client';
import { buildInvestorProGrantData, isStripeInvestorProPlan } from '@/lib/investorProGrant';
import { grantPlusCreditFromStripeCheckout } from '@/lib/stripePublication';
import { activePublicationOfferIds } from '@/lib/offerPublication';
import {
  grantPartnerPlanFromStripeCheckout,
  grantPartnerPlanFromStripeInvoice,
  grantPartnerPlanFromStripeSubscription,
  isStripePartnerPlan,
} from '@/lib/partnerStripeGrant';

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
      const metadataUserId = Number(session.metadata?.user_id || 0);

      if (customerEmail) {

        if (session.mode === 'subscription' && isStripePartnerPlan(rawPlanType)) {
          const user = metadataUserId
            ? await prisma.user.findUnique({ where: { id: metadataUserId }, select: { id: true, email: true } })
            : await prisma.user.findUnique({ where: { email: customerEmail }, select: { id: true, email: true } });
          const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
          if (user?.id && subscriptionId) {
            const isTrial = session.metadata?.partner_trial === 'true';
            const grant = await grantPartnerPlanFromStripeSubscription({
              userId: Number(user.id),
              checkoutSessionId,
              subscriptionId,
              stripePlanType: rawPlanType,
              isTrial,
            });
            console.log(
              `[stripe:webhook] partner_subscription email=${customerEmail} session=${checkoutSessionId} sub=${subscriptionId} trial=${isTrial} granted=${grant.granted}`,
            );
          }
        } else if (rawPlanType === 'renewal') {
          console.log(`[stripe:webhook] renewal_completed email=${customerEmail} session=${checkoutSessionId} offer=${offerIdToRenew || 'missing'}`);
        } else if (rawPlanType === 'pakiet_plus') {
          const user = await prisma.user.findUnique({
            where: { email: customerEmail },
            select: { id: true },
          });
          if (!user?.id) {
            console.warn(`[stripe:webhook] pakiet_plus user not found email=${customerEmail} session=${checkoutSessionId}`);
          } else {
            await grantPlusCreditFromStripeCheckout({
              userId: Number(user.id),
              checkoutSessionId,
            });
            console.log(`[stripe:webhook] pakiet_plus credit granted email=${customerEmail} session=${checkoutSessionId}`);
          }
        } else if (isStripePartnerPlan(rawPlanType)) {
          const user = await prisma.user.findUnique({
            where: { email: customerEmail },
            select: { id: true },
          });
          if (!user?.id) {
            console.warn(
              `[stripe:webhook] partner_plan user not found email=${customerEmail} session=${checkoutSessionId}`,
            );
          } else {
            const grant = await grantPartnerPlanFromStripeCheckout({
              userId: Number(user.id),
              checkoutSessionId,
              stripePlanType: rawPlanType,
            });
            console.log(
              `[stripe:webhook] partner_plan email=${customerEmail} session=${checkoutSessionId} plan=${rawPlanType} granted=${grant.granted} credits=${grant.creditsAdded} company=${grant.companyId}`,
            );
          }
        } else if (isStripeInvestorProPlan(rawPlanType)) {
          const grant = buildInvestorProGrantData();
          await prisma.user.updateMany({
            where: { email: customerEmail },
            data: grant,
          });
          console.log(
            `[stripe:webhook] investor_pro_granted email=${customerEmail} session=${checkoutSessionId} until=${grant.proExpiresAt.toISOString()}`
          );
        } else if (rawPlanType === 'market_report') {
          const user = metadataUserId
            ? await prisma.user.findUnique({ where: { id: metadataUserId }, select: { id: true, email: true } })
            : await prisma.user.findUnique({ where: { email: customerEmail }, select: { id: true, email: true } });
          if (!user?.id) {
            console.warn(`[stripe:webhook] market_report user not found email=${customerEmail} session=${checkoutSessionId}`);
          } else {
            const { grantMarketReportCredits } = await import('@/lib/market/access');
            const { ensureMarketTables } = await import('@/lib/market/ensureMarketTables');
            await ensureMarketTables();
            await grantMarketReportCredits(Number(user.id), 1);
            const draftId = Number(session.metadata?.market_draft_id || 0);
            if (Number.isFinite(draftId) && draftId > 0) {
              const draft = await prisma.marketValuationDraft.findUnique({ where: { id: draftId } });
              if (draft && !draft.consumedAt) {
                try {
                  const { valueProperty } = await import('@/lib/market/compsEngine');
                  const { deliverMarketReport } = await import('@/lib/market/deliverReport');
                  const { consumeMarketReportCredit } = await import('@/lib/market/access');
                  const subject = JSON.parse(draft.subjectJson);
                  const valued = await valueProperty(subject, draft.listingPrice);
                  if (valued.ok) {
                    await consumeMarketReportCredit(Number(user.id));
                    await deliverMarketReport({
                      userId: Number(user.id),
                      email: customerEmail,
                      purpose: 'consumer',
                      creditUsed: true,
                      subject,
                      result: valued,
                    });
                    await prisma.marketValuationDraft.update({
                      where: { id: draft.id },
                      data: { consumedAt: new Date() },
                    });
                  }
                } catch (err) {
                  console.error('[stripe:webhook] market_report deliver failed', err);
                }
              }
            }
            console.log(`[stripe:webhook] market_report credit granted email=${customerEmail} session=${checkoutSessionId}`);
          }
        } else {
          console.warn(
            `[stripe:webhook] unknown_plan_type plan=${rawPlanType} email=${customerEmail} session=${checkoutSessionId}`
          );
        }


        if (rawPlanType === 'renewal' && offerIdToRenew) {
          const numericOfferId = Number(offerIdToRenew);
          if (!Number.isFinite(numericOfferId) || numericOfferId <= 0) {
            console.error(`[stripe:webhook] invalid renewal offer id: ${offerIdToRenew}`);
            return NextResponse.json({ error: 'Nieprawidłowe offerId do odnowienia' }, { status: 400 });
          }

          const existing = await prisma.offer.findUnique({
            where: { id: numericOfferId },
            select: { id: true, status: true, expiresAt: true },
          });
          if (!existing) {
            console.error(`[stripe:webhook] renewal update missed offerId=${numericOfferId} session=${checkoutSessionId}`);
            return NextResponse.json({ error: 'Nie udało się aktywować odnowionej oferty' }, { status: 404 });
          }

          const pubIds = await activePublicationOfferIds([numericOfferId]);
          if (!pubIds.has(numericOfferId)) {
            console.warn(
              `[stripe:webhook] renewal skipped — no active publication offerId=${numericOfferId} session=${checkoutSessionId}`,
            );
            return NextResponse.json({ received: true });
          }

          const newExpiresAt = new Date();
          newExpiresAt.setDate(newExpiresAt.getDate() + 30);

          const updateResult = await prisma.offer.updateMany({
            where: { id: numericOfferId, status: 'ACTIVE' },
            data: { expiresAt: newExpiresAt },
          });

          if (updateResult.count === 0) {
            console.error(`[stripe:webhook] renewal update missed offerId=${numericOfferId} session=${checkoutSessionId}`);
            return NextResponse.json({ error: 'Nie udało się aktywować odnowionej oferty' }, { status: 404 });
          }
          console.log(`[stripe:webhook] renewal activated offerId=${numericOfferId} session=${checkoutSessionId}`);
        }
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const rawSubscription = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null })
        .subscription;
      const subscriptionId =
        typeof rawSubscription === 'string' ? rawSubscription : rawSubscription?.id;
      const amountPaid = Number(invoice.amount_paid || 0);
      const billingReason = String(invoice.billing_reason || '');

      if (subscriptionId && amountPaid > 0 && billingReason !== 'manual') {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const rawPlanType = String(sub.metadata?.plan_type || '').trim().toLowerCase();
        const userId = Number(sub.metadata?.user_id || 0);

        if (isStripePartnerPlan(rawPlanType) && userId) {
          const grant = await grantPartnerPlanFromStripeInvoice({
            userId,
            invoiceId: invoice.id,
            subscriptionId,
            stripePlanType: rawPlanType,
          });
          console.log(
            `[stripe:webhook] partner_invoice user=${userId} invoice=${invoice.id} sub=${subscriptionId} granted=${grant.granted} credits=${grant.creditsAdded}`,
          );
        }
      }
    }

    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
