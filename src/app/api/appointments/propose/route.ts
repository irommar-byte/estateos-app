import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { offerId, sellerId, proposedDate, message } = await req.json();

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Brak sesji' }, { status: 401 });

    let sessionData: any = {};
    try { sessionData = decryptSession(sessionCookie.value); } catch(e) {}
    
    const currentUserEmail = sessionData.email || sessionCookie.value;
    let dbUserId = sessionData.id;

    if (currentUserEmail && String(currentUserEmail).includes('@')) {
       const u = await prisma.user.findFirst({ where: { email: String(currentUserEmail) } });
       if (u) dbUserId = u.id;
    }

    const finalBuyerId = String(dbUserId || currentUserEmail);

    // KULOODPORNA BLOKADA: Sprawdzamy czy klient już nie zapytał o tę ofertę
    const existing = await prisma.appointment.findFirst({
      where: { offerId: parseInt(offerId, 10), buyerId: parseInt(String(finalBuyerId), 10) }
    });

    if (existing) {
      return NextResponse.json({ error: 'Masz już aktywne zapytanie do tej nieruchomości.' }, { status: 400 });
    }

    // Zabezpieczenie przed błędem 500 (Invalid Date)
    const parsedDate = new Date(proposedDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Nieprawidłowy format daty.' }, { status: 400 });
    }

    const appointment = await prisma.appointment.create({
      data: {
        offerId: parseInt(offerId, 10),
        buyerId: parseInt(String(finalBuyerId), 10),
        sellerId: parseInt(String(sellerId), 10),
        proposedDate: parsedDate,
        message: message ? String(message) : null,
        status: 'PROPOSED'
      }
    });
    
    // --- INIEKCJA: Wiadomość Systemowa do Deal Roomu ---
    try {
        await prisma.dealMessage.create({
            data: {
                dealId: `${offerId}_${finalBuyerId}`,
                senderId: 'SYSTEM',
                senderName: 'EstateOS AI',
                text: `📅 Zaproponowano termin spotkania: ${parsedDate.toLocaleDateString('pl-PL')} o ${parsedDate.toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}`
            }
        });
    } catch(e) { console.log('DealMessage err', e); }
    

    await prisma.notification.create({
      data: {
        userId: Number(sellerId),
        title: 'Nowe zapytanie z Lejka!',
        message: 'Klient chce obejrzeć Twoją nieruchomość.',
        type: 'APPOINTMENT',
        link: `/moje-konto/crm?appId=${appointment.id}`
      }
    });

    // WYSYŁKA E-MAIL (Zgodna z istniejącym szablonem EstateOS)
    
    // Wymuszona konfiguracja Resend z pliku .env
    const safeHost = process.env.EMAIL_HOST || 'smtp.resend.com';
    const smtpPort = Number(process.env.EMAIL_PORT) || 465;
    const safeUser = process.env.EMAIL_USER || 'resend';
    const safePass = process.env.EMAIL_PASSWORD || process.env.RESEND_API_KEY || '';

    const transporter = nodemailer.createTransport({
      host: safeHost,
      port: smtpPort,
      secure: true, // Zawsze true dla portu 465
      auth: { user: safeUser, pass: safePass },
      tls: { rejectUnauthorized: false }
    });

    const seller = await prisma.user.findUnique({ where: { id: Number(sellerId) }, select: { email: true } });
    if (seller && seller.email) {
      try {
        await transporter.sendMail({
          from: '"EstateOS" <powiadomienia@estateos.pl>',
          to: seller.email,
          subject: "📅 Propozycja Prezentacji Nieruchomości",
          html: `<div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; background-color: #050505; color: #ffffff; padding: 40px; border-radius: 20px; border: 1px solid #111;">
            <h2 style="color: #10b981; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px; font-size: 18px;">Nowe Zapytanie o Prezentację</h2>
            <p style="color: #ccc; line-height: 1.6;">Potencjalny kupiec chce obejrzeć Twoją nieruchomość.</p>
            <div style="background-color: #111; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #222;">
              <p style="margin: 0; color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">Proponowany termin</p>
              <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #fff;">${parsedDate.toLocaleDateString('pl-PL')} o ${parsedDate.toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}</p>
              ${message ? `<p style="margin: 15px 0 0 0; color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">Wiadomość od klienta</p><p style="margin: 5px 0 0 0; font-style: italic; color: #ddd;">"${message}"</p>` : ''}
            </div>
            <a href="https://estateos.pl/moje-konto/crm" style="display: inline-block; background-color: #10b981; color: #000; padding: 15px 30px; border-radius: 30px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; margin-top: 20px;">Zarządzaj w CRM</a>
          </div>`
        });
      } catch(err) { console.error("Błąd maila (Appointments):", err); }
    }

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
