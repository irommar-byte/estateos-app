/**
 * Zawężony select dla zapytań Prisma `Offer` w kanale mobile.
 * Produkcja może nie mieć jeszcze wszystkich kolumn z `schema.prisma` — pełne `findMany`/`findUnique`
 * rzuca P2022 (unknown column). Publiczny GET `/api/offers` używa tego samego zestawu pól i działa na starszej bazie.
 */
export const MOBILE_OFFER_PRISMA_SELECT = {
  id: true,
  title: true,
  description: true,
  transactionType: true,
  propertyType: true,
  condition: true,
  price: true,
  pricePerSqm: true,
  adminFee: true,
  agentCommissionPercent: true,
  deposit: true,
  area: true,
  plotArea: true,
  rooms: true,
  floor: true,
  totalFloors: true,
  yearBuilt: true,
  hasBalcony: true,
  hasElevator: true,
  hasStorage: true,
  hasParking: true,
  hasGarden: true,
  isFurnished: true,
  heating: true,
  city: true,
  district: true,
  street: true,
  buildingNumber: true,
  lat: true,
  lng: true,
  isExactLocation: true,
  images: true,
  videoUrl: true,
  floorPlanUrl: true,
  status: true,
  expiresAt: true,
  promotedUntil: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      planType: true,
      isPro: true,
    },
  },
} as const;

/** Alias: ten sam zestaw pól co lista publiczna `/api/offers` (bezpieczny na starszą bazę). */
export const WEB_OFFER_PUBLIC_PRISMA_SELECT = MOBILE_OFFER_PRISMA_SELECT;
