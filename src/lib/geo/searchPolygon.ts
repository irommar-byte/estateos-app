/**
 * Obszar poszukiwań narysowany przez klienta na mapie: lista punktów [lng, lat].
 */

export type LngLat = [number, number];

export function parseSearchPolygon(raw: unknown): LngLat[] | null {
  if (!Array.isArray(raw)) return null;
  const points: LngLat[] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const lng = Number(p[0]);
    const lat = Number(p[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    points.push([lng, lat]);
  }
  return points.length >= 3 ? points.slice(0, 60) : null;
}

/** Ray casting. */
export function pointInPolygon(lng: number, lat: number, polygon: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Oferta pasuje do obszaru, gdy jest w środku. Oferta bez współrzędnych nie jest odrzucana
 * (nie karzemy ogłoszeń bez pinezki — oceni je reszta kryteriów).
 */
export function offerInsideSearchPolygon(polygonRaw: unknown, offer: { lat?: unknown; lng?: unknown }): boolean {
  const polygon = parseSearchPolygon(polygonRaw);
  if (!polygon) return true;
  const lat = Number(offer.lat);
  const lng = Number(offer.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return true;
  return pointInPolygon(lng, lat, polygon);
}
