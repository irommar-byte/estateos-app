import type { ProPhotoSessionExampleId } from '../components/ProPhotoSessionExampleCard';
import { getProPhotoSessionSampleFloorPlanAssets } from './proPhotoSessionSampleFloorPlans';

export const PRO_PHOTO_SESSION_SAMPLE_IDS: Record<ProPhotoSessionExampleId, number> = {
  warsaw: 910_001,
  berlin: 910_002,
  kyiv: 910_003,
};

const SAMPLE_OWNER_ID = 910_000;

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

const IMAGE_SETS: Record<ProPhotoSessionExampleId, string[]> = {
  warsaw: [
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?q=80&w=1400&auto=format&fit=crop',
  ],
  berlin: [
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1613977257363-707ba9348227?q=80&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1600607687644-c7171b42498f?q=80&w=1400&auto=format&fit=crop',
  ],
  kyiv: [
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1600210492493-20305cc83717?q=80&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1616594039964-ae9021a400f0?q=80&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=1400&auto=format&fit=crop',
  ],
};

const COORDS: Record<ProPhotoSessionExampleId, { lat: number; lng: number; city: string; district: string; street: string; country: string; countryCode: string }> = {
  warsaw: {
    lat: 52.1934,
    lng: 21.034,
    city: 'Warszawa',
    district: 'Mokotów',
    street: 'Puławska 12',
    country: 'Polska',
    countryCode: 'PL',
  },
  berlin: {
    lat: 52.5388,
    lng: 13.4241,
    city: 'Berlin',
    district: 'Prenzlauer Berg',
    street: 'Kastanienallee 45',
    country: 'Niemcy',
    countryCode: 'DE',
  },
  kyiv: {
    lat: 50.4265,
    lng: 30.5383,
    city: 'Kijów',
    district: 'Peczersk',
    street: 'Illinska 8',
    country: 'Ukraina',
    countryCode: 'UA',
  },
};

const PRICES: Record<ProPhotoSessionExampleId, { price: number; currency: string }> = {
  warsaw: { price: 2_450_000, currency: 'PLN' },
  berlin: { price: 890_000, currency: 'EUR' },
  kyiv: { price: 185_000, currency: 'USD' },
};

const SPECS: Record<ProPhotoSessionExampleId, { area: number; rooms: number; floor: number; totalFloors: number; yearBuilt: number }> = {
  warsaw: { area: 98, rooms: 3, floor: 12, totalFloors: 14, yearBuilt: 2019 },
  berlin: { area: 112, rooms: 4, floor: 3, totalFloors: 5, yearBuilt: 1912 },
  kyiv: { area: 86, rooms: 2, floor: 18, totalFloors: 24, yearBuilt: 2021 },
};

export function isProPhotoSessionSampleOfferId(id: unknown): boolean {
  const num = Number(id);
  return Object.values(PRO_PHOTO_SESSION_SAMPLE_IDS).includes(num);
}

export function buildProPhotoSessionSampleOffer(id: ProPhotoSessionExampleId, t: TranslateFn) {
  const base = `addOffer.step5.proSession.examples.${id}`;
  const geo = COORDS[id];
  const price = PRICES[id];
  const specs = SPECS[id];
  const floorPlan = getProPhotoSessionSampleFloorPlanAssets(id);

  return {
    id: PRO_PHOTO_SESSION_SAMPLE_IDS[id],
    title: t(`${base}.title`),
    description: t(`${base}.description`),
    price: price.price,
    priceCurrency: price.currency,
    transactionType: 'SALE',
    propertyType: 'APARTMENT',
    condition: 'READY',
    city: geo.city,
    district: geo.district,
    street: geo.street,
    localityCountry: geo.country,
    localityCountryCode: geo.countryCode,
    lat: geo.lat,
    lng: geo.lng,
    isExactLocation: true,
    area: specs.area,
    rooms: specs.rooms,
    floor: specs.floor,
    totalFloors: specs.totalFloors,
    yearBuilt: specs.yearBuilt,
    heating: 'Miejskie',
    hasBalcony: true,
    hasElevator: true,
    hasParking: id !== 'kyiv',
    hasStorage: true,
    hasGarden: id === 'berlin',
    isFurnished: id === 'warsaw',
    isTwoLevel: false,
    images: IMAGE_SETS[id],
    floorPlanUrl: floorPlan.floorPlanUrl,
    floorPlan3dUrl: floorPlan.floorPlan3dUrl,
    floorPlanScanMeta: floorPlan.floorPlanScanMeta,
    status: 'ACTIVE',
    views: id === 'warsaw' ? 1248 : id === 'berlin' ? 892 : 756,
    userId: SAMPLE_OWNER_ID,
    userName: t('addOffer.step5.proSession.examples.ownerName'),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isLegalSafeVerified: id === 'warsaw',
    legalCheckStatus: id === 'warsaw' ? 'VERIFIED' : 'NONE',
  };
}

export function getProPhotoSessionSampleOffer(id: ProPhotoSessionExampleId, t: TranslateFn) {
  return buildProPhotoSessionSampleOffer(id, t);
}
