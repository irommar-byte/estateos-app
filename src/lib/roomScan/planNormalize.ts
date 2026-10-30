import type { FloorPlanScanMeta, RoomScanDetectedObject, RoomScanObjectCategory, RoomScanWallSegment } from '../../types/roomScan';

/**
 * Prostuje skan LiDAR do rysowania: obraca cały plan tak, by dominujące ściany szły w poziomie i pionie,
 * a ściany odchylone od osi o kilka stopni ustawia dokładnie pod kątem prostym. Dane w bazie zostają bez zmian.
 */
const SNAP_DEG = 8;

function dominantAngle(walls: RoomScanWallSegment[]): number {
  // Średnia kołowa kąta ×4 (okres 90°), ważona długością ściany.
  let sx = 0;
  let sy = 0;
  for (const w of walls) {
    const dx = w.x2 - w.x1;
    const dz = w.z2 - w.z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.3) continue;
    const a = Math.atan2(dz, dx) * 4;
    sx += Math.cos(a) * len;
    sy += Math.sin(a) * len;
  }
  if (!sx && !sy) return 0;
  return Math.atan2(sy, sx) / 4;
}

function snapWall(w: RoomScanWallSegment): RoomScanWallSegment {
  const dx = w.x2 - w.x1;
  const dz = w.z2 - w.z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return w;
  const deg = (Math.atan2(dz, dx) * 180) / Math.PI;
  const nearest = Math.round(deg / 90) * 90;
  if (Math.abs(deg - nearest) > SNAP_DEG) return w;
  const mx = (w.x1 + w.x2) / 2;
  const mz = (w.z1 + w.z2) / 2;
  const rad = (nearest * Math.PI) / 180;
  const hx = (Math.cos(rad) * len) / 2;
  const hz = (Math.sin(rad) * len) / 2;
  return { ...w, x1: mx - hx, z1: mz - hz, x2: mx + hx, z2: mz + hz };
}

/**
 * Łączy końce ścian we wspólne narożniki, a potem ustawia ściany „prawie pionowe/poziome” dokładnie w osi,
 * przesuwając narożniki razem — sąsiednie ściany zostają połączone, bez szczelin i skosów.
 */
function weldAndSquare(walls: RoomScanWallSegment[], tol = 0.12): RoomScanWallSegment[] {
  const pts: Array<{ x: number; z: number }> = [];
  const snap = (x: number, z: number) => {
    const hit = pts.find((p) => Math.hypot(p.x - x, p.z - z) <= tol);
    if (hit) return hit;
    const p = { x, z };
    pts.push(p);
    return p;
  };
  const segs = walls.map((w) => ({ w, a: snap(w.x1, w.z1), b: snap(w.x2, w.z2) }));
  for (let iter = 0; iter < 6; iter += 1) {
    for (const seg of segs) {
      const dx = seg.b.x - seg.a.x;
      const dz = seg.b.z - seg.a.z;
      if (Math.hypot(dx, dz) < 0.05) continue;
      const deg = (Math.atan2(dz, dx) * 180) / Math.PI;
      const nearest = Math.round(deg / 90) * 90;
      if (Math.abs(deg - nearest) > SNAP_DEG) continue;
      if (Math.abs(nearest) % 180 === 0) {
        const z = (seg.a.z + seg.b.z) / 2;
        seg.a.z = z;
        seg.b.z = z;
      } else {
        const x = (seg.a.x + seg.b.x) / 2;
        seg.a.x = x;
        seg.b.x = x;
      }
    }
  }
  return segs.map(({ w, a, b }) => ({ ...w, x1: a.x, z1: a.z, x2: b.x, z2: b.z }));
}

