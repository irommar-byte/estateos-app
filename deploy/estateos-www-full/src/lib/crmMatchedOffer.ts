import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';

export function shapeMatchedOfferForCrm(offer: Record<string, unknown>) {
  const imageUrl = resolveOfferPrimaryImage(offer as { imageUrl?: unknown; images?: unknown });
  const tx = String(offer.transactionType || 'SELL').toUpperCase();
  return {
    ...offer,
    imageUrl: imageUrl || null,
    transactionType: tx === 'RENT' ? 'rent' : 'sale',
  };
}
