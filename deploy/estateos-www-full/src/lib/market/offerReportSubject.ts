import { prisma } from '@/lib/prisma';
import { parseValuationSubject } from '@/lib/market/parseSubject';
import { parseLooseNumber } from '@/lib/market/format';
import { resolveAcquisitionCoords } from '@/lib/crm/acquisitionOffer';
import { normalizeAcquisitionForm, createDefaultAcquisitionForm } from '@/lib/acquisitionWorkflow';
import type { ValuationSubject } from '@/lib/market/types';

export type OfferReportInput = {
  subject: ValuationSubject;
  listingPrice: number | null;
  offer: {
    id: number;
    title: string | null;
    city: string | null;
    district: string | null;
    address: string | null;
    area: number | null;
  };
};

function offerAddress(offer: {
  street?: string | null;
  buildingNumber?: string | null;
  apartmentNumber?: string | null;
  city?: string | null;
}) {
  const street = [offer.street, offer.buildingNumber].filter(Boolean).join(' ').trim();
  if (street && offer.apartmentNumber) return `${street} m. ${offer.apartmentNumber}`;
  return street || null;
}

export async function resolveOfferReportInput(params: {
  agencyUserId: number;
  offerId: number;
  clientId?: number | null;
  body?: Record<string, unknown>;
}): Promise<OfferReportInput | { error: string }> {
  const offer = await prisma.offer.findFirst({
    where: { id: params.offerId, userId: params.agencyUserId },
    select: {
      id: true,
      title: true,
      city: true,
      district: true,
      street: true,
      buildingNumber: true,
      apartmentNumber: true,
      lat: true,
      lng: true,
      area: true,
      rooms: true,
      floor: true,
      pricePln: true,
      price: true,
    },
  });
  if (!offer) return { error: 'Nie znaleziono tej oferty.' };

  let formProperty: Record<string, unknown> | null = null;
  let expectedPrice: number | null = null;
  if (params.clientId) {
    const client = await prisma.agencyClient.findFirst({
      where: { id: params.clientId, agencyUserId: params.agencyUserId, status: 'ACTIVE' },
      select: { firstName: true, lastName: true, sellerCity: true, sellerDistrict: true, sellerPrice: true },
    });
    const acquisition = await prisma.agencyClientAcquisition.findFirst({
      where: { clientId: params.clientId },
      select: { formData: true },
    });
    if (acquisition?.formData && client) {
      const form = normalizeAcquisitionForm(
        acquisition.formData,
        createDefaultAcquisitionForm(client),
      );
      formProperty = form.property as unknown as Record<string, unknown>;
      expectedPrice = parseLooseNumber(form.strategy.expectedPrice) ?? client.sellerPrice ?? null;
    } else if (client?.sellerPrice) {
      expectedPrice = client.sellerPrice;
    }
  }

  const coords = resolveAcquisitionCoords({
    lat: params.body?.lat ?? offer.lat ?? formProperty?.lat,
    lng: params.body?.lng ?? offer.lng ?? formProperty?.lng,
  });
  const area =
    parseLooseNumber(params.body?.area) ??
    (offer.area > 0 ? offer.area : null) ??
    parseLooseNumber(formProperty?.area);
  const parsed = parseValuationSubject({
    lat: coords?.lat ?? params.body?.lat,
    lng: coords?.lng ?? params.body?.lng,
    area,
    rooms: params.body?.rooms ?? offer.rooms ?? formProperty?.rooms,
    floor: params.body?.floor ?? offer.floor ?? formProperty?.floor,
    city: params.body?.city || offer.city || formProperty?.city || 'Warszawa',
    district: params.body?.district || offer.district || formProperty?.district,
    address:
      params.body?.address ||
      offerAddress(offer) ||
      formProperty?.address ||
      offer.title,
  });
  if ('error' in parsed) return parsed;

  const listingPrice =
    parseLooseNumber(params.body?.listingPrice ?? params.body?.price) ??
    (offer.pricePln && offer.pricePln > 0 ? offer.pricePln : null) ??
    (offer.price > 0 ? offer.price : null) ??
    expectedPrice;

  return {
    subject: parsed,
    listingPrice,
    offer: {
      id: offer.id,
      title: offer.title,
      city: offer.city,
      district: offer.district,
      address: offerAddress(offer),
      area: offer.area,
    },
  };
}