export function normalizeScanMeta(meta: FloorPlanScanMeta | null | undefined): FloorPlanScanMeta | null {
  if (!meta?.walls?.length) return meta || null;
  const angle = dominantAngle(meta.walls);
  const b = meta.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const rot = (x: number, z: number) => ({ x: cx + (x - cx) * cos - (z - cz) * sin, z: cz + (x - cx) * sin + (z - cz) * cos });

  const walls = weldAndSquare(
    meta.walls.map((w) => {
      const a = rot(w.x1, w.z1);
      const c = rot(w.x2, w.z2);
      return snapWall({ ...w, x1: a.x, z1: a.z, x2: c.x, z2: c.z });
    }),
  );
  const sections = meta.sections.map((s) => {
    const p = rot(s.centerX, s.centerZ);
    return { ...s, centerX: p.x, centerZ: p.z };
  });
  const objects = (meta.objects || []).map((o) => {
    const p = rot(o.centerX, o.centerZ);
    // Brak orientacji w skanie (scalony skan mieszkania) → zostaje pusta; dobierze ją placePlanObjects.
    return { ...o, centerX: p.x, centerZ: p.z, rotationDeg: o.rotationDeg == null ? undefined : o.rotationDeg - (angle * 180) / Math.PI };
  });
  const openings = (meta.openings || []).map((o) => {
    const a = rot(o.x1, o.z1);
    const c = rot(o.x2, o.z2);
    return { ...o, x1: a.x, z1: a.z, x2: c.x, z2: c.z };
  });
  const xs = walls.flatMap((w) => [w.x1, w.x2]);
  const zs = walls.flatMap((w) => [w.z1, w.z2]);
  // Kompas obraca się razem z planem (kąt północy liczony w tym samym układzie co ściany).
  const northRotationDegrees =
    meta.northRotationDegrees != null && Number.isFinite(meta.northRotationDegrees)
      ? ((((meta.northRotationDegrees - (angle * 180) / Math.PI) % 360) + 360) % 360)
      : meta.northRotationDegrees;
  return {
    ...meta,
    northRotationDegrees,
    walls,
    sections,
    objects,
    openings,
    bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) },
  };
}

/* ───────────────────── pomieszczenia wykryte ze ścian ───────────────────── */

export type PlanRoom = {
  id: string;
  label: string;
  key: string;
  areaSqM: number;
  /** Optyczny środek (najdalej od ścian) — tu stoi podpis. */
  labelX: number;
  labelZ: number;
  /** Podłoga jako prostokąty wierszami: [x0, z0, x1, z1] w metrach. */
  rects: Array<[number, number, number, number]>;
};

/**
 * Rasteryzuje ściany (z nadprożami drzwi, które domykają pokoje), zalewa „na zewnątrz”
 * i zostawia zamknięte obszary. Każdy dostaje nazwę i metraż z sekcji skanu o najbliższej powierzchni.
 */
