import { prisma } from '@/lib/prisma';
import { shapeAgencyClientMatchOffer } from '@/lib/crm/matchOfferShape';

export async function loadPresentationOfferPreview(offerId: number | null | undefined) {
  const id = Number(offerId || 0);
  if (!Number.isFinite(id) || id <= 0) return null;
  const offer = await prisma.offer.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      price: true,
      priceCurrency: true,
      city: true,
      district: true,
      street: true,
      area: true,
      rooms: true,
      description: true,
      images: true,
    },
  });
  if (!offer) return null;
  return shapeAgencyClientMatchOffer(offer);
}
