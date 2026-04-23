import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { offerId, amount, financing } = body;

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Zaloguj się, aby złożyć ofertę' }, { status: 401 });

    let sessionData: any = {};
    try { sessionData = decryptSession(sessionCookie.value); } catch(e) {}
    const currentUserEmail = sessionData.email || sessionCookie.value;
    let dbUserId = sessionData.id;

    if (currentUserEmail && String(currentUserEmail).includes('@')) {
       const u = await prisma.user.findFirst({ where: { email: String(currentUserEmail) } });
       if (u) dbUserId = u.id;
    }

    const offer = await prisma.offer.findUnique({ where: { id: Number(offerId) } });
    if (!offer) return NextResponse.json({ error: 'Brak oferty' }, { status: 404 });

    const bid = await prisma.bid.create({
      data: {
        offerId: parseInt(offerId, 10),
        buyerId: parseInt(String(dbUserId || currentUserEmail), 10),
        sellerId: parseInt(String(offer.userId || currentUserEmail), 10),
        amount: Number(amount),
        financing: financing,
        status: 'PENDING'
      }
    });
    
    // --- INIEKCJA: Wiadomość Systemowa do Deal Roomu ---
    try {
        await prisma.dealMessage.create({
            data: {
                dealId: `${offerId}_${dbUserId}`,
                senderId: 'SYSTEM',
                senderName: 'EstateOS AI',
                text: `💰 Złożono oficjalną ofertę zakupu na kwotę: ${Number(amount).toLocaleString('pl-PL')} PLN. Finansowanie: ${financing}`
            }
        });
    } catch(e) { console.log('DealMessage err', e); }
    

    // Powiadomienie dla Sprzedającego (Dzwoneczek)
    await prisma.notification.create({
      data: {
        userId: Number(offer.userId),
        title: '💎 Nowa Oferta Zakupu!',
        message: `Kupiec złożył oficjalną ofertę w kwocie ${Number(amount).toLocaleString('pl-PL')} PLN (${financing === 'CASH' ? 'Gotówka' : 'Kredyt Bankowy'}) za Twoją nieruchomość. Wejdź w Lejek CRM.`,
        type: 'BID',
        link: `/moje-konto/crm?tab=offers`
      }
    });

    // WYSYŁKA E-MAIL (Zgodna z istniejącym szablonem EstateOS)
    
    const safeHost = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST || '';
    const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT) || 587;
    const safeUser = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER || '';
    const safePass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD || '';

    const transporter = nodemailer.createTransport({
          host: safeHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: safeUser, pass: safePass },
          tls: { rejectUnauthorized: false }
        });

    const seller = await prisma.user.findUnique({ where: { id: Number(offer.userId) }, select: { email: true } });
    if (seller && seller.email) {
      try {
        await transporter.sendMail({
          from: '"EstateOS" <powiadomienia@estateos.pl>',
          to: seller.email,
          subject: "💎 Nowa Oferta Zakupu Nieruchomości",
          html: `<div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; background-color: #050505; color: #ffffff; padding: 40px; border-radius: 20px; border: 1px solid #111;">
            <h2 style="color: #10b981; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px; font-size: 18px;">Nowa Oferta Zakupu</h2>
            <p style="color: #ccc; line-height: 1.6;">Kupiec złożył oficjalną propozycję finansową dla Twojej nieruchomości.</p>
            <div style="background-color: #111; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #222;">
              <p style="margin: 0; color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">Proponowana kwota</p>
              <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: 900; color: #fff;">${Number(amount).toLocaleString('pl-PL')} PLN</p>
              <p style="margin: 15px 0 0 0; color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">Źródło finansowania</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #10b981;">${financing === 'CASH' ? 'Gotówka' : 'Kredyt Bankowy'}</p>
            </div>
            <a href="https://estateos.pl/moje-konto/crm" style="display: inline-block; background-color: #10b981; color: #000; padding: 15px 30px; border-radius: 30px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; margin-top: 20px;">Sprawdź Ofertę w CRM</a>
          </div>`
        });
      } catch(err) { console.error("Błąd maila (Bids):", err); }
    }

    return NextResponse.json({ success: true, bid });
  } catch(e) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