export function detectPlanRooms(meta: FloorPlanScanMeta | null | undefined, res = 0.05): PlanRoom[] {
  if (!meta?.walls?.length) return [];
  const pad = 0.3;
  const minX = meta.bounds.minX - pad;
  const minZ = meta.bounds.minZ - pad;
  const W = Math.ceil((meta.bounds.maxX - meta.bounds.minX + pad * 2) / res) + 1;
  const H = Math.ceil((meta.bounds.maxZ - meta.bounds.minZ + pad * 2) / res) + 1;
  if (W * H > 600_000) return [];
  const grid = new Int32Array(W * H); // 0 pusto, -1 ściana, -2 na zewnątrz, >0 numer pomieszczenia
  const r = 1; // grubość ściany ≈ 3 komórki
  for (const w of meta.walls) {
    const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
    const steps = Math.max(1, Math.ceil(len / (res / 2)));
    for (let i = 0; i <= steps; i += 1) {
      const gx = Math.round((w.x1 + ((w.x2 - w.x1) * i) / steps - minX) / res);
      const gz = Math.round((w.z1 + ((w.z2 - w.z1) * i) / steps - minZ) / res);
      for (let dz = -r; dz <= r; dz += 1)
        for (let dx = -r; dx <= r; dx += 1) {
          const x = gx + dx;
          const z = gz + dz;
          if (x >= 0 && z >= 0 && x < W && z < H) grid[z * W + x] = -1;
        }
    }
  }
  const fill = (start: number, value: number): number[] => {
    const cells: number[] = [];
    const stack = [start];
    grid[start] = value;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      const x = c % W;
      const z = (c - x) / W;
      const next = [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, z > 0 ? c - W : -1, z < H - 1 ? c + W : -1];
      for (const n of next) {
        if (n >= 0 && grid[n] === 0) {
          grid[n] = value;
          stack.push(n);
        }
      }
    }
    return cells;
  };
  for (let x = 0; x < W; x += 1) {
    if (grid[x] === 0) fill(x, -2);
    if (grid[(H - 1) * W + x] === 0) fill((H - 1) * W + x, -2);
  }
  for (let z = 0; z < H; z += 1) {
    if (grid[z * W] === 0) fill(z * W, -2);
    if (grid[z * W + W - 1] === 0) fill(z * W + W - 1, -2);
  }

  // Zatoki otwarte z jednej strony — np. przedpokój, w którym skaner nie złapał ściany z drzwiami wejściowymi.
  // Komórka „na zewnątrz”, która w 3 z 4 kierunków ma ścianę bliżej niż ~3 m, leży w środku mieszkania.
  const reach = Math.round(3.2 / res);
  const near = new Uint8Array(W * H);
  for (let z = 0; z < H; z += 1) {
    let last = -1e9;
    for (let x = 0; x < W; x += 1) {
      const c = z * W + x;
      if (grid[c] === -1) last = x;
      else if (x - last <= reach) near[c] += 1;
    }
    last = 1e9;
    for (let x = W - 1; x >= 0; x -= 1) {
      const c = z * W + x;
      if (grid[c] === -1) last = x;
      else if (last - x <= reach) near[c] += 1;
    }
  }
  for (let x = 0; x < W; x += 1) {
    let last = -1e9;
    for (let z = 0; z < H; z += 1) {
      const c = z * W + x;
      if (grid[c] === -1) last = z;
      else if (z - last <= reach) near[c] += 1;
    }
    last = 1e9;
    for (let z = H - 1; z >= 0; z -= 1) {
      const c = z * W + x;
      if (grid[c] === -1) last = z;
      else if (last - z <= reach) near[c] += 1;
    }
  }
  const pocket = new Uint8Array(W * H);
  for (let c = 0; c < grid.length; c += 1) {
    if (grid[c] === -2 && near[c] >= 3) {
      grid[c] = 0;
      pocket[c] = 1;
    }
  }

  const comps: Array<{ id: number; cells: number[]; area: number; pocket: boolean }> = [];
  for (let c = 0; c < grid.length; c += 1) {
    if (grid[c] !== 0) continue;
    const id = comps.length + 1;
    const cells = fill(c, id);
    const area = cells.length * res * res;
    if (area >= 1) comps.push({ id, cells, area, pocket: pocket[c] === 1 });
    else for (const cell of cells) grid[cell] = -2;
  }
  if (!comps.length) return [];

  // Sekcje skanu → pomieszczenia po najbliższej powierzchni.
  const sections = [...(meta.sections || [])].filter((s) => (s.areaSqM || 0) > 0);
  // Meble ze skanu podpowiadają typ pomieszczenia (wanna/WC → łazienka, łóżko → sypialnia, kuchenka → kuchnia).
  const compCats = comps.map(() => new Set<string>());
  for (const obj of meta.objects || []) {
    const gx = Math.round((obj.centerX - minX) / res);
    const gz = Math.round((obj.centerZ - minZ) / res);
    if (gx < 0 || gz < 0 || gx >= W || gz >= H) continue;
    const ci = comps.findIndex((comp) => comp.id === grid[gz * W + gx]);
    if (ci >= 0) compCats[ci].add(obj.category);
  }
  const kindOf = (key: string) =>
    /bath|wc|toilet|łaz/i.test(key) ? 'bath' : /bed|sypial/i.test(key) ? 'bed' : /kitchen|kuch/i.test(key) ? 'kitchen' : /hall|przedpok|korytarz/i.test(key) ? 'hall' : 'room';
  const compKind = (cats: Set<string>) =>
    cats.has('toilet') || cats.has('bathtub') ? 'bath' : cats.has('bed') ? 'bed' : cats.has('stove') || cats.has('oven') || cats.has('refrigerator') ? 'kitchen' : null;
  const pairs: Array<{ comp: number; sec: number; diff: number }> = [];
  comps.forEach((comp, ci) =>
    sections.forEach((s, si) => {
      const areaDiff = Math.abs(comp.area - Number(s.areaSqM)) / Math.max(comp.area, Number(s.areaSqM));
      const seen = compKind(compCats[ci]);
      const wanted = kindOf(`${s.key} ${s.label}`);
      const typeCost = !seen
        ? wanted === 'bath' || wanted === 'bed'
          ? 0.15
          : wanted === 'hall' && comp.pocket
            ? -0.25
            : 0
        : seen === wanted || (seen === 'bed' && wanted === 'room')
          ? -0.2
          : 0.5;
      pairs.push({ comp: ci, sec: si, diff: areaDiff + typeCost });
    }),
  );
  pairs.sort((a, b) => a.diff - b.diff);
  const compSec = new Map<number, number>();
  const usedSec = new Set<number>();
  for (const p of pairs) {
    if (compSec.has(p.comp) || usedSec.has(p.sec) || p.diff > 0.7) continue;
    compSec.set(p.comp, p.sec);
    usedSec.add(p.sec);
  }

  // Zatoka bez dopasowanego pomieszczenia to tylko wcięcie obrysu — zostaje na zewnątrz.
  comps.forEach((comp, ci) => {
    if (comp.pocket && !compSec.has(ci)) for (const cell of comp.cells) grid[cell] = -2;
  });

  return comps.flatMap((comp, ci) => {
    if (comp.pocket && !compSec.has(ci)) return [];
    // Odległość od brzegu (BFS) → komórka najdalej od ścian to optyczny środek.
    const dist = new Map<number, number>();
    const queue: number[] = [];
    for (const c of comp.cells) {
      const x = c % W;
      const edge = [c - 1, c + 1, c - W, c + W].some((n) => n < 0 || n >= grid.length || grid[n] !== comp.id) || x === 0 || x === W - 1;
      if (edge) {
        dist.set(c, 0);
        queue.push(c);
      }
    }
    let best = queue[0] ?? comp.cells[0];
    for (let qi = 0; qi < queue.length; qi += 1) {
      const c = queue[qi];
      const d = dist.get(c)!;
      if (d > (dist.get(best) ?? 0)) best = c;
      for (const n of [c - 1, c + 1, c - W, c + W]) {
        if (n >= 0 && n < grid.length && grid[n] === comp.id && !dist.has(n)) {
          dist.set(n, d + 1);
          queue.push(n);
        }
      }
    }
    const bx = best % W;
    const bz = (best - bx) / W;
    // Podłoga jako prostokąty wierszami.
    const rects: PlanRoom['rects'] = [];
    const rows = new Map<number, number[]>();
    for (const c of comp.cells) {
      const x = c % W;
      const z = (c - x) / W;
      (rows.get(z) || rows.set(z, []).get(z)!).push(x);
    }
    for (const [z, xs] of rows) {
      xs.sort((a, b) => a - b);
      let start = xs[0];
      for (let i = 1; i <= xs.length; i += 1) {
        if (i === xs.length || xs[i] !== xs[i - 1] + 1) {
          rects.push([minX + (start - 0.5) * res, minZ + (z - 0.5) * res, minX + (xs[i - 1] + 0.5) * res, minZ + (z + 0.5) * res]);
          if (i < xs.length) start = xs[i];
        }
      }
    }
    const sec = compSec.has(ci) ? sections[compSec.get(ci)!] : null;
    return [{
      id: `plan-room-${ci}`,
      label: sec?.label || (comp.area < 3 ? '' : 'Pomieszczenie'),
      key: sec?.key || 'room',
      areaSqM: sec?.areaSqM ? Number(sec.areaSqM) : Math.round(comp.area * 10) / 10,
      labelX: minX + bx * res,
      labelZ: minZ + bz * res,
      rects,
    }];
  });
}

