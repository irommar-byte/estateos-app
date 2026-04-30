import { radarService } from '@/lib/services/radar.service';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import type { PropertyType, TransactionType } from '@prisma/client';

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
      const rawPlanType = session.metadata?.plan_type || '';
      const offerIdToRenew = session.metadata?.offer_id_to_renew;

      if (rawPlanType === 'pakiet_plus' && session.metadata?.offer_payload) {
        try {
          const payload = JSON.parse(session.metadata.offer_payload);

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          const user = customerEmail ? await prisma.user.findUnique({ where: { email: customerEmail } }) : null;

          if (user) {
            const p = payload as Record<string, unknown>;
            const price = Number.parseFloat(String(p.price ?? '0')) || 0;
            const area = Number.parseFloat(String(p.area ?? '0')) || 0;
            const roomsRaw = p.rooms;
            const floorRaw = p.floor;

            await prisma.offer.create({
              data: {
                userId: user.id,
                title: String(p.title ?? 'Nowa oferta'),
                description: p.description ? String(p.description) : '',
                propertyType: coercePropertyType(p.propertyType),
                district: String(p.district || 'OTHER'),
                price,
                area,
                city: String(p.city || 'Warszawa'),
                street: typeof p.address === 'string' && p.address.includes(',') ? String(p.address).split(',')[0]?.trim() || null : (p.street ? String(p.street) : null),
                images: coerceImagesPayload(p),
                floorPlanUrl: p.floorPlanUrl ? String(p.floorPlanUrl) : p.floorPlan ? String(p.floorPlan) : null,
                status: 'ACTIVE',
                lat: Number.parseFloat(String(p.lat)) || 52.2297,
                lng: Number.parseFloat(String(p.lng)) || 21.0122,
                rooms:
                  roomsRaw !== undefined && roomsRaw !== null && String(roomsRaw).trim() !== ''
                    ? Number.parseInt(String(roomsRaw), 10)
                    : null,
                floor:
                  floorRaw !== undefined && floorRaw !== null && String(floorRaw).trim() !== ''
                    ? Number.parseInt(String(floorRaw), 10)
                    : null,
                yearBuilt:
                  p.buildYear || p.year
                    ? (() => {
                        const n = Number.parseInt(String(p.buildYear ?? p.year), 10);
                        return Number.isFinite(n) ? n : null;
                      })()
                    : null,
                deposit:
                  p.deposit != null && String(p.deposit).trim() !== ''
                    ? Number.parseFloat(String(p.deposit))
                    : null,
                adminFee:
                  p.rentAdminFee != null && String(p.rentAdminFee).trim() !== ''
                    ? Number.parseFloat(String(p.rentAdminFee))
                    : null,
                transactionType: coerceTransactionType(p.transactionType),
                expiresAt,
              },
            });
          }
        } catch (e) {
          console.error("❌ Błąd tworzenia oferty (pakiet_plus):", e);
        }
      }


      if (customerEmail) {

        if (rawPlanType === 'renewal') {
          console.log(`🛒 Pakiet+: ${customerEmail}`);
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


        if (rawPlanType === 'renewal' && offerIdToRenew) {
          const newExpiresAt = new Date();
          newExpiresAt.setDate(newExpiresAt.getDate() + 30);

          await prisma.offer.updateMany({
            where: { id: Number(offerIdToRenew) },
            data: {
              status: 'ACTIVE',
              expiresAt: newExpiresAt
            }
          });
        }
      }
    }

    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
