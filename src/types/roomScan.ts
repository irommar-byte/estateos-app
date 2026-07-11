export type RoomScanWallSegment = {
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
};

export type FloorPlanScanMeta = {
  version: 1;
  scannedAt: string;
  roomCount: number;
  totalAreaSqM: number | null;
  sections: RoomScanSection[];
  walls: RoomScanWallSegment[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
};
