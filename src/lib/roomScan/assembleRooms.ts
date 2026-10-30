import type { FloorPlanScanMeta, RoomScanWallSegment } from '../../types/roomScan';
import { detectPlanRooms } from './planNormalize';

/**
 * Plan całego mieszkania złożony z osobnych skanów pokoi.
 * Każdy skan ma własny układ współrzędnych, więc pokoje łączymy przez wspólne drzwi:
 * otwór drzwiowy (nadproże ~2 m) jednego pokoju kładziemy na otworze drugiego, po drugiej stronie ściany.
 * Wybieramy ułożenie, w którym pokoje na siebie nie nachodzą i jak najdłużej przylegają ścianami.
 */
type Pt = { x: number; z: number };
type Seg = { a: Pt; b: Pt };
type Door = Seg & { len: number; mid: Pt; ang: number; used?: boolean };
type RoomIn = { name: string; key?: string; area?: number; meta: FloorPlanScanMeta };
type Placed = { room: RoomIn; rot: number; tx: number; tz: number; walls: Seg[]; doors: Door[]; cells: Set<string> };

const RES = 0.1;
const cellKey = (x: number, z: number) => `${Math.round(x / RES)},${Math.round(z / RES)}`;

function doorsOf(meta: FloorPlanScanMeta): Door[] {
  const walls = meta.walls || [];
  const out: Door[] = [];
  const candidates = [
    ...(meta.openings || []).filter((o) => o.kind === 'door' || o.kind === 'opening').map((o) => ({ x1: o.x1, z1: o.z1, x2: o.x2, z2: o.z2 })),
    // RoomPlan zapisuje drzwi jako niski fragment ściany (nadproże 1,9–2,25 m) o szerokości 0,6–1,2 m.
    ...walls.filter((w) => {
      const h = Number(w.heightM || 0);
      const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
      return h > 1.85 && h < 2.25 && len > 0.55 && len < 1.3;
    }),
  ];
  for (const c of candidates) {
    const len = Math.hypot(c.x2 - c.x1, c.z2 - c.z1);
    const mid = { x: (c.x1 + c.x2) / 2, z: (c.z1 + c.z2) / 2 };
    if (out.some((d) => Math.hypot(d.mid.x - mid.x, d.mid.z - mid.z) < 0.25)) continue;
    out.push({ a: { x: c.x1, z: c.z1 }, b: { x: c.x2, z: c.z2 }, len, mid, ang: Math.atan2(c.z2 - c.z1, c.x2 - c.x1) });
  }
  return out;
}

function roomCells(meta: FloorPlanScanMeta): Pt[] {
  const rooms = detectPlanRooms(meta, 0.1);
  const pts: Pt[] = [];
  const main = rooms.sort((a, b) => b.areaSqM - a.areaSqM)[0];
  if (!main) return pts;
  for (const [x0, z0, x1, z1] of main.rects) {
    for (let x = x0 + RES / 2; x < x1; x += RES) pts.push({ x, z: (z0 + z1) / 2 });
  }
  return pts;
}

/** Dominujący kierunek ścian (średnia kołowa kąta ×4, ważona długością) — w stopniach, okres 90°. */
function dominantDeg(walls: Seg[]): number {
  let sx = 0;
  let sy = 0;
  for (const w of walls) {
    const dx = w.b.x - w.a.x;
    const dz = w.b.z - w.a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    const a = Math.atan2(dz, dx) * 4;
    sx += Math.cos(a) * len;
    sy += Math.sin(a) * len;
  }
  return ((Math.atan2(sy, sx) / 4) * 180) / Math.PI;
}

function axisDiff(a: number, b: number): number {
  const d = (((a - b) % 90) + 90) % 90;
  return Math.min(d, 90 - d);
}

function transform(p: Pt, rot: number, tx: number, tz: number): Pt {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return { x: p.x * c - p.z * s + tx, z: p.x * s + p.z * c + tz };
}

function interiorSide(cells: Set<string>, door: Door): number {
  // +1, gdy wnętrze pokoju leży po stronie normalnej (−sin, cos) odcinka drzwi.
  const n = { x: -Math.sin(door.ang), z: Math.cos(door.ang) };
  let plus = 0;
  let minus = 0;
  for (const d of [0.25, 0.4, 0.6]) {
    if (cells.has(cellKey(door.mid.x + n.x * d, door.mid.z + n.z * d))) plus += 1;
    if (cells.has(cellKey(door.mid.x - n.x * d, door.mid.z - n.z * d))) minus += 1;
  }
  return plus >= minus ? 1 : -1;
}

