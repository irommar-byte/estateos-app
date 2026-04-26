import { radarService } from './radar.service';
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
// CREATE 🔥 (WYMUSZA GEO)
// =======================
export async function createOffer(body: any) {
  const { userId, lat, lng } = body;

  if (!userId) {
    throw new Error('Brak ID użytkownika');
  }

  // 🔥 KLUCZOWA WALIDACJA
  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    throw new Error('Brak lokalizacji (lat/lng)');
  }
  const newOffer = await prisma.offer.create({
    data: {
      title: body.title || "Nowa Oferta",
      description: body.description || "",

      transactionType: mapTransactionType(body.transactionType),
      propertyType: mapPropertyType(body.propertyType),
      condition: mapCondition(body.condition),

      price: Number(body.price) || 0,
      area: Number(body.area) || 0,
      rooms: body.rooms ? Number(body.rooms) : null,

      lat: Number(lat),
      lng: Number(lng),

      images: typeof body.images === "string"
        ? body.images
        : JSON.stringify(body.images || []),

      status: mapStatus(body.status),

      userId: Number(userId)
    }
  });

  await radarService.matchNewOffer(newOffer);

  return newOffer;
}

// =======================
// UPDATE (bez zmian GEO)
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

      ...(body.images !== undefined && {
        images: typeof body.images === 'string'
          ? body.images
          : JSON.stringify(body.images)
      }),

      ...(body.status !== undefined && {
        status: mapStatus(body.status)
      })
    }
  });
}
