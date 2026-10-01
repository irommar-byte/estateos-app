/**
 * Floor-plan / LiDAR persistence guards.
 *
 * Accidental `floorPlanScanMeta: null` (or empty) in a title/description save
 * used to wipe room scans + walls. Clearing now requires an explicit flag.
 */

export type FloorPlanExistingAssets = {
  floorPlanUrl?: string | null;
  floorPlanExtraUrls?: string | null;
  floorPlan3dUrl?: string | null;
  floorPlanScanMeta?: string | null;
};

export type FloorPlanAssetPatch = {
  floorPlanUrl?: string | null;
  floorPlanExtraUrls?: string | null;
  floorPlan3dUrl?: string | null;
  floorPlanScanMeta?: string | null;
};

function truthyFlag(body: Record<string, unknown> | null | undefined, ...keys: string[]): boolean {
  if (!body) return false;
  return keys.some((key) => {
    const value = body[key];
    return value === true || value === 1 || value === 'true' || value === '1';
  });
}

function parseScanMeta(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** True when applying `next` would drop LiDAR geometry that `existing` still has. */
export function wouldDestroyScanGeometry(existingRaw: unknown, nextRaw: unknown): boolean {
  const existing = parseScanMeta(existingRaw);
  const next = parseScanMeta(nextRaw);
  if (!existing) return false;
  if (!next) return true;

  const existingWalls = Array.isArray(existing.walls) ? existing.walls.length : 0;
  const nextWalls = Array.isArray(next.walls) ? next.walls.length : 0;
  const existingRooms = Array.isArray(existing.roomScans) ? existing.roomScans.length : 0;
  const nextRooms = Array.isArray(next.roomScans) ? next.roomScans.length : 0;

  if (existingWalls > 0 && nextWalls === 0) return true;
  if (existingRooms > 0 && nextRooms === 0) return true;
  return false;
}

function serializeExtraUrls(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Resolve floor-plan fields for offer update.
 * - Missing body fields → no patch (keep DB).
 * - null/empty without clear* flag → ignored (keep DB).
 * - Destructive meta downgrade without replace/clear → ignored.
 */
export function resolveFloorPlanAssetPatch(
  body: Record<string, unknown> | null | undefined,
  existing: FloorPlanExistingAssets,
): FloorPlanAssetPatch {
  const clearAll = truthyFlag(body, 'clearFloorPlan', 'floorPlanCleared');
  const clear3d = clearAll || truthyFlag(body, 'clearFloorPlan3d', 'dropServerFloorPlan3d');
  const clearMeta = clearAll || truthyFlag(body, 'clearFloorPlanScanMeta');
  const allowDestructiveReplace = clearMeta || truthyFlag(body, 'replaceFloorPlanScanMeta');

  const patch: FloorPlanAssetPatch = {};

  const floorPlanRaw =
    body && Object.prototype.hasOwnProperty.call(body, 'floorPlanUrl')
      ? body.floorPlanUrl
      : body && Object.prototype.hasOwnProperty.call(body, 'floorPlan')
        ? body.floorPlan
        : undefined;

  if (floorPlanRaw !== undefined) {
    if (floorPlanRaw === null || floorPlanRaw === '') {
      if (clearAll) patch.floorPlanUrl = null;
    } else {
      patch.floorPlanUrl = String(floorPlanRaw);
    }
  } else if (clearAll) {
    patch.floorPlanUrl = null;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'floorPlanExtraUrls')) {
    const extras = body.floorPlanExtraUrls;
    if (extras === null || extras === '' || extras === undefined) {
      if (clearAll) patch.floorPlanExtraUrls = null;
    } else {
      patch.floorPlanExtraUrls = serializeExtraUrls(extras);
    }
  } else if (clearAll) {
    patch.floorPlanExtraUrls = null;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'floorPlan3dUrl')) {
    const model = body.floorPlan3dUrl;
    if (model === null || model === '') {
      if (clear3d) patch.floorPlan3dUrl = null;
    } else {
      patch.floorPlan3dUrl = String(model);
    }
  } else if (clear3d) {
    patch.floorPlan3dUrl = null;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'floorPlanScanMeta')) {
    const meta = body.floorPlanScanMeta;
    if (meta === null || meta === '') {
      if (clearMeta) patch.floorPlanScanMeta = null;
    } else {
      const next = String(meta);
      if (
        existing.floorPlanScanMeta &&
        wouldDestroyScanGeometry(existing.floorPlanScanMeta, next) &&
        !allowDestructiveReplace
      ) {
        // Keep richer existing meta — title/description saves must never strip rooms/walls.
      } else {
        patch.floorPlanScanMeta = next;
      }
    }
  } else if (clearMeta) {
    patch.floorPlanScanMeta = null;
  }

  return patch;
}
