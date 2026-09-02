export type ListingRoomArea = {
  name: string;
  areaSqm: number;
};

function parseArea(raw: unknown): number | null {
  const n = Number(String(raw ?? '').replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

function unwrapJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

function roomFromUnknown(item: unknown): ListingRoomArea | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const area = parseArea(row.areaM2 ?? row.areaSqM ?? row.areaSqm ?? row.area);
  if (area == null) return null;
  const name = String(row.name || row.label || row.title || '').replace(/\s+/g, ' ').trim();
  if (!name) return null;
  return { name, areaSqm: area };
}

function collectFromList(list: unknown): ListingRoomArea[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const rooms: ListingRoomArea[] = [];
  for (const item of list) {
    const room = roomFromUnknown(item);
    if (!room) continue;
    const key = `${room.name.toLowerCase()}|${room.areaSqm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rooms.push(room);
  }
  return rooms;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  const unwrapped = unwrapJson(value) ?? value;
  if (!unwrapped || typeof unwrapped !== 'object' || Array.isArray(unwrapped)) return null;
  return unwrapped as Record<string, unknown>;
}

export function formatListingAreaSqm(value: number | string): string {
  const n = typeof value === 'number' ? value : parseArea(value);
  if (n == null) return '';
  return String(n).replace('.', ',');
}

export function extractListingRoomAreas(source: unknown): ListingRoomArea[] {
  const root = asRecord(source);
  if (!root) {
    const fromArray = collectFromList(unwrapJson(source) ?? source);
    return fromArray.slice(0, 12);
  }

  const meta = asRecord(root.floorPlanScanMeta) || asRecord(root.scanMeta);
  const lists = [
    root.roomAreas,
    root.roomsBreakdown,
    root.propertyRoomScans,
    root.roomScans,
    meta?.roomScans,
    meta?.sections,
  ];

  for (const list of lists) {
    const rooms = collectFromList(list);
    if (rooms.length) return rooms.slice(0, 12);
  }

  return [];
}
