import sharp from 'sharp';
import type { FloorPlanScanMeta } from '@/types/roomScan';
import { detectPlanRooms, normalizeScanMeta } from '@/lib/roomScan/planNormalize';

const ROOM_TINT: Record<string, string> = {
  livingRoom: '#f6eddf',
  bedroom: '#e9eef8',
  room: '#eaf1e6',
  bathroom: '#e4eff6',
  kitchen: '#f6ebe3',
  hallway: '#efeeea',
};

export type SheetPlan = {
  /** Rzut bez napisów (PNG, data URI) — napisy kładzie silnik kartki, tą samą czcionką co reszta. */
  image: string;
  labels: Array<{ x: number; y: number; label: string; area: string; small: boolean }>;
  totalArea: string | null;
};

/** Czysty rzut wektorowy ze skanu LiDAR: wyprostowany, pomieszczenia w kolorach, grube ściany. */
export async function buildSheetPlan(raw: FloorPlanScanMeta | null, width: number, height: number, density = 2): Promise<SheetPlan | null> {
  const meta = normalizeScanMeta(raw);
  if (!meta?.walls?.length) return null;
  const rooms = detectPlanRooms(meta);
  const pad = 14;
  const b = meta.bounds;
  const spanX = Math.max(0.5, b.maxX - b.minX);
  const spanZ = Math.max(0.5, b.maxZ - b.minZ);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanZ);
  const ox = (width - spanX * scale) / 2;
  const oy = (height - spanZ * scale) / 2;
  const X = (x: number) => ox + (x - b.minX) * scale;
  const Y = (z: number) => oy + (z - b.minZ) * scale;
  const wallW = Math.max(3, Math.min(7, scale * 0.12));

  const fills = rooms
    .map((room) => {
      const d = room.rects.map(([x0, z0, x1, z1]) => `M${X(x0).toFixed(1)} ${Y(z0).toFixed(1)}H${X(x1).toFixed(1)}V${Y(z1).toFixed(1)}H${X(x0).toFixed(1)}Z`).join('');
      const tint = ROOM_TINT[room.key] || '#f2f1ee';
      return `<path d="${d}" fill="${tint}" stroke="${tint}" stroke-width="0.6"/>`;
    })
    .join('');
  const walls = meta.walls
    .map((w) => `<line x1="${X(w.x1).toFixed(1)}" y1="${Y(w.z1).toFixed(1)}" x2="${X(w.x2).toFixed(1)}" y2="${Y(w.z2).toFixed(1)}"/>`)
    .join('');
  const windows = (meta.openings || [])
    .filter((o) => o.kind === 'window')
    .map((o) => `<line x1="${X(o.x1).toFixed(1)}" y1="${Y(o.z1).toFixed(1)}" x2="${X(o.x2).toFixed(1)}" y2="${Y(o.z2).toFixed(1)}"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * density}" height="${height * density}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  ${fills}
  <g stroke="#15171a" stroke-width="${wallW}" stroke-linecap="square" stroke-linejoin="miter">${walls}</g>
  <g stroke="#ffffff" stroke-width="${wallW + 1}">${windows}</g>
  <g stroke="#2f6fd8" stroke-width="1.6">${windows}</g>
</svg>`;
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();

  const labels = rooms
    .filter((room) => room.label)
    .map((room) => ({
      x: X(room.labelX),
      y: Y(room.labelZ),
      label: room.label,
      area: `${String(Math.round(room.areaSqM * 10) / 10).replace('.', ',')} m²`,
      small: room.areaSqM < 6,
    }));
  const total = rooms.reduce((sum, room) => sum + (room.label ? room.areaSqM : 0), 0);
  return {
    image: `data:image/png;base64,${png.toString('base64')}`,
    labels,
    totalArea: total > 0 ? `${String(Math.round(total * 10) / 10).replace('.', ',')} m²` : null,
  };
}
