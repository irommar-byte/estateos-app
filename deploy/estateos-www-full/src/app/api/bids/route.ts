import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';
import {
  assertContactVerified,
  BUYER_CONTACT_REQUIREMENTS,
  contactVerificationJson,
  loadUserForContactVerification,
} from '@/lib/contactVerification';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { offerId, amount, financing } = body;

    const buyerId = await resolveWebUserId(req);
    if (!buyerId) return NextResponse.json({ error: 'Zaloguj się, aby złożyć ofertę' }, { status: 401 });

    const buyer = await loadUserForContactVerification(buyerId);
    const buyerGate = assertContactVerified(buyer, BUYER_CONTACT_REQUIREMENTS);
    if (!buyerGate.ok) return contactVerificationJson(buyerGate);

    const offer = await prisma.offer.findUnique({ where: { id: Number(offerId) } });
    if (!offer) return NextResponse.json({ error: 'Brak oferty' }, { status: 404 });

    const deal = await prisma.deal.upsert({
      where: { offerId_buyerId: { offerId: Number(offerId), buyerId } },
      create: { offerId: Number(offerId), buyerId, sellerId: offer.userId, status: 'NEGOTIATION' },
      update: {},
    });

    const { executeDealAction } = await import('@/app/api/mobile/v1/deals/[id]/actions/route');
    const actionRes = await executeDealAction(buyerId, deal.id, {
      type: 'BID_PROPOSE',
      amount: Number(amount),
      financing,
    });
    if (actionRes.status >= 400) return actionRes;

    const actionJson = (await actionRes.clone().json().catch(() => ({}))) as {
      bidId?: number;
    };

    const safeHost = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST || '';
    const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT) || 587;
    const safeUser = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER || '';
    const safePass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD || '';

    const seller = await prisma.user.findUnique({
      where: { id: Number(offer.userId) },
      select: { email: true },
    });
    if (seller?.email && safeHost) {
      try {
        const transporter = nodemailer.createTransport({
          host: safeHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: safeUser, pass: safePass },
          tls: { rejectUnauthorized: false },
        });
        await transporter.sendMail({
          from: '"EstateOS" <powiadomienia@estateos.pl>',
          to: seller.email,
          subject: 'Nowa oferta zakupu nieruchomości',
          html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #050505; color: #ffffff; padding: 40px; border-radius: 20px; border: 1px solid #111;">
            <h2 style="color: #10b981; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px; font-size: 18px;">Nowa oferta zakupu</h2>
            <p style="color: #ccc; line-height: 1.6;">Kupiec złożył oficjalną propozycję finansową dla Twojej nieruchomości.</p>
            <div style="background-color: #111; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #222;">
              <p style="margin: 0; color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">Proponowana kwota</p>
              <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: 900; color: #fff;">${Number(amount).toLocaleString('pl-PL')} PLN</p>
              <p style="margin: 15px 0 0 0; color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">Źródło finansowania</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #10b981;">${financing === 'CASH' ? 'Gotówka' : 'Kredyt bankowy'}</p>
            </div>
            <a href="https://estateos.pl/moje-konto/crm" style="display: inline-block; background-color: #10b981; color: #000; padding: 15px 30px; border-radius: 30px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; margin-top: 20px;">Sprawdź ofertę w CRM</a>
          </div>`,
        });
      } catch (err) {
        console.error('Błąd maila (Bids):', err);
      }
    }

    return NextResponse.json({
      success: true,
      bid: { id: actionJson.bidId || null, dealId: deal.id },
      dealId: deal.id,
    });
  } catch (e) {
    console.error('[bids]', e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
