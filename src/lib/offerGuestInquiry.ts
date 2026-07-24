import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail, isEmailDeliveryEnabled, buildOfferGuestInquiryEmail } from '@/lib/email/transactional';
import { notificationService } from '@/lib/services/notification.service';

const ONLINE_MS = 20 * 60 * 1000;

export function isSellerOnlineFromLastLogin(lastLoginAt: Date | string | null | undefined): boolean {
  if (!lastLoginAt) return false;
  const ts = new Date(lastLoginAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= ONLINE_MS;
}

export const OFFER_GUEST_QUESTION_KEYS = [
  'isAvailable',
  'viewingWhen',
  'priceNegotiable',
  'moreInfo',
] as const;

export type OfferGuestQuestionKey = (typeof OFFER_GUEST_QUESTION_KEYS)[number];

const QUESTION_LABELS_PL: Record<OfferGuestQuestionKey, string> = {
  isAvailable: 'Czy oferta jest nadal aktualna?',
  viewingWhen: 'Kiedy można obejrzeć nieruchomość?',
  priceNegotiable: 'Czy cena jest do negocjacji?',
  moreInfo: 'Proszę o dodatkowe informacje',
};

export function resolveGuestQuestionLabel(questionKey: string, customQuestion?: string): string {
  const key = String(questionKey || '').trim() as OfferGuestQuestionKey;
  if (key && QUESTION_LABELS_PL[key]) return QUESTION_LABELS_PL[key];
  const custom = String(customQuestion || '').trim();
  return custom || QUESTION_LABELS_PL.moreInfo;
}

function normalizePhone(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/[^\d+]/g, '')
    .slice(0, 24);
}

function isPlausiblePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

export async function submitOfferGuestInquiry(params: {
  offerId: number;
  questionKey: string;
  message: string;
  phone: string;
  guestName?: string;
}): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string }
> {
  const offerId = Number(params.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return { ok: false, status: 400, error: 'Nieprawidłowa oferta.' };
  }

  const phone = normalizePhone(params.phone);
  if (!isPlausiblePhone(phone)) {
    return { ok: false, status: 400, error: 'Podaj prawidłowy numer telefonu.' };
  }

  const message = String(params.message || '').trim();
  if (message.length < 8 || message.length > 1200) {
    return { ok: false, status: 400, error: 'Wiadomość powinna mieć od 8 do 1200 znaków.' };
  }

  const questionLabel = resolveGuestQuestionLabel(params.questionKey);
  const guestName = String(params.guestName || '').trim().slice(0, 80) || null;

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: {
      id: true,
      title: true,
      status: true,
      userId: true,
      city: true,
      pricePln: true,
      price: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!offer || String(offer.status || '').toUpperCase() !== 'ACTIVE') {
    return { ok: false, status: 404, error: 'Oferta jest niedostępna.' };
  }

  const seller = offer.user;
  if (!seller?.id || !seller.email) {
    return { ok: false, status: 400, error: 'Nie można wysłać zapytania do wystawcy.' };
  }

  const offerTitle = String(offer.title || `Oferta #${offerId}`).trim();
  const offerUrl = `${(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://estateos.pl').replace(/\/+$/, '')}/oferta/${offerId}`;
  const priceLabel =
    offer.pricePln != null && Number(offer.pricePln) > 0
      ? `${Math.round(Number(offer.pricePln)).toLocaleString('pl-PL')} zł`
      : offer.price != null
        ? String(offer.price)
        : '—';

  const emailHtml = buildOfferGuestInquiryEmail({
    sellerName: seller.name,
    offerTitle,
    offerId,
    offerUrl,
    city: offer.city,
    priceLabel,
    question: questionLabel,
    message,
    phone,
    guestName,
  });

  const emailSubject = `Zapytanie o ofertę #${offerId} — ${offerTitle.slice(0, 60)}`;

  let emailSent = false;
  if (isEmailDeliveryEnabled()) {
    emailSent = await sendTransactionalEmail({
      to: seller.email,
      subject: emailSubject,
      html: emailHtml,
    });
  }

  const notifTitle = 'Nowe zapytanie o ofertę';
  const notifBody = `${questionLabel} · Tel. ${phone}${guestName ? ` · ${guestName}` : ''}. Szczegóły także na e-mailu.`;
  const dayKey = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `guest-inquiry:${offerId}:${phone}:${dayKey}`;

  try {
    const notification = await prisma.notification.create({
      data: {
        userId: seller.id,
        title: notifTitle,
        body: notifBody,
        type: 'MESSAGE',
        targetType: 'OFFER',
        targetId: String(offerId),
        status: 'PENDING',
        idempotencyKey,
      },
    });

    try {
      await notificationService.sendPushToUser(seller.id, {
        title: notifTitle,
        body: notifBody,
        data: {
          type: 'OFFER_GUEST_INQUIRY',
          offerId: String(offerId),
          notificationId: notification.id,
        },
      });
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date() },
      }).catch(() => null);
    }
  } catch (error: any) {
    // Duplicate same-day inquiry from same phone — still OK if email went out.
    if (error?.code !== 'P2002') {
      console.error('[guest-inquiry] notification failed', error);
    }
  }

  if (!emailSent && !isEmailDeliveryEnabled()) {
    // Prefer success when notification was created; email may be disabled in some envs.
    return { ok: true };
  }

  if (!emailSent && isEmailDeliveryEnabled()) {
    // Notification still delivered — soft success with warning path handled by client as ok.
    console.warn('[guest-inquiry] email failed for offer', offerId);
  }

  return { ok: true };
}
