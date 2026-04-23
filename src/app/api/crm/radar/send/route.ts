import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { offerId, buyerIds } = await req.json();
    
    // 1. Weryfikacja Autoryzacji i statusu PRO (Bezpieczeństwo)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    
    let sessionData: any = {};
    try { sessionData = decryptSession(sessionCookie.value); } catch(e) {}
    const email = sessionData.email || sessionCookie.value;
    const user = await prisma.user.findUnique({ where: { email: String(email) } });
    
    if (!user || !user.isPro) {
      return NextResponse.json({ error: 'Funkcja dostępna tylko dla użytkowników PRO' }, { status: 403 });
    }

    const offer = await prisma.offer.findUnique({ where: { id: Number(offerId) } });
    if (!offer) return NextResponse.json({ error: 'Nie znaleziono oferty' }, { status: 404 });

    // 2. Pobieramy kupców - KONWERSJA ID NA NUMBER (Int)
    const numericBuyerIds = buyerIds.map((id: any) => Number(id));
    const buyers = await prisma.user.findMany({
      where: { id: { in: numericBuyerIds } },
      select: { id: true, email: true, name: true }
    });

    // 3. Konfiguracja Maila
    const smtpPort = Number(process.env.EMAIL_PORT) || 587;
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      tls: { rejectUnauthorized: false }
    });

    // 4. Masowa wysyłka i powiadomienia
    for (const buyer of buyers) {
        // Powiadomienie w systemie (Konwersja id na String dla tabeli Notification)
        await prisma.notification.create({
          data: {
            userId: Number(buyer.id),
            title: "🔥 Gorąca Oferta z Radaru!",
            message: `Znaleźliśmy nieruchomość "${offer.title}", która pasuje do Twoich parametrów.`,
            type: "SYSTEM",
            link: `/oferta/${offerId}`
          }
        });

        // Email
        if (buyer.email) {
           await transporter.sendMail({
             from: '"EstateOS" <powiadomienia@estateos.pl>',
             to: buyer.email,
             subject: `🔥 Gorąca Oferta z Radaru: ${offer.title}`,
             html: `<div style="background:#050505;color:#fff;padding:20px;"><h2>Nowa oferta dla Ciebie!</h2><p>${offer.title}</p><a href="https://estateos.pl/oferta/${offer.id}">Sprawdź teraz</a></div>`
           }).catch(err => console.error("Błąd maila:", err));
        }
    }
    
    return NextResponse.json({ success: true });
  } catch(e: any) {
    console.error("Błąd wysyłki Radaru:", e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
