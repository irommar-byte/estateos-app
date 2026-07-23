import type { ProPhotoSessionExampleId } from '../components/ProPhotoSessionExampleCard';
import type { FloorPlanScanMeta, RoomScanSection, RoomScanWallSegment } from '../types/roomScan';

const WALKTHROUGH_3D_URL =
  'https://cdn.jsdelivr.net/gh/google/model-viewer@master/packages/shared-assets/models/Astronaut.usdz';

const FLOOR_PLAN_IMAGES: Record<ProPhotoSessionExampleId, string> = {
  warsaw:
    'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?q=80&w=1400&auto=format&fit=crop',
  berlin:
    'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=1400&auto=format&fit=crop',
  kyiv:
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1400&auto=format&fit=crop',
};

function seg(x1: number, z1: number, x2: number, z2: number): RoomScanWallSegment {
  const lengthM = Math.hypot(x2 - x1, z2 - z1);
  return { x1, z1, x2, z2, lengthM: Number(lengthM.toFixed(2)) };
}

function rectWalls(x0: number, z0: number, x1: number, z1: number): RoomScanWallSegment[] {
  return [
    seg(x0, z0, x1, z0),
    seg(x1, z0, x1, z1),
    seg(x1, z1, x0, z1),
    seg(x0, z1, x0, z0),
  ];
}

function buildMeta(
  walls: RoomScanWallSegment[],
  sections: RoomScanSection[],
  totalAreaSqM: number,
  scannedAt: string,
): FloorPlanScanMeta {
  const xs = walls.flatMap((w) => [w.x1, w.x2]);
  const zs = walls.flatMap((w) => [w.z1, w.z2]);
  const pad = 0.65;
  return {
    version: 1,
    scannedAt,
    roomCount: sections.length,
    totalAreaSqM,
    ceilingHeightM: 2.7,
    sections,
    walls,
    objects: [],
    openings: [],
    bounds: {
      minX: Math.min(...xs) - pad,
      maxX: Math.max(...xs) + pad,
      minZ: Math.min(...zs) - pad,
      maxZ: Math.max(...zs) + pad,
    },
  };
}

/** Penthouse Mokotów — salon z antresolą, 2 sypialnie, kuchnia, łazienka, hol, taras. */
const WARSAW_WALLS: RoomScanWallSegment[] = [
  ...rectWalls(0, 0, 9.2, 8.8),
  seg(0, 4.6, 5.4, 4.6),
  seg(5.4, 0, 5.4, 4.6),
  seg(5.4, 3.1, 9.2, 3.1),
  seg(7.1, 3.1, 7.1, 4.6),
  seg(5.4, 4.6, 7.1, 4.6),
  seg(4.4, 4.6, 4.4, 8.8),
  seg(4.4, 6.9, 7.1, 6.9),
  seg(7.1, 4.6, 7.1, 8.8),
];

const WARSAW_SECTIONS: RoomScanSection[] = [
  { key: 'livingRoom', label: 'Salon', centerX: 2.7, centerZ: 2.3, areaSqM: 24.8 },
  { key: 'kitchen', label: 'Kuchnia', centerX: 7.3, centerZ: 1.55, areaSqM: 11.2 },
  { key: 'hallway', label: 'Hol', centerX: 6.25, centerZ: 3.85, areaSqM: 2.6 },
  { key: 'bathroom', label: 'Łazienka', centerX: 8.15, centerZ: 3.85, areaSqM: 3.4 },
  { key: 'bedroom', label: 'Sypialnia I', centerX: 2.2, centerZ: 6.7, areaSqM: 18.4 },
  { key: 'bedroom', label: 'Sypialnia II', centerX: 5.75, centerZ: 5.75, areaSqM: 8.8 },
  { key: 'balcony', label: 'Taras', centerX: 8.15, centerZ: 6.65, areaSqM: 7.6 },
];