/* ───────────────────── meble ułożone w pomieszczeniach ───────────────────── */

export type PlacedPlanObject = RoomScanDetectedObject & { widthM: number; depthM: number; rotationDeg: number };

const FALLBACK_SIZE: Partial<Record<RoomScanObjectCategory, [number, number]>> = {
  bed: [1.6, 2.0],
  sofa: [2.0, 0.9],
  table: [1.2, 0.8],
  chair: [0.5, 0.5],
  storage: [0.8, 0.5],
  refrigerator: [0.6, 0.65],
  stove: [0.6, 0.6],
  oven: [0.6, 0.6],
  dishwasher: [0.6, 0.6],
  washerDryer: [0.6, 0.6],
  sink: [0.5, 0.45],
  toilet: [0.4, 0.65],
  bathtub: [1.7, 0.75],
  television: [1.2, 0.3],
};

function inRoom(room: PlanRoom, x: number, z: number): boolean {
  for (const [x0, z0, x1, z1] of room.rects) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return true;
  return false;
}

/**
 * Meble ze skanu ustawione porządnie: równolegle do ścian (co 90°), w całości w swoim pomieszczeniu,
 * bez wchodzenia w ściany. Gdy skan nie zapisał orientacji, wybiera tę, która lepiej pasuje do pokoju
 * (szerokość wzdłuż najbliższej ściany — tak stoją szafy, wanny, łóżka wezgłowiem do ściany).
 */
