'use client';

import { useEffect, useState } from 'react';

export type RoomColors = { floor: number; wall: number };

/** Średni kolor fragmentu zdjęcia (pomija prześwietlenia — okna — i głębokie cienie). */
function averageRegion(data: Uint8ClampedArray, w: number, y0: number, y1: number, x0: number, x1: number): [number, number, number] | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * w + x) * 4;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (lum > 242 || lum < 18) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
  }
  return n > 20 ? [r / n, g / n, b / n] : null;
}

async function sample(src: string): Promise<{ floor: [number, number, number] | null; wall: [number, number, number] | null }> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('img'));
    img.src = src;
  });
  const W = 64;
  const H = 48;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { floor: null, wall: null };
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  // Podłoga: dolny pas kadru, środek. Ściana: górna połowa, boki (środek to zwykle okno lub meble).
  const floor = averageRegion(data, W, Math.round(H * 0.8), H, Math.round(W * 0.2), Math.round(W * 0.8));
  const left = averageRegion(data, W, Math.round(H * 0.12), Math.round(H * 0.45), 0, Math.round(W * 0.22));
  const right = averageRegion(data, W, Math.round(H * 0.12), Math.round(H * 0.45), Math.round(W * 0.78), W);
  const wall = left && right ? (left.map((v, i) => (v + right[i]) / 2) as [number, number, number]) : left || right;
  return { floor, wall };
}

/** Rozjaśnia kolor ze zdjęcia (zdjęcia są ciemniejsze niż oświetlony model 3D) i pakuje do 0xRRGGBB. */
function toHex(rgb: [number, number, number], lift: number): number {
  const [r, g, b] = rgb.map((v) => Math.round(Math.min(255, v + (255 - v) * lift)));
  return (r << 16) | (g << 8) | b;
}

/**
 * Kolory wnętrz do spaceru 3D: podłoga i ściany każdego pokoju odczytane z jego zdjęć.
 * Klucz = nazwa pomieszczenia małymi literami (jak na rzucie).
 */
export function useRoomPhotoColors(groups: Array<{ room: string; urls: string[] }>): Record<string, RoomColors> {
  const [colors, setColors] = useState<Record<string, RoomColors>>({});
  const key = groups.map((g) => `${g.room}:${g.urls.slice(0, 2).join(',')}`).join('|');
  useEffect(() => {
    if (!groups.length) return;
    let alive = true;
    (async () => {
      const out: Record<string, RoomColors> = {};
      for (const group of groups) {
        const samples = await Promise.all(group.urls.slice(0, 2).map((src) => sample(src).catch(() => ({ floor: null, wall: null }))));
        const floors = samples.map((s) => s.floor).filter(Boolean) as Array<[number, number, number]>;
        const walls = samples.map((s) => s.wall).filter(Boolean) as Array<[number, number, number]>;
        const avg = (list: Array<[number, number, number]>) =>
          list.length ? (list.reduce((acc, c) => acc.map((v, i) => v + c[i] / list.length) as [number, number, number], [0, 0, 0] as [number, number, number])) : null;
        const floor = avg(floors);
        const wall = avg(walls);
        if (floor || wall) {
          out[group.room.toLocaleLowerCase('pl')] = {
            floor: floor ? toHex(floor, 0.18) : 0xeadfcf,
            wall: wall ? toHex(wall, 0.35) : 0xf8fafc,
          };
        }
      }
      if (alive) setColors(out);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return colors;
}
