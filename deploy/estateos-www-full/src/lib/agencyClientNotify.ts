import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { resolveSellerPersonName } from '@/lib/sellerDisplay';

function buildTransporter() {
  const smtpPort = Number(process.env.EMAIL_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls: { rejectUnauthorized: false },
  });
}

export async function notifyAgencyClientAboutOffer(params: {
  clientId: number;
  offerId: number;
  agencyUserId: number;
  channel: 'email' | 'manual';
  customMessage?: string;
}) {
  const [client, offer, agent] = await Promise.all([
    prisma.agencyClient.findFirst({
      where: { id: params.clientId, agencyUserId: params.agencyUserId },
    }),
    prisma.offer.findUnique({
      where: { id: params.offerId },
      select: { id: true, title: true, city: true, district: true, price: true, priceCurrency: true },
    }),
    prisma.user.findUnique({
      where: { id: params.agencyUserId },
      select: { name: true, companyName: true, email: true, phone: true },
    }),
  ]);

  if (!client || !offer || !agent) {
    throw new Error('Nie znaleziono klienta, oferty lub agenta.');
  }

  const agentName = resolveSellerPersonName(agent) || agent.name || 'Twój agent';
  const agencyName = agent.companyName?.trim() || 'EstateOS';
  const clientName = `${client.firstName}`.trim() || 'Kliencie';
  const offerUrl = `https://estateos.pl/oferta/${offer.id}`;
  const priceLabel = `${Math.round(offer.price).toLocaleString('pl-PL')} ${offer.priceCurrency || 'PLN'}`;
  const location = [offer.city, offer.district].filter(Boolean).join(', ');

  const intro =
    params.customMessage?.trim() ||
    `Znalazłem ofertę, która może Cię zainteresować — ${offer.title} (${location}, ${priceLabel}).`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;padding:32px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;padding:32px;border:1px solid #e5e7eb;">
        <p style="font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#059669;margin:0 0 12px;">${agencyName}</p>
        <h1 style="font-size:22px;margin:0 0 8px;color:#111;">Witaj ${clientName},</h1>
        <p style="color:#374151;line-height:1.6;margin:0 0 20px;">${intro}</p>
        <div style="background:#f9fafb;border-radius:16px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 6px;font-weight:600;color:#111;">${offer.title}</p>
          <p style="margin:0;color:#6b7280;font-size:14px;">${location} · ${priceLabel}</p>
        </div>
        <a href="${offerUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:13px;">Zobacz ofertę</a>
        <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">Pozdrawiam,<br><strong>${agentName}</strong><br>${agencyName}</p>
      </div>
    </div>`;

  let emailSent = false;
  if (params.channel === 'email' && client.email) {
    const transporter = buildTransporter();
    await transporter.sendMail({
      from: `"${agencyName}" <powiadomienia@estateos.pl>`,
      to: client.email,
      replyTo: agent.email || undefined,
      subject: `${agentName}: nowa propozycja — ${offer.title}`,
      html,
    });
    emailSent = true;
  }

  await prisma.agencyClientMatch.upsert({
    where: { clientId_offerId: { clientId: client.id, offerId: offer.id } },
    create: { clientId: client.id, offerId: offer.id, score: 0, notifiedAt: new Date() },
    update: { notifiedAt: new Date() },
  });

  await prisma.agencyClientActivity.create({
    data: {
      clientId: client.id,
      agencyUserId: params.agencyUserId,
      offerId: offer.id,
      kind: emailSent ? 'CLIENT_NOTIFIED' : 'OFFER_SHARED',
      title: emailSent ? 'Wysłano ofertę e-mailem' : 'Zapisano udostępnienie oferty',
      body: intro,
      metadata: { channel: params.channel, emailSent },
    },
  });

  return { emailSent, offerUrl };
}
