import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';
import { notificationService } from '@/lib/services/notification.service';

export const dynamic = 'force-dynamic';
const EVENT_PREFIX = '[[DEAL_EVENT]]';

function buildEventContent(payload: Record<string, unknown>) {
  return `${EVENT_PREFIX}${JSON.stringify(payload)}`;
}

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

    const buyerId = Number(dbUserId);
    const parsedOfferId = Number(offerId);
    if (!buyerId || Number.isNaN(parsedOfferId)) {
      return NextResponse.json({ error: 'Nieprawidłowe dane użytkownika/oferty' }, { status: 400 });
    }

    // Zabezpieczenie przed błędem 500 (Invalid Date)
    const parsedDate = new Date(proposedDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Nieprawidłowy format daty.' }, { status: 400 });
    }

    const offer = await prisma.offer.findUnique({ where: { id: parsedOfferId }, select: { userId: true } });
    if (!offer) return NextResponse.json({ error: 'Nie znaleziono oferty' }, { status: 404 });
    const resolvedSellerId = Number(sellerId) || offer.userId;

    const deal = await prisma.deal.upsert({
      where: { offerId_buyerId: { offerId: parsedOfferId, buyerId } },
      create: { offerId: parsedOfferId, buyerId, sellerId: resolvedSellerId, status: 'NEGOTIATION' },
      update: { status: 'NEGOTIATION', isActive: true, updatedAt: new Date() },
    });

    const existingPending = await prisma.appointment.findFirst({
      where: { dealId: deal.id, proposedById: buyerId, status: 'PENDING' },
    });
    if (existingPending) {
      return NextResponse.json({ error: 'Masz już aktywne zapytanie do tej nieruchomości.' }, { status: 400 });
    }

    const appointment = await prisma.appointment.create({
      data: {
        dealId: deal.id,
        proposedById: buyerId,
        proposedDate: parsedDate,
        message: message ? String(message) : null,
      }
    });
    
    // Canonical DEAL_EVENT (parity app/web)
    try {
        await prisma.dealMessage.create({
            data: {
                dealId: deal.id,
                senderId: buyerId,
                content: buildEventContent({
                  entity: 'APPOINTMENT',
                  action: 'PROPOSED',
                  status: 'PENDING',
                  appointmentId: appointment.id,
                  proposedDate: parsedDate.toISOString(),
                  note: message ? String(message).trim().slice(0, 500) : null,
                  message: message ? String(message).trim().slice(0, 500) : null,
                  createdAt: appointment.createdAt.toISOString(),
                }),
            }
        });
    } catch(e) { console.log('DealMessage err', e); }
    

    await prisma.notification.create({
      data: {
        userId: resolvedSellerId,
        title: 'Nowe zapytanie z Lejka!',
        body: 'Klient chce obejrzeć Twoją nieruchomość.',
        type: 'APPOINTMENT',
        targetType: 'DEAL',
        targetId: String(deal.id),
      }
    });

    try {
      await notificationService.sendPushToUser(resolvedSellerId, {
        title: 'Nowa propozycja terminu',
        body: `${parsedDate.toLocaleDateString('pl-PL')} ${parsedDate.toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}`,
        data: {
          target: 'dealroom',
          notificationType: 'dealroom_chat',
          targetType: 'DEAL',
          dealId: deal.id,
          offerId: parsedOfferId,
          deeplink: `estateos://dealroom/${deal.id}`,
          screen: 'DealroomChat',
          route: 'DealroomChat',
          entity: 'dealroom',
        },
      });
    } catch (pushError) {
      console.warn('[APPOINTMENT PROPOSE PUSH WARN]', pushError);
    }

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

    const seller = await prisma.user.findUnique({ where: { id: resolvedSellerId }, select: { email: true } });
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
