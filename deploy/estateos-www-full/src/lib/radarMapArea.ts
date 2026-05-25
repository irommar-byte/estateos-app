/** Obliczenia obszaru radaru na mapie — parity z `RadarHomeScreen` (mobile). */

export const RADAR_AREA_RETICLE_PX = 220;
export const RADAR_AREA_MIN_KM = 0.3;
export const RADAR_AREA_MAX_KM = 10;

export function clampRadarRadius(km: number): number {
  return Math.max(RADAR_AREA_MIN_KM, Math.min(RADAR_AREA_MAX_KM, km));
}

export function kmPerPixelAt(lat: number, zoom: number): number {
  const meters =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  return meters / 1000;
}

export function radiusKmFromZoom(lat: number, zoom: number): number {
  const km = (RADAR_AREA_RETICLE_PX / 2) * kmPerPixelAt(lat, zoom);
  return Math.round(clampRadarRadius(km) * 10) / 10;
}

export function zoomFromRadiusKm(lat: number, radiusKm: number): number {
  const targetKmPerPx = clampRadarRadius(radiusKm) / (RADAR_AREA_RETICLE_PX / 2);
  const metersPerPx = targetKmPerPx * 1000;
  const cos = Math.cos((lat * Math.PI) / 180);
  const raw = Math.log2((156543.03392 * cos) / Math.max(metersPerPx, 1));
  return Math.max(8, Math.min(15.5, raw));
}

export type RadarMapAreaSelection = {
  lat: number;
  lng: number;
  radiusKm: number;
  city: string;
  district: string;
  addressLabel: string;
};