/** Altbau Prenzlauer Berg — 4 pokoje, otwarty salon, kuchnia, łazienka, hol. */
const BERLIN_WALLS: RoomScanWallSegment[] = [
  ...rectWalls(0, 0, 10.6, 9.4),
  seg(0, 5.2, 6.8, 5.2),
  seg(6.8, 0, 6.8, 5.2),
  seg(6.8, 3.4, 10.6, 3.4),
  seg(8.4, 3.4, 8.4, 5.2),
  seg(4.9, 5.2, 4.9, 9.4),
  seg(4.9, 7.1, 6.8, 7.1),
  seg(6.8, 5.2, 6.8, 9.4),
  seg(8.4, 5.2, 8.4, 9.4),
];

const BERLIN_SECTIONS: RoomScanSection[] = [
  { key: 'livingRoom', label: 'Wohnzimmer', centerX: 3.4, centerZ: 2.6, areaSqM: 35.4 },
  { key: 'kitchen', label: 'Küche', centerX: 8.7, centerZ: 1.7, areaSqM: 12.8 },
  { key: 'diningRoom', label: 'Esszimmer', centerX: 3.2, centerZ: 7.3, areaSqM: 14.6 },
  { key: 'bedroom', label: 'Schlafzimmer I', centerX: 5.85, centerZ: 6.15, areaSqM: 9.2 },
  { key: 'bedroom', label: 'Schlafzimmer II', centerX: 5.85, centerZ: 8.3, areaSqM: 8.4 },
  { key: 'office', label: 'Arbeitszimmer', centerX: 9.5, centerZ: 7.3, areaSqM: 8.8 },
  { key: 'bathroom', label: 'Bad', centerX: 9.5, centerZ: 4.3, areaSqM: 4.6 },
  { key: 'hallway', label: 'Flur', centerX: 7.6, centerZ: 4.3, areaSqM: 3.2 },
];

/** Apartament Peczersk — 2 pokoje, kuchnia otwarta, łazienka, balkon. */
const KYIV_WALLS: RoomScanWallSegment[] = [
  ...rectWalls(0, 0, 8.4, 7.6),
  seg(0, 4.1, 5.2, 4.1),
  seg(5.2, 0, 5.2, 4.1),
  seg(5.2, 2.6, 8.4, 2.6),
  seg(6.9, 2.6, 6.9, 4.1),
  seg(3.6, 4.1, 3.6, 7.6),
  seg(3.6, 5.9, 5.2, 5.9),
  seg(6.9, 4.1, 6.9, 7.6),
];

const KYIV_SECTIONS: RoomScanSection[] = [
  { key: 'livingRoom', label: 'Вітальня', centerX: 2.6, centerZ: 2.05, areaSqM: 21.3 },
  { key: 'kitchen', label: 'Кухня', centerX: 6.8, centerZ: 1.3, areaSqM: 8.4 },
  { key: 'hallway', label: 'Коридор', centerX: 6.05, centerZ: 3.35, areaSqM: 2.1 },
  { key: 'bathroom', label: 'Ванна', centerX: 7.65, centerZ: 3.35, areaSqM: 3.2 },
  { key: 'bedroom', label: 'Спальня I', centerX: 1.8, centerZ: 5.85, areaSqM: 14.2 },
  { key: 'bedroom', label: 'Спальня II', centerX: 4.4, centerZ: 6.75, areaSqM: 7.8 },
  { key: 'balcony', label: 'Балкон', centerX: 7.65, centerZ: 5.9, areaSqM: 5.4 },
];

const SCAN_META: Record<ProPhotoSessionExampleId, FloorPlanScanMeta> = {
  warsaw: buildMeta(WARSAW_WALLS, WARSAW_SECTIONS, 98, '2026-06-12T09:15:00.000Z'),
  berlin: buildMeta(BERLIN_WALLS, BERLIN_SECTIONS, 112, '2026-06-10T14:40:00.000Z'),
  kyiv: buildMeta(KYIV_WALLS, KYIV_SECTIONS, 86, '2026-06-08T11:05:00.000Z'),
};

export function getProPhotoSessionSampleFloorPlanAssets(id: ProPhotoSessionExampleId) {
  const meta = SCAN_META[id];
  return {
    floorPlanUrl: FLOOR_PLAN_IMAGES[id],
    floorPlan3dUrl: WALKTHROUGH_3D_URL,
    floorPlanScanMeta: JSON.stringify(meta),
  };
}
