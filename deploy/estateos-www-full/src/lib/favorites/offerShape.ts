import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';

/** Kształt karty oferty w CRM (Ulubione / lista rynku). */
export function shapeOfferForCrmCard(offer: Record<string, unknown>) {
  const city = String(offer.city || '').trim();
  const district = String(offer.district || '').trim();
  const street = String(offer.street || '').trim();
  const location = [city, district].filter(Boolean).join(', ') || street || '—';

  return {
    ...offer,
    id: offer.id,
    title: offer.title,
    price: offer.price,
    location,
    area: offer.area,
    rooms: offer.rooms,
    imageUrl: resolveOfferPrimaryImage(offer),
    expiresAt: offer.expiresAt,
    createdAt: offer.createdAt,
    status: offer.status,
    transactionType: offer.transactionType,
    userId: offer.userId,
  };
}
