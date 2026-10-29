import type { FloorPlanScanMeta, PropertyRoomScan } from '@/types/roomScan';

export type PlanSpec = { label: string; value: string };

const num = (v: unknown): number | null => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmt = (n: number, digits = 2) => n.toFixed(digits).replace(/\.?0+$/, '').replace('.', ',');

/**
 * Parametry, które zebrał LiDAR, do podpisu pod rzutem: wymiary, wysokość, metraż, kubatura, okna i drzwi.
 * Dla pokoju — jego pomiary; dla całego mieszkania — sumy i średnia wysokość.
 */
export function planSpecs(room: PropertyRoomScan | null, meta: FloorPlanScanMeta | null | undefined, rooms: PropertyRoomScan[]): PlanSpec[] {
  const out: PlanSpec[] = [];
  const countOpenings = (list: Array<{ kind?: string }> | undefined) => ({
    windows: (list || []).filter((o) => o.kind === 'window').length,
    doors: (list || []).filter((o) => o.kind === 'door').length,
  });
  if (room) {
    const w = num(room.widthM);
    const l = num(room.lengthM);
    const h = num(room.heightM) ?? num(meta?.ceilingHeightM);
    const a = num(room.areaM2) ?? num(meta?.totalAreaSqM);
    if (w) out.push({ label: 'Szerokość', value: `${fmt(w)} m` });
    if (l) out.push({ label: 'Długość', value: `${fmt(l)} m` });
    if (h) out.push({ label: 'Wysokość', value: `${fmt(h)} m` });
    if (a) out.push({ label: 'Powierzchnia', value: `${fmt(a, 1)} m²` });
    if (a && h) out.push({ label: 'Kubatura', value: `${fmt(a * h, 1)} m³` });
    if (w && l) out.push({ label: 'Obwód', value: `${fmt(2 * (w + l), 1)} m` });
    const o = countOpenings(room.scanMeta?.openings || meta?.openings);
    if (o.windows) out.push({ label: 'Okna', value: String(o.windows) });
    if (o.doors) out.push({ label: 'Drzwi', value: String(o.doors) });
    return out;
  }
  const areaSum = rooms.reduce((sum, r) => sum + (num(r.areaM2) || 0), 0);
  const area = areaSum || num(meta?.totalAreaSqM);
  const heights = rooms.map((r) => num(r.heightM)).filter((v): v is number => v != null);
  const h = heights.length ? heights.reduce((s, v) => s + v, 0) / heights.length : num(meta?.ceilingHeightM);
  const b = meta?.bounds;
  if (area) out.push({ label: 'Powierzchnia', value: `${fmt(area, 1)} m²` });
  if (rooms.length) out.push({ label: 'Pomieszczenia', value: String(rooms.length) });
  if (h) out.push({ label: 'Wysokość', value: `${fmt(h)} m` });
  if (area && h) out.push({ label: 'Kubatura', value: `${fmt(area * h, 0)} m³` });
  if (b && meta?.walls?.length) {
    const sx = b.maxX - b.minX;
    const sz = b.maxZ - b.minZ;
    if (sx > 0.5 && sz > 0.5) out.push({ label: 'Obrys', value: `${fmt(Math.max(sx, sz), 1)} × ${fmt(Math.min(sx, sz), 1)} m` });
  }
  const whole = countOpenings(meta?.openings);
  const fromRooms = rooms.reduce(
    (acc, r) => {
      const o = countOpenings(r.scanMeta?.openings);
      return { windows: acc.windows + o.windows, doors: acc.doors + o.doors };
    },
    { windows: 0, doors: 0 },
  );
  const windows = whole.windows || fromRooms.windows;
  const doors = whole.doors || fromRooms.doors;
  if (windows) out.push({ label: 'Okna', value: String(windows) });
  if (doors) out.push({ label: 'Drzwi', value: String(doors) });
  return out;
}
