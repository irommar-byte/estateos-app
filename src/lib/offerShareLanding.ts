import { prisma } from '@/lib/prisma';
import { formatOfferPropertyType } from '@/lib/offerDisplayLabels';
import { resolveOfferDetailAccess } from '@/lib/offerPublicAccess';
import { WEB_OFFER_PUBLIC_PRISMA_SELECT } from '@/lib/mobileOfferPrismaSelect';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';

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

export type OfferShareCard = {
  id: number;
  title: string;
  ogTitle: string;
  ogDescription: string;
  canonicalUrl: string;
  imageUrl: string;
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
};

export async function loadOfferShareCard(offerId: number): Promise<OfferShareCard | null> {
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
  const ogDescription = `${summaryLine} — ${priceLabel}. Zobacz galerię i parametry na EstateOS™. Kontakt po bezpłatnej rejestracji.`;
  const ogTitle = `${title} — ${locationLabel}`;

  return {
    id: offerId,
    title,
    ogTitle,
    ogDescription,
    canonicalUrl,
    imageUrl: primary,
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
    description: row.description ? String(row.description).trim().slice(0, 600) : null,
  };
}