function placeRoom(room: RoomIn, rot: number, tx: number, tz: number, localCells: Pt[]): Placed {
  const walls = (room.meta.walls || []).map((w) => ({ a: transform({ x: w.x1, z: w.z1 }, rot, tx, tz), b: transform({ x: w.x2, z: w.z2 }, rot, tx, tz) }));
  const doors = doorsOf(room.meta).map((d) => {
    const a = transform(d.a, rot, tx, tz);
    const b = transform(d.b, rot, tx, tz);
    return { a, b, len: d.len, mid: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, ang: Math.atan2(b.z - a.z, b.x - a.x) };
  });
  const cells = new Set(localCells.map((p) => transform(p, rot, tx, tz)).map((p) => cellKey(p.x, p.z)));
  return { room, rot, tx, tz, walls, doors, cells };
}

function contactScore(candidate: Placed, placed: Placed[]): number {
  // Długość ścian kandydata biegnących równolegle i blisko (≤ 0,35 m) ścian już ułożonych pokoi.
  let score = 0;
  for (const w of candidate.walls) {
    const len = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z);
    if (len < 0.4) continue;
    const steps = Math.ceil(len / 0.2);
    for (let i = 0; i <= steps; i += 1) {
      const p = { x: w.a.x + ((w.b.x - w.a.x) * i) / steps, z: w.a.z + ((w.b.z - w.a.z) * i) / steps };
      const near = placed.some((pl) =>
        pl.walls.some((v) => {
          const vx = v.b.x - v.a.x;
          const vz = v.b.z - v.a.z;
          const vl = Math.hypot(vx, vz);
          if (vl < 0.4) return false;
          const cross = Math.abs((w.b.x - w.a.x) * vz - (w.b.z - w.a.z) * vx) / (len * vl);
          if (cross > 0.12) return false; // nie równoległe
          const t = Math.max(0, Math.min(1, ((p.x - v.a.x) * vx + (p.z - v.a.z) * vz) / (vl * vl)));
          return Math.hypot(p.x - (v.a.x + vx * t), p.z - (v.a.z + vz * t)) <= 0.35;
        }),
      );
      if (near) score += len / steps;
    }
  }
  return score;
}

export type AssembledPlan = { meta: FloorPlanScanMeta; confidence: number; placed: number; total: number };

