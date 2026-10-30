import type { FloorPlanScanMeta } from '../../types/roomScan';

type PlanRoom = { label: string; rects: Array<[number, number, number, number]> };

/** Strony świata po polsku (8 kierunków) i pora słońca dla okien wychodzących w danym kierunku. */
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type CompassDir = (typeof DIRS)[number];
export const DIR_LABEL: Record<CompassDir, string> = {
  N: 'północ',
  NE: 'płn.-wsch.',
  E: 'wschód',
  SE: 'płd.-wsch.',
  S: 'południe',
  SW: 'płd.-zach.',
  W: 'zachód',
  NW: 'płn.-zach.',
};
const SUN: Record<CompassDir, string> = {
  N: 'światło rozproszone',
  NE: 'wczesny poranek',
  E: 'rano',
  SE: 'przedpołudnie',
  S: 'słońce przez cały dzień',
  SW: 'popołudnie',
  W: 'popołudnie i zachód',
  NW: 'wieczór latem',
};
/** Przybliżone godziny bezpośredniego słońca w polskim klimacie (średnio w roku). */
const SUN_HOURS: Record<CompassDir, number> = { N: 0.5, NE: 2, E: 3.5, SE: 5, S: 6.5, SW: 5, W: 3.5, NW: 2 };

export type RoomExposure = { room: string; dirs: CompassDir[]; sun: string; sunHours: number };

/** Kąt północy w układzie planu (atan2(z, x)) — taki sam jak róża wiatrów w aplikacji. */
export function northAngleDeg(meta: FloorPlanScanMeta | null | undefined): number | null {
  const rot = meta?.northRotationDegrees;
  return rot != null && Number.isFinite(rot) ? rot - 90 : null;
}

function bearingToDir(bearing: number): CompassDir {
  const b = ((bearing % 360) + 360) % 360;
  return DIRS[Math.round(b / 45) % 8];
}

function inRoom(room: PlanRoom, x: number, z: number) {
  return room.rects.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
}

/**
 * Ekspozycja okien: dla każdego okna — w którym jest pokoju i na którą stronę świata wychodzi.
 * Działa, gdy skan ma kompas (northRotationDegrees) i okna (openings: window).
 */
export function windowExposure(meta: FloorPlanScanMeta | null | undefined, singleRoomName?: string | null): RoomExposure[] {
  const north = northAngleDeg(meta);
  const windows = (meta?.openings || []).filter((o) => o.kind === 'window');
  if (north == null || !windows.length || !meta) return [];
  // W aplikacji liczymy ekspozycję per pokój (każdy skan pokoju ma swój kompas).
  const rooms: PlanRoom[] = [];
  const cx = (meta.bounds.minX + meta.bounds.maxX) / 2;
  const cz = (meta.bounds.minZ + meta.bounds.maxZ) / 2;
  const byRoom = new Map<string, Set<CompassDir>>();
  for (const w of windows) {
    const mx = (w.x1 + w.x2) / 2;
    const mz = (w.z1 + w.z2) / 2;
    const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1) || 1;
    // Dwie normalne ściany; „na zewnątrz” to ta, po której stronie nie ma pokoju (albo dalej od środka).
    const n1 = { x: -(w.z2 - w.z1) / len, z: (w.x2 - w.x1) / len };
    const probe = 0.35;
    const side = (n: { x: number; z: number }) => ({ x: mx + n.x * probe, z: mz + n.z * probe });
    let roomName = singleRoomName || null;
    let outward = n1;
    if (!singleRoomName) {
      const a = side(n1);
      const b = side({ x: -n1.x, z: -n1.z });
      const ra = rooms.find((r) => inRoom(r, a.x, a.z));
      const rb = rooms.find((r) => inRoom(r, b.x, b.z));
      if (ra && !rb) {
        roomName = ra.label;
        outward = { x: -n1.x, z: -n1.z };
      } else if (rb && !ra) {
        roomName = rb.label;
        outward = n1;
      } else {
        roomName = (ra || rb)?.label || null;
        outward = (mx - cx) * n1.x + (mz - cz) * n1.z >= 0 ? n1 : { x: -n1.x, z: -n1.z };
      }
    } else {
      outward = (mx - cx) * n1.x + (mz - cz) * n1.z >= 0 ? n1 : { x: -n1.x, z: -n1.z };
    }
    if (!roomName) continue;
    const phi = (Math.atan2(outward.z, outward.x) * 180) / Math.PI;
    const dir = bearingToDir(phi - north);
    const set = byRoom.get(roomName) || new Set<CompassDir>();
    set.add(dir);
    byRoom.set(roomName, set);
  }
  return [...byRoom.entries()].map(([room, set]) => {
    const dirs = DIRS.filter((d) => set.has(d));
    const best = dirs.reduce((acc, d) => (SUN_HOURS[d] > SUN_HOURS[acc] ? d : acc), dirs[0]);
    const sunHours = Math.min(9, dirs.reduce((sum, d) => sum + SUN_HOURS[d], 0) * (dirs.length > 1 ? 0.7 : 1));
    return { room, dirs, sun: SUN[best], sunHours: Math.round(sunHours * 2) / 2 };
  });
}
