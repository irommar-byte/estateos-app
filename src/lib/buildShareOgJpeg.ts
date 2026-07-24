import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { loadOfferShareCard } from '@/lib/offerShareLanding';
import { loadCarShareMeta } from '@/lib/carShareLanding';

/** Bump when layout/copy of OG card changes — busts FB + disk cache. */
export const OG_CARD_VERSION = 'v5';

function resolvePublicAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://estateos.pl').replace(
    /\/+$/,
    '',
  );
}

function cacheDir(): string {
  return path.join(process.cwd(), 'public', 'uploads', 'og-cache');
}

function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(value: string, max: number): string {
  const s = String(value || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
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
    path.join(process.env.HOME || '', 'estateos', 'public', pathname.replace(/^\//, '')),
  ];

  for (const candidate of candidates) {
    try {
      const buf = await fs.readFile(candidate);
      if (buf.length) return buf;
    } catch {
      /* next */
    }
  }
  return null;
}

async function loadPhotoBuffer(url: string): Promise<Buffer | null> {
  const raw = String(url || '').trim();
  if (!raw) return null;
  const local = await readLocalUploadBuffer(raw);
  if (local) return local;
  try {
    const res = await fetch(raw, {
      headers: { Accept: 'image/*,*/*', 'User-Agent': 'EstateOS-OG/1.0' },
      cache: 'force-cache',
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

function buildOverlaySvg(params: {
  brand: string;
  brandColor: string;
  title: string;
  subtitle: string;
  price: string;
  priceBg: string;
  priceBorder: string;
  priceLabelColor: string;
  priceValueColor: string;
}): Buffer {
  const title = escapeXml(truncate(params.title, 58));
  const subtitle = escapeXml(truncate(params.subtitle, 72));
  const price = escapeXml(params.price);
  const brand = escapeXml(params.brand);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="55%" stop-color="#0f172a" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.45"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#wash)"/>
  <rect x="36" y="402" width="1128" height="192" rx="28" fill="#ffffff" fill-opacity="0.96"/>
  <text x="68" y="448" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="16" font-weight="700" letter-spacing="3.2" fill="${params.brandColor}">${brand}</text>
  <text x="68" y="498" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="36" font-weight="700" fill="#0f172a">${title}</text>
  <text x="68" y="536" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="22" font-weight="600" fill="#475569">${subtitle}</text>
  ${
    price
      ? `<rect x="860" y="448" width="280" height="100" rx="18" fill="${params.priceBg}" stroke="${params.priceBorder}" stroke-width="2"/>
  <text x="1000" y="486" text-anchor="middle" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="14" font-weight="700" letter-spacing="1.5" fill="${params.priceLabelColor}">CENA</text>
  <text x="1000" y="528" text-anchor="middle" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="${params.priceValueColor}">${price}</text>`
      : ''
  }
</svg>`;

  return Buffer.from(svg);
}

async function composeOgJpeg(photoUrl: string, overlay: Buffer, fallbackGradient: string): Promise<Buffer> {
  const photo = await loadPhotoBuffer(photoUrl);
  let base: sharp.Sharp;
  if (photo) {
    base = sharp(photo).rotate().resize(1200, 630, { fit: 'cover', position: 'attention' });
  } else {
    base = sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 3,
        background: fallbackGradient,
      },
    });
  }

  return base
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 78, mozjpeg: true, chromaSubsampling: '4:2:0' })
    .toBuffer();
}

async function readCache(filePath: string): Promise<Buffer | null> {
  try {
    const buf = await fs.readFile(filePath);
    return buf.length > 1000 ? buf : null;
  } catch {
    return null;
  }
}

async function writeCache(filePath: string, buf: Buffer): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buf);
  } catch {
    /* non-fatal */
  }
}

export function offerOgPublicUrl(offerId: number): string {
  return `${resolvePublicAppOrigin()}/api/og/offer/${offerId}?${OG_CARD_VERSION}`;
}

export function carOgPublicUrl(carId: number): string {
  return `${resolvePublicAppOrigin()}/api/og/car/${carId}?${OG_CARD_VERSION}`;
}

export async function getOfferOgJpeg(offerId: number): Promise<Buffer | null> {
  if (!Number.isFinite(offerId) || offerId <= 0) return null;
  const filePath = path.join(cacheDir(), `offer-${offerId}-${OG_CARD_VERSION}.jpg`);
  const cached = await readCache(filePath);
  if (cached) return cached;

  const card = await loadOfferShareCard(offerId);
  if (!card) return null;

  const overlay = buildOverlaySvg({
    brand: 'ESTATEOS™',
    brandColor: '#0f766e',
    title: card.title,
    subtitle: card.summaryLine,
    price: card.priceLabel,
    priceBg: '#ecfdf5',
    priceBorder: '#a7f3d0',
    priceLabelColor: '#047857',
    priceValueColor: '#065f46',
  });

  const jpeg = await composeOgJpeg(card.imageUrl, overlay, '#e0f2fe');
  await writeCache(filePath, jpeg);
  return jpeg;
}

export async function getCarOgJpeg(carId: number): Promise<Buffer | null> {
  if (!Number.isFinite(carId) || carId <= 0) return null;
  const filePath = path.join(cacheDir(), `car-${carId}-${OG_CARD_VERSION}.jpg`);
  const cached = await readCache(filePath);
  if (cached) return cached;

  const meta = await loadCarShareMeta(carId);
  if (!meta) return null;

  const overlay = buildOverlaySvg({
    brand: 'ESTATEOS™CAR',
    brandColor: '#0284c7',
    title: meta.title,
    subtitle: meta.ogDescription.split('.')[0] || meta.locationLabel,
    price: meta.priceLabel,
    priceBg: '#eff6ff',
    priceBorder: '#bfdbfe',
    priceLabelColor: '#1d4ed8',
    priceValueColor: '#1e3a8a',
  });

  const jpeg = await composeOgJpeg(meta.photoUrl, overlay, '#e0f2fe');
  await writeCache(filePath, jpeg);
  return jpeg;
}
