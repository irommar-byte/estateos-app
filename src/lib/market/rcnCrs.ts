/**
 * EPSG:2180 (PUWG 1992 / GRS80) → WGS84.
 * GML z usługi RCN podaje oś jako northing, easting (Y, X).
 */
const A = 6378137.0;
const F = 1 / 298.257222101;
const E2 = 2 * F - F * F;
const LON0 = (19 * Math.PI) / 180;
const K0 = 0.9993;
const FALSE_EASTING = 500000;
const FALSE_NORTHING = -5300000;

export function cs92ToWgs84(easting: number, northing: number): { lat: number; lng: number } {
  const x = easting - FALSE_EASTING;
  const y = northing - FALSE_NORTHING;
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const m = y / K0;
  const mu =
    m /
    (A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 * E2 * E2) / 256));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu);
  const ep2 = E2 / (1 - E2);
  const c1 = ep2 * Math.cos(phi1) ** 2;
  const t1 = Math.tan(phi1) ** 2;
  const n1 = A / Math.sqrt(1 - E2 * Math.sin(phi1) ** 2);
  const r1 = (A * (1 - E2)) / (1 - E2 * Math.sin(phi1) ** 2) ** 1.5;
  const d = x / (n1 * K0);
  const lat =
    phi1 -
    ((n1 * Math.tan(phi1)) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6) / 720);
  const lng =
    LON0 +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5) / 120) /
      Math.cos(phi1);
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

/** GML pos w EPSG:2180: "northing easting". */
export function parseCs92Pos(pos: string): { lat: number; lng: number } | null {
  const parts = String(pos || '')
    .trim()
    .split(/\s+/)
    .map(Number);
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  const northing = parts[0];
  const easting = parts[1];
  if (easting < 100000 || easting > 900000 || northing < 100000 || northing > 900000) return null;
  const { lat, lng } = cs92ToWgs84(easting, northing);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 48.8 || lat > 55.2 || lng < 13.8 || lng > 24.5) return null;
  return { lat, lng };
}
