import bcrypt from 'bcrypt';
import { PlanType, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildWelcomeEmailHtml, buildWelcomeEmailSubject, sendTransactionalEmail } from '@/lib/email/transactional';
import { importOfferFromUrl, isSupportedImportOfferUrl } from '@/lib/otodomImport';
import { createOfferFromOtodomDraft, findExistingImportedOffer } from '@/lib/otodomImportCreate';
import { peekLastImageInfo } from '@/lib/otodomImportFloorPlan';
import { activateOfferPublication } from '@/lib/offerPublication';
import {
  buildPhoneLookupVariants,
  extractPhoneFromBody,
  normalizePhoneE164,
} from '@/lib/phoneE164';
import { MOBILE_USER_SELECT, shapeMobileUser } from '@/lib/mobileUserShape';
import { encryptSession } from '@/lib/sessionUtils';
import { verifyPortalOnboardingInvite } from '@/lib/portalOnboardingInvite';

const MAX_IMPORT_IMAGES = 12;

export type PortalListingPreview = {
  title: string;
  price: number | null;
  priceLabel: string;
  city: string;
  district: string;
  area: number | null;
  rooms: number | null;
  transactionType: 'RENT' | 'SALE';
  propertyType: string;
  imageUrl: string | null;
  imageCount: number;
  source: string;
  externalUrl: string;
};

function formatPriceLabel(price: number | null, transactionType: 'RENT' | 'SALE'): string {
  if (price == null || !Number.isFinite(price)) return 'Cena do uzgodnienia';
  const formatted = new Intl.NumberFormat('pl-PL').format(price);
  return transactionType === 'RENT' ? `${formatted} zł / mies.` : `${formatted} zł`;
}

export async function previewPortalListing(portalUrl: string): Promise<PortalListingPreview> {
  const url = String(portalUrl || '').trim();
  if (!isSupportedImportOfferUrl(url)) {
    throw new Error(
      'Obsługiwane są linki: OtoDom (/oferta/...), OLX (/d/oferta/...) lub Nieruchomosci-Online.',
    );
  }

  const draft = await importOfferFromUrl(url);
  const existing = await findExistingImportedOffer(draft);
  if (existing) {
    throw new Error(`Ta oferta jest już w EstateOS™ (oferta #${existing.id}).`);
  }

  return {
    title: draft.title,
    price: draft.price,
    priceLabel: formatPriceLabel(draft.price, draft.transactionType),
    city: draft.city,
    district: draft.district,
    area: draft.area,
    rooms: draft.rooms,
    transactionType: draft.transactionType,
    propertyType: draft.propertyType,
    imageUrl: draft.imageUrls[0] ?? null,
    imageCount: draft.imageCount,
    source: draft.source,
    externalUrl: draft.externalUrl,
  };
}

export type PortalOnboardingResult = {
  userId: number;
  offerId: number;
  publicUrl: string;
  profileUrl: string;
  editUrl: string;
  sessionToken: string;
  user: ReturnType<typeof shapeMobileUser>;
  imagesUploaded: number;
};

export async function registerAndImportPortalListing(params: {
  inviteToken: string;
  portalUrl: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  rightsConfirmed: boolean;
}): Promise<PortalOnboardingResult> {
  const invite = verifyPortalOnboardingInvite(params.inviteToken);
  if (!invite) {
    throw new Error('Link zaproszenia jest nieprawidłowy lub wygasł. Poproś EstateOS o nowy link.');
  }

  if (!params.rightsConfirmed) {
    throw new Error('Wymagane oświadczenie o prawach do publikacji danych i zdjęć z ogłoszenia.');
  }

  const portalUrl = String(params.portalUrl || '').trim();
  if (!isSupportedImportOfferUrl(portalUrl)) {
    throw new Error('Wklej poprawny link do ogłoszenia z OtoDom, OLX lub Nieruchomosci-Online.');
  }

  const cleanEmail = String(params.email || '').toLowerCase().trim();
  const password = String(params.password || '');
  const firstName = String(params.firstName || '').trim();
  const lastName = String(params.lastName || '').trim();
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Właściciel';

  if (!cleanEmail || !password) throw new Error('E-mail i hasło są wymagane.');
  if (password.length < 6) throw new Error('Hasło musi mieć min. 6 znaków.');
  if (!firstName || !lastName) throw new Error('Podaj imię i nazwisko.');

  const phoneE164 = normalizePhoneE164(extractPhoneFromBody({ phone: params.phone, contactPhone: params.phone }));
  if (!phoneE164) throw new Error('Numer telefonu jest wymagany.');

  const existingEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existingEmail) {
    throw new Error('Ten adres e-mail jest już zarejestrowany. Zaloguj się i dodaj ogłoszenie z poziomu konta.');
  }

  const phoneVariants = buildPhoneLookupVariants(phoneE164);
  const existingPhone = await prisma.user.findFirst({
    where: { OR: phoneVariants.map((variant) => ({ phone: variant })) },
  });
  if (existingPhone) {
    throw new Error('Ten numer telefonu jest już w użyciu.');
  }

  const draft = await importOfferFromUrl(portalUrl);
  const existingOffer = await findExistingImportedOffer(draft);
  if (existingOffer) {
    throw new Error(`Ta oferta jest już w EstateOS™ (oferta #${existingOffer.id}).`);
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: cleanEmail,
      password: hashed,
      name: displayName,
      phone: phoneE164,
      role: Role.USER,
      planType: PlanType.NONE,
    },
    select: MOBILE_USER_SELECT,
  });

  const floorPeek = peekLastImageInfo(draft);
  const floorPlanChoice =
    floorPeek.suggestedFloorPlanIndex != null
      ? { enabled: true, imageIndex: floorPeek.suggestedFloorPlanIndex }
      : { enabled: false, imageIndex: null as number | null };

  const created = await createOfferFromOtodomDraft(draft, user.id, undefined, {
    agentVoice: false,
    maxImportImages: MAX_IMPORT_IMAGES,
    floorPlanImageIndex: floorPlanChoice.enabled ? floorPlanChoice.imageIndex : null,
  });

  if (!created.ok) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
    throw new Error(created.message || 'Nie udało się utworzyć oferty z importu.');
  }

  try {
    await activateOfferPublication({
      userId: user.id,
      offerId: created.offerId,
      kind: 'PLUS_CREDIT',
      skipEntitlementConsume: true,
    });
  } catch (error) {
    await prisma.offer.delete({ where: { id: created.offerId } }).catch(() => null);
    await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
    throw error;
  }

  void sendTransactionalEmail({
    to: user.email,
    subject: buildWelcomeEmailSubject({ userName: user.name }),
    html: buildWelcomeEmailHtml({ userName: user.name }),
  });

  const sessionToken = encryptSession({ id: user.id, email: user.email, role: user.role || 'USER' });

  return {
    userId: user.id,
    offerId: created.offerId,
    publicUrl: created.publicUrl,
    profileUrl: `/profil/${user.id}`,
    editUrl: created.editUrl,
    sessionToken,
    user: shapeMobileUser(user),
    imagesUploaded: created.images.uploaded,
  };
}
