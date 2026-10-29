import type { FloorPlanScanMeta, RoomScanWallSegment } from '@/types/roomScan';

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
    return { ...o, centerX: p.x, centerZ: p.z, rotationDeg: (o.rotationDeg || 0) - (angle * 180) / Math.PI };
  });
  const openings = (meta.openings || []).map((o) => {
    const a = rot(o.x1, o.z1);
    const c = rot(o.x2, o.z2);
    return { ...o, x1: a.x, z1: a.z, x2: c.x, z2: c.z };
  });
  const xs = walls.flatMap((w) => [w.x1, w.x2]);
  const zs = walls.flatMap((w) => [w.z1, w.z2]);
  return {
    ...meta,
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

  const comps: Array<{ id: number; cells: number[]; area: number }> = [];
  for (let c = 0; c < grid.length; c += 1) {
    if (grid[c] !== 0) continue;
    const id = comps.length + 1;
    const cells = fill(c, id);
    const area = cells.length * res * res;
    if (area >= 1) comps.push({ id, cells, area });
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
      const typeCost = !seen ? (wanted === 'bath' || wanted === 'bed' ? 0.15 : 0) : seen === wanted || (seen === 'bed' && wanted === 'room') ? -0.2 : 0.5;
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

  return comps.map((comp, ci) => {
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
    return {
      id: `plan-room-${ci}`,
      label: sec?.label || (comp.area < 3 ? '' : 'Pomieszczenie'),
      key: sec?.key || 'room',
      areaSqM: sec?.areaSqM ? Number(sec.areaSqM) : Math.round(comp.area * 10) / 10,
      labelX: minX + bx * res,
      labelZ: minZ + bz * res,
      rects,
    };
  });
}
