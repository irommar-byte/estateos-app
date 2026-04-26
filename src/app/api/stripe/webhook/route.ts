import { radarService } from '@/lib/services/radar.service';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

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
            await prisma.offer.create({
              data: {
                userId: user.id,
                title: payload.title,
                propertyType: payload.propertyType || "Mieszkanie",
                district: payload.district || "Śródmieście",
                price: String(payload.price || "0"),
                area: String(payload.area || "0"),
                description: payload.description || "",
                address: payload.address || "",
                imageUrl: payload.imageUrl || "",
                images: payload.images || "",
                contactName: payload.contactName || "",
                contactPhone: payload.contactPhone || "",
                status: "ACTIVE",
                lat: parseFloat(payload.lat) || 52.2297,
                lng: parseFloat(payload.lng) || 21.0122,
                advertiserType: payload.advertiserType || "private",
                rooms: String(payload.rooms || ""),
                floor: String(payload.floor || ""),
                year: String(payload.buildYear || ""),
                amenities: payload.amenities || "",
                floorPlan: payload.floorPlan || null,
                transactionType: payload.transactionType || "sale",
                rentAdminFee: payload.rentAdminFee || null,
                deposit: payload.deposit || null,
                rentMinPeriod: payload.rentMinPeriod || null,
                rentAvailableFrom: payload.rentAvailableFrom || null,
                rentType: payload.rentType || null,
                expiresAt
              }
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
