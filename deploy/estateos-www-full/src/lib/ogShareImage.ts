import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

function resolvePublicAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://estateos.pl').replace(
    /\/+$/,
    '',
  );
}

async function readLocalUploadBuffer(url: string): Promise<Buffer | null> {
  const origin = resolvePublicAppOrigin();
  let pathname = '';
  try {
    const u = new URL(url);
    if (u.origin !== origin && !url.includes('estateos.pl')) return null;
    pathname = u.pathname;
  } catch {
    if (url.startsWith('/uploads/')) pathname = url;
    else return null;
  }
  if (!pathname.startsWith('/uploads/')) return null;

  const candidates = [
    path.join(process.cwd(), 'public', pathname.replace(/^\//, '')),
    path.join(process.cwd(), pathname.replace(/^\//, '')),
    path.join('/var/www/estateos', 'public', pathname.replace(/^\//, '')),
    path.join(process.env.HOME || '', 'estateos', 'public', pathname.replace(/^\//, '')),
  ];

  for (const candidate of candidates) {
    try {
      const buf = await fs.readFile(candidate);
      if (buf.length) return buf;
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Satori (next/og ImageResponse) nie renderuje WebP w <img>.
 * Pobieramy zdjęcie (prefer lokalny plik uploadów) i konwertujemy do JPEG data-URI.
 */
export async function fetchImageAsJpegDataUrl(
  url: string,
  opts?: { width?: number; height?: number; quality?: number },
): Promise<string | null> {
  const raw = String(url || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:image/')) return raw;

  try {
    let buf = await readLocalUploadBuffer(raw);

    if (!buf) {
      const res = await fetch(raw, {
        headers: {
          Accept: 'image/*,*/*',
          'User-Agent': 'EstateOS-OG/1.0',
        },
        cache: 'force-cache',
      });
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    }

    if (!buf?.length) return null;

    const width = opts?.width ?? 1200;
    const height = opts?.height ?? 630;
    const quality = opts?.quality ?? 84;

    const jpeg = await sharp(buf)
      .rotate()
      .resize(width, height, { fit: 'cover', position: 'attention' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return null;
  }
}
