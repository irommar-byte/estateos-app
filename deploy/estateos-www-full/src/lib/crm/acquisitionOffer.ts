import { createOffer } from '@/lib/services/offer.service';
import { linkOfferToAgencyClient } from '@/lib/offerAgencyManagement';
import { prisma } from '@/lib/prisma';
import {
  amenitiesSummary,
  parseAmenities,
  type PropertyAmenities,
} from '@/lib/crm/clientJourney';
import {
  createDefaultAcquisitionForm,
  normalizeAcquisitionForm,
  type AcquisitionFormData,
} from '@/lib/acquisitionWorkflow';
import { validateCityDistrict } from '@/lib/location/locationCatalog';
import { resolveOfferLocationFromCoordinates } from '@/lib/location/resolveOfferLocationFromCoordinates';
import {
  apartmentNumberForType,
  parseSellerPropertyType,
  sellerPropertyTypeLabel,
} from '@/lib/crm/sellerProperty';

export type ListingProgressStep = {
  id: 'signed' | 'draft' | 'photos' | 'published' | 'live';
  label: string;
  done: boolean;
  current: boolean;
};


export function amenitiesToOfferFlags(amenities: PropertyAmenities | string | null | undefined) {
  const parsed = parseAmenities(amenities);
  return {
    hasParking: parsed.garage || parsed.parkingSpot,
    hasStorage: parsed.storageUnit || parsed.basement,
    hasBalcony: parsed.balcony || parsed.terrace,
    hasGarden: parsed.garden,
    hasElevator: parsed.elevator,
  };
}

export function resolveAcquisitionCity(property: Record<string, unknown>, client: {
  sellerCity?: string | null;
  sellerDistrict?: string | null;
}): string {
  const fromProperty = String(property.city || '').trim();
  if (fromProperty && !fromProperty.includes(',')) return fromProperty;
  const address = String(property.address || client.sellerCity || '');
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || '';
  if (last && last.length <= 48 && !/^\d/.test(last)) return last;
  return 'Warszawa';
}

function toCoord(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n) > 0.01 ? n : null;
}