export function assembleRoomScans(rooms: RoomIn[]): AssembledPlan | null {
  const usable = rooms.filter((r) => r.meta?.walls?.length >= 3);
  if (usable.length < 2) return null;
  const local = new Map(usable.map((r) => [r, roomCells(r.meta)]));
  // Zaczynamy od pokoju z największą liczbą drzwi (zwykle przedpokój).
  const hub = [...usable].sort((a, b) => doorsOf(b.meta).length - doorsOf(a.meta).length || (b.area || 0) - (a.area || 0))[0];
  const placed: Placed[] = [placeRoom(hub, 0, 0, 0, local.get(hub)!)];
  const hubAxis = dominantDeg(placed[0].walls);
  const remaining = usable.filter((r) => r !== hub);
  let confidenceSum = 0;

  while (remaining.length) {
    type Pick = { room: RoomIn; placedRoom: Placed; score: number; anchor: Door; own: number };
    let best = null as Pick | null;
    for (const room of remaining) {
      const roomDoors = doorsOf(room.meta);
      const cellsLocal = local.get(room)!;
      for (const target of placed) {
        for (const anchor of target.doors) {
          if (anchor.used) continue;
          const inside = interiorSide(target.cells, anchor);
          const n = { x: -Math.sin(anchor.ang) * inside, z: Math.cos(anchor.ang) * inside };
          roomDoors.forEach((door, di) => {
            const lenPenalty = Math.abs(door.len - anchor.len);
            if (lenPenalty > 0.3) return;
            for (const flip of [0, Math.PI]) {
              let rot = anchor.ang - door.ang + flip;
              // Ściany mieszkania są do siebie prostopadłe: dociągamy obrót pokoju do osi pokoju bazowego.
              const ownAxis = dominantDeg(
                (room.meta.walls || []).map((w) => ({ a: { x: w.x1, z: w.z1 }, b: { x: w.x2, z: w.z2 } })),
              );
              const turned = ownAxis + (rot * 180) / Math.PI;
              const diff = (((hubAxis - turned) % 90) + 135) % 90 - 45;
              if (Math.abs(diff) > 12) continue;
              rot += (diff * Math.PI) / 180;
              for (const thick of [0.1, 0.18, 0.26]) {
                const mid = transform(door.mid, rot, 0, 0);
                // Środek drzwi kandydata na środek drzwi kotwicy, przesunięty o grubość ściany na zewnątrz kotwicy.
                const tx = anchor.mid.x - n.x * thick - mid.x;
                const tz = anchor.mid.z - n.z * thick - mid.z;
                const cand = placeRoom(room, rot, tx, tz, cellsLocal);
                // Wnętrze kandydata musi leżeć po drugiej stronie drzwi niż wnętrze kotwicy.
                const candDoor = cand.doors[di];
                if (!candDoor) continue;
                const probe = { x: anchor.mid.x - n.x * (thick + 0.4), z: anchor.mid.z - n.z * (thick + 0.4) };
                if (!cand.cells.has(cellKey(probe.x, probe.z))) continue;
                let overlap = 0;
                for (const c of cand.cells) if (placed.some((p) => p.cells.has(c))) overlap += 1;
                const overlapM2 = overlap * RES * RES;
                const contact = contactScore(cand, placed);
                const score = contact - overlapM2 * 6 - lenPenalty * 4;
                if (!best || score > best.score) best = { room, placedRoom: cand, score, anchor, own: di };
              }
            }
          });
        }
      }
    }
    const chosen = best as Pick | null;
    if (!chosen) break;
    best = chosen;
    chosen.anchor.used = true;
    chosen.placedRoom.doors[chosen.own].used = true;
    placed.push(chosen.placedRoom);
    remaining.splice(remaining.indexOf(chosen.room), 1);
    confidenceSum += chosen.score > 1.5 ? 1 : chosen.score > 0.5 ? 0.6 : 0.2;
  }

  const walls: RoomScanWallSegment[] = placed.flatMap((p) =>
    (p.room.meta.walls || []).map((w) => {
      const a = transform({ x: w.x1, z: w.z1 }, p.rot, p.tx, p.tz);
      const b = transform({ x: w.x2, z: w.z2 }, p.rot, p.tx, p.tz);
      return { ...w, x1: a.x, z1: a.z, x2: b.x, z2: b.z };
    }),
  );
  const objects = placed.flatMap((p) =>
    (p.room.meta.objects || []).map((o) => {
      const c = transform({ x: o.centerX, z: o.centerZ }, p.rot, p.tx, p.tz);
      return { ...o, centerX: c.x, centerZ: c.z, rotationDeg: o.rotationDeg == null ? undefined : o.rotationDeg + (p.rot * 180) / Math.PI };
    }),
  );
  const openings = placed.flatMap((p) =>
    (p.room.meta.openings || []).map((o) => {
      const a = transform({ x: o.x1, z: o.z1 }, p.rot, p.tx, p.tz);
      const b = transform({ x: o.x2, z: o.z2 }, p.rot, p.tx, p.tz);
      return { ...o, x1: a.x, z1: a.z, x2: b.x, z2: b.z };
    }),
  );
  const sections = placed.map((p) => {
    const xs = [...p.cells].map((k) => Number(k.split(',')[0]) * RES);
    const zs = [...p.cells].map((k) => Number(k.split(',')[1]) * RES);
    const sec = p.room.meta.sections?.[0];
    return {
      ...(sec || { key: p.room.key || 'room', label: p.room.name }),
      label: p.room.name,
      areaSqM: p.room.area ?? sec?.areaSqM,
      centerX: xs.reduce((s, v) => s + v, 0) / (xs.length || 1),
      centerZ: zs.reduce((s, v) => s + v, 0) / (zs.length || 1),
    };
  });
  const allX = walls.flatMap((w) => [w.x1, w.x2]);
  const allZ = walls.flatMap((w) => [w.z1, w.z2]);
  const first = placed[0].room.meta;
  return {
    meta: {
      ...first,
      version: 2,
      roomCount: placed.length,
      sections: sections as FloorPlanScanMeta['sections'],
      walls,
      objects,
      openings,
      // Kompas pierwszego pokoju (w jego układzie), obrócony razem z nim (pokój bazowy ma obrót 0).
      northRotationDegrees: first.northRotationDegrees ?? null,
      bounds: { minX: Math.min(...allX), maxX: Math.max(...allX), minZ: Math.min(...allZ), maxZ: Math.max(...allZ) },
    },
    confidence: placed.length > 1 ? confidenceSum / (placed.length - 1) : 0,
    placed: placed.length,
    total: usable.length,
  };
}
