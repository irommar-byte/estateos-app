import { plainOfferDescription } from '@/lib/offerDescriptionHtml';
import { absolutizeMediaUrl } from '@/lib/offerShareLanding';
import { resolveOfferImageUrls, resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';

type MatchOfferSource = {
  id: number;
  title: string;
  price: unknown;
  pricePln?: unknown;
  priceCurrency?: string | null;
  city?: string | null;
  district?: string | null;
  street?: string | null;
  description?: string | null;
  area?: number | null;
  rooms?: number | null;
  transactionType?: string | null;
  images?: unknown;
  imageUrl?: unknown;
};

export function shapeAgencyClientMatchOffer(offer: MatchOfferSource) {
  const description = plainOfferDescription(offer.description);
  const imageUrls = resolveOfferImageUrls(offer).map(absolutizeMediaUrl).filter(Boolean);
  const imageUrl = absolutizeMediaUrl(resolveOfferPrimaryImage(offer)) || imageUrls[0] || '';
  return {
    id: offer.id,
    title: offer.title,
    price: offer.price,
    pricePln: offer.pricePln,
    priceCurrency: offer.priceCurrency,
    city: offer.city,
    district: offer.district,
    street: offer.street,
    area: offer.area,
    rooms: offer.rooms,
    transactionType: offer.transactionType,
    excerpt: description.replace(/\s+/g, ' ').slice(0, 180),
    description,
    imageUrl,
    imageUrls: imageUrls.length ? imageUrls : imageUrl ? [imageUrl] : [],
  };
}