export function resolveAcquisitionCoords(property: Record<string, unknown>): { lat: number; lng: number } | null {
  const lat = toCoord(property.lat);
  const lng = toCoord(property.lng);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function mapPropertyType(raw: unknown): string {
  return parseSellerPropertyType(raw);
}

function offerHasPhotos(images: unknown): boolean {
  if (!images) return false;
  try {
    const parsed = typeof images === 'string' ? JSON.parse(images) : images;
    if (Array.isArray(parsed)) return parsed.filter(Boolean).length > 0;
  } catch {
    /* ignore */
  }
  return String(images).replace(/[\[\]"'\s]/g, '').length > 8;
}

export function buildListingProgress(params: {
  signed: boolean;
  offer: {
    id: number;
    status?: string | null;
    managementStatus?: string | null;
    images?: unknown;
    officeReviewStatus?: string | null;
  } | null;
}): ListingProgressStep[] {
  const status = String(params.offer?.status || '').toUpperCase();
  const office = String(params.offer?.officeReviewStatus || '').toUpperCase();
  const published = ['ACTIVE', 'PUBLISHED'].includes(status);
  const live = published && String(params.offer?.managementStatus || '').toUpperCase() !== 'PAUSED';
  const inOfficeReview = office === 'OFFICE_REVIEW';
  const steps: Array<{ id: ListingProgressStep['id']; label: string; done: boolean }> = [
    { id: 'signed', label: 'Umowa podpisana', done: params.signed },
    { id: 'draft', label: 'Szkic ogłoszenia', done: Boolean(params.offer) },
    { id: 'photos', label: 'Zdjęcia w ofercie', done: Boolean(params.offer && offerHasPhotos(params.offer.images)) },
    {
      id: 'published',
      label: inOfficeReview ? 'Oferta weryfikowana przez biuro' : 'Ogłoszenie opublikowane',
      done: published || office === 'OFFICE_APPROVED',
    },
    { id: 'live', label: 'Widoczna dla kupujących', done: live },
  ];
  const firstOpen = steps.findIndex((step) => !step.done);
  return steps.map((step, index) => ({
    ...step,
    current: firstOpen === -1 ? index === steps.length - 1 : index === firstOpen,
  }));
}

export function listingStatusLabel(
  status?: string | null,
  officeReviewStatus?: string | null,
): string {
  const office = String(officeReviewStatus || '').toUpperCase();
  if (office === 'OFFICE_REVIEW') return 'Oferta weryfikowana przez biuro';
  if (office === 'OFFICE_REJECTED') return 'Wymaga poprawek biura';
  switch (String(status || '').toUpperCase()) {
    case 'ACTIVE':
    case 'PUBLISHED':
      return 'Opublikowana';
    case 'PENDING':
      return office === 'OFFICE_APPROVED' ? 'Aktywowana przez biuro' : 'Szkic — niepubliczna';
    case 'SOLD':
      return 'Sprzedana';
    case 'ARCHIVED':
      return 'Zarchiwizowana';
    case 'REJECTED':
      return 'Odrzucona';
    default:
      return status ? String(status) : 'W przygotowaniu';
  }
}

export function seedAcquisitionForm(params: {
  client: {
    firstName?: string | null;
    lastName?: string | null;
    sellerCity?: string | null;
    sellerDistrict?: string | null;
    sellerPrice?: number | null;
    sellerArea?: number | null;
    sellerRooms?: number | null;
    sellerDescription?: string | null;
    sellerPropertyType?: string | null;
  };
  meeting?: { startsAt?: string; location?: string | null; notes?: string | null } | null;
  lat?: number | null;
  lng?: number | null;
  prepItems?: string[];
  sellerPropertyType?: string | null;
  apartmentNumber?: string | null;
}): AcquisitionFormData {
  const form = createDefaultAcquisitionForm(params.client);
  const prep = new Set(params.prepItems || []);
  const propertyType = sellerPropertyTypeLabel(
    params.sellerPropertyType || params.client.sellerPropertyType,
  );
  return normalizeAcquisitionForm(
    {
      ...form,
      meeting: {
        ...form.meeting,
        startsAt: params.meeting?.startsAt || form.meeting.startsAt,
        location: params.meeting?.location || form.meeting.location,
      },
      property: {
        ...form.property,
        address: params.meeting?.location || form.property.address,
        city: params.client.sellerCity || form.property.city,
        district: params.client.sellerDistrict || form.property.district,
        lat: params.lat != null ? String(params.lat) : form.property.lat,
        lng: params.lng != null ? String(params.lng) : form.property.lng,
        propertyType,
        apartmentNumber: apartmentNumberForType(propertyType, params.apartmentNumber),
      },
      strategy: {
        ...form.strategy,
        photoConsent: prep.has('photo_ready') ? true : form.strategy.photoConsent,
        keysHandover: prep.has('keys_access'),
      },
      notes: params.meeting?.notes || form.notes,
    },
    form,
  );
}

export async function createOfferFromAcquisitionRecord(params: {
  agencyUserId: number;
  clientId: number;
}): Promise<{ ok: true; offerId: number } | { ok: false; error: string }> {
  const client = await prisma.agencyClient.findFirst({
    where: { id: params.clientId, agencyUserId: params.agencyUserId, status: 'ACTIVE' },
    include: { acquisition: true, linkedOffer: { select: { id: true } } },
  });
  if (!client) return { ok: false, error: 'Nie znaleziono klienta.' };
  if (client.type !== 'SELLER') {
    return { ok: false, error: 'Oferty z karty pozyskania można tworzyć tylko dla sprzedających.' };
  }
  if (client.linkedOfferId) return { ok: true, offerId: client.linkedOfferId };

  const form = (client.acquisition?.formData || {}) as Record<string, any>;
  const property = (form.property || {}) as Record<string, any>;
  const strategy = (form.strategy || {}) as Record<string, any>;
  const ownership = (form.ownership || {}) as Record<string, any>;
  const coords = resolveAcquisitionCoords(property);
  if (!coords) {
    return {
      ok: false,
      error: 'Brak lokalizacji (lat/lng) na karcie. Uzupełnij adres na mapie w kroku „Nieruchomość”.',
    };
  }

  const cityHint = resolveAcquisitionCity(property, client);
  const districtHint = String(property.district || client.sellerDistrict || '').trim();
  const address = String(property.address || client.sellerCity || '').trim();
  const areaVal = Number(String(property.area || '').replace(/\s/g, '').replace(',', '.')) || client.sellerArea || 0;
  const roomsVal = Number(property.rooms) || client.sellerRooms || 0;
  const priceVal =
    Number(String(strategy.expectedPrice || '').replace(/\s/g, '').replace(',', '.')) || client.sellerPrice || 0;
  if (!(areaVal > 0)) {
    return { ok: false, error: 'Uzupełnij powierzchnię w kroku „Nieruchomość”.' };
  }
  if (!(roomsVal > 0)) {
    return { ok: false, error: 'Uzupełnij liczbę pokoi w kroku „Nieruchomość”.' };
  }
  if (!(priceVal > 0)) {
    return { ok: false, error: 'Uzupełnij cenę oczekiwaną w kroku „Strategia”.' };
  }

  const userLocation = validateCityDistrict(cityHint, districtHint);
  const resolvedFromPin = await resolveOfferLocationFromCoordinates({
    lat: coords.lat,
    lng: coords.lng,
    preferredCity: cityHint || undefined,
    streetHint: address || undefined,
  });
  let city = userLocation.city || cityHint;
  let district = userLocation.district || districtHint;
  if (userLocation.valid) {
    city = userLocation.city;
    district = userLocation.district;
  } else if (resolvedFromPin?.validation.valid) {
    city = resolvedFromPin.validation.city;
    district = resolvedFromPin.validation.district;
  } else if (resolvedFromPin && !resolvedFromPin.strictCity) {
    const fallback = validateCityDistrict(
      resolvedFromPin.city || cityHint,
      resolvedFromPin.district || districtHint || 'Inny obszar',
    );
    if (!fallback.valid) {
      return {
        ok: false,
        error:
          fallback.message ||
          userLocation.message ||
          'Uzupełnij miasto i dzielnicę w kroku „Nieruchomość”.',
      };
    }
    city = fallback.city;
    district = fallback.district;
  } else {
    return {
      ok: false,
      error:
        userLocation.message ||
        resolvedFromPin?.validation.message ||
        'Uzupełnij dzielnicę w kroku „Nieruchomość” — mapa wybierze ją sama po ustawieniu pinezki.',
    };
  }
  const amenityFlags = amenitiesToOfferFlags(property.amenities);
  const amenityLine = amenitiesSummary(property.amenities);
  const extraBits = [
    property.parking ? `Parking/garaż: ${property.parking}` : '',
    property.storage ? `Komórka/piwnica: ${property.storage}` : '',
    amenityLine ? `Przyległości: ${amenityLine}` : '',
  ].filter(Boolean);
  const planImages = String(property.planImages || '')
    .split(',')
    .map((item: string) => item.trim())
    .filter((item: string) => item.startsWith('http') || item.startsWith('/'));
  let roomScans: unknown[] = [];
  let wholeScan: Record<string, any> | null = null;
  try {
    const parsedRooms = JSON.parse(String(property.roomsJson || '[]'));
    if (Array.isArray(parsedRooms)) roomScans = parsedRooms;
  } catch {
    roomScans = [];
  }
  try {
    const parsedWhole = JSON.parse(String(property.wholeScanJson || 'null'));
    if (parsedWhole && typeof parsedWhole === 'object') wholeScan = parsedWhole;
  } catch {
    wholeScan = null;
  }
  const wholePlan2d = String(wholeScan?.floorPlanPngUri || '').trim();
  const wholePlan3d = String(wholeScan?.floorPlan3dUri || '').trim();
  const floorPlanScanMeta = wholeScan?.scanMeta
    ? JSON.stringify({
        ...wholeScan.scanMeta,
        roomScans,
        roomAreaTotalSqM: roomScans.reduce((sum: number, item: any) => {
          const value = Number(String(item?.areaM2 || '').replace(',', '.'));
          return sum + (Number.isFinite(value) ? value : 0);
        }, 0),
      })
    : roomScans.length
      ? JSON.stringify({ version: 2, roomScans })
      : null;

  const kw = String(ownership.landRegisterNumber || '').trim().toUpperCase();
  const landRegistryNumber = /^[A-Z]{2}[A-Z0-9]{2}\/\d{8}\/\d$/.test(kw) ? kw : undefined;
  const apartmentNumber = apartmentNumberForType(property.propertyType, property.apartmentNumber);

  if (client.acquisition?.id) {
    await prisma.agencyClientAcquisition.update({
      where: { id: client.acquisition.id },
      data: {
        formData: {
          ...form,
          property: {
            ...property,
            city,
            district,
            lat: String(coords.lat),
            lng: String(coords.lng),
          },
        },
      },
    }).catch(() => {});
  }
  await prisma.agencyClient.update({
    where: { id: client.id },
    data: {
      sellerCity: city,
      sellerDistrict: district,
      sellerArea: areaVal,
      sellerRooms: Math.round(roomsVal),
      sellerPrice: priceVal,
      sellerPropertyType: parseSellerPropertyType(property.propertyType),
    },
  }).catch(() => {});

  try {
    const createdOffer = await createOffer({
      userId: params.agencyUserId,
      title: address ? `Nieruchomość ${address}` : `Mieszkanie ${areaVal} m² ${city}`,
      transactionType: 'SELL',
      propertyType: mapPropertyType(property.propertyType),
      price: priceVal,
      priceCurrency: 'PLN',
      city,
      district,
      street: address || undefined,
      area: areaVal,
      rooms: roomsVal,
      floor: property.floor ? Number(property.floor) : undefined,
      totalFloors: property.totalFloors ? Number(property.totalFloors) : undefined,
      yearBuilt: property.yearBuilt ? Number(property.yearBuilt) : undefined,
      lat: coords.lat,
      lng: coords.lng,
      landRegistryNumber,
      apartmentNumber: apartmentNumber || undefined,
      description:
        [property.advantages || client.sellerDescription || client.notes, extraBits.join('. ')].filter(Boolean).join('\n\n') ||
        'Oferta utworzona z karty pozyskania CRM EstateOS.',
      status: 'PENDING',
      floorPlanUrl:
        (wholePlan2d.startsWith('http') || wholePlan2d.startsWith('/') ? wholePlan2d : '') ||
        planImages[0] ||
        undefined,
      ...amenityFlags,
    });

    const offerId = Number(createdOffer.id);
    await prisma.offer.update({
      where: { id: offerId },
      data: {
        managementStatus: 'AGENCY_MANAGED',
        ...(wholePlan3d.startsWith('http') || wholePlan3d.startsWith('/')
          ? { floorPlan3dUrl: wholePlan3d }
          : {}),
        ...(floorPlanScanMeta ? { floorPlanScanMeta } : {}),
      },
    }).catch(() => {});
    await linkOfferToAgencyClient({ agencyUserId: params.agencyUserId, clientId: params.clientId, offerId });
    return { ok: true, offerId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się utworzyć oferty z karty.';
    return { ok: false, error: message };
  }
}
