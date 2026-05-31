import { prisma } from '@/lib/prisma';
import { MOBILE_OFFER_PRISMA_SELECT } from '@/lib/mobileOfferPrismaSelect';
import { isOfferLocalityColumnMissingError } from '@/lib/offerSchemaErrors';
import { ensureOfferLocalityCountryColumns } from '@/lib/services/offer.service';

const { localityCountry: _lc, localityCountryCode: _lcc, ...MOBILE_LIST_SELECT_WITHOUT_LOCALITY } =
  MOBILE_OFFER_PRISMA_SELECT;

/** Publiczna lista ofert dla mobile — jak GET /api/offers, z migracją kolumn kraju i fallbackiem. */
export async function findManyMobileListOffers(where: Record<string, unknown>) {
  await ensureOfferLocalityCountryColumns();
  try {
    return await prisma.offer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: MOBILE_OFFER_PRISMA_SELECT as any,
    });
  } catch (error) {
    if (!isOfferLocalityColumnMissingError(error)) throw error;
    return await prisma.offer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: MOBILE_LIST_SELECT_WITHOUT_LOCALITY as any,
    });
  }
}

/** Pojedyncza oferta mobile — ten sam select co lista, z fallbackiem bez kolumn kraju. */
export async function findUniqueMobileListOffer(offerId: number) {
  await ensureOfferLocalityCountryColumns();
  try {
    return await prisma.offer.findUnique({
      where: { id: offerId },
      select: MOBILE_OFFER_PRISMA_SELECT as any,
    });
  } catch (error) {
    if (!isOfferLocalityColumnMissingError(error)) throw error;
    return await prisma.offer.findUnique({
      where: { id: offerId },
      select: MOBILE_LIST_SELECT_WITHOUT_LOCALITY as any,
    });
  }
}
