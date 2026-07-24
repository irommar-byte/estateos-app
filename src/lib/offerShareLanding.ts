import { prisma } from '@/lib/prisma';
import { formatOfferPropertyType } from '@/lib/offerDisplayLabels';
import { resolveOfferDetailAccess } from '@/lib/offerPublicAccess';
import { WEB_OFFER_PUBLIC_PRISMA_SELECT } from '@/lib/mobileOfferPrismaSelect';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { stripHtmlToPlain, stripInternalOfferDescriptionMarkers } from '@/lib/offerDescriptionHtml';
import { getUserDisplayAvatar } from '@/lib/agencyCompany';
import { resolvePresentingAgent } from '@/lib/offerPresentingAgent';
import {
  isAgentOrAgencySeller,
  resolveSellerDisplayName,
  resolveSellerPersonName,
  resolveServicingCompanyName,
} from '@/lib/sellerDisplay';
import { getBestUserAvatarUrl } from '@/lib/userAvatar';

export function resolvePublicAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://estateos.pl').replace(
    /\/+$/,
    '',
  );
}

export function absolutizeMediaUrl(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const origin = resolvePublicAppOrigin();
  return raw.startsWith('/') ? `${origin}${raw}` : `${origin}/${raw}`;
}

function parseImageList(images: unknown): string[] {
  if (Array.isArray(images)) {
    return images.map((x) => absolutizeMediaUrl(String(x))).filter(Boolean);
  }
  if (typeof images === 'string') {
    const trimmed = images.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map((x) => absolutizeMediaUrl(String(x))).filter(Boolean);
        }
      } catch {
        return [];
      }
    }
    const one = absolutizeMediaUrl(trimmed);
    return one ? [one] : [];
  }
  return [];
}

function formatPricePln(price: unknown, isRent: boolean): string {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return 'Cena na zapytanie';
  const formatted = Math.round(n).toLocaleString('pl-PL');
  return isRent ? `${formatted} zł / mc` : `${formatted} zł`;
}

export type OfferSharePublisher = {
  userId: number;
  displayName: string;
  personName: string | null;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  isAgent: boolean;
  isPresentingAgent: boolean;
  averageRating: number | null;
  reviewCount: number;
  profileHref: string;
};

export type OfferShareCard = {
  id: number;
  title: string;
  ogTitle: string;
  ogDescription: string;
  canonicalUrl: string;
  imageUrl: string;
  /** PNG 1200×630 pod Facebook / Messenger (nie WebP z galerii). */
  socialImageUrl: string;
  images: string[];
  priceLabel: string;
  isRent: boolean;
  locationLabel: string;
  summaryLine: string;
  propertyTypeLabel: string;
  transactionLabel: string;
  area: number | null;
  rooms: number | null;
  floor: number | string | null;
  description: string | null;
  publisher: OfferSharePublisher | null;
  fullOfferPath: string;
};

