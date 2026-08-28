const CATALOG_STRIP_KEYS = [
  'videoUrl',
  'floorPlanUrl',
  'floorPlan3dUrl',
  'floorPlanScanMeta',
  'description',
  'descriptionVerificationStatus',
  'legalVerification',
  'legalVerificationStatus',
  'legal_check_status',
  'legalCheckStatus',
  'exchangeRateUsed',
  'exchangeRateDate',
  'adminFee',
  'agentCommissionPercent',
  'deposit',
  'street',
  'buildingNumber',
  'localityCountry',
  'views',
  'viewsCount',
  'favoritesCount',
  'createdAt',
  'updatedAt',
] as const;

/** Katalog mapy — jedno zdjęcie, bez ciężkich pól (mniejszy JSON). */
export function trimOfferForMobileCatalog<T extends Record<string, unknown>>(offer: T): T {
  const next = { ...offer } as T & { images?: unknown };
  for (const key of CATALOG_STRIP_KEYS) {
    delete (next as Record<string, unknown>)[key];
  }

  let images = next.images;
  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch {
      images = images ? [images] : [];
    }
  }
  if (Array.isArray(images) && images.length > 1) {
    next.images = [images[0]] as T['images'];
  }
  return next as T;
}
