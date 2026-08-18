export type RoomScanWallSegment = {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  lengthM?: number;
  /** Wysokość ściany (podłoga → sufit), metry. */
  heightM?: number;
};

export type RoomScanObjectCategory =
  | 'storage'
  | 'refrigerator'
  | 'stove'
  | 'bed'
  | 'sink'
  | 'washerDryer'
  | 'toilet'
  | 'bathtub'
  | 'oven'
  | 'dishwasher'
  | 'table'
  | 'sofa'
  | 'chair'
  | 'fireplace'
  | 'television'
  | 'stairs'
  | 'unknown';

export type RoomScanDetectedObject = {
  id: string;
  category: RoomScanObjectCategory;
  label: string;
  centerX: number;
  centerZ: number;
  widthM?: number;
  depthM?: number;
};

export type RoomScanOpeningKind = 'door' | 'window' | 'opening';

export type RoomScanOpening = {
  id: string;
  kind: RoomScanOpeningKind;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  lengthM?: number;
};

export type RoomScanSection = {
  key: string;
  label: string;
  centerX: number;
  centerZ: number;
  areaSqM?: number;
  /** Główne wymiary obrysu pomieszczenia, liczone w osi ścian. */
  widthM?: number;
  lengthM?: number;
  /** Średnia wysokość pomieszczenia (m), jeśli znana. */
  ceilingHeightM?: number;
  inferredFromObjects?: boolean;
};

export type FloorPlanScanMeta = {
  version: 1 | 2;
  scannedAt: string;
  roomCount: number;
  totalAreaSqM: number | null;
  /** Średnia wysokość pomieszczeń (podłoga → sufit). */
  ceilingHeightM: number | null;
  sections: RoomScanSection[];
  walls: RoomScanWallSegment[];
  objects: RoomScanDetectedObject[];
  openings: RoomScanOpening[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Obrót kierunku północy względem góry rzutu; pomiar kompasem urządzenia. */
  northRotationDegrees?: number | null;
  headingAccuracyDegrees?: number | null;
  headingSource?: 'true' | 'magnetic' | null;
  /** Osobne skany przypisane do pomieszczeń. */
  roomScans?: PropertyRoomScan[];
  roomAreaTotalSqM?: number;
};

export type RoomScanDraftAssets = {
  floorPlanPngUri: string;
  floorPlan3dUri: string;
  scanMeta: FloorPlanScanMeta;
};

export type PropertyRoomScan = {
  id: string;
  name: string;
  widthM: string;
  lengthM: string;
  heightM: string;
  areaM2: string;
  floorPlanPngUri?: string;
  floorPlan3dUri?: string;
  scanMeta?: FloorPlanScanMeta;
  scannedAt?: string;
};

export type WholePropertyScan = {
  floorPlanPngUri: string;
  floorPlan3dUri: string;
  scanMeta: FloorPlanScanMeta;
  scannedAt: string;
};
