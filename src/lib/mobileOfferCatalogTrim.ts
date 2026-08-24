/** Katalog mapy — jedno zdjęcie, bez ciężkich pól (mniejszy JSON ~40%). */
export function trimOfferForMobileCatalog<T extends Record<string, unknown>>(offer: T): T {
  const next = { ...offer } as T & { images?: unknown };
  delete (next as Record<string, unknown>).videoUrl;
  delete (next as Record<string, unknown>).floorPlanUrl;
  delete (next as Record<string, unknown>).floorPlan3dUrl;
  delete (next as Record<string, unknown>).floorPlanScanMeta;

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