export function placePlanObjects(meta: FloorPlanScanMeta | null | undefined, rooms: PlanRoom[]): PlacedPlanObject[] {
  if (!meta?.objects?.length || !rooms.length) return [];
  const walls = meta.walls || [];
  const out: PlacedPlanObject[] = [];
  const boxes: Array<[number, number, number, number]> = [];
  const seen = new Set<string>();
  // Najpierw duże (łóżka, wanny, szafy), potem drobne — krzesło ustępuje łóżku, nie odwrotnie.
  const ordered = [...meta.objects].sort((a, b) => (b.widthM || 0.5) * (b.depthM || 0.5) - (a.widthM || 0.5) * (a.depthM || 0.5));
  for (const obj of ordered) {
    if (obj.category === 'unknown') continue;
    // Kuchenka i piekarnik w jednym miejscu to jedno urządzenie.
    const dupKey = `${obj.category === 'oven' ? 'stove' : obj.category}:${obj.centerX.toFixed(1)}:${obj.centerZ.toFixed(1)}`;
    if (seen.has(dupKey)) continue;
    seen.add(dupKey);
    const fb = FALLBACK_SIZE[obj.category] || [0.6, 0.5];
    const w = obj.widthM && obj.widthM > 0.12 ? obj.widthM : fb[0];
    const d = obj.depthM && obj.depthM > 0.12 ? obj.depthM : fb[1];
    if (w * d > 5.5 && obj.category !== 'bed' && obj.category !== 'sofa') continue;

    let room = rooms.find((r) => inRoom(r, obj.centerX, obj.centerZ));
    if (!room) {
      let best = Infinity;
      for (const r of rooms) {
        for (const [x0, z0, x1, z1] of r.rects) {
          const dx = Math.max(x0 - obj.centerX, 0, obj.centerX - x1);
          const dz = Math.max(z0 - obj.centerZ, 0, obj.centerZ - z1);
          const dist = Math.hypot(dx, dz);
          if (dist < best) {
            best = dist;
            room = r;
          }
        }
      }
      if (!room || best > 0.8) continue;
    }
    const target = room;
    const misses = (cx: number, cz: number, ex: number, ez: number) => {
      let n = 0;
      for (const fx of [-1, -0.5, 0, 0.5, 1])
        for (const fz of [-1, -0.5, 0, 0.5, 1]) if (!inRoom(target, cx + fx * ex * 0.96, cz + fz * ez * 0.96)) n += 1;
      for (const [x0, z0, x1, z1] of boxes) {
        const ox = Math.min(cx + ex, x1) - Math.max(cx - ex, x0);
        const oz = Math.min(cz + ez, z1) - Math.max(cz - ez, z0);
        if (ox > 0.02 && oz > 0.02) n += 1 + Math.round((ox * oz) / 0.05);
      }
      return n;
    };

    // Najbliższa ściana: pozioma czy pionowa?
    let nearH = Infinity;
    let nearV = Infinity;
    for (const wall of walls) {
      const horizontal = Math.abs(wall.z2 - wall.z1) < Math.abs(wall.x2 - wall.x1);
      const t = Math.max(0, Math.min(1, ((obj.centerX - wall.x1) * (wall.x2 - wall.x1) + (obj.centerZ - wall.z1) * (wall.z2 - wall.z1)) / (Math.hypot(wall.x2 - wall.x1, wall.z2 - wall.z1) ** 2 || 1)));
      const dist = Math.hypot(obj.centerX - (wall.x1 + t * (wall.x2 - wall.x1)), obj.centerZ - (wall.z1 + t * (wall.z2 - wall.z1)));
      if (horizontal) nearH = Math.min(nearH, dist);
      else nearV = Math.min(nearV, dist);
    }
    const snapped = obj.rotationDeg == null ? null : (((Math.round(obj.rotationDeg / 90) * 90) % 360) + 360) % 360;
    const options = snapped != null ? [snapped] : nearH <= nearV ? [0, 90] : [90, 0];

    let pick = { rot: options[0], x: obj.centerX, z: obj.centerZ, cost: Infinity };
    for (const rot of options) {
      const quarter = rot % 180 !== 0;
      const ex = (quarter ? d : w) / 2;
      const ez = (quarter ? w : d) / 2;
      // Szukamy najbliższego miejsca, w którym mebel mieści się w całości (spirala co 5 cm, do 90 cm).
      let found = { x: obj.centerX, z: obj.centerZ, miss: misses(obj.centerX, obj.centerZ, ex, ez), shift: 0 };
      if (found.miss) {
        outer: for (let ring = 1; ring <= 24; ring += 1) {
          const step = ring * 0.05;
          for (let k = 0; k < ring * 8; k += 1) {
            const a = (k / (ring * 8)) * Math.PI * 2;
            const x = obj.centerX + Math.cos(a) * step;
            const z = obj.centerZ + Math.sin(a) * step;
            if (!inRoom(target, x, z)) continue;
            const m = misses(x, z, ex, ez);
            if (m < found.miss) found = { x, z, miss: m, shift: step };
            if (m === 0) break outer;
          }
        }
      }
      const cost = found.miss * 10 + found.shift + (rot === options[0] ? 0 : 0.35);
      if (cost < pick.cost) pick = { rot, x: found.x, z: found.z, cost };
    }
    const q = pick.rot % 180 !== 0;
    const hx = (q ? d : w) / 2;
    const hz = (q ? w : d) / 2;
    boxes.push([pick.x - hx, pick.z - hz, pick.x + hx, pick.z + hz]);
    out.push({ ...obj, centerX: pick.x, centerZ: pick.z, widthM: w, depthM: d, rotationDeg: pick.rot });
  }
  return out;
}

