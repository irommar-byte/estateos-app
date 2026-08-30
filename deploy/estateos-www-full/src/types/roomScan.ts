export type RoomScanWallSegment = {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  lengthM?: number;
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
  heightM?: number;
  rotationDeg?: number;
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
  widthM?: number;
  lengthM?: number;
  ceilingHeightM?: number;
  inferredFromObjects?: boolean;
  userAssigned?: boolean;
};

export type PropertyRoomScan = {
  id: string;
  name: string;
  typeKey?: string;
  sourceSectionIndex?: number;
  widthM: string;
  lengthM: string;
  heightM: string;
  areaM2: string;
  floorPlanPngUri?: string;
  floorPlan3dUri?: string;
  scanMeta?: FloorPlanScanMeta;
  scannedAt?: string;
};

export type FloorPlanScanMeta = {
  version: 1 | 2;
  scannedAt: string;
  roomCount: number;
  totalAreaSqM: number | null;
  ceilingHeightM?: number | null;
  sections: RoomScanSection[];
  walls: RoomScanWallSegment[];
  objects?: RoomScanDetectedObject[];
  openings?: RoomScanOpening[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  northRotationDegrees?: number | null;
  headingAccuracyDegrees?: number | null;
  headingSource?: 'true' | 'magnetic' | null;
  roomScans?: PropertyRoomScan[];
  roomAreaTotalSqM?: number;
};
