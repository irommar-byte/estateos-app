import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { returnUrl, cancelUrl, plan, offerPayload, offerId } = body;

    // Pobieramy poprawne linki z Frontendu, by Stripe się nie wysypał
    const origin = req.headers.get('origin') || 'https://estateos.pl';
    const finalReturnUrl = returnUrl || `${origin}/moje-konto/crm`;
    const finalCancelUrl = cancelUrl || `${origin}/dodaj-oferte`;

    let productName = 'EstateOS Agencja PRO';
    let productDesc = 'Nielimitowane ogłoszenia, Import XML, Zlecenia Concierge i Radar Inwestorski.';
    let unitAmount = 414900;
    let metadata: any = { plan_type: plan || 'unknown' };
    if (offerPayload) {
      metadata.offer_payload = JSON.stringify(offerPayload);
    }

    if (plan === 'investor') {
      productName = 'EstateOS Investor PRO';
      productDesc = 'Natychmiastowy Radar (0 opóźnienia), 5 aktywnych ogłoszeń, dostęp Off-Market.';
      unitAmount = 14900;
    } else if (plan === 'renewal') {
      productName = 'Odnowienie Oferty (30 Dni)';
      productDesc = 'Przedłużenie ważności Twojej oferty o kolejne 30 dni z natychmiastowym efektem.';
      unitAmount = 2400; // 24.00 PLN
      if (offerId) {
          metadata.offer_id_to_renew = String(offerId);
      }
    } else if (plan === 'pakiet_plus') {
      productName = 'Pakiet + (1 Ogłoszenie / 30 Dni)';
      productDesc = 'Wykupienie 1 slotu ogłoszeniowego ważnego przez równe 30 dni.';
      unitAmount = 2999; // 29.99 PLN

    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'blik'],
      line_items: [{
        price_data: {
          currency: 'pln',
          product_data: { name: productName, description: productDesc },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      metadata: metadata,
      success_url: `${finalReturnUrl}?payment_success=true&plan_activated=${plan}`,
      cancel_url: finalCancelUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch(e: any) { 
    console.error("Krytyczny błąd kasy Stripe:", e);
    // Zwracamy KONKRETNY BŁĄD, żeby można było go przeczytać na białym oknie!
    return NextResponse.json({ error: e.message || 'Wewnętrzny błąd Stripe' }, { status: 500 }); 
  }
}
