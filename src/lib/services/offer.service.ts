import { prisma } from '@/lib/prisma';
import {
  TransactionType,
  PropertyType,
  PropertyCondition,
  OfferStatus
} from '@prisma/client';
import { validateCityDistrict } from '@/lib/location/locationCatalog';
import {
  attachVerificationMetaToDescription,
  buildOfferVerificationMeta,
} from '@/lib/offerVerification';
import { dispatchFavoritesPriceChangePush } from '@/lib/favoritesPricePush';
import { validateAgentCommissionPercent } from '@/lib/agentCommission';

// =======================
// MAPOWANIA
// =======================
function mapTransactionType(val?: string): TransactionType {
  switch (val) {
    case 'SALE': return TransactionType.SELL;
    case 'SELL': return TransactionType.SELL;
    case 'RENT': return TransactionType.RENT;
    default: return TransactionType.SELL;
  }
}

function mapPropertyType(val?: string): PropertyType {
  switch (val) {
    case 'APARTMENT': return PropertyType.FLAT;
    case 'FLAT': return PropertyType.FLAT;
    case 'HOUSE': return PropertyType.HOUSE;
    case 'PLOT': return PropertyType.PLOT;
    case 'COMMERCIAL': return PropertyType.COMMERCIAL;
    case 'PREMISES': return PropertyType.COMMERCIAL;
    default: return PropertyType.FLAT;
  }
}

function mapCondition(val?: string): PropertyCondition {
  switch (val) {
    case 'READY': return PropertyCondition.READY;
    case 'NEEDS_RENOVATION': return PropertyCondition.NEEDS_RENOVATION;
    case 'RENOVATION': return PropertyCondition.NEEDS_RENOVATION;
    case 'DEVELOPER_STATE': return PropertyCondition.DEVELOPER_STATE;
    case 'DEVELOPER': return PropertyCondition.DEVELOPER_STATE;
    case 'NOT_APPLICABLE': return PropertyCondition.NOT_APPLICABLE;
    default: return PropertyCondition.READY;
  }
}

function mapStatus(val?: string): OfferStatus {
  switch (val) {
    case 'ACTIVE': return OfferStatus.ACTIVE;
    case 'REJECTED': return OfferStatus.REJECTED;
    case 'ARCHIVED': return OfferStatus.ARCHIVED;
    case 'SOLD': return OfferStatus.SOLD;
    default: return OfferStatus.PENDING;
  }
}

// =======================
// CREATE
// =======================
export async function createOffer(body: any) {
  const { userId, lat, lng } = body;

  if (!userId) throw new Error('Brak ID użytkownika');
  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    throw new Error('Brak lokalizacji (lat/lng)');
  }

  const locationValidation = validateCityDistrict(body.city, body.district);
  if (!locationValidation.valid) {
    throw new Error(locationValidation.message || 'Nieprawidłowa lokalizacja');
  }

  const verificationMeta = buildOfferVerificationMeta({
    apartmentNumber: body.apartmentNumber,
    landRegistryNumber: body.landRegistryNumber,
  });
  const descriptionWithVerification = attachVerificationMetaToDescription(body.description || "", verificationMeta);

  let agentCommissionPercent: number | null | undefined = undefined;
  if (body.agentCommissionPercent !== undefined && body.agentCommissionPercent !== null) {
    const v = validateAgentCommissionPercent(body.agentCommissionPercent);
    if (!v.ok) throw new Error(v.message);
    agentCommissionPercent = v.value;
  }

  return prisma.offer.create({
    data: {
      title: body.title || "Nowa Oferta",
      description: descriptionWithVerification,

      transactionType: mapTransactionType(body.transactionType),
      propertyType: mapPropertyType(body.propertyType),
      condition: mapCondition(body.condition),

      price: Number(body.price) || 0,
      area: Number(body.area) || 0,
      adminFee: body.adminFee !== undefined && body.adminFee !== null ? Number(body.adminFee) : null,
      deposit: body.deposit !== undefined && body.deposit !== null ? Number(body.deposit) : null,
      plotArea: body.plotArea !== undefined && body.plotArea !== null ? Number(body.plotArea) : null,
      rooms: body.rooms !== undefined && body.rooms !== null ? Number(body.rooms) : null,

      floor: body.floor !== undefined && body.floor !== null ? Number(body.floor) : null,
      totalFloors: body.totalFloors !== undefined && body.totalFloors !== null ? Number(body.totalFloors) : null,
      yearBuilt: body.yearBuilt !== undefined && body.yearBuilt !== null ? Number(body.yearBuilt) : null,

      city: locationValidation.city,
      district: locationValidation.district,
      street: body.street || body.address || null,
      buildingNumber: body.buildingNumber || body.apartmentNumber || null,
      isExactLocation: body.isExactLocation !== undefined ? !!body.isExactLocation : true,

      lat: Number(lat),
      lng: Number(lng),

      images: typeof body.images === "string"
        ? body.images
        : JSON.stringify(body.images || []),

      videoUrl: body.videoUrl || null,
      floorPlanUrl: body.floorPlanUrl || null,

      hasBalcony: !!body.hasBalcony,
      hasElevator: !!body.hasElevator,
      hasStorage: !!body.hasStorage,
      hasParking: !!body.hasParking,
      hasGarden: !!body.hasGarden,
      isFurnished: !!body.isFurnished,
      heating: body.heating ? String(body.heating).trim() : null,

      status: mapStatus(body.status),

      ...(agentCommissionPercent !== undefined && { agentCommissionPercent }),

      userId: Number(userId)
    }
  });
}

