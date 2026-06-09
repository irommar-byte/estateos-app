/** Great-circle distance in kilometres between two WGS84 points. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(km: number, locale: string): string {
  if (!Number.isFinite(km)) return "";
  const rounded = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return locale === "pl" ? `~${rounded} km` : locale === "uk" ? `~${rounded} км` : `~${rounded} km`;
}