export async function loadOfferShareCard(
  offerId: number,
  opts?: { portalToken?: string | null; agentUserId?: string | number | null },
): Promise<OfferShareCard | null> {
  if (!Number.isFinite(offerId) || offerId <= 0) return null;

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: WEB_OFFER_PUBLIC_PRISMA_SELECT as any,
  });
  if (!offer) return null;

  const row = offer as any;

  const access = await resolveOfferDetailAccess(prisma, row, {});
  if (!access.allowed) return null;

  const isRent = String(row.transactionType || '').toUpperCase() === 'RENT';
  const propertyTypeLabel = formatOfferPropertyType(row.propertyType, 'pl') || 'Nieruchomość';
  const transactionLabel = isRent ? 'Wynajem' : 'Sprzedaż';
  const locParts = [row.district, row.city].filter(Boolean);
  const locationLabel = locParts.join(', ') || row.city || 'Polska';
  const title = String(row.title || '').trim() || `Oferta #${offerId}`;
  const priceLabel = formatPricePln(row.pricePln ?? row.price, isRent);
  const summaryLine = [propertyTypeLabel, transactionLabel, locationLabel].filter(Boolean).join(' · ');

  const images = parseImageList(row.images);
  const primary = absolutizeMediaUrl(resolveOfferPrimaryImage(row)) || images[0] || '';
  const canonicalUrl = `${resolvePublicAppOrigin()}/o/${offerId}`;
  const ogDescription = `${summaryLine} — ${priceLabel}. Galeria, parametry i kontakt na EstateOS™.`;
  const ogTitle = `${title} — ${priceLabel}`;

  const portalToken = opts?.portalToken?.trim() || null;
  const agentRaw = opts?.agentUserId;
  const agentUserId =
    agentRaw != null && String(agentRaw).trim() ? String(agentRaw).trim() : null;
  const presentingAgent = await resolvePresentingAgent({
    offerId,
    portalToken,
    agentUserId: agentUserId ? Number(agentUserId) : null,
  });

  const publisherSource = presentingAgent
    ? {
        userId: presentingAgent.userId,
        userLike: presentingAgent,
        isPresentingAgent: true,
      }
    : row.user
      ? {
          userId: Number(row.user.id ?? row.userId),
          userLike: row.user,
          isPresentingAgent: false,
        }
      : null;

  let publisher: OfferSharePublisher | null = null;
  if (publisherSource && Number.isFinite(publisherSource.userId) && publisherSource.userId > 0) {
    const uid = publisherSource.userId;
    const userLike = publisherSource.userLike;
    const displayName =
      presentingAgent?.displayName ||
      resolveSellerDisplayName(userLike, String(userLike.name || 'Wystawca'));
    const personName = presentingAgent?.personName ?? resolveSellerPersonName(userLike);
    const companyName =
      presentingAgent?.companyName ?? resolveServicingCompanyName(userLike);
    const avatar =
      absolutizeMediaUrl(
        presentingAgent?.image ||
          (await getUserDisplayAvatar(uid)) ||
          getBestUserAvatarUrl(userLike) ||
          '',
      ) || null;
    const reviewAgg = await prisma.review.aggregate({
      where: { revieweeId: uid, isAutoGenerated: false },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const reviewCount = Number(reviewAgg._count._all || 0);
    const avgRaw = reviewAgg._avg.rating;

    const phone =
      presentingAgent?.phone ||
      (userLike.phone != null ? String(userLike.phone).trim() : '') ||
      null;
    const email =
      presentingAgent?.email ||
      (userLike.email != null ? String(userLike.email).trim() : '') ||
      null;

    publisher = {
      userId: uid,
      displayName,
      personName,
      companyName,
      phone: phone || null,
      email: email || null,
      imageUrl: avatar,
      isAgent: isAgentOrAgencySeller(userLike),
      isPresentingAgent: publisherSource.isPresentingAgent,
      averageRating: reviewCount > 0 && avgRaw != null ? Number(avgRaw) : null,
      reviewCount,
      profileHref: `/profil/${uid}`,
    };
  }

  const fullOfferQs = new URLSearchParams();
  if (portalToken) fullOfferQs.set('portal', portalToken);
  else if (agentUserId) fullOfferQs.set('agent', agentUserId);
  const fullOfferPath = `/oferta/${offerId}${fullOfferQs.toString() ? `?${fullOfferQs.toString()}` : ''}`;

  return {
    id: offerId,
    title,
    ogTitle,
    ogDescription,
    canonicalUrl,
    imageUrl: primary,
    socialImageUrl: `${resolvePublicAppOrigin()}/api/og/offer/${offerId}?v5`,
    images: images.length ? images : primary ? [primary] : [],
    priceLabel,
    isRent,
    locationLabel,
    summaryLine,
    propertyTypeLabel,
    transactionLabel,
    area: row.area != null ? Number(row.area) : null,
    rooms: row.rooms != null ? Number(row.rooms) : null,
    floor: row.floor != null ? row.floor : null,
    description: row.description
      ? stripHtmlToPlain(stripInternalOfferDescriptionMarkers(String(row.description))).slice(0, 600)
      : null,
    publisher,
    fullOfferPath,
  };
}