// =======================
// UPDATE
// =======================
export async function updateOffer(body: any) {
  const { id, userId } = body;

  if (!id || !userId) {
    throw new Error('Brak ID oferty lub użytkownika');
  }

  const existing = await prisma.offer.findUnique({
    where: { id: Number(id) }
  });

  if (!existing || existing.userId !== Number(userId)) {
    throw new Error('Brak uprawnień');
  }

  const shouldValidateLocation = body.city !== undefined || body.district !== undefined;
  const locationValidation = shouldValidateLocation
    ? validateCityDistrict(body.city ?? existing.city, body.district ?? existing.district)
    : null;

  if (locationValidation && !locationValidation.valid) {
    throw new Error(locationValidation.message || 'Nieprawidłowa lokalizacja');
  }

  let agentCommissionPercent: number | null | undefined = undefined;
  if (body.agentCommissionPercent !== undefined) {
    if (body.agentCommissionPercent === null) {
      agentCommissionPercent = null;
    } else {
      const v = validateAgentCommissionPercent(body.agentCommissionPercent);
      if (!v.ok) throw new Error(v.message);
      agentCommissionPercent = v.value;
    }
  }

  const oldPrice = Number(existing.price);
  const updatedOffer = await prisma.offer.update({
    where: { id: Number(id) },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),

      ...(body.transactionType !== undefined && {
        transactionType: mapTransactionType(body.transactionType)
      }),

      ...(body.propertyType !== undefined && {
        propertyType: mapPropertyType(body.propertyType)
      }),

      ...(body.condition !== undefined && {
        condition: mapCondition(body.condition)
      }),

      ...(body.price !== undefined && {
        price: Number(body.price)
      }),

      ...(body.area !== undefined && {
        area: Number(body.area)
      }),

      ...(body.rooms !== undefined && {
        rooms: body.rooms === null ? null : Number(body.rooms)
      }),

      ...(body.floor !== undefined && {
        floor: body.floor === null ? null : Number(body.floor)
      }),

      ...(body.totalFloors !== undefined && {
        totalFloors: body.totalFloors === null ? null : Number(body.totalFloors)
      }),

      ...(body.yearBuilt !== undefined && {
        yearBuilt: body.yearBuilt === null ? null : Number(body.yearBuilt)
      }),

      ...(body.city !== undefined && {
        city: locationValidation?.city
      }),

      ...(body.district !== undefined && {
        district: locationValidation?.district
      }),

      ...(body.images !== undefined && {
        images: typeof body.images === 'string'
          ? body.images
          : JSON.stringify(body.images)
      }),

      ...(body.videoUrl !== undefined && { videoUrl: body.videoUrl || null }),
      ...(body.floorPlanUrl !== undefined && { floorPlanUrl: body.floorPlanUrl || null }),

      ...(body.hasBalcony !== undefined && { hasBalcony: !!body.hasBalcony }),
      ...(body.hasElevator !== undefined && { hasElevator: !!body.hasElevator }),
      ...(body.hasStorage !== undefined && { hasStorage: !!body.hasStorage }),
      ...(body.hasParking !== undefined && { hasParking: !!body.hasParking }),
      ...(body.hasGarden !== undefined && { hasGarden: !!body.hasGarden }),
      ...(body.isFurnished !== undefined && { isFurnished: !!body.isFurnished }),
      ...(body.heating !== undefined && {
        heating: body.heating ? String(body.heating).trim() : null
      }),

      ...(body.status !== undefined && {
        status: mapStatus(body.status)
      }),

      ...(agentCommissionPercent !== undefined && { agentCommissionPercent })
    }
  });
  const newPrice = Number(updatedOffer.price);
  if (Number.isFinite(oldPrice) && Number.isFinite(newPrice) && oldPrice !== newPrice) {
    await dispatchFavoritesPriceChangePush({
      offerId: Number(updatedOffer.id),
      oldPrice,
      newPrice,
      changedByUserId: Number(userId) || null,
      source: 'mobile_offers_put',
    });
  }
  return updatedOffer;
}