/**
 * Miejsce na podpis pomieszczenia: w środku pokoju, ale tam, gdzie napis (w × h metrów) nie wchodzi
 * na ściany ani na meble. Gdy się nie da, zwraca optyczny środek.
 */
export function planLabelSpot(room: PlanRoom, w: number, h: number, furniture: PlacedPlanObject[]): { x: number; z: number } {
  const boxes = furniture.map((o) => {
    const q = o.rotationDeg % 180 !== 0;
    const hx = (q ? o.depthM : o.widthM) / 2;
    const hz = (q ? o.widthM : o.depthM) / 2;
    return [o.centerX - hx, o.centerZ - hz, o.centerX + hx, o.centerZ + hz] as const;
  });
  const fits = (x: number, z: number) => {
    for (const fx of [-0.5, 0, 0.5]) for (const fz of [-0.5, 0.5]) if (!inRoom(room, x + fx * w, z + fz * h)) return false;
    return true;
  };
  const overlap = (x: number, z: number) => {
    let sum = 0;
    for (const [x0, z0, x1, z1] of boxes) {
      const ox = Math.min(x + w / 2, x1) - Math.max(x - w / 2, x0);
      const oz = Math.min(z + h / 2, z1) - Math.max(z - h / 2, z0);
      if (ox > 0 && oz > 0) sum += ox * oz;
    }
    return sum;
  };
  let best = { x: room.labelX, z: room.labelZ, cost: fits(room.labelX, room.labelZ) ? overlap(room.labelX, room.labelZ) * 10 : 1e6 };
  if (best.cost === 0) return best;
  const xs = room.rects.flatMap((r) => [r[0], r[2]]);
  const zs = room.rects.flatMap((r) => [r[1], r[3]]);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  for (let x = minX + w / 2; x <= maxX - w / 2; x += 0.08)
    for (let z = minZ + h / 2; z <= maxZ - h / 2; z += 0.08) {
      if (!fits(x, z)) continue;
      const cost = overlap(x, z) * 10 + Math.hypot(x - room.labelX, z - room.labelZ) * 0.15;
      if (cost < best.cost) best = { x, z, cost };
    }
  return best;
}
