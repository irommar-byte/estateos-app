import { prisma } from '@/lib/prisma';
import {
  TransactionType,
  PropertyType,
  PropertyCondition,
  OfferStatus
} from '@prisma/client';

// =======================
// MAPOWANIA
// =======================
function mapTransactionType(val?: string): TransactionType {
  switch (val) {
    case 'SALE': return TransactionType.SELL;
    case 'RENT': return TransactionType.RENT;
    default: return TransactionType.SELL;
  }
}

function mapPropertyType(val?: string): PropertyType {
  switch (val) {
    case 'APARTMENT': return PropertyType.FLAT;
    case 'HOUSE': return PropertyType.HOUSE;
    case 'PLOT': return PropertyType.PLOT;
    case 'COMMERCIAL': return PropertyType.COMMERCIAL;
    default: return PropertyType.FLAT;
  }
}

function mapCondition(val?: string): PropertyCondition {
  switch (val) {
    case 'READY': return PropertyCondition.READY;
    case 'NEEDS_RENOVATION': return PropertyCondition.NEEDS_RENOVATION;
    case 'DEVELOPER_STATE': return PropertyCondition.DEVELOPER_STATE;
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

  return prisma.offer.create({
    data: {
      title: body.title || "Nowa Oferta",
      description: body.description || "",

      transactionType: mapTransactionType(body.transactionType),
      propertyType: mapPropertyType(body.propertyType),
      condition: mapCondition(body.condition),

      price: Number(body.price) || 0,
      area: Number(body.area) || 0,
      rooms: body.rooms !== undefined && body.rooms !== null ? Number(body.rooms) : null,

      floor: body.floor !== undefined && body.floor !== null ? Number(body.floor) : null,
      totalFloors: body.totalFloors !== undefined && body.totalFloors !== null ? Number(body.totalFloors) : null,
      yearBuilt: body.yearBuilt !== undefined && body.yearBuilt !== null ? Number(body.yearBuilt) : null,

      city: body.city || "Warszawa",
      district: body.district || "OTHER",

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

      status: mapStatus(body.status),

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

  return prisma.offer.update({
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
        city: body.city || "Warszawa"
      }),

      ...(body.district !== undefined && {
        district: body.district || "OTHER"
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

      ...(body.status !== undefined && {
        status: mapStatus(body.status)
      })
    }
  });
}
